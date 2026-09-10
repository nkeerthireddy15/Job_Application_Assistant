import { Router } from "express";
import Source from "../models/Source.js";
import { importBySource } from "../services/importers.js";
import { processAndSaveJobs } from "../services/jobProcessor.js";

const router = Router();
router.get("/", async (_req, res) => res.json({ success: true, data: await Source.find().sort({ createdAt: -1 }) }));
router.post("/", async (req, res) => {
  const source = await Source.create({ name: req.body.name, type: req.body.type, value: String(req.body.value || "").trim(), company: req.body.company || "", enabled: req.body.enabled !== false });
  res.status(201).json({ success: true, data: source });
});
router.patch("/:id", async (req, res) => {
  const source = await Source.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!source) return res.status(404).json({ success: false, message: "Source not found" });
  res.json({ success: true, data: source });
});
router.delete("/:id", async (req, res) => { await Source.findByIdAndDelete(req.params.id); res.json({ success: true }); });
router.post("/:id/run", async (req, res) => {
  const source = await Source.findById(req.params.id);
  if (!source) return res.status(404).json({ success: false, message: "Source not found" });
  const jobs = await importBySource(source);
  const result = await processAndSaveJobs(jobs, { useAI: req.body.useAI === true, minScore: Number(req.body.minScore || 0) });
  source.lastRunAt = new Date(); source.lastFetched = jobs.length; source.lastSaved = result.saved; source.lastError = ""; await source.save();
  res.json({ success: true, fetched: jobs.length, ...result });
});
export default router;
