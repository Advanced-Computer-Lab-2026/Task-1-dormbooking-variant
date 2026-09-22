import { Booking } from '../models/Booking.js';
import Joi from 'joi';

// TODO: write a validation schema for create/update per README.md section 2.

const createSchema = Joi.object({
    roomNumber: Joi.string().required(),
    startDate: Joi.date().less(Joi.ref('endDate')).required(),
    endDate: Joi.date().required(),
    purpose: Joi.string(),
    bookedBy: Joi.string()
});

const updateSchema = Joi.object({
    roomNumber: Joi.string(),
    // No Joi.ref('endDate') here: on a partial PATCH, endDate may not be in
    // the request body at all, so a sibling ref has nothing to compare
    // against. The real startDate < endDate check (against the *merged*
    // existing + patched values) happens in updateBooking below.
    startDate: Joi.date(),
    endDate: Joi.date(),
    purpose: Joi.string(),
    bookedBy: Joi.string()
});


// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(_, res, next) {
    try {
        // TODO
        const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
        res.json({ bookings: bookings });
    } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        res.json({
            booking
        });
    } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
    try {
        const { value, error } = createSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.message });
        const conflict = await Booking.findOne({
            roomNumber: value.roomNumber,
            startDate: { $lt: value.endDate },
            endDate: { $gt: value.startDate }
        });

        if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing booking on this room' });

        const booking = await Booking.create({ roomNumber: value.roomNumber, startDate: value.startDate, endDate: value.endDate, purpose: value.purpose, bookedBy: value.bookedBy });
        res.status(201).json({ booking: booking });
    } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
    try {
        const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) return res.status(400).json({ message: error.message });

        const existingBooking = await Booking.findById(req.params.id);
        if (!existingBooking) return res.status(404).json({ message: 'Booking not found' });

        // Merge the patch onto the current booking so the overlap/date-order
        // checks see the resulting state, not just the fields being changed.
        const roomNumber = value.roomNumber ?? existingBooking.roomNumber;
        const startDate = value.startDate ?? existingBooking.startDate;
        const endDate = value.endDate ?? existingBooking.endDate;

        if (!(startDate < endDate)) {
            return res.status(400).json({ message: '"startDate" must be before "endDate"' });
        }

        const conflict = await Booking.findOne({
            _id: { $ne: req.params.id },
            roomNumber,
            startDate: { $lt: endDate },
            endDate: { $gt: startDate }
        });
        if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing booking on this room' });

        const booking = await Booking.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
        res.json({ booking });
    } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
    try {
        const doc = await Booking.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Booking not found' });
        res.json({ ok: true });
    } catch (err) { next(err); }
}
