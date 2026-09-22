import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string().hex().length(24)
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string().hex().length(24)
}).custom((value, helpers) => {
  if (value.startDate && value.endDate) {
    if (value.startDate >= value.endDate) {
      return helpers.error('any.invalid');
    }
  }

  return value;
});

async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
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
    const { value, error } = createSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const conflict = await hasConflict(
      value.roomNumber,
      value.startDate,
      value.endDate
    );

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking'
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

    const existingBooking = await Booking.findById(req.params.id);

    if (!existingBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const roomNumber = value.roomNumber ?? existingBooking.roomNumber;
    const startDate = value.startDate ?? existingBooking.startDate;
    const endDate = value.endDate ?? existingBooking.endDate;

    const conflict = await hasConflict(
      roomNumber,
      startDate,
      endDate,
      req.params.id
    );

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking'
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');

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