import { Booking } from '../models/Booking.js';
import Joi from 'joi';

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date()
    .greater(Joi.ref('startDate'))
    .required()
    .messages({ 'date.greater': '"endDate" must be later than "startDate"' }),
  purpose: Joi.string(),
  bookedBy: Joi.string()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date()
    .greater(Joi.ref('startDate'))
    .messages({ 'date.greater': '"endDate" must be later than "startDate"' }),
  purpose: Joi.string()
});

// Helper: check for range overlap on the same room.
// Two ranges overlap when: existingStart < newEnd AND existingEnd > newStart.
// Pass excludeId to skip the booking being updated (so it doesn't conflict with itself).
async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await Booking.findOne(query);
  return existing !== null;
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email')
      .sort({ startDate: 1 })
      .lean();
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    return res.status(200).json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await hasConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) return res.status(409).json({ message: 'Room is already booked for an overlapping time range' });

    const booking = await Booking.create({
      roomNumber: value.roomNumber,
      startDate: value.startDate,
      endDate: value.endDate,
      purpose: value.purpose,
      bookedBy: value.bookedBy
    });
    return res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    // Fetch existing booking to merge any unchanged date/room fields before conflict check
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate  = value.startDate  ?? existing.startDate;
    const endDate    = value.endDate    ?? existing.endDate;

    // Exclude the current booking from the conflict check so it doesn't conflict with itself
    const conflict = await hasConflict(roomNumber, startDate, endDate, req.params.id);
    if (conflict) return res.status(409).json({ message: 'Room is already booked for an overlapping time range' });

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');

    return res.status(200).json({ booking: updated });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    return res.status(200).json({ ok: true });
  } catch (err) { next(err); }
}
