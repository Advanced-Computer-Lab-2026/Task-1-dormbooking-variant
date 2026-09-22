import { Router } from 'express';
import {
  getAllBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking
} from '../controllers/bookingController.js';

const router = Router();

// Notice we use '/' and '/:id', NOT '/api/bookings'
router.get('/', getAllBookings);
router.get('/:id', getBooking);
router.post('/', createBooking);
router.patch('/:id', updateBooking);
router.delete('/:id', deleteBooking);

export default router;