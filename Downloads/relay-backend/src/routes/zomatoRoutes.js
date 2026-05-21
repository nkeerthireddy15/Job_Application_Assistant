const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const ZomatoReservation = require('../models/ZomatoReservation');
const Store = require('../models/Store');
const auth = require('../middleware/auth');

const authorize = require('../middleware/authorize');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard Zomato-style response shape */
const zomatoStatus = (ok, code, message) => ({
  status: ok,
  status_code: code,
  message,
});

/** Generate a unique partner_booking_id */
const makePartnerBookingId = () =>
  `ONIRO-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Resolve the Store document from a Zomato store_id (outletId in our system).
 * Returns null when not found.
 */
const findStoreByOutletId = (outletId) =>
  Store.findOne({ 'integrations.zomato.outletId': outletId });

/**
 * Build Axios headers for outbound Zomato API calls using the store's
 * configured API key.
 */
const zomatoHeaders = (apiKey) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'x-zomato-api-key': apiKey,
});

// ---------------------------------------------------------------------------
// INBOUND — Booking Relay Webhook (Zomato → Oniro)
//
// Zomato sends new booking details to this endpoint.
//
// Authentication: Zomato attaches the Authorization header that *we* told
// Zomato to use during integration setup.  We store that secret in
// store.integrations.zomato.secret and validate it here.
//
// Endpoint must be publicly accessible (no JWT middleware).
// ---------------------------------------------------------------------------
router.post('/webhook/booking', async (req, res) => {
  try {
    const payload = req.body;

    const {
      booking_id,
      table_reservation,
      customer_details = {},
      business_details = {},
      offer_details = {},
      created_at,
    } = payload;

    if (!booking_id || !table_reservation || !business_details?.store_id) {
      return res.status(400).json({
        status: zomatoStatus(false, 'BAD_REQUEST', 'Missing required fields'),
      });
    }

    // Locate store by the store_id Zomato included in business_details
    const store = await findStoreByOutletId(business_details.store_id);
    if (!store) {
      return res.status(404).json({
        status: zomatoStatus(false, 'BUSINESS_NOT_FOUND', 'Store not found for given store_id'),
      });
    }

    // Validate the authorization secret Zomato sends in the header
    const expectedSecret = store.integrations?.zomato?.secret || '';
    const incomingAuth = req.headers.authorization || '';
    if (
      expectedSecret &&
      !crypto.timingSafeEqual(
        Buffer.from(incomingAuth),
        Buffer.from(expectedSecret)
      )
    ) {
      return res.status(401).json({
        status: zomatoStatus(false, 'UNAUTHORISED', 'Invalid authorization'),
      });
    }

    // Idempotency — ignore duplicate booking_id
    const existing = await ZomatoReservation.findOne({ zomato_booking_id: booking_id });
    if (existing) {
      return res.json({
        status: zomatoStatus(true, 'SUCCESS', 'Booking already received'),
        partner_booking_id: existing.partner_booking_id,
        booking_status: existing.booking_status,
      });
    }

    const partner_booking_id = makePartnerBookingId();

    // Determine initial booking status
    const preferred_mode = table_reservation?.preferred_confirmation_mode || 'MANUAL';
    let booking_status = preferred_mode === 'AUTO' ? 'CONFIRMED' : 'AWAITING_CONFIRMATION';

    const reservation = await ZomatoReservation.create({
      store: store._id,
      zomato_booking_id: booking_id,
      partner_booking_id,
      booking_status,
      table_reservation: {
        slot_start_time: table_reservation.slot_start_time,
        duration: table_reservation.duration || 60,
        covers_count: table_reservation.covers_count,
        notes: table_reservation.notes || [],
        preferred_confirmation_mode: preferred_mode,
        cover_charge: table_reservation.cover_charge || {},
      },
      customer_details: {
        name: customer_details.name || '',
        contact_number: customer_details.contact_number || '',
        email_address: customer_details.email_address || '',
        visit_count: String(customer_details.visit_count || ''),
        contact_number_with_isd_code: customer_details.contact_number_with_isd_code || '',
      },
      business_details: {
        zomato_business_id: business_details.zomato_business_id || '',
        store_id: business_details.store_id,
      },
      offer_details: {
        discount_percentage: offer_details.discount_percentage || 0,
        offers: Array.isArray(offer_details.offers) ? offer_details.offers : [],
        offer_message: offer_details.offer_message || '',
      },
      zomato_created_at: created_at || null,
      raw_payload: payload,
    });

    // If AUTO mode, immediately notify Zomato that we accepted
    if (preferred_mode === 'AUTO') {
      const apiKey = store.integrations?.zomato?.apiKey;
      if (apiKey) {
        try {
          await axios.post(
            'https://api.zomato.com/merchant-gw/dining-pos/tr/booking/accept',
            {
              store_id: business_details.store_id,
              zomato_booking_id: booking_id,
              partner_booking_id,
            },
            { headers: zomatoHeaders(apiKey) }
          );
        } catch (apiErr) {
          // Log but do not fail the webhook response
          console.error('Zomato Accept API call failed for AUTO booking', apiErr?.response?.data || apiErr.message);
        }
      }
    }

    // Per PDF spec the relay response booking_status uses SUCCESS (not CONFIRMED)
    const relay_booking_status = preferred_mode === 'AUTO' ? 'SUCCESS' : booking_status;

    return res.json({
      status: zomatoStatus(true, 'SUCCESS', 'Booking received successfully'),
      partner_booking_id,
      booking_status: relay_booking_status,
    });
  } catch (error) {
    console.error('Zomato booking webhook error', error);
    return res.status(500).json({
      status: zomatoStatus(false, 'INTERNAL_SERVER_ERROR', 'Failed to process booking'),
    });
  }
});

// ---------------------------------------------------------------------------
// INBOUND — Cancellation Relay (Zomato → Oniro)
//
// Zomato notifies us when it cancels a booking.
// ---------------------------------------------------------------------------
router.post('/webhook/booking/cancel', async (req, res) => {
  try {
    const { zomato_booking_id, partner_booking_id, reason } = req.body;

    if (!zomato_booking_id) {
      return res.status(400).json({
        status: zomatoStatus(false, 'BAD_REQUEST', 'zomato_booking_id is required'),
      });
    }

    const reservation = await ZomatoReservation.findOne({ zomato_booking_id });
    if (!reservation) {
      return res.status(404).json({
        status: zomatoStatus(false, 'INVALID_BOOKING', 'Booking not found'),
      });
    }

    reservation.booking_status = 'CANCELLED';
    if (reason) reservation.rejection_reason = reason;
    await reservation.save();

    return res.json({
      status: zomatoStatus(true, 'SUCCESS', 'Cancellation acknowledged'),
    });
  } catch (error) {
    console.error('Zomato cancel webhook error', error);
    return res.status(500).json({
      status: zomatoStatus(false, 'INTERNAL_SERVER_ERROR', 'Failed to process cancellation'),
    });
  }
});

// ---------------------------------------------------------------------------
// INBOUND — Inventory Details API (Zomato → Oniro)
//
// Zomato queries our system for available slots within a time range.
// We return available slot windows using the cover counts per slot.
// ---------------------------------------------------------------------------
router.post('/inventory', async (req, res) => {
  try {
    const { store_id, start_time, end_time, covers_count, existing_order_id } = req.body;

    if (!store_id || !start_time || !end_time) {
      return res.status(400).json({
        status: zomatoStatus(false, 'BAD_REQUEST', 'store_id, start_time and end_time are required'),
      });
    }

    const store = await findStoreByOutletId(store_id);
    if (!store) {
      return res.status(404).json({
        status: zomatoStatus(false, 'BUSINESS_NOT_FOUND', 'Store not found'),
      });
    }

    /**
     * Build slot list: one slot every 30 minutes in the requested range.
     * Count overlapping confirmed reservations (excluding existing_order_id for
     * modification flow) to calculate available_covers_count.
     *
     * Production implementation would use a proper capacity management layer.
     */
    const DEFAULT_CAPACITY = 50;
    const SLOT_DURATION = 30; // minutes
    const slots = [];

    for (let t = start_time; t < end_time; t += SLOT_DURATION * 60) {
      const slotEnd = t + SLOT_DURATION * 60;

      const conflictQuery = {
        store: store._id,
        booking_status: { $in: ['CONFIRMED', 'AWAITING_CONFIRMATION', 'REDEEMED'] },
        'table_reservation.slot_start_time': { $gte: t, $lt: slotEnd },
      };

      if (existing_order_id) {
        conflictQuery.zomato_booking_id = { $ne: String(existing_order_id) };
      }

      const booked = await ZomatoReservation.countDocuments(conflictQuery);
      const available = Math.max(0, DEFAULT_CAPACITY - booked);

      slots.push({
        slot_start_time: t,
        duration: SLOT_DURATION,
        available_covers_count: available,
      });
    }

    return res.json({
      status: zomatoStatus(true, 'SUCCESS', 'Inventory fetched'),
      slot_details: slots,
    });
  } catch (error) {
    console.error('Zomato inventory error', error);
    return res.status(500).json({
      status: zomatoStatus(false, 'INTERNAL_SERVER_ERROR', 'Failed to fetch inventory'),
    });
  }
});

// ---------------------------------------------------------------------------
// All routes below require dashboard user auth (JWT)
// ---------------------------------------------------------------------------
router.use(auth);

// ---------------------------------------------------------------------------
// GET /api/zomato/reservations — list reservations for a store (admin + manager)
// ---------------------------------------------------------------------------
router.get('/reservations', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { storeId, booking_status } = req.query;
    const query = {};
    if (storeId) query.store = storeId;
    if (booking_status) query.booking_status = booking_status;

    const reservations = await ZomatoReservation.find(query)
      .populate('store', 'name code city')
      .sort({ 'table_reservation.slot_start_time': -1 });

    return res.json({ reservations });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch Zomato reservations' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/zomato/booking/accept
//
// Dashboard user accepts a booking (admin + manager).
// 1. Calls Zomato Accept Booking API.
// 2. Updates local booking_status → CONFIRMED.
// ---------------------------------------------------------------------------
router.post('/booking/accept', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { reservationId } = req.body;

    const reservation = await ZomatoReservation.findById(reservationId).populate('store');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const store = reservation.store;
    const apiKey = store.integrations?.zomato?.apiKey;
    const outletId = store.integrations?.zomato?.outletId;

    if (!apiKey) {
      return res.status(400).json({ message: 'Zomato API key not configured for this store' });
    }

    // Call Zomato Accept Booking API
    let zomatoResponse = null;
    try {
      const { data } = await axios.post(
        'https://api.zomato.com/merchant-gw/dining-pos/tr/booking/accept',
        {
          store_id: outletId,
          zomato_booking_id: reservation.zomato_booking_id,
          partner_booking_id: reservation.partner_booking_id,
        },
        { headers: zomatoHeaders(apiKey) }
      );
      zomatoResponse = data;
    } catch (apiErr) {
      const errData = apiErr?.response?.data;
      return res.status(502).json({
        message: 'Zomato Accept API call failed',
        zomatoError: errData || apiErr.message,
      });
    }

    reservation.booking_status = 'CONFIRMED';
    await reservation.save();

    return res.json({
      message: 'Booking accepted',
      reservation,
      zomatoResponse,
    });
  } catch (error) {
    console.error('Accept booking error', error);
    return res.status(500).json({ message: 'Failed to accept booking' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/zomato/booking/reject
//
// Dashboard user rejects a booking (admin + manager).
// 1. Calls Zomato Reject Booking API.
// 2. Updates local booking_status → REJECTED.
// ---------------------------------------------------------------------------
router.post('/booking/reject', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { reservationId, reason = 'Rejected by restaurant' } = req.body;

    const reservation = await ZomatoReservation.findById(reservationId).populate('store');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const store = reservation.store;
    const apiKey = store.integrations?.zomato?.apiKey;
    const outletId = store.integrations?.zomato?.outletId;

    if (!apiKey) {
      return res.status(400).json({ message: 'Zomato API key not configured for this store' });
    }

    // Call Zomato Reject Booking API
    let zomatoResponse = null;
    try {
      const { data } = await axios.post(
        'https://api.zomato.com/merchant-gw/dining-pos/tr/booking/reject',
        {
          store_id: outletId,
          zomato_booking_id: reservation.zomato_booking_id,
          partner_booking_id: reservation.partner_booking_id,
          reason,
        },
        { headers: zomatoHeaders(apiKey) }
      );
      zomatoResponse = data;
    } catch (apiErr) {
      const errData = apiErr?.response?.data;
      return res.status(502).json({
        message: 'Zomato Reject API call failed',
        zomatoError: errData || apiErr.message,
      });
    }

    reservation.booking_status = 'REJECTED';
    reservation.rejection_reason = reason;
    await reservation.save();

    return res.json({
      message: 'Booking rejected',
      reservation,
      zomatoResponse,
    });
  } catch (error) {
    console.error('Reject booking error', error);
    return res.status(500).json({ message: 'Failed to reject booking' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/zomato/booking/get
//
// Proxy to Zomato Get Booking Details API (admin + manager).
// URL: https://api.zomato.com/merchant-gw/dining-pos/tr/booking/get
// ---------------------------------------------------------------------------
router.post('/booking/get', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { reservationId } = req.body;

    const reservation = await ZomatoReservation.findById(reservationId).populate('store');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const store = reservation.store;
    const apiKey = store.integrations?.zomato?.apiKey;
    const outletId = store.integrations?.zomato?.outletId;

    if (!apiKey) {
      return res.status(400).json({ message: 'Zomato API key not configured' });
    }

    const { data } = await axios.post(
      'https://api.zomato.com/merchant-gw/dining-pos/tr/booking/get',
      {
        store_id: outletId,
        zomato_booking_id: reservation.zomato_booking_id,
        partner_booking_id: reservation.partner_booking_id,
      },
      { headers: zomatoHeaders(apiKey) }
    );

    return res.json({ data });
  } catch (error) {
    const errData = error?.response?.data;
    return res.status(502).json({
      message: 'Failed to fetch booking from Zomato',
      zomatoError: errData || error.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/zomato/slot/action
//
// Proxy to Zomato Slot Action API — admin only (affects live availability).
// URL: https://api.zomato.com/merchant-gw/dining-pos/tr/slot/action
// Actions: BLOCK | UNBLOCK | SOLD_OUT
// ---------------------------------------------------------------------------
router.post('/slot/action', authorize('admin'), async (req, res) => {
  try {
    const { storeId, action, slot_start_time, duration, idempotency_key } = req.body;

    if (!storeId || !action || !slot_start_time || !duration) {
      return res.status(400).json({ message: 'storeId, action, slot_start_time and duration are required' });
    }

    if (!['BLOCK', 'UNBLOCK', 'SOLD_OUT'].includes(action)) {
      return res.status(400).json({ message: 'action must be BLOCK, UNBLOCK, or SOLD_OUT' });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const apiKey = store.integrations?.zomato?.apiKey;
    const outletId = store.integrations?.zomato?.outletId;

    if (!apiKey) {
      return res.status(400).json({ message: 'Zomato API key not configured for this store' });
    }

    const requestBody = {
      store_id: outletId,
      action,
      slot_start_time,
      duration,
    };
    if (idempotency_key) requestBody.idempotency_key = idempotency_key;

    const { data } = await axios.post(
      'https://api.zomato.com/merchant-gw/dining-pos/tr/slot/action',
      requestBody,
      { headers: zomatoHeaders(apiKey) }
    );

    return res.json({ message: 'Slot action sent', data });
  } catch (error) {
    const errData = error?.response?.data;
    return res.status(502).json({
      message: 'Slot action API call failed',
      zomatoError: errData || error.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/zomato/pay/auth-code — admin + manager
//
// (keeping authorize inline below)
//
// Zomato Pay — 4-digit auth code validation.
// Per "Zomato Pay - 4 digit auth code.pdf":
//   URL: https://api.zomato.com/v2.1/transaction/auth_code
//   Header: X-Zomato-Api-Key
//   Request: { res_id, partner_entity_id, auth_code, order_date, paid_amount, debug }
//   Response (success): { status, message, bill_amount, discount_amount,
//     discount_percentage, merchant_discount, zomato_discount,
//     amount_receivable, created_at, order_id, redeemed_order }
//   Response (failed): { status, message }
// ---------------------------------------------------------------------------
router.post('/pay/auth-code', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { storeId, auth_code, order_date, paid_amount, debug = 0 } = req.body;

    if (!storeId || !auth_code || !order_date || paid_amount === undefined) {
      return res.status(400).json({ message: 'storeId, auth_code, order_date and paid_amount are required' });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const apiKey = store.integrations?.zomato?.apiKey;
    const outletId = store.integrations?.zomato?.outletId;       // partner_entity_id
    const restaurantId = store.integrations?.zomato?.restaurantId; // res_id

    if (!apiKey) {
      return res.status(400).json({ message: 'Zomato API key not configured for this store' });
    }

    const { data } = await axios.post(
      'https://api.zomato.com/v2.1/transaction/auth_code',
      {
        res_id: restaurantId,
        partner_entity_id: outletId,
        auth_code: Number(auth_code),
        order_date,
        paid_amount: Number(paid_amount),
        debug: Number(debug),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Zomato-Api-Key': apiKey,
        },
      }
    );

    return res.json({ data });
  } catch (error) {
    const errData = error?.response?.data;
    return res.status(502).json({
      message: 'Zomato Pay auth-code validation failed',
      zomatoError: errData || error.message,
    });
  }
});

module.exports = router;
