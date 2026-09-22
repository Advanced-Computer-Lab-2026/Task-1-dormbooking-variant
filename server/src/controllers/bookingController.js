import { Booking } from '../models/Booking.js';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
// TODO: write a validation schema for create/update per README.md section 2.

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().less(Joi.ref('endDate')).messages({ 'date.less': 'Start date must be before end date' }).required(),
  endDate: Joi.date().required(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string().optional(),
  startDate: Joi.date().less(Joi.ref('endDate')).messages({ 'date.less': 'Start date must be before end date' }).optional(),
  endDate: Joi.date().optional(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body , { abortEarly: false, stripUnknown: true });

    if (error) {
      return res.status(400).json({ message: error.details.map(d => d.message).join(', ')
      });
    }

    const { roomNumber, startDate, endDate, purpose, bookedBy } = value;

    const conflict = await Booking.findOne({
      roomNumber,
      $or: [
        { startDate: { $lt: endDate }, endDate: { $gt: startDate } }
        // bycheck lw fee overlap between existing booking and new booking, 
        // if yes byrg3 conflict 409
      ]
    });

    if (conflict) {
      return res.status(409).json({
        message: 'This room is already booked for the requested time range'
      });
    }

    const booking = await Booking.create({
      roomNumber,
      startDate,
      endDate,
      purpose,
      bookedBy
    });

    res.status(201).json({ booking });

  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body , { abortEarly: false, stripUnknown: true });
    
    if (error) {
      return res.status(400).json({message: error.details.map(d => d.message).join(', ')
      });
    }

    const existingBooking = await Booking.findById(req.params.id);
    if (!existingBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const roomNumber = value.roomNumber ?? existingBooking.roomNumber;
    const startDate = value.startDate ?? existingBooking.startDate;
    const endDate = value.endDate ?? existingBooking.endDate;

    const conflict = await Booking.findOne({
      _id: { $ne: req.params.id },
      roomNumber,
      startDate: { $lt: endDate },
      endDate: { $gt: startDate }
    });

     if (conflict) {
      return res.status(409).json({
        message: 'This room is already booked for the requested time range'
      });
    }

    Object.assign(existingBooking, value);
    const updatedBooking = await existingBooking.save();

    res.json({ booking: updatedBooking });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) { next(err); }
}
