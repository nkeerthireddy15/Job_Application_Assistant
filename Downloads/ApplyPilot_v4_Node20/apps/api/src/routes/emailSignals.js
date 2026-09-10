import { Router } from "express";
import { detectHiringSignal, scanGmail } from "../services/emailDetector.js";

const router = Router();
router.post("/analyze", async (req, res) => res.json({ success: true, data: detectHiringSignal(req.body || {}) }));
router.get("/gmail", async (_req, res) => {
  const token = process.env.GMAIL_ACCESS_TOKEN;
  if (!token) return res.status(400).json({ success: false, message: "GMAIL_ACCESS_TOKEN is not configured. Add an OAuth access token to enable Gmail scanning." });
  const data = await scanGmail(token);
  res.json({ success: true, data });
});
export default router;
