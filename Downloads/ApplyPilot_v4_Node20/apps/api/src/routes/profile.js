import { Router } from "express";
import Profile from "../models/Profile.js";
const router = Router();
const allowed = ["firstName","lastName","email","phone","city","currentTitle","yearsExperience","skills","targetRoles","preferredLocations","excludedKeywords","currentCTC","expectedCTC","noticePeriod","linkedin","github","portfolio","sponsorshipAnswer","about","customAnswers"];
router.get("/", async (_req, res) => {
  const profile = await Profile.findOneAndUpdate({ singletonKey: "default" }, { $setOnInsert: { singletonKey: "default" } }, { new: true, upsert: true });
  res.json({ success: true, data: profile });
});
router.put("/", async (req, res) => {
  const body = Object.fromEntries(allowed.filter((key) => Object.prototype.hasOwnProperty.call(req.body, key)).map((key) => [key, req.body[key]]));
  const profile = await Profile.findOneAndUpdate({ singletonKey: "default" }, { $set: body, $setOnInsert: { singletonKey: "default" } }, { new: true, upsert: true, runValidators: true });
  res.json({ success: true, data: profile });
});
export default router;
