import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const bookingFields = {
  roomNumber: Joi.string().trim().min(1),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string().trim().allow(''),
  bookedBy: Joi.string().hex().length(24)
};

const createSchema = Joi.object({
  roomNumber: bookingFields.roomNumber.required(),
  startDate: bookingFields.startDate.required(),
  endDate: bookingFields.endDate.required(),
  purpose: bookingFields.purpose,
  bookedBy: bookingFields.bookedBy
});

const updateSchema = Joi.object(bookingFields).min(1);

function hasValidDateRange(startDate, endDate) {
  return new Date(startDate) < new Date(endDate);
}

async function findConflict({ roomNumber, startDate, endDate, excludeId }) {
  const filter = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return Booking.findOne(filter);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ startDate: 1 })
      .populate('bookedBy', 'name email');

    res.json({ bookings });
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

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    if (!hasValidDateRange(value.startDate, value.endDate)) {
      return res.status(400).json({
        message: 'startDate must be before endDate'
      });
    }

    const conflict = await findConflict(value);

    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked for that time range'
      });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const existing = await Booking.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const proposed = { ...existing.toObject(), ...value };

    if (!hasValidDateRange(proposed.startDate, proposed.endDate)) {
      return res.status(400).json({
        message: 'startDate must be before endDate'
      });
    }

    const conflict = await findConflict({
      ...proposed,
      excludeId: existing._id
    });

    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked for that time range'
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      existing._id,
      { $set: value },
      { new: true, runValidators: true }
    );

    res.json({ booking });
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

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}