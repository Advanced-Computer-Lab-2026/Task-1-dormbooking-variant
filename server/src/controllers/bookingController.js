import { Booking } from '../models/Booking.js';
import Joi from 'joi';

const bookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date()
    .required()
    .less(Joi.ref('endDate'))
    .messages({
      'date.less': 'startDate must be strictly before endDate',
    }),
  endDate: Joi.date().required(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().optional(),
});

const updateBookingSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date().less(Joi.ref('endDate')),
  endDate: Joi.date(),
  purpose: Joi.string(),
  bookedBy: Joi.string(),
});
// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate('bookedBy', 'name email')
      .lean();
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = bookingSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate }
    });
    if (conflict) {
      return res.status(409).json({
        message: 'The room is already booked for part of that time range'
      });
    }

    const booking = await Booking.create(value);
    const populatedBooking = await booking.populate('bookedBy', 'name email');
    res.status(201).json({ booking: populatedBooking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const existingBooking = await Booking.findById(req.params.id);
    if (!existingBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const proposedBooking = {
      roomNumber: value.roomNumber ?? existingBooking.roomNumber,
      startDate: value.startDate ?? existingBooking.startDate,
      endDate: value.endDate ?? existingBooking.endDate,
      purpose: value.purpose ?? existingBooking.purpose,
      bookedBy: value.bookedBy ?? existingBooking.bookedBy?.toString()
    };
    const dateValidation = bookingSchema.validate(proposedBooking, {
      abortEarly: false,
      stripUnknown: true
    });
    if (dateValidation.error) {
      return res.status(400).json({ message: dateValidation.error.message });
    }

    const conflict = await Booking.findOne({
      _id: { $ne: existingBooking._id },
      roomNumber: dateValidation.value.roomNumber,
      startDate: { $lt: dateValidation.value.endDate },
      endDate: { $gt: dateValidation.value.startDate }
    });
    if (conflict) {
      return res.status(409).json({
        message: 'The room is already booked for part of that time range'
      });
    }

    existingBooking.set(dateValidation.value);
    const booking = await existingBooking.save();
    const populatedBooking = await booking.populate('bookedBy', 'name email');
    res.json({ booking: populatedBooking });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
}
