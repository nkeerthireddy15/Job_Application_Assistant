const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const Store = require('../models/Store');
const EasyDinerReservation = require('../models/EasyDinerReservation');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

const PARTNER_BASE_URL = process.env.EASYDINER_PARTNER_BASE_URL || 'https://api-test.eazydiner.com';
const PAYMENTS_BASE_URL = process.env.EASYDINER_PAYMENTS_BASE_URL || 'https://api-test.eazydiner.com';
const API_VERSION = process.env.EASYDINER_API_VERSION || '1.0';

const STATUS_VALUES = new Set(['cancelled', 'confirmed', 'completed', 'no_show']);

const makePartnerBookingId = () =>
  `ONIRO-ED-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const normalizeStatus = (status) => String(status || '').toLowerCase();

const getPartnerStoreId = (creds, fallback = '') =>
  String(creds?.storeId || creds?.outletId || fallback || '');

const getEasyDinerCreds = (store) => {
  const integrationCreds = store?.integrations?.easyDiner || {};

  const secret =
    integrationCreds.secret ||
    process.env.EASYDINER_PARTNER_SECRET ||
    process.env.PARTNER_SECRET ||
    '';

  const password =
    integrationCreds.password ||
    process.env.EASYDINER_PARTNER_SALT ||
    process.env.PARTNER_SALT ||
    '';

  const outletId = integrationCreds.outletId || process.env.EASYDINER_OUTLET_ID || '';

  const username = integrationCreds.username || process.env.EASYDINER_USERNAME || secret;

  return {
    ...integrationCreds,
    secret,
    password,
    outletId,
    username,
  };
};

const resolveReservationDate = (payload) => {
  if (payload.reservation_time) {
    const byDate = new Date(payload.reservation_time);
    if (!Number.isNaN(byDate.getTime())) return byDate;
  }

  if (payload.slot_start_time) {
    const epoch = Number(payload.slot_start_time);
    if (!Number.isNaN(epoch)) {
      return new Date(epoch > 1e12 ? epoch : epoch * 1000);
    }
  }

  if (payload.date && payload.time) {
    const bySplit = new Date(`${payload.date}T${payload.time}`);
    if (!Number.isNaN(bySplit.getTime())) return bySplit;
  }

  return null;
};

const findStoreByEasyDinerOutletId = (outletId) =>
  Store.findOne({ 'integrations.easyDiner.outletId': String(outletId || '') });

const isSecretValid = (incoming, expected) => {
  if (!expected) return true;
  if (!incoming) return false;

  const left = Buffer.from(String(incoming));
  const right = Buffer.from(String(expected));
  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
};

const buildCommonHeaders = (secret, token) => ({
  secret,
  token,
  version: API_VERSION,
  'Content-Type': 'application/json',
});

const normalizePartnerBookings = (payload) => {
  const list =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.bookings) && payload.bookings) ||
    (Array.isArray(payload?.data?.bookings) && payload.data.bookings) ||
    (Array.isArray(payload?.data) && payload.data) ||
    [];

  return list.map((item) => {
    const customer = item.customer_details || item.customer || {};
    const rawStatus = item.booking_status || item.status;

    return {
      _id: item.id || item.booking_id || item.partner_booking_id,
      easydiner_booking_id: String(
        item.booking_id || item.easydiner_booking_id || item.id || item.partner_booking_id || ''
      ),
      partner_booking_id: String(item.partner_booking_id || ''),
      partner_store_id: String(item.partner_store_id || item.outlet_id || ''),
      booking_status: normalizeStatus(rawStatus) || 'awaiting_confirmation',
      covers_count: Number(item.covers_count || item.guests || item.pax || 0),
      reservation_time: resolveReservationDate(item),
      customer_details: {
        name: customer.name || item.customer_name || '',
        phone:
          customer.phone ||
          customer.contact_number ||
          customer.contact_number_with_isd_code ||
          item.customer_phone ||
          '',
        email: customer.email || customer.email_address || item.customer_email || '',
      },
      raw_payload: item,
    };
  });
};

const getPartnerToken = async (store) => {
  const creds = getEasyDinerCreds(store);
  const secretHeader = creds.secret || creds.username;
  if (!secretHeader || !creds.password) {
    throw new Error('Easy Diner credentials are incomplete. Configure secret/username and password.');
  }

  const loginBody = {
    username: creds.username || creds.secret,
    authkey: creds.password,
  };

  const { data } = await axios.post(
    `${PARTNER_BASE_URL}/partner/2.0/login`,
    loginBody,
    {
      headers: {
        "secret": secretHeader,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!data?.token) {
    throw new Error('Easy Diner login succeeded but token was missing in response');
  }

  return data.token;
};

const getPaymentsToken = async (store) => {
  const creds = getEasyDinerCreds(store);
  if (!creds.username || !creds.secret || !creds.password) {
    throw new Error('Easy Diner credentials are incomplete. Configure secret and password.');
  }

  const { data } = await axios.post(
    `${PAYMENTS_BASE_URL}/partner/payments/login`,
    {
      username: creds.username || creds.secret,
      authkey: creds.password,
    },
    {
      headers: {
        "secret": creds.username || creds.secret,
        version: API_VERSION,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!data?.token) {
    throw new Error('Easy Diner payments login succeeded but token was missing in response');
  }

  return data.token;
};

// ---------------------------------------------------------------------------
// INBOUND — Booking webhook (Easy Diner -> Oniro)
// ---------------------------------------------------------------------------
router.post('/webhook/booking', async (req, res) => {
  try {
    const payload = req.body || {};

    const partnerStoreId =
      payload.partner_store_id ||
      payload.outlet_id ||
      payload.store_id ||
      payload.business_details?.store_id;

    const externalBookingId =
      payload.booking_id ||
      payload.easydiner_booking_id ||
      payload.reservation_id ||
      payload.id ||
      payload.partner_booking_id;

    if (!partnerStoreId || !externalBookingId) {
      return res.status(400).json({
        status: false,
        message: 'partner_store_id/outlet_id and booking_id are required',
      });
    }

    const store = await findStoreByEasyDinerOutletId(partnerStoreId);
    if (!store) {
      return res.status(404).json({
        status: false,
        message: 'Store not found for given partner_store_id',
      });
    }

    const expectedSecret = getEasyDinerCreds(store).secret;
    const incomingSecret = req.headers.secret || req.headers.authorization || '';
    if (!isSecretValid(incomingSecret, expectedSecret)) {
      return res.status(401).json({
        status: false,
        message: 'Invalid secret',
      });
    }

    const existing = await EasyDinerReservation.findOne({ easydiner_booking_id: String(externalBookingId) });
    if (existing) {
      return res.json({
        status: true,
        message: 'Booking already received',
        partner_booking_id: existing.partner_booking_id,
        booking_status: existing.booking_status,
      });
    }

    const partner_booking_id = makePartnerBookingId();
    const status = normalizeStatus(payload.status) || 'awaiting_confirmation';

    const reservation = await EasyDinerReservation.create({
      store: store._id,
      easydiner_booking_id: String(externalBookingId),
      partner_booking_id,
      partner_store_id: String(partnerStoreId),
      booking_status: STATUS_VALUES.has(status) ? status : 'awaiting_confirmation',
      remarks: payload.remarks || '',
      covers_count: Number(payload.covers_count || payload.guests || payload.pax || 0),
      reservation_time: resolveReservationDate(payload),
      customer_details: {
        name: payload.customer_name || payload.customer_details?.name || '',
        phone: payload.customer_phone || payload.customer_details?.phone || payload.customer_details?.contact_number || '',
        email: payload.customer_email || payload.customer_details?.email || payload.customer_details?.email_address || '',
      },
      raw_payload: payload,
    });

    return res.json({
      status: true,
      message: 'Booking received successfully',
      partner_booking_id: reservation.partner_booking_id,
      booking_status: reservation.booking_status,
    });
  } catch (error) {
    console.error('Easy Diner booking webhook error', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to process booking webhook',
    });
  }
});

router.use(auth);

// ---------------------------------------------------------------------------
// GET /api/easydiner/reservations
// ---------------------------------------------------------------------------
router.get('/reservations', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { storeId, booking_status } = req.query;
    const query = {};
    if (storeId) query.store = storeId;
    if (booking_status) query.booking_status = booking_status;

    const reservations = await EasyDinerReservation.find(query)
      .populate('store', 'name code city')
      .sort({ reservation_time: -1, createdAt: -1 });

    return res.json({ reservations });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch Easy Diner reservations' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/easydiner/partner/bookings
// Logs in to EasyDiner and fetches bookings for the selected partner_store_id.
// ---------------------------------------------------------------------------
router.get('/partner/bookings', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { storeId, booking_status } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: 'storeId is required' });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const creds = getEasyDinerCreds(store);
    const secret = creds.secret || creds.username;
    const partner_store_id = getPartnerStoreId(creds);

    if (!secret || !creds.password || !partner_store_id) {
      return res.status(400).json({
        message:
          'Easy Diner credentials are incomplete for this store (storeId/outletId, username/secret and password required)',
      });
    }

    const token = await getPartnerToken(store);

    let partnerResponse;
    try {
      const payload = { partner_store_id };
      const { data } = await axios.request({
        method: 'get',
        url: `${PARTNER_BASE_URL}/partner/2.0/booking`,
        headers: buildCommonHeaders(secret, token),
        params: payload,
        data: payload,
      });
      partnerResponse = data;
    } catch (apiError) {
      return res.status(502).json({
        message: 'Easy Diner booking list fetch failed',
        easyDinerError: apiError?.response?.data || apiError.message,
      });
    }

    let reservations = normalizePartnerBookings(partnerResponse);
    if (booking_status) {
      reservations = reservations.filter((r) => r.booking_status === normalizeStatus(booking_status));
    }

    return res.json({
      reservations,
      easyDinerResponse: partnerResponse,
    });
  } catch (error) {
    console.error('Easy Diner partner bookings fetch error', error);
    return res.status(500).json({ message: 'Failed to fetch Easy Diner bookings' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/easydiner/booking/status
// ---------------------------------------------------------------------------
router.patch('/booking/status', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { reservationId, status, remarks = '' } = req.body;
    const normalizedStatus = normalizeStatus(status);

    if (!reservationId || !STATUS_VALUES.has(normalizedStatus)) {
      return res.status(400).json({
        message: 'reservationId and status (cancelled|confirmed|completed|no_show) are required',
      });
    }

    if (normalizedStatus === 'cancelled' && !remarks) {
      return res.status(400).json({ message: 'remarks is required for cancelled status' });
    }

    const reservation = await EasyDinerReservation.findById(reservationId).populate('store');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const store = reservation.store;
    const creds = getEasyDinerCreds(store);
    const secret = creds.secret;
    const partner_store_id = creds.outletId || reservation.partner_store_id;

    if (!secret || !partner_store_id) {
      return res.status(400).json({
        message: 'Easy Diner credentials are incomplete for this store (secret/outletId required)',
      });
    }

    const token = await getPartnerToken(store);

    let partnerResponse;
    try {
      const { data } = await axios.patch(
        `${PARTNER_BASE_URL}/partner/2.0/booking`,
        {
          partner_booking_id: reservation.partner_booking_id,
          partner_store_id,
          remarks,
          status: normalizedStatus,
        },
        { headers: buildCommonHeaders(secret, token) }
      );
      partnerResponse = data;
    } catch (apiError) {
      return res.status(502).json({
        message: 'Easy Diner booking status update failed',
        easyDinerError: apiError?.response?.data || apiError.message,
      });
    }

    reservation.booking_status = normalizedStatus;
    reservation.remarks = remarks || reservation.remarks;
    await reservation.save();

    return res.json({
      message: 'Booking status updated',
      reservation,
      easyDinerResponse: partnerResponse,
    });
  } catch (error) {
    console.error('Easy Diner booking status update error', error);
    return res.status(500).json({ message: 'Failed to update Easy Diner booking status' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/easydiner/pay/verify
// ---------------------------------------------------------------------------
router.post('/pay/verify', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { storeId, order_id, outlet_id } = req.body;

    if (!storeId || !order_id) {
      return res.status(400).json({ message: 'storeId and order_id are required' });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const creds = getEasyDinerCreds(store);
    const effectiveOutletId = outlet_id || creds.outletId;

    if (!creds.secret || !effectiveOutletId) {
      return res.status(400).json({
        message: 'Easy Diner credentials are incomplete for this store (secret/outletId required)',
      });
    }

    const token = await getPaymentsToken(store);

    let verifyResponse;
    try {
      const { data } = await axios.post(
        `${PAYMENTS_BASE_URL}/partner/payments/status`,
        {
          outlet_id: String(effectiveOutletId),
          order_id: String(order_id),
        },
        {
          headers: buildCommonHeaders(creds.secret, token),
        }
      );
      verifyResponse = data;
    } catch (apiError) {
      return res.status(502).json({
        message: 'Easy Diner payment verification failed',
        easyDinerError: apiError?.response?.data || apiError.message,
      });
    }

    return res.json({ data: verifyResponse });
  } catch (error) {
    console.error('Easy Diner payment verification error', error);
    return res.status(500).json({ message: 'Failed to verify Easy Diner payment' });
  }
});

module.exports = router;
