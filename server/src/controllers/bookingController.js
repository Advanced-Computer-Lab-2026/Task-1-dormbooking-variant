import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const bookingBodySchema = Joi.object({
  roomNumber: Joi.string().trim().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  purpose: Joi.string().trim().allow('').optional(),
  bookedBy: Joi.string().pattern(/^[a-fA-F0-9]{24}$/).optional()
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.message('"startDate" must be strictly before "endDate"');
  }
  return value;
}, 'date range ordering');

const updateBookingSchema = bookingBodySchema.keys({
  roomNumber: Joi.string().trim().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  purpose: Joi.string().trim().allow('').optional(),
  bookedBy: Joi.string().pattern(/^[a-fA-F0-9]{24}$/).optional()
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.message('"startDate" must be strictly before "endDate"');
  }
  return value;
}, 'date range ordering').min(1);

async function hasConflict({ roomNumber, startDate, endDate, excludeId = null }) {
  const query = {
    roomNumber,
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Boolean(await Booking.exists(query));
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().sort({ startDate: 1 }).populate('bookedBy', 'name email');
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = bookingBodySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    if (await hasConflict(value)) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking in the same room.' });
    }

    const booking = await Booking.create(value);
    const populatedBooking = await booking.populate('bookedBy', 'name email');
    res.status(201).json({ booking: populatedBooking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const merged = {
      ...existing.toObject(),
      ...value,
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate
    };

    if (await hasConflict({
      roomNumber: merged.roomNumber,
      startDate: merged.startDate,
      endDate: merged.endDate,
      excludeId: existing._id
    })) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking in the same room.' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');

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
