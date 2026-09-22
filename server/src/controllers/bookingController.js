  import { Booking } from '../models/Booking.js';
  import Joi from 'joi';
  import mongoose from 'mongoose';
  // TODO: write a validation schema for create/update per README.md section 2.
  const bookingSchema = Joi.object({
    roomNumber: Joi.string().required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    purpose: Joi.string().allow('', null),
    bookedBy: Joi.string().hex().length(24).optional() // ObjectId as string
  }).custom((value, helpers) => {
    if (new Date(value.startDate) >= new Date(value.endDate)) {
      return helpers.message('startDate must be strictly before endDate');
    }
    return value;
  });

  const bookingUpdateSchema= Joi.object({
    roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string().hex().length(24)
  }).min(1);

  async function findConflict({ roomNumber, startDate, endDate }, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },   // existing.startDate < new.endDate
    endDate: { $gt: startDate }    // existing.endDate > new.startDate
  };
  if (excludeId) {
    query._id = { $ne: excludeId }; // don't conflict with itself on update
  }
  return Booking.findOne(query);
}
  
  // TODO: per README.md section 4, you will need a way to detect whether a
  // proposed booking conflicts with an existing one on the same room.

  // GET /api/bookings
  // TODO: implement per README.md section 3.
  export async function getAllBookings(req, res, next) {
    try {
      // TODO
          const bookings = await Booking.find().populate('bookedBy','name email');
          res.json(bookings);


    } catch (err) { next(err); }
  }

  // GET /api/bookings/:id
  // TODO: implement per README.md sections 3 and 5.
  export async function getBooking(req, res, next) {
    try {
      // TODO
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking id' });
    }
    const booking = await Booking.findById(req.params.id).populate('bookedBy','name email');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(booking);
    } catch (err) { next(err); }
  }

  // POST /api/bookings
  // TODO: implement per README.md sections 3 and 4.
  export async function createBooking(req, res, next) {
    try {
      // TODO
      const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const conflict = await findConflict(value);
    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking for this room',
        conflictsWith: conflict._id
      });
    }

    const booking = await Booking.create(value);
    res.status(201).json(booking);
    } catch (err) { next(err); }
  }

  // PATCH /api/bookings/:id
  // TODO: implement per README.md sections 3, 4, and 5.
  export async function updateBooking(req, res, next) {
    try {
      // TODO
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking id' });
    }

    const { error, value } = bookingUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // merge patch onto existing doc so both the strictly-before check
    // and the conflict check run against the full, resulting range
    const merged = {
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate
    };

    if (new Date(merged.startDate) >= new Date(merged.endDate)) {
      return res.status(400).json({ message: 'startDate must be strictly before endDate' });
    }

    const conflict = await findConflict(merged, req.params.id);
    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking for this room',
        conflictsWith: conflict._id
      });
    }

    Object.assign(existing, value);
    await existing.save();
    res.json(existing);
    } catch (err) { next(err); }
  }

  // DELETE /api/bookings/:id
  // TODO: implement per README.md sections 3 and 5.
  export async function deleteBooking(req, res, next) {
    try {
      // TODO
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking id' });
    }
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(204).send();
    } catch (err) { next(err); }
  }
