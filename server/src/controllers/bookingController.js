import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// Validation schema for creation — per README.md section 2.
// startDate must be strictly before endDate; Joi.ref checks this explicitly.
const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().allow('', null),
  bookedBy: Joi.string().allow('', null)
});

// Validation schema for updates — every field optional, since PATCH may only
// change one field. If both dates are present together, still enforce order.
const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().allow('', null),
  bookedBy: Joi.string().allow('', null)
});

// Per README.md section 4: two bookings on the same room conflict if their
// date ranges overlap. One range overlaps another if it starts before the
// other ends AND ends after the other starts.
async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };
  if (excludeId) query._id = { $ne: excludeId }; // so update doesn't conflict with itself
  const conflict = await Booking.findOne(query);
  return !!conflict;
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().populate('bookedBy', 'name email');
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
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await hasConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) return res.status(409).json({ message: 'This room is already booked for that time range' });

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

    // Merge the incoming partial update with the existing booking's values,
    // so conflict detection always checks against the *final* real date range —
    // not undefined fields that were never sent in this PATCH request.
    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate = value.startDate ?? existing.startDate;
    const endDate = value.endDate ?? existing.endDate;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    const conflict = await hasConflict(roomNumber, startDate, endDate, req.params.id);
    if (conflict) return res.status(409).json({ message: 'This room is already booked for that time range' });

    const doc = await Booking.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    res.json({ booking: doc });
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