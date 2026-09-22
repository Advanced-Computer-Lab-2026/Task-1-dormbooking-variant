import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24)
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && value.endDate <= value.startDate) {
    return helpers.error('date.order');
  }

  return value;
})
.messages({
  'date.order': 'endDate must be strictly after startDate'
});

function publicBooking(booking) {
  return {
    id: booking._id.toString(),
    roomNumber: booking.roomNumber,
    startDate: booking.startDate,
    endDate: booking.endDate,
    purpose: booking.purpose,
    bookedBy: booking.bookedBy,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt
  };
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ bookings: bookings.map(publicBooking) });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate }
    });
    if (existing) return res.status(409).json({ message: 'Booking conflicts with an existing booking' });

    const booking = await Booking.create(value);
    res.status(201).json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const current = await Booking.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Booking not found' });

    const proposed = {
      roomNumber: value.roomNumber ?? current.roomNumber,
      startDate: value.startDate ?? current.startDate,
      endDate: value.endDate ?? current.endDate
    };
    if (proposed.endDate <= proposed.startDate) {
      return res.status(400).json({ message: 'endDate must be strictly after startDate' });
    }

    const existing = await Booking.findOne({
      _id: { $ne: current._id },
      roomNumber: proposed.roomNumber,
      startDate: { $lt: proposed.endDate },
      endDate: { $gt: proposed.startDate }
    });
    if (existing) return res.status(409).json({ message: 'Booking conflicts with an existing booking' });

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');
    res.json({ booking: publicBooking(booking) });
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
