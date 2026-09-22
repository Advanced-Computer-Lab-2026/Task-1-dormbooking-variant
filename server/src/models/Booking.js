import mongoose from 'mongoose';

// ─── Booking Schema ───────────────────────────────────────────────────────────
// A Booking represents one reservation of a dorm common room for a time range.
// We do NOT put a unique index here — conflict detection is a RANGE-OVERLAP
// problem, not an exact-duplicate problem, so it must be done in the controller
// via a database query (see bookingController.js → hasConflict).
const bookingSchema = new mongoose.Schema(
  {
    // The identifier for the room being booked (e.g. "101", "A3").
    // required: true  → Mongoose will reject a save() call if this is missing.
    roomNumber: {
      type: String,
      required: true,
    },

    // The date/time the booking begins.
    // Stored as a BSON Date in MongoDB (milliseconds since epoch internally).
    startDate: {
      type: Date,
      required: true,
    },

    // The date/time the booking ends.
    // Must be AFTER startDate — we validate this in the controller with Joi.
    endDate: {
      type: Date,
      required: true,
    },

    // A short description of why the room is being booked (e.g. "Study group").
    // Not required — guests can leave it blank.
    purpose: {
      type: String,
    },

    // A reference to the User who made this booking.
    // type: mongoose.Schema.Types.ObjectId  → stored as a 12-byte ObjectId in MongoDB.
    // ref: 'User'                           → tells Mongoose which model to use
    //                                         when we call .populate('bookedBy').
    // Not required — anonymous bookings are allowed in this variant.
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  // timestamps: true → Mongoose automatically adds and manages two fields:
  //   createdAt — set once when the document is first saved
  //   updatedAt — updated every time the document is saved
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);
