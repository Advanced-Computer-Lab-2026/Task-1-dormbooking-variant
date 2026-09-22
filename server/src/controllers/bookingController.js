import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js'; 
import Joi from 'joi';

// TODO: write a validation schema for create/update per README.md section 2.
const bookingValidationSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
    'date.greater': '"endDate" must be strictly after "startDate"'
  }),
  purpose: Joi.string().optional().allow(''),
  bookedBy: Joi.string().hex().length(24).optional() // Validates MongoDB ObjectId format
});

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.
async function hasBookingConflict(roomNumber, startDate, endDate, ignoreBookingId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) }
  };

  // when updating an existing booking don't check for overlaps against itself
  if (ignoreBookingId) {
    query._id = { $ne: ignoreBookingId };
  }

  const conflictingBooking = await Booking.findOne(query);
  return !!conflictingBooking; // Returns true if a conflict exists, false otherwise
}
function publicBooking(b) {
  return { id: b._id.toString(), roomNumber:b.roomNumber,startDate:b.startDate,endDate:b.endDate,purpose:b.purpose,bookedBy:b.bookedBy, createdAt: b.createdAt };
}


// GET /api/bookings
// TODO: implement per README.md section 3.
// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
     const bookings = await Booking.find()
      .populate({ path: 'bookedBy', model: 'User', options: { strictPopulate: false } }) 
      .sort({ roomNumber: -1 })
      .lean();
      
    
    return res.status(200).json(bookings);
  } catch (err) { next(err); }
}




// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: 'bookedBy', model: 'User', select: 'name email', options: { strictPopulate: false } });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    return res.status(200).json(booking);
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
// POST /api/bookings
// README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    // validate request body structures
    const { error, value } = bookingValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }
    
    // check for date range overlap conflicts on the same room
    const isConflicting = await hasBookingConflict(value.roomNumber, value.startDate, value.endDate);
    if (isConflicting) {
      return res.status(409).json({ message: 'Conflict: This room is already booked for the selected time range.' });
    }

    // Create the booking record using your validated schema parameters
    const booking = await Booking.create(value);
    
    // Send your custom mapped data back and exit immediately
    return res.status(201).json({ booking: publicBooking(booking) });
  } catch (err) { next(err); }
}


// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
     // validate structural rules
    const { error, value } = bookingValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // check conflicts, making sure it doesn't flag its own current record as a conflict
    const isConflicting = await hasBookingConflict(
      value.roomNumber, 
      value.startDate, 
      value.endDate, 
      booking._id
    );
     if (isConflicting) {
      return res.status(409).json({ message: 'Conflict: This room is already booked for the selected time range.' });
    }

    // apply updates and save
    Object.assign(booking, value);
    await booking.save();

    return res.status(200).json(booking);
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

    return res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (err) { next(err); }
}
