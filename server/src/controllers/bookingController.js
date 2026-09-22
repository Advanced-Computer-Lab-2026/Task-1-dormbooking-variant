import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const bookingSchema = Joi.object({
  roomNumber: Joi.string().required(),

  startDate: Joi.date().required(),

  endDate: Joi.date()
    .required()
    .greater(Joi.ref('startDate')),

  purpose: Joi.string().optional(),

  bookedBy: Joi.string().optional(),
});

async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingBooking = await Booking.findOne(query);

  return existingBooking !== null;
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email');

    res.status(200).json(bookings);
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { error, value } = bookingSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const conflict = await hasConflict(
      value.roomNumber,
      value.startDate,
      value.endDate
    );

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking',
      });
    }

    const booking = await Booking.create(value);

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const existingBooking = await Booking.findById(req.params.id);

    if (!existingBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const candidate = {
      roomNumber: req.body.roomNumber ?? existingBooking.roomNumber,
      startDate: req.body.startDate ?? existingBooking.startDate,
      endDate: req.body.endDate ?? existingBooking.endDate,
      purpose: req.body.purpose ?? existingBooking.purpose,
      bookedBy:
        req.body.bookedBy ??
        (existingBooking.bookedBy
          ? existingBooking.bookedBy.toString()
          : undefined),
    };

    const { error, value } = bookingSchema.validate(candidate);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const conflict = await hasConflict(
      value.roomNumber,
      value.startDate,
      value.endDate,
      req.params.id
    );

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking',
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      value,
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');

    res.status(200).json(updatedBooking);
  } catch (err) {
    next(err);
  }
}
// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}