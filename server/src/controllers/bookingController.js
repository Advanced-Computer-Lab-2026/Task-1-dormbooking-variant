import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// Validation schema for creating a booking
const createSchema = Joi.object({
  roomNumber: Joi.string().required(),

  startDate: Joi.date().required(),

  endDate: Joi.date()
    .required()
    .custom((value, helpers) => {
      const startDate = helpers.state.ancestors[0].startDate;

      if (startDate && value <= startDate) {
  return helpers.message({
    custom: 'startDate must be before endDate'
  });
}

      return value;
    }),

  purpose: Joi.string().allow(''),

  bookedBy: Joi.string()
});

// Validation schema for updating a booking
const updateSchema = Joi.object({
  roomNumber: Joi.string(),

  startDate: Joi.date(),

  endDate: Joi.date()
    .custom((value, helpers) => {
      const startDate = helpers.state.ancestors[0].startDate;

      if (startDate && value <= startDate) {
  return helpers.message({
    custom: 'startDate must be before endDate'
  });
}

      return value;
    }),

  purpose: Joi.string().allow(''),

  bookedBy: Joi.string()
});

// Check whether a proposed booking conflicts
// with an existing booking on the same room.
async function hasConflict(
  roomNumber,
  startDate,
  endDate,
  excludeId = null
) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };

  // When updating a booking, exclude the booking
  // currently being updated from the conflict check.
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Booking.exists(query);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy');

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
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
      return res.status(400).json({
        message: error.message
      });
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
    // First find the existing booking
    const existingBooking = await Booking.findById(req.params.id);

    if (!existingBooking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    // Validate the fields provided in the PATCH request
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        message: error.message
      });
    }

    // Build what the booking will look like after the update
    const proposedBooking = {
      roomNumber:
        value.roomNumber ?? existingBooking.roomNumber,

      startDate:
        value.startDate ?? existingBooking.startDate,

      endDate:
        value.endDate ?? existingBooking.endDate,

      purpose:
        value.purpose ?? existingBooking.purpose,

      bookedBy:
        value.bookedBy ?? existingBooking.bookedBy
    };

    // Validate the complete proposed booking
    const { error: proposedError } = createSchema.validate(
      proposedBooking,
      {
        abortEarly: false,
        stripUnknown: true
      }
    );

    if (proposedError) {
      return res.status(400).json({
        message: proposedError.message
      });
    }

    // Check for conflicts with other bookings
    // while excluding the current booking itself.
    const conflict = await hasConflict(
      proposedBooking.roomNumber,
      proposedBooking.startDate,
      proposedBooking.endDate,
      req.params.id
    );

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking'
      });
    }

    // Update the booking
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      {
        new: true,
        runValidators: true
      }
    );

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(
      req.params.id
    );

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}