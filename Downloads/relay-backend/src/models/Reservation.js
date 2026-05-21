const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    platform: {
      type: String,
      enum: ['zomato', 'swiggy', 'easyDiner'],
      required: true,
    },
    externalReservationId: {
      type: String,
      required: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    guests: {
      type: Number,
      required: true,
      min: 1,
    },
    reservationTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

reservationSchema.index({ store: 1, platform: 1, reservationTime: -1 });
reservationSchema.index({ externalReservationId: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('Reservation', reservationSchema);
