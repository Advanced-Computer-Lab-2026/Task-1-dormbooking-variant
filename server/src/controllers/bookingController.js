import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  purpose: Joi.string().allow('').optional(),
  bookedBy: Joi.string().hex().length(24).optional() // ObjectId as hex string
}).custom((value, helpers) => {
  if (new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'startDate before endDate').messages({
  'any.invalid': 'startDate must be strictly before endDate'
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string().hex().length(24)
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'startDate before endDate').messages({
  'any.invalid': 'startDate must be strictly before endDate'
});

async function findConflict({ roomNumber, startDate, endDate }, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return Booking.findOne(query);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().sort({ startDate: 1 });
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await findConflict(value);
    if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing reservation for this room' });

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const proposed = {
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate
    };

    const conflict = await findConflict(proposed, existing._id);
    if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing reservation for this room' });

    const booking = await Booking.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    res.json({ booking });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
