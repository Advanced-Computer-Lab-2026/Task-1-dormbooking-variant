import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.
const createBookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required().greater(Joi.ref('startDate')),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().optional()
});

const updateBookingSchema = Joi.object({
  roomNumber: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().optional()
});

// TODO: per README.md section 4, you will need a way to detect whether a
async function findConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };


  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await Booking.findOne(query);
}



// proposed booking conflicts with an existing one on the same room.

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().populate('bookedBy');

    return res.status(200).json(bookings);
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy');

    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    return res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}


// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { error, value } = createBookingSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: error.details[0].message
      });
    }

    const conflict = await findConflict(
      value.roomNumber,
      value.startDate,
      value.endDate
    );

    if (conflict) {
      return res.status(409).json({
        error: 'Booking conflicts with an existing booking'
      });
    }

    const booking = await Booking.create(value);

    return res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { error, value } = updateBookingSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: error.details[0].message
      });
    }

    const existingBooking = await Booking.findById(req.params.id);

    if (!existingBooking) {
      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    const roomNumber =
      value.roomNumber ?? existingBooking.roomNumber;

    const startDate =
      value.startDate ?? existingBooking.startDate;

    const endDate =
      value.endDate ?? existingBooking.endDate;

    
    const conflict = await findConflict(
      roomNumber,
      startDate,
      endDate,
      req.params.id
    );

    if (conflict) {
      return res.status(409).json({
        error: 'Booking conflicts with an existing booking'
      });
    }

    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      value,
      {
        new: true,
        runValidators: true
      }
    );

    return res.status(200).json(booking);
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
      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    return res.status(200).json({
      message: 'Booking deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}
