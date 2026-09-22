import Joi from 'joi';
import { Booking } from '../models/Booking.js';




// Validation when CREATING a booking
const createBookingSchema = Joi.object({
  roomNumber: Joi.string().required(),

  startDate: Joi.date().required(),

  endDate: Joi.date()
    .greater(Joi.ref('startDate'))
    .required(),

  purpose: Joi.string().optional(),

  bookedBy: Joi.string().optional()
});



const updateBookingSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string(),
  bookedBy: Joi.string()
});




export async function getAllBookings(req, res, next) {
  try {
const bookings = await Booking.find()
.populate('bookedBy', 'name email')
    return res.status(200).json(bookings);

  } catch (err) {
    next(err);
  }
}


// 

export async function getBooking(req, res, next) {
  try {
const booking = await Booking.findById(req.params.id)
  .populate('bookedBy', 'name email')
    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    return res.status(200).json(booking);

  } catch (err) {
    next(err);
  }
}




export async function createBooking(req, res, next) {
  try {

   
    const { error, value } = createBookingSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message
      });
    }



    const conflict = await Booking.findOne({
      roomNumber: value.roomNumber,

      startDate: {
        $lt: value.endDate
      },

      endDate: {
        $gt: value.startDate
      }
    });


    
    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked during this period'
      });
    }



    const booking = await Booking.create(value);



    return res.status(201).json(booking);

  } catch (err) {
    next(err);
  }
}


// =

export async function updateBooking(req, res, next) {
  try {

   
    const existingBooking = await Booking.findById(req.params.id);


 
    if (!existingBooking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }



    const { error, value } = updateBookingSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message
      });
    }


   
    const roomNumber =
      value.roomNumber ?? existingBooking.roomNumber;

    const startDate =
      value.startDate ?? existingBooking.startDate;

    const endDate =
      value.endDate ?? existingBooking.endDate;


    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: 'startDate must be before endDate'
      });
    }


    const conflict = await Booking.findOne({

      // Do not compare the booking with itself
      _id: {
        $ne: req.params.id
      },

      roomNumber: roomNumber,

      startDate: {
        $lt: endDate
      },

      endDate: {
        $gt: startDate
      }
    });


    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked during this period'
      });
    }


    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      value,
      {
        new: true,
        runValidators: true
      }
    );


    return res.status(200).json(updatedBooking);

  } catch (err) {
    next(err);
  }
}


export async function deleteBooking(req, res, next) {
  try {

    const booking = await Booking.findByIdAndDelete(req.params.id);


    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }


    return res.status(200).json({
      message: 'Booking deleted successfully'
    });

  } catch (err) {
    next(err);
  }
}