import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.
const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  purpose: Joi.string().allow('').optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string().hex().length(24)
});

function validateDateOrder(startDate, endDate) {
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return 'startDate must be before endDate';
  }
  return null;
}

async function hasConflict(roomNumber, startDate, endDate, excludeId) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };
  if (excludeId) query._id = { $ne: excludeId };
  const conflict = await Booking.findOne(query);
  return !!conflict;
}

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    // TODO
    const bookings = await Booking.find()
      .sort({ startDate: 1 })
      .populate('bookedBy', 'name email');
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    // TODO
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const dateError = validateDateOrder(value.startDate, value.endDate);
    if (dateError) return res.status(400).json({ message: dateError });

    if (await hasConflict(value.roomNumber, value.startDate, value.endDate)) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking for this room' });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    // TODO
     const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    // Fall back to the existing document's own values for any field
    // not included in this PATCH, so the conflict/date checks below
    // always compare a complete, valid range.
    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate = value.startDate ?? existing.startDate;
    const endDate = value.endDate ?? existing.endDate;

    const dateError = validateDateOrder(startDate, endDate);
    if (dateError) return res.status(400).json({ message: dateError });

    if (await hasConflict(roomNumber, startDate, endDate, existing._id)) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking for this room' });
    }

    const doc = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );
    res.json({ booking: doc });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    // TODO
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });

  } catch (err) { next(err); }
}
