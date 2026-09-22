import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const bookingFields = {
  roomNumber: Joi.string().trim(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().trim(),
  bookedBy: Joi.string().hex().length(24)
};

const dateOrder = (value, helpers) => {
  if (value.startDate && value.endDate && value.startDate >= value.endDate) {
    return helpers.error('any.invalid');
  }
  return value;
};

const createSchema = Joi.object({
  ...bookingFields,
  roomNumber: bookingFields.roomNumber.required(),
  startDate: bookingFields.startDate.required(),
  endDate: bookingFields.endDate.required()
}).custom(dateOrder).messages({
  'any.invalid': 'startDate must be before endDate'
});

const updateSchema = Joi.object(bookingFields).min(1).custom(dateOrder).messages({
  'any.invalid': 'startDate must be before endDate'
});

const hasBookingConflict = async ({ roomNumber, startDate, endDate, excludeId }) => {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };

  if (excludeId) query._id = { $ne: excludeId };

  return Boolean(await Booking.exists(query));
};

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate('bookedBy', 'name email')
      .lean();
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email')
      .lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    if (await hasBookingConflict(value)) {
      return res.status(409).json({ message: 'Room is already booked for this time range' });
    }

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const proposed = {
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate
    };

    if (proposed.startDate >= proposed.endDate) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    if (await hasBookingConflict({ ...proposed, excludeId: existing._id })) {
      return res.status(409).json({ message: 'Room is already booked for this time range' });
    }

    const booking = await Booking.findByIdAndUpdate(
      existing._id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');
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
