import mongoose from 'mongoose';
import { User } from './User.js';

// TODO: define the Booking schema per README.md section 1.

const bookingSchema = new mongoose.Schema(
    {
        roomNumber: { type: String, required: true, unique: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        purpose: { type: String, required: false },
        bookedBy: { type: mongoose.Schema.Types.ObjectId, required: false }
    },
    { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);
