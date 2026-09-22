import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const createSchema = Joi.object({
  roomNumber: Joi.string().trim().min(1).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  purpose: Joi.string().trim().allow('', null),
  bookedBy: Joi.string().hex().length(24) // Mongo ObjectId as a 24-char hex string
}).custom((value, helpers) => {
  if (new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.message('"startDate" must be strictly before "endDate"');
  }
  return value;
});

const updateSchema = Joi.object({
  roomNumber: Joi.string().trim().min(1),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string().trim().allow('', null),
  bookedBy: Joi.string().hex().length(24)
})
  .with('startDate', 'endDate')
  .with('endDate', 'startDate')
  .custom((value, helpers) => {
    if (value.startDate && value.endDate && new Date(value.startDate) >= new Date(value.endDate)) {
      return helpers.message('"startDate" must be strictly before "endDate"');
    }
    return value;
  });
  function serializeBooking(b) {
  return {
    id: b._id.toString(),
    roomNumber: b.roomNumber,
    startDate: b.startDate,
    endDate: b.endDate,
    purpose: b.purpose ?? null,
    bookedBy: b.bookedBy && b.bookedBy._id
      ? { id: b.bookedBy._id.toString(), name: b.bookedBy.name, email: b.bookedBy.email }
      : (b.bookedBy ? b.bookedBy.toString() : null),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt
  };
}

// Two ranges [startA, endA) and [startB, endB) overlap exactly when
// startA < endB AND startB < endA — the standard interval-overlap test.
async function findConflict({ roomNumber, startDate, endDate, excludeId }) {
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
    const bookings = await Booking.find()
      .sort({ startDate: 1 })
      .populate('bookedBy', 'name email');
    res.json({ bookings: bookings.map(serializeBooking) });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking: serializeBooking(booking) });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await findConflict({
      roomNumber: value.roomNumber,
      startDate: value.startDate,
      endDate: value.endDate
    });
    if (conflict) {
      return res.status(409).json({ message: 'This room is already booked for an overlapping time range' });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking: serializeBooking(booking) });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const merged = {
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate
    };
    if (new Date(merged.startDate) >= new Date(merged.endDate)) {
      return res.status(400).json({ message: '"startDate" must be strictly before "endDate"' });
    }

    const conflict = await findConflict({ ...merged, excludeId: existing._id });
    if (conflict) {
      return res.status(409).json({ message: 'This room is already booked for an overlapping time range' });
    }

    const doc = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');
    res.json({ booking: serializeBooking(doc) });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}