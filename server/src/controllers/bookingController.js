import { Booking } from '../models/Booking.js';
import joi from 'joi';

const createSchema = joi.object({
  roomNumber: joi.string().required(),
  startDate: joi.date().required(),
  endDate: joi.date().greater(joi.ref('startDate')).required().messages({'date.greater': 'Timing is wrong', }),
  purpose: joi.string().optional(),
  bookedBy: joi.string().optional(),
});

const updateSchema = joi.object({
  roomNumber: joi.string(),
  startDate: joi.date(),
  endDate: joi.date().greater(joi.ref('startDate')).required().messages({'date.greater': 'Timing is wrong', }),
  purpose: joi.string(),
  bookedBy: joi.string(),
});

export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().populate('bookedBy', 'name email');
    res.status(200).json({
      success: true,
      Message: 'data fetched Successfully',
      data: bookings,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBooking(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('bookedBy', 'name email');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }
    res.status(200).json({
      success: true,
      message: 'data fetched successfully',
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function createBooking(req, res, next) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const conflict = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Room is already booked for these dates',
      });
    }

    const booking = await Booking.create(value);
    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { error, value } = updateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const conflict = await Booking.findOne({       
      roomNumber : value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Room is already booked for these dates',
      });
    }

    const booking = await Booking.findByIdAndUpdate(id, value, { new: true }).populate('bookedBy', 'name email');

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteBooking(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndDelete(id);  

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully',
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}
