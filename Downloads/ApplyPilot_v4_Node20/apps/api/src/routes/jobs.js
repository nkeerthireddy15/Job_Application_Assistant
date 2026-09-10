import { Router } from "express";
import Job from "../models/Job.js";
import { scoreJob } from "../services/matcher.js";
import { getProfile, processAndSaveJobs } from "../services/jobProcessor.js";
import { importGreenhouse, importLever, importAshby, importWorkable } from "../services/importers.js";
import { aiScoreJob } from "../services/ai.js";

const router = Router();

router.get("/", async (req, res) => {
  const { status, q, sourceType, minScore = 0, limit = 100 } = req.query;
  const filter = { matchScore: { $gte: Number(minScore) || 0 } };
  if (status && status !== "all") filter.status = status;
  if (sourceType && sourceType !== "all") filter.sourceType = sourceType;
  if (q) filter.$or = ["title", "company", "location", "description"].map((field) => ({ [field]: { $regex: q, $options: "i" } }));
  const jobs = await Job.find(filter).populate("recommendedResumeId").sort({ matchScore: -1, discoveredAt: -1 }).limit(Math.min(Number(limit) || 100, 500));
  res.json({ success: true, data: jobs });
});

router.get("/:id", async (req, res) => {
  const job = await Job.findById(req.params.id).populate("recommendedResumeId");
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  res.json({ success: true, data: job });
});

router.post("/", async (req, res) => {
  const result = await processAndSaveJobs([req.body], { useAI: req.body.useAI === true });
  const job = await Job.findOne({ url: req.body.url });
  res.status(201).json({ success: true, data: job, ...result });
});

router.patch("/:id/status", async (req, res) => {
  const allowed = ["new", "shortlisted", "applied", "skipped", "interview", "rejected", "offer"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ success: false, message: "Invalid status" });
  const update = { status: req.body.status };
  if (req.body.status === "applied") update.appliedAt = new Date();
  const job = await Job.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  res.json({ success: true, data: job });
});

router.post("/rescore", async (req, res) => {
  const profile = await getProfile();
  const jobs = await Job.find();
  let aiCount = 0;
  for (const job of jobs) {
    const local = scoreJob(job.toObject(), profile);
    let ai = null;
    if (req.body.useAI === true && process.env.GEMINI_API_KEY) {
      try { ai = await aiScoreJob(job.toObject(), profile, local); aiCount += 1; } catch (e) { console.warn(e.message); }
    }
    job.localScore = local.score;
    job.aiScore = ai?.score ?? null;
    job.matchScore = ai?.score != null ? Math.round(local.score * 0.55 + Number(ai.score) * 0.45) : local.score;
    job.matchReasons = [...local.reasons, ...(ai?.reasons || [])].slice(0, 8);
    job.aiSummary = ai?.summary || "";
    await job.save();
  }
  res.json({ success: true, rescored: jobs.length, aiScored: aiCount });
});

async function importAndSave(importer, value, company, req, res) {
  const jobs = await importer(value, company);
  const result = await processAndSaveJobs(jobs, { useAI: req.body.useAI === true, minScore: Number(req.body.minScore || 0) });
  res.json({ success: true, fetched: jobs.length, ...result });
}
router.post("/import/greenhouse", (req, res, next) => importAndSave(importGreenhouse, String(req.body.boardToken || "").trim(), req.body.company, req, res).catch(next));
router.post("/import/lever", (req, res, next) => importAndSave(importLever, String(req.body.site || "").trim(), req.body.company, req, res).catch(next));
router.post("/import/ashby", (req, res, next) => importAndSave(importAshby, String(req.body.boardName || "").trim(), req.body.company, req, res).catch(next));
router.post("/import/workable", (req, res, next) => importAndSave(importWorkable, String(req.body.subdomain || "").trim(), req.body.company, req, res).catch(next));

export default router;
