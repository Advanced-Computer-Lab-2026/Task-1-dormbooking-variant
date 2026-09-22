import { Booking } from '../models/Booking.js';
import mongoose from 'mongoose';
import Joi from 'joi';

const createSchema = Joi.object({
  roomNumber: Joi.string().trim().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  purpose: Joi.string().allow('').optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string().trim(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string().hex().length(24).allow(null)
}).min(1);

function validateDateRange(startDate, endDate) {
  if (new Date(startDate) >= new Date(endDate)) {
    return 'startDate must be before endDate';
  }
}

async function findConflict({ roomNumber, startDate, endDate, excludeId }) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };

  if (excludeId) query._id = { $ne: excludeId };
  return Booking.findOne(query);
}

function validateId(id, res) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: 'Invalid booking id' });
    return false;
  }
  return true;
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email')
      .sort({ startDate: 1 });
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    if (!validateId(req.params.id, res)) return;

    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
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

    const dateError = validateDateRange(value.startDate, value.endDate);
    if (dateError) return res.status(400).json({ message: dateError });

    const conflict = await findConflict(value);
    if (conflict) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking' });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    if (!validateId(req.params.id, res)) return;

    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const nextBooking = {
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate
    };
    const dateError = validateDateRange(nextBooking.startDate, nextBooking.endDate);
    if (dateError) return res.status(400).json({ message: dateError });

    const conflict = await findConflict({
      ...nextBooking,
      excludeId: existing._id
    });
    if (conflict) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking' });
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
    if (!validateId(req.params.id, res)) return;

    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
