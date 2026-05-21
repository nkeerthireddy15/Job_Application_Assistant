const mongoose = require('mongoose');

const platformCredSchema = new mongoose.Schema(
  {
    storeId:      { type: String, default: '' }, // platform-specific store/outlet identifier
    username:     { type: String, default: '' },
    password:     { type: String, default: '' },
    outletId:     { type: String, default: '' },
    restaurantId: { type: String, default: '' },
    apiKey:       { type: String, default: '' },
    secret:       { type: String, default: '' },
  },
  { _id: false }
);

const storeSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    code:     { type: String, required: true, unique: true, uppercase: true, trim: true },
    city:     { type: String, required: true, trim: true },
    address:  { type: String, default: '', trim: true },
    phone:    { type: String, default: '', trim: true },
    email:    { type: String, default: '', trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    integrations: {
      zomato:    { type: platformCredSchema, default: () => ({}) },
      swiggy:    { type: platformCredSchema, default: () => ({}) },
      easyDiner: { type: platformCredSchema, default: () => ({}) },
      epos:      { type: platformCredSchema, default: () => ({}) },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Store', storeSchema);
