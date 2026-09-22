import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.

const createSchema = Joi.object({
  roomNumber: Joi.string().min(2).max(60).required(),
  startDate: Joi.date().required().less(Joi.ref('endDate')).messages({
    'date.less': 'startDate must be strictly before endDate',
  }),
  endDate: Joi.date().required(),
  purpose: Joi.string().allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null),
});

const updateSchema = Joi.object({
  roomNumber: Joi.string().min(2).max(60),
  startDate: Joi.date().less(Joi.ref('endDate')).messages({
    'date.less': 'startDate must be strictly before endDate',
  }),
  endDate: Joi.date(),
  purpose: Joi.string().allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null),
}).min(1);

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.
function isValidRange(startDate, endDate) {
  return new Date(startDate).getTime() < new Date(endDate).getTime();
}

async function findConflict({ roomNumber, startDate, endDate, excludeId = null }) {
  const query = {
    roomNumber,
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Booking.findOne(query);
}

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().populate('bookedBy', 'name email').sort({ startDate: 1 });
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    if (!isValidRange(value.startDate, value.endDate)) {
      return res.status(400).json({ message: 'startDate must be strictly before endDate' });
    }

    const conflict = await findConflict({
      roomNumber: value.roomNumber,
      startDate: value.startDate,
      endDate: value.endDate
    });

    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for that time range' });
    }

    const booking = await Booking.create(value);
    const populatedBooking = await Booking.findById(booking._id).populate('bookedBy', 'name email');
    res.status(201).json({ booking: populatedBooking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const nextRoomNumber = value.roomNumber ?? existing.roomNumber;
    const nextStartDate = value.startDate ?? existing.startDate;
    const nextEndDate = value.endDate ?? existing.endDate;

    if (!isValidRange(nextStartDate, nextEndDate)) {
      return res.status(400).json({ message: 'startDate must be strictly before endDate' });
    }

    const conflict = await findConflict({
      roomNumber: nextRoomNumber,
      startDate: nextStartDate,
      endDate: nextEndDate,
      excludeId: req.params.id
    });

    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for that time range' });
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');

    res.json({ booking: updated });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
