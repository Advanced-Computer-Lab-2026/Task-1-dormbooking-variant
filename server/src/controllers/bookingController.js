import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// -----------------------------------------------------------------------------
// 1. Validation Schemas
// -----------------------------------------------------------------------------
const createBookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

const updateBookingSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24)
});

// -----------------------------------------------------------------------------
// 2. Conflict Detection Helper
// -----------------------------------------------------------------------------
async function checkConflict(roomNumber, startDate, endDate, excludeBookingId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) }
  };

  // On PATCH / update, ignore the current booking to prevent self-conflict
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return await Booking.findOne(query);
}

// -----------------------------------------------------------------------------
// 3. Controller Routes
// -----------------------------------------------------------------------------

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createBookingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { roomNumber, startDate, endDate } = value;

    // Check range overlap
    const conflict = await checkConflict(roomNumber, startDate, endDate);
    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for the selected time range' });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Combine proposed values with existing values to check true target range
    const targetRoom = value.roomNumber ?? booking.roomNumber;
    const targetStart = value.startDate ?? booking.startDate;
    const targetEnd = value.endDate ?? booking.endDate;

    // Verify startDate is strictly before endDate after merging target values
    if (new Date(targetStart) >= new Date(targetEnd)) {
      return res.status(400).json({ message: 'endDate must be strictly after startDate' });
    }

    // Check conflict excluding the current booking ID
    const conflict = await checkConflict(targetRoom, targetStart, targetEnd, req.params.id);
    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for the updated time range' });
    }

    Object.assign(booking, value);
    await booking.save();

    // Populate bookedBy before sending back
    await booking.populate('bookedBy', 'name email');

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