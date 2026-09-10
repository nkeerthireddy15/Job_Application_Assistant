import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  generatedBy: { type: String, default: "local" },
  approved: { type: Boolean, default: false }
}, { timestamps: true });

answerSchema.index({ jobId: 1, question: 1 }, { unique: true });
export default mongoose.model("ApplicationAnswer", answerSchema);
