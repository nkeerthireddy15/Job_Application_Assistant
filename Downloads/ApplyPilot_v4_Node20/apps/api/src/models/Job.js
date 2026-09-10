import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  externalId: { type: String, index: true },
  source: { type: String, default: "manual", index: true },
  sourceType: { type: String, default: "manual", index: true },
  company: { type: String, required: true },
  title: { type: String, required: true },
  location: { type: String, default: "" },
  url: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  employmentType: { type: String, default: "" },
  minExperience: { type: Number, default: null },
  maxExperience: { type: Number, default: null },
  skills: { type: [String], default: [] },
  matchScore: { type: Number, default: 0, index: true },
  localScore: { type: Number, default: 0 },
  aiScore: { type: Number, default: null },
  matchReasons: { type: [String], default: [] },
  aiSummary: { type: String, default: "" },
  recommendedResumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", default: null },
  status: {
    type: String,
    enum: ["new", "shortlisted", "applied", "skipped", "interview", "rejected", "offer"],
    default: "new",
    index: true
  },
  discoveredAt: { type: Date, default: Date.now, index: true },
  appliedAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

jobSchema.index({ source: 1, externalId: 1 }, { unique: true, sparse: true });
export default mongoose.model("Job", jobSchema);
