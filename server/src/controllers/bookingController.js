import { Booking } from '../models/Booking.js';
import Joi from 'joi';

// ---- Validation schemas (README.md section 2) ----

export const createBookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required().greater(Joi.ref('startDate')).messages({
    'date.greater': 'endDate must be strictly after startDate',
  }),
  purpose: Joi.string().allow('', null),
  bookedBy: Joi.string().hex().length(24), // ObjectId as string, optional
});

export const updateBookingSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date().greater(Joi.ref('startDate')),
  purpose: Joi.string().allow('', null),
  bookedBy: Joi.string().hex().length(24),
}).min(1); // require at least one field on update

// ---- Conflict detection (README.md section 4) ----
// Two ranges [startA, endA) and [startB, endB) overlap iff startA < endB AND startB < endA.
// excludeId lets update-checks skip comparing the booking against itself.
async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const conflict = await Booking.findOne(query);
  return !!conflict;
}

// ---- Controllers (README.md sections 3, 4, 5) ----

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().populate('bookedBy', 'name email');
    res.json(bookings);
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
     const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { error, value } = createBookingSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map(d => d.message) });
    }

    const conflict = await hasConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking for this room' });
    }

    const booking = await Booking.create(value);
    res.status(201).json(booking);
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { error, value } = updateBookingSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map(d => d.message) });
    }

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    // merge incoming fields onto the existing doc so partial updates
    // still get compared against the real stored values
    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate = value.startDate ?? existing.startDate;
    const endDate = value.endDate ?? existing.endDate;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'endDate must be strictly after startDate' });
    }

    const conflict = await hasConflict(roomNumber, startDate, endDate, existing._id);
    if (conflict) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking for this room' });
    }

    const updated = await Booking.findByIdAndUpdate(req.params.id, value, { new: true });
    res.json(updated);
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Booking not found' });
    res.status(204).send();
  } catch (err) { next(err); }
}