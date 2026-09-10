import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import profileRoutes from "./routes/profile.js";
import jobRoutes from "./routes/jobs.js";
import statsRoutes from "./routes/stats.js";
import resumeRoutes from "./routes/resumes.js";
import sourceRoutes from "./routes/sources.js";
import discoveryRoutes from "./routes/discovery.js";
import answerRoutes from "./routes/answers.js";
import emailSignalRoutes from "./routes/emailSignals.js";

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));
  app.get("/api/health", (_req, res) => res.json({ success: true, message: "ApplyPilot AI v2 is healthy" }));
  app.use("/api/profile", profileRoutes);
  app.use("/api/jobs", jobRoutes);
  app.use("/api/stats", statsRoutes);
  app.use("/api/resumes", resumeRoutes);
  app.use("/api/sources", sourceRoutes);
  app.use("/api/discovery", discoveryRoutes);
  app.use("/api/answers", answerRoutes);
  app.use("/api/email-signals", emailSignalRoutes);
  app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ success: false, message: err.message || "Internal server error" }); });
  return app;
}
