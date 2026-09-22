import Joi from 'joi';
import { Booking } from '../models/Booking.js';

function datesAreInOrder(value, helpers) {
  if (value.startDate && value.endDate && value.startDate >= value.endDate) {
    return helpers.message('startDate must be before endDate');
  }

  return value;
}

const bookingFields = {
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24),
};

const createSchema = Joi.object({
  ...bookingFields,
  roomNumber: bookingFields.roomNumber.required(),
  startDate: bookingFields.startDate.required(),
  endDate: bookingFields.endDate.required(),
}).custom(datesAreInOrder);

const updateSchema = Joi.object(bookingFields)
  .min(1)
  .custom(datesAreInOrder);

async function findOverlappingBooking({ roomNumber, startDate, endDate, excludeId }) {
  const filter = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  };

  if (excludeId) filter._id = { $ne: excludeId };

  return Booking.findOne(filter);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate('bookedBy', 'name email');
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await findOverlappingBooking(value);
    if (conflict) return res.status(409).json({ message: 'Room is already booked for this time range' });

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const updatedValues = {
      roomNumber: value.roomNumber ?? booking.roomNumber,
      startDate: value.startDate ?? booking.startDate,
      endDate: value.endDate ?? booking.endDate,
    };
    if (updatedValues.startDate >= updatedValues.endDate) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    const conflict = await findOverlappingBooking({
      ...updatedValues,
      excludeId: booking._id,
    });
    if (conflict) return res.status(409).json({ message: 'Room is already booked for this time range' });

    booking.set(value);
    await booking.save();
    res.json({ booking });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
