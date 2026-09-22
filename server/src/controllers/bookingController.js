import { Booking } from '../models/Booking.js';
import Joi from 'joi';


// TODO: write a validation schema for create/update per README.md section 2.
const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string(),
  bookedBy: Joi.string()
})

const updateSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().less(Joi.ref('endDate')).required(),
  endDate: Joi.date().required(),
  purpose: Joi.string(),
  bookedBy: Joi.string()
})



// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.
async function hasBookingConflict(roomNumber, startDate, endDate, excludeBookingId = null) {
  const query = {
    roomNumber,
    $and: [
      { startDate: { $lt: new Date(endDate) } },
      { endDate: { $gt: new Date(startDate) } }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const existing = await Booking.findOne(query);
  return Boolean(existing);
}
// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    // TODO
    
    const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
    res.json({bookings}) 
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    // TODO
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({message: 'Booking not found'});
    res.json(booking);
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
     const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const conflict = await hasBookingConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for the selected dates.' });
    }

    const booking = await Booking.create(value);
    res.status(201).json(booking);


    // TODO
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    // TODO
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });
     const doc = await Booking.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking: doc });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    // TODO
    const { id } = req.params;
    const deletedBooking = await Booking.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (err) { next(err); }
}
