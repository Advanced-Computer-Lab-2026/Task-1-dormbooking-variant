import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const bookingFields = {
  roomNumber: Joi.string().trim().min(1).max(60),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  purpose: Joi.string().trim().max(500).allow(''),
  bookedBy: Joi.string().hex().length(24)
};

const createSchema = Joi.object({
  ...bookingFields,
  roomNumber: bookingFields.roomNumber.required(),
  startDate: bookingFields.startDate.required(),
  endDate: bookingFields.endDate.required()
});

const updateSchema = Joi.object(bookingFields).min(1);

function validateDateRange(value) {
  if (value.startDate >= value.endDate) {
    return 'startDate must be before endDate';
  }

  return null;
}

async function findConflict(booking, excludeId) {
  const query = {
    roomNumber: booking.roomNumber,
    startDate: { $lt: booking.endDate },
    endDate: { $gt: booking.startDate }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Booking.findOne(query);
}

export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email')
      .sort({ startDate: 1 });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

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

export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const dateError = validateDateRange(value);

    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    if (await findConflict(value)) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking'
      });
    }

    const booking = await Booking.create(value);
    await booking.populate('bookedBy', 'name email');

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const currentBooking = await Booking.findById(req.params.id);

    if (!currentBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const proposedBooking = {
      ...currentBooking.toObject(),
      ...value
    };

    const dateError = validateDateRange(proposedBooking);

    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    if (await findConflict(proposedBooking, currentBooking._id)) {
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