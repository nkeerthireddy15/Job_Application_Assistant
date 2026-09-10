import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  originalName: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  targetRoles: { type: [String], default: [] },
  targetSkills: { type: [String], default: [] },
  isDefault: { type: Boolean, default: false, index: true },
  notes: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("Resume", resumeSchema);
