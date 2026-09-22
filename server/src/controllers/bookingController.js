import { Booking } from '../models/Booking.js';
import Joi from 'joi';
import mongoose from 'mongoose';

// TODO: write a validation schema for create/update per README.md section 2.

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

const createSchema = Joi.object({
  roomNumber: Joi.string().trim().required(),
  startDate: Joi.date().iso().required(),
  purpose: Joi.string().trim().allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null, ''),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()});

const updateSchema = Joi.object({
  roomNumber: Joi.string().trim(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string().trim().allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null, ''),
}).min(1);

  // GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find();

    res.status(200).json({ bookings });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate }
    });

    if (conflict) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking' });
    }

    const booking = await Booking.create({
      roomNumber: value.roomNumber,
      startDate: value.startDate,
      endDate: value.endDate,
      purpose: value.purpose,
      bookedBy: value.bookedBy
    });

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate },
      _id: { $ne: req.params.id }
    });

    if (conflict) {
      return res.status(409).json({ message: 'Booking conflicts with an existing booking' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        roomNumber: value.roomNumber,
        startDate: value.startDate,
        endDate: value.endDate,
        purpose: value.purpose,
        bookedBy: value.bookedBy
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ booking });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (err) {
    next(err);
  }
}
