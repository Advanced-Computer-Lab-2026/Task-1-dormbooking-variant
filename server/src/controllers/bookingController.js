import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24)
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24)
});

async function checkConflict(roomNumber, start, end, excludeBookingId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: end },
    endDate: { $gt: start }
  };
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  return Booking.findOne(query);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().sort({ startDate: 1 }).populate('bookedBy', 'name email').lean();
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

    const conflict = await checkConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) return res.status(409).json({ message: 'Room is already booked for this time range' });

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const doc = await Booking.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });

    const newRoomNumber = value.roomNumber || doc.roomNumber;
    const newStartDate = value.startDate || doc.startDate;
    const newEndDate = value.endDate || doc.endDate;

    if (new Date(newStartDate) >= new Date(newEndDate)) {
      return res.status(400).json({ message: 'startDate must be strictly before endDate' });
    }

    const conflict = await checkConflict(newRoomNumber, newStartDate, newEndDate, doc._id);
    if (conflict) return res.status(409).json({ message: 'Room is already booked for this time range' });

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );

    res.json({ booking: updated });
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
