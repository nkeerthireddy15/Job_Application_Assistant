import mongoose from "mongoose";

const sourceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["greenhouse", "lever", "ashby", "workable", "serper"], required: true },
  value: { type: String, required: true },
  company: { type: String, default: "" },
  enabled: { type: Boolean, default: true, index: true },
  lastRunAt: { type: Date, default: null },
  lastFetched: { type: Number, default: 0 },
  lastSaved: { type: Number, default: 0 },
  lastError: { type: String, default: "" }
}, { timestamps: true });

sourceSchema.index({ type: 1, value: 1 }, { unique: true });
export default mongoose.model("Source", sourceSchema);
