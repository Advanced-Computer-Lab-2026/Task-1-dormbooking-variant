import { Booking } from '../models/Booking.js';
import Joi from 'joi';

// TODO: write a validation schema for create/update per README.md section 2.

const createSchema = Joi.object({
  roomNumber: Joi.string().min(1).max(30).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required().greater(Joi.ref('startDate')),
  purpose: Joi.string().max(200).allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null),
})

const updateSchema = Joi.object({
  roomNumber: Joi.string().min(1).max(30),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  purpose: Joi.string().max(200).allow('', null),
  bookedBy: Joi.string().hex().length(24).allow(null)
})
 
function publicBooking(b) {
  return {  id: b._id,roomNumber: b.roomNumber, startDate: b.startDate, endDate: b.endDate, purpose: b.purpose, bookedBy: b.bookedBy };
}

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

async function findConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: new Date(endDate) },
    endDate:   { $gt: new Date(startDate) },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Booking.findOne(query).lean();
}

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    // TODO
    const bookings = await Booking.find().sort({ roomNumber: -1 }).lean();
    res.json({ bookings: bookings.map(publicBooking) });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    // TODO
    const booking = await Booking.findById(req.params.id).lean(); 
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    // TODO
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await findConflict( value.roomNumber, value.startDate, value.endDate );

    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked for an overlapping date range',
        conflict: publicBooking(conflict),
      });
    } 

    const booking = await Booking.create(value);
    res.status(201).json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    // TODO
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) return res.status(400).json({ message: error.message });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Merge: proposed value if sent, otherwise stored value
    const newRoom  = value.roomNumber ?? booking.roomNumber;
    const newStart = value.startDate  ?? booking.startDate;
    const newEnd   = value.endDate    ?? booking.endDate;

    // Cross-field rule against merged values (Joi can't see the DB)
    if (new Date(newStart) >= new Date(newEnd)) {
      return res.status(400).json({
        message: '"startDate" must be strictly before "endDate"',
      });
    }

    // Conflict check using real dates, excluding this booking
    const conflict = await findConflict(newRoom, newStart, newEnd, booking._id);
    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked for an overlapping date range',
        conflict: publicBooking(conflict),
      });
    }

    // Apply changes and persist
    Object.assign(booking, value);
    await booking.save();

    res.json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    // TODO
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.status(204).end();
  } catch (err) { next(err); }
}
