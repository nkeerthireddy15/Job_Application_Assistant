import { Router } from "express";
import Job from "../models/Job.js";
const router = Router();
router.get("/", async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [total, strong, applied, interviews, skipped, todayCount, sources] = await Promise.all([
    Job.countDocuments(), Job.countDocuments({ matchScore: { $gte: 75 } }), Job.countDocuments({ status: "applied" }),
    Job.countDocuments({ status: "interview" }), Job.countDocuments({ status: "skipped" }),
    Job.countDocuments({ discoveredAt: { $gte: today } }), Job.distinct("sourceType")
  ]);
  res.json({ success: true, data: { total, strong, applied, interviews, skipped, today: todayCount, sources: sources.length } });
});
export default router;
