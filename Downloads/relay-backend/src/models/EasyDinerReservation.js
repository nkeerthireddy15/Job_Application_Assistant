const mongoose = require('mongoose');

const EasyDinerCustomerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  { _id: false }
);

const EasyDinerReservationSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },

    easydiner_booking_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    partner_booking_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    partner_store_id: {
      type: String,
      required: true,
      trim: true,
    },

    booking_status: {
      type: String,
      enum: ['awaiting_confirmation', 'confirmed', 'cancelled', 'completed', 'no_show', 'failed'],
      default: 'awaiting_confirmation',
    },

    remarks: {
      type: String,
      default: '',
      trim: true,
    },

    covers_count: {
      type: Number,
      default: 0,
    },

    reservation_time: {
      type: Date,
      default: null,
    },

    customer_details: {
      type: EasyDinerCustomerSchema,
      default: () => ({}),
    },

    raw_payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

EasyDinerReservationSchema.index({ store: 1, booking_status: 1, reservation_time: -1 });
EasyDinerReservationSchema.index({ partner_store_id: 1, partner_booking_id: 1 });

module.exports = mongoose.model('EasyDinerReservation', EasyDinerReservationSchema);
