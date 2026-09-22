import mongoose from 'mongoose';
import Joi from 'joi';
import { Booking } from '../models/Booking.js';



// Full schema, used for create. startDate < endDate is enforced explicitly
// via .custom(), since Joi can't infer an ordering relationship between
// two independently-typed date fields.
const createSchema = Joi.object({
  roomNumber: Joi.string().trim().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  purpose: Joi.string().trim().allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null, ''),
}).custom((value, helpers) => {
  if (new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.message('"startDate" must be strictly before "endDate"');
  }
  return value;
}, 'start-before-end validation');

// Partial schema for PATCH — every field optional, at least one required.
// The start < end check can't happen here in isolation, since a PATCH
// might only send one of the two date fields — it happens in
// updateBooking() after merging onto the existing document.
const updateSchema = Joi.object({
  roomNumber: Joi.string().trim(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string().trim().allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null, ''),
}).min(1);

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

// --- Conflict detection ---
// Two ranges overlap unless one ends at-or-before the other starts.
// Negating that: existing.startDate < proposed.endDate AND
// existing.endDate > proposed.startDate. Strict comparisons mean a
// booking ending at 3pm and one starting at 3pm do NOT conflict.
// excludeId lets an update ignore the booking being updated.
async function findConflict(roomNumber, startDate, endDate, excludeId) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
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
      .populate('bookedBy', 'name email')
      .sort({ startDate: 1 });
    res.json(bookings);
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw httpError(400, 'Invalid booking id');
    }

    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) {
      throw httpError(404, 'Booking not found');
    }
    res.json(booking);
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { error, value } = createSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw httpError(400, 'Validation failed', error.details.map((d) => d.message));
    }

    const conflict = await findConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) {
      throw httpError(409, 'This booking overlaps an existing booking for that room.', {
        conflictingBooking: conflict,
      });
    }

    const booking = await Booking.create(value);
    res.status(201).json(booking);
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw httpError(400, 'Invalid booking id');
    }

    const existing = await Booking.findById(id);
    if (!existing) {
      throw httpError(404, 'Booking not found');
    }

    const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw httpError(400, 'Validation failed', error.details.map((d) => d.message));
    }

    // Merge onto the existing doc so we validate/conflict-check the
    // *effective* range, not just whatever partial fields were sent.
    const merged = {
      roomNumber: value.roomNumber !== undefined ? value.roomNumber : existing.roomNumber,
      startDate: value.startDate !== undefined ? value.startDate : existing.startDate,
      endDate: value.endDate !== undefined ? value.endDate : existing.endDate,
      purpose: value.purpose !== undefined ? value.purpose : existing.purpose,
      bookedBy: value.bookedBy !== undefined ? value.bookedBy : existing.bookedBy,
    };

    if (new Date(merged.startDate) >= new Date(merged.endDate)) {
      throw httpError(400, 'Validation failed', ['"startDate" must be strictly before "endDate"']);
    }

    const conflict = await findConflict(merged.roomNumber, merged.startDate, merged.endDate, id);
    if (conflict) {
      throw httpError(409, 'This booking overlaps an existing booking for that room.', {
        conflictingBooking: conflict,
      });
    }

    const updated = await Booking.findByIdAndUpdate(id, merged, {
      new: true,
      runValidators: true,
    }).populate('bookedBy', 'name email');

    res.json(updated);
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw httpError(400, 'Invalid booking id');
    }

    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) {
      throw httpError(404, 'Booking not found');
    }
    res.status(204).send();
  } catch (err) { next(err); }
}