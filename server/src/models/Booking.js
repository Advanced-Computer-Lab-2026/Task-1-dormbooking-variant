import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    purpose: { type: String, required: false },
    // Ensure bookedBy is defined exactly like this:
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);