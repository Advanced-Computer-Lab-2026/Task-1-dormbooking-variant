import { Router } from 'express';
import {
  getAllBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking
} from '../controllers/bookingController.js';

const router = Router();

router.get('/', getAllBookings); // GET /api/bookings
router.get('/:id', getBooking); // GET /api/bookings/:id
router.post('/', createBooking); // POST /api/bookings
router.patch('/:id', updateBooking); // PATCH /api/bookings/:id
router.delete('/:id', deleteBooking); // DELETE /api/bookings/:id

export default router;