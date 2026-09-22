import { Router } from 'express';
import {
  getAllBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking
} from '../controllers/bookingController.js';

const router = Router();

// ── Collection routes (/api/bookings) ──────────────────────────────────────────
// GET    → read all bookings (no body needed)
// POST   → create a new booking (body = the new booking data)
router.get('/',  getAllBookings);
router.post('/', createBooking);

// ── Resource routes (/api/bookings/:id) ───────────────────────────────────────
// GET    → read one specific booking by its MongoDB _id
// PATCH  → partially update one booking (only send the fields you want to change)
// DELETE → permanently delete one booking
router.get('/:id',    getBooking);
router.patch('/:id',  updateBooking);
router.delete('/:id', deleteBooking);

export default router;

