import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.
const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional(),
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional(),
});

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

function publicBooking(b) {
  const bookedBy = b.bookedBy?.name
    ? { id: b.bookedBy._id.toString(), name: b.bookedBy.name, email: b.bookedBy.email }
    : b.bookedBy;

  return { id: b._id.toString(), roomNumber: b.roomNumber, startDate: b.startDate, endDate: b.endDate, purpose: b.purpose, bookedBy, createdAt: b.createdAt };
}

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    // TODO
    const bookings = await Booking.find().populate('bookedBy').sort({ createdAt: -1 }).lean();
    res.json({ bookings: bookings.map(publicBooking) });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    // TODO
    const booking = await Booking.findById(req.params.id).populate('bookedBy');
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      res.json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    // TODO
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // Validating if another booking exists with an overlapping date range for that same room number
    const existing = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate }
    });
    if (existing) return res.status(409).json({ message: 'Booking already exists in that date range' });

    const booking = await Booking.create(value);
    res.status(201).json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    // TODO
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const current = await Booking.findById(req.params.id);

    if (!current) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const proposed = {
      roomNumber: value.roomNumber ?? current.roomNumber,
      startDate: value.startDate ?? current.startDate,
      endDate: value.endDate ?? current.endDate,
      purpose: value.purpose ?? current.purpose,
      bookedBy: value.bookedBy ?? current.bookedBy
    };

    const dateError = createSchema.validate(proposed).error;

    if (dateError) {
      return res.status(400).json({ message: dateError.message });
    }

    const existing = await Booking.findOne({
      _id: { $ne: current._id },
      roomNumber: proposed.roomNumber,
      startDate: { $lt: proposed.endDate },
      endDate: { $gt: proposed.startDate }
    });

    if (existing) {
      return res.status(409).json({
        message: 'Booking already exists in that date range'
      });
    }

    const doc = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: proposed },
      { new: true, runValidators: true }
    );

    res.json({ booking: publicBooking(doc) });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    // TODO
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
