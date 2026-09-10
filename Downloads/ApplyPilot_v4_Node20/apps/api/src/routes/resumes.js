import { Router } from "express";
import multer from "multer";
import { fileURLToPath } from "node:url";
import Resume from "../models/Resume.js";

const router = Router();
const uploadDir = fileURLToPath(new URL("../../uploads/", import.meta.url));
const upload = multer({ dest: uploadDir, limits: { fileSize: 8 * 1024 * 1024 } });
router.get("/", async (_req, res) => res.json({ success: true, data: await Resume.find().sort({ isDefault: -1, createdAt: -1 }) }));
router.post("/", upload.single("resume"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Resume file is required" });
  const isDefault = String(req.body.isDefault) === "true";
  if (isDefault) await Resume.updateMany({}, { $set: { isDefault: false } });
  const resume = await Resume.create({ name: req.body.name || req.file.originalname, path: req.file.path, originalName: req.file.originalname, mimeType: req.file.mimetype, targetRoles: String(req.body.targetRoles || "").split(",").map((x) => x.trim()).filter(Boolean), targetSkills: String(req.body.targetSkills || "").split(",").map((x) => x.trim()).filter(Boolean), notes: req.body.notes || "", isDefault });
  res.status(201).json({ success: true, data: resume });
});
router.patch("/:id/default", async (req, res) => { await Resume.updateMany({}, { $set: { isDefault: false } }); const resume = await Resume.findByIdAndUpdate(req.params.id, { isDefault: true }, { new: true }); if (!resume) return res.status(404).json({ success: false, message: "Resume not found" }); res.json({ success: true, data: resume }); });
router.delete("/:id", async (req, res) => { await Resume.findByIdAndDelete(req.params.id); res.json({ success: true }); });
export default router;
