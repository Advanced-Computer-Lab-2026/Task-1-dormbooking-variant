import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// ─── Validation Schemas ───────────────────────────────────────────────────────
// Joi is a schema-description library. We describe the SHAPE of valid request
// bodies here, then call .validate(req.body) inside each handler.
// If the data doesn't match, Joi gives us an error object with a human-readable
// message — we send that message back to the client as a 400 Bad Request.

// Used when CREATING a new booking (POST /api/bookings).
// All three date/room fields are .required() — we can't create a booking
// without knowing which room, or when it starts and ends.
const createSchema = Joi.object({
  roomNumber: Joi.string().min(1).required(),

  // Joi.date() accepts ISO strings like "2024-10-01T09:00:00Z" and JS Date
  // objects. .iso() strictly requires the ISO 8601 format.
  startDate: Joi.date().iso().required(),
  endDate:   Joi.date().iso().required(),

  purpose:  Joi.string().max(300),          // optional, 300-char cap
  bookedBy: Joi.string().hex().length(24),  // optional, must be a valid ObjectId
                                            // (24 hex characters = 12 bytes)
});

// Used when UPDATING an existing booking (PATCH /api/bookings/:id).
// Every field is optional — a PATCH request is allowed to change just one field.
// But at minimum one field must be present, enforced by .min(1) on the object.
const updateSchema = Joi.object({
  roomNumber: Joi.string().min(1),
  startDate:  Joi.date().iso(),
  endDate:    Joi.date().iso(),
  purpose:    Joi.string().max(300),
  bookedBy:   Joi.string().hex().length(24),
}).min(1); // Reject empty bodies — there's nothing to update otherwise.


// ─── Conflict Detection Helper ────────────────────────────────────────────────
// This is the core of the variant. We cannot use a Mongoose unique index because
// conflicts are about OVERLAPPING TIME RANGES, not exact duplicates.
//
// MATH: Two ranges [A_start, A_end] and [B_start, B_end] OVERLAP if and only if:
//           A_start < B_end  AND  A_end > B_start
//
// Visualisation:
//   Existing:   |====A====|
//   Case 1 (no overlap): |==B==|            → B_end ≤ A_start  (fails A_start < B_end)
//   Case 2 (no overlap):           |==B==|  → B_start ≥ A_end  (fails A_end > B_start)
//   Case 3 (overlap):      |==B==|          → BOTH conditions met ✓
//
// We translate that math directly into a MongoDB query:
//   startDate: { $lt: endDate }   → existing booking starts BEFORE the new one ends
//   endDate:   { $gt: startDate } → existing booking ends   AFTER  the new one starts
//
// Parameters:
//   roomNumber — which room to check
//   startDate  — proposed start
//   endDate    — proposed end
//   excludeId  — pass the booking's own _id when updating so it doesn't
//                conflict with itself; pass null when creating.
async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const conflict = await Booking.findOne({
    roomNumber,                          // must be the SAME room
    _id:       { $ne: excludeId },       // exclude the booking being updated
                                         // (on create: excludeId is null, and
                                         //  all real ObjectIds are ≠ null, so
                                         //  this clause has no effect)
    startDate: { $lt: endDate },         // overlap condition left side
    endDate:   { $gt: startDate },       // overlap condition right side
  });
  return conflict !== null; // true → conflict found, false → safe to book
}


// ─── GET /api/bookings ────────────────────────────────────────────────────────
// Scenario: A student opens the booking app and wants to see all existing
//           reservations. We return every booking, newest first, with the
//           booker's name & email filled in instead of a raw ObjectId.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking
      .find()                            // no filter → return every document
      .sort({ createdAt: -1 })          // newest first (most recently created)
      .populate('bookedBy', 'name email'); // replace ObjectId with {name, email}
                                           // 'name email' = projection: only
                                           // include those two fields from User

    res.json({ bookings });
  } catch (err) { next(err); }           // pass DB errors to the global error handler
}


// ─── GET /api/bookings/:id ────────────────────────────────────────────────────
// Scenario: A student clicks on a specific booking to see its full details.
//           :id comes from the URL (e.g. GET /api/bookings/64abc123...)
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking
      .findById(req.params.id)           // req.params.id is the :id from the URL
      .populate('bookedBy', 'name email');

    // findById returns null if no document with that _id exists.
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    res.json({ booking });
  } catch (err) { next(err); }
}


// ─── POST /api/bookings ───────────────────────────────────────────────────────
// Scenario: A student fills out the booking form and clicks "Book".
//
// Steps:
//   1. Validate the request body shape with Joi
//   2. Check startDate < endDate (Joi can't compare two date fields by itself)
//   3. Query the DB for overlapping bookings on the same room → 409 if found
//   4. Save the new booking → 201 Created
export async function createBooking(req, res, next) {
  try {
    // ── Step 1: Shape validation ──────────────────────────────────────────────
    // value    → the parsed/coerced data (e.g. ISO string → JS Date object)
    // error    → a Joi ValidationError object if anything is wrong, else undefined
    const { value, error } = createSchema.validate(req.body, { abortEarly: true });
    if (error) return res.status(400).json({ message: error.message });

    // ── Step 2: Date-order validation ─────────────────────────────────────────
    // Joi validated that both are valid dates, but we still need to check their
    // relative order. If startDate >= endDate the booking makes no sense.
    if (value.startDate >= value.endDate) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    // ── Step 3: Conflict detection ────────────────────────────────────────────
    // excludeId = null because this is a new booking — there's nothing to exclude.
    const conflict = await hasConflict(value.roomNumber, value.startDate, value.endDate, null);
    if (conflict) {
      return res.status(409).json({
        message: `Room ${value.roomNumber} is already booked for an overlapping time range`,
      });
    }

    // ── Step 4: Create & respond ──────────────────────────────────────────────
    // Booking.create() is equivalent to: new Booking(value).save()
    // It returns the saved document including the auto-generated _id and timestamps.
    const booking = await Booking.create(value);
    res.status(201).json({ booking });    // 201 = Created (not just 200 OK)
  } catch (err) { next(err); }
}


// ─── PATCH /api/bookings/:id ──────────────────────────────────────────────────
// Scenario: A student realises they need 30 more minutes and extends their
//           booking end time. They send only { endDate: "..." }.
//
// Steps:
//   1. Validate the incoming fields with Joi (all optional, min 1 field)
//   2. Find the existing booking — 404 if it doesn't exist
//   3. Compute the PROPOSED state by merging old + new values
//   4. Validate date order on the proposed state
//   5. Run conflict detection, EXCLUDING this booking's own _id
//   6. Apply the update and respond
export async function updateBooking(req, res, next) {
  try {
    // ── Step 1: Shape validation ──────────────────────────────────────────────
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: true,
      stripUnknown: true, // silently drop any fields not in our schema
    });
    if (error) return res.status(400).json({ message: error.message });

    // ── Step 2: Find the existing booking ─────────────────────────────────────
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    // ── Step 3: Compute proposed state ────────────────────────────────────────
    // A PATCH request may only send some fields. For conflict detection, we need
    // the FULL picture of what the booking will look like after the update.
    // We merge: existing values ← overridden by → whatever the client sent.
    const proposedRoom  = value.roomNumber ?? existing.roomNumber;
    const proposedStart = value.startDate  ?? existing.startDate;
    const proposedEnd   = value.endDate    ?? existing.endDate;
    // ??  is the "nullish coalescing" operator: use left side unless it's null/undefined,
    // in which case use the right side (the existing stored value).

    // ── Step 4: Date-order validation on proposed state ───────────────────────
    if (proposedStart >= proposedEnd) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    // ── Step 5: Conflict detection (excluding self) ───────────────────────────
    // We pass existing._id as excludeId so the booking doesn't conflict with
    // its OWN current slot in the database. Without this, every update would
    // return 409 because the booking overlaps with itself.
    const conflict = await hasConflict(proposedRoom, proposedStart, proposedEnd, existing._id);
    if (conflict) {
      return res.status(409).json({
        message: `Room ${proposedRoom} is already booked for an overlapping time range`,
      });
    }

    // ── Step 6: Apply the update ──────────────────────────────────────────────
    // findByIdAndUpdate with { new: true } returns the document AFTER the update,
    // not the document as it was BEFORE. Without { new: true }, we'd return stale data.
    // runValidators: true → re-runs Mongoose schema validators (required, etc.)
    //                        on the updated fields.
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },        // $set → only update the fields provided; leave others alone
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');

    res.json({ booking: updated });
  } catch (err) { next(err); }
}


// ─── DELETE /api/bookings/:id ─────────────────────────────────────────────────
// Scenario: A student cancels their booking.
export async function deleteBooking(req, res, next) {
  try {
    // findByIdAndDelete finds the document, deletes it, and returns the deleted doc.
    // If the _id doesn't exist it returns null.
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });

    res.json({ ok: true, deleted: doc._id }); // confirm which booking was deleted
  } catch (err) { next(err); }
}
