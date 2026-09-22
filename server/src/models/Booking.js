import mongoose from 'mongoose';

// TODO: define the Booking schema per README.md section 1.
/*
| `roomNumber` | String | required |
| `startDate` | Date | required |
| `endDate` | Date | required |
| `purpose` | String | optional |
| `bookedBy` | ObjectId ref `User` | optional, plain field like any other |
*/

const bookingSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    purpose: { type: String },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);
