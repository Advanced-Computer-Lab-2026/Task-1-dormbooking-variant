import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

/*Implement full CRUD over bookings — create, read one, read all, update,
and delete. Creating or updating a booking needs to reject it with a
conflict error if it overlaps an existing one on the same room, per
section 4. Decide the paths and HTTP methods yourself, following standard
REST conventions.*/


const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  endDate: Joi.date().required(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24),  //user id
  //make sure start date is strictly before end date
  startDate: Joi.date().less(Joi.ref('endDate')).required()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  endDate: Joi.date(),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24),
  startDate: Joi.date().less(Joi.ref('endDate'))
});
/*
Use Mongoose's `.populate('bookedBy')` on `getAllBookings`/`getBooking` so
the response includes the referenced user's `name`/`email` instead of just
an id.
*/

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    // TODO
    const bookings = await Booking.find().populate('bookedBy', 'name email').sort({ createdAt: -1 }).lean();
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
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate }
    });
    if (existing) return res.status(409).json({ message: 'Booking conflicts with an existing one' });

    const booking = await Booking.create(value);
    res.status(201).json({ booking });  } 
    catch (err) { next(err); }
}
/*Two bookings on the **same room** conflict if their date ranges overlap.
Before creating (or updating) a booking, you need a way to check for any
existing booking on the same `roomNumber` whose range overlaps the
proposed one, and reject with `409` if one exists. On update, make sure a
booking doesn't conflict with itself.*/

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
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

    // Combine the old values with any new values from the request
    const proposed = {
      roomNumber: value.roomNumber ?? existingBooking.roomNumber,
      startDate: value.startDate ?? existingBooking.startDate,
      endDate: value.endDate ?? existingBooking.endDate
    };

    // Make sure startDate is before endDate
    if (proposed.startDate >= proposed.endDate) {
      return res.status(400).json({
        message: 'startDate must be before endDate'
      });
    }

    // Check whether the updated booking conflicts with another booking
    const conflict = await Booking.findOne({
      _id: { $ne: req.params.id },
      roomNumber: proposed.roomNumber,
      startDate: { $lt: proposed.endDate },
      endDate: { $gt: proposed.startDate }
    });

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing one'
      });
    }

    // Apply the requested changes
    Object.assign(existingBooking, value);

    await existingBooking.save();

    const booking = await Booking.findById(existingBooking._id)
      .populate('bookedBy', 'name email');

    res.json({ booking });
  } catch (err) {
    next(err);
  }
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
