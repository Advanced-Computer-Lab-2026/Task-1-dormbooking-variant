import Joi from "joi";
import { Booking } from "../models/Booking.js";

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),
  purpose: Joi.string().min(1).max(200),
  bookedBy: Joi.string().hex().length(24),
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date().greater(Joi.ref("startDate")),
  purpose: Joi.string().min(1).max(200),
  bookedBy: Joi.string().hex().length(24),
});

function publicBooking(b) {
  const formattedBookedBy =
    b.bookedBy && b.bookedBy.name
      ? {
          id: b.bookedBy._id.toString(),
          name: b.bookedBy.name,
          email: b.bookedBy.email,
        }
      : b.bookedBy;

  return {
    id: b._id.toString(),
    roomNumber: b.roomNumber,
    startDate: b.startDate,
    endDate: b.endDate,
    purpose: b.purpose,
    bookedBy: formattedBookedBy,
    createdAt: b.createdAt,
  };
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate("bookedBy", "name email") // Fetch name and email from User model
      .lean();
    res.json({ bookings: bookings.map(publicBooking) });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      "bookedBy",
      "name email",
    ); // Fetch name and email from User model

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ booking: publicBooking(booking) });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findOne({
      roomNumber: value.roomNumber.toString(),
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate },
    });
    if (existing)
      return res.status(409).json({ message: "Booking already exists" });

    const booking = await Booking.create({
      roomNumber: value.roomNumber.toString(),
      startDate: value.startDate,
      endDate: value.endDate,
      purpose: value.purpose,
      bookedBy: value.bookedBy,
    });

    res.status(201).json({ booking: publicBooking(booking) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) return res.status(400).json({ message: error.message });

    const doc = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: "Booking not found" });
    res.json({ booking: publicBooking(doc) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Booking not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
