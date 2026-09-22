import Joi from 'joi';
import { Booking } from '../models/Booking.js';

//function to check date validity used by both create and update
function validRange(value, helpers) {
  if (new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.message('startDate must be strictly before endDate');
  }
  return value;
}

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional()
}).custom(validRange, 'startDate before endDate');

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24)
})
  .custom((value, helpers) => {
    if (value.startDate && value.endDate) return validRange(value, helpers);
    return value;
  }, 'startDate before endDate')
  .min(1);

// Two ranges [aStart, aEnd) and [bStart, bEnd) overlap iff aStart < bEnd && bStart < aEnd.
// excludeId lets update check for conflicts against every OTHER booking without
// tripping over the booking being updated itself.
async function hasConflict(roomNumber, startDate, endDate, excludeId) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };
  if (excludeId) query._id = { $ne: excludeId };
  const conflict = await Booking.findOne(query);
  return Boolean(conflict);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().sort({ startDate: 1 }).populate('bookedBy');
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await hasConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing booking on this room' });

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

    // Merge onto the existing doc so a partial update (e.g. only startDate)
    // is still checked against the full, correct range.
    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate = value.startDate ?? existing.startDate;
    const endDate = value.endDate ?? existing.endDate;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'startDate must be strictly before endDate' });
    }

    const conflict = await hasConflict(roomNumber, startDate, endDate, existing._id);
    if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing booking on this room' });

    const booking = await Booking.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    res.json({ booking });
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
