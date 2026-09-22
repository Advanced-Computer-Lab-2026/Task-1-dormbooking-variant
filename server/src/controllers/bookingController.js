import { Booking } from '../models/Booking.js';
import Joi from 'joi';

// TODO: write a validation schema for create/update per README.md section 2.

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().max(200),
  bookedBy: Joi.string()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date().greater(Joi.ref('startDate')),
  purpose: Joi.string().max(200)
});

function publicbooking( u) {
  return { id: u._id.toString(), roomNumber: u.roomNumber, startDate: u.startDate, endDate: u.endDate, purpose: u.purpose, bookedBy: u.bookedBy, createdAt: u.createdAt };
}
// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const booking = await Booking.find().populate('bookedBy');
    res.json({ booking: booking.map(publicbooking) });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
     const booking = await Booking.findById(req.params.id).populate('bookedBy');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        res.json({ booking: publicbooking(booking) });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
      const { value, error } = createSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.message });
    
        const existing = await Booking.findOne({ roomNumber: value.roomNumber,
          $or: [
            { startDate: { $lte: value.endDate, $gte: value.startDate } },
            { endDate: { $gte: value.startDate, $lte: value.endDate } }
          ]
        });
        if (existing) return res.status(409).json({ message: 'Room is already booked for the selected period' });

        const booking = await Booking.create(value);
        res.status(201).json({ booking: publicbooking(booking) });
      } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    // 1. Fetch the existing booking
    const current = await Booking.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Booking not found' });

    // 2. Merge old + new so nothing is undefined
    const merged = {
      roomNumber: value.roomNumber ?? current.roomNumber,
      startDate:  value.startDate  ?? current.startDate,
      endDate:    value.endDate    ?? current.endDate
    };

    // 3. Overlap check using merged values
    const existing = await Booking.findOne({
      _id: { $ne: req.params.id },
      roomNumber: merged.roomNumber,
      $or: [
        { startDate: { $lte: merged.endDate, $gte: merged.startDate } },
        { endDate:   { $gte: merged.startDate, $lte: merged.endDate } }
      ]
    });
    if (existing) {
      return res.status(409).json({ message: 'Room is already booked for the selected period' });
    }

    // 4. Apply the update
    const doc = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy');

    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking: publicbooking(doc) });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) { next(err); }
}
