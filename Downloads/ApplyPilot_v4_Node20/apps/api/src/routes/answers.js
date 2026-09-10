import { Router } from "express";
import Job from "../models/Job.js";
import Profile from "../models/Profile.js";
import ApplicationAnswer from "../models/ApplicationAnswer.js";
import { generateAnswer } from "../services/ai.js";

const router = Router();
router.get("/:jobId", async (req, res) => res.json({ success: true, data: await ApplicationAnswer.find({ jobId: req.params.jobId }).sort({ createdAt: -1 }) }));
router.post("/:jobId/generate", async (req, res) => {
  const [job, profile] = await Promise.all([Job.findById(req.params.jobId).lean(), Profile.findOne({ singletonKey: "default" }).lean()]);
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  if (!profile) return res.status(400).json({ success: false, message: "Complete profile first" });
  const question = String(req.body.question || "").trim();
  if (!question) return res.status(400).json({ success: false, message: "question is required" });
  const generated = await generateAnswer({ question, job, profile });
  const row = await ApplicationAnswer.findOneAndUpdate({ jobId: job._id, question }, { $set: { answer: generated.answer, generatedBy: generated.generatedBy, approved: false } }, { upsert: true, new: true });
  res.json({ success: true, data: row });
});
router.patch("/:answerId", async (req, res) => {
  const row = await ApplicationAnswer.findByIdAndUpdate(req.params.answerId, req.body, { new: true });
  if (!row) return res.status(404).json({ success: false, message: "Answer not found" });
  res.json({ success: true, data: row });
});
export default router;
