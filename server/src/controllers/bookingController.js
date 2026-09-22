import Joi from 'joi';
import { Booking } from '../models/Booking.js';




const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'endDate must be strictly after startDate'
  }),
  purpose: Joi.string().allow('', null).optional(),
  bookedBy: Joi.string().hex().length(24).allow(null).optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

async function hasRoomConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await Booking.findOne(query);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).lean().populate('bookedBy');
    res.json({bookings: bookings});
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy');
    if (!booking) return res.status(404).json({message: 'Booking not found'});
    res.json({booking: booking});
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await hasRoomConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for this time period' });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    // Determine the new range (either updated field or existing value)
    const effectiveRoom = value.roomNumber || existing.roomNumber;
    const effectiveStart = value.startDate ? new Date(value.startDate) : existing.startDate;
    const effectiveEnd = value.endDate ? new Date(value.endDate) : existing.endDate;

    if (effectiveStart >= effectiveEnd) {
      return res.status(400).json({ message: 'endDate must be strictly after startDate' });
    }

    // Check for conflict with other bookings on that room
    const conflict = await hasRoomConflict(effectiveRoom, effectiveStart, effectiveEnd, existing._id);
    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for this time period' });
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy');

    res.json({ booking: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
