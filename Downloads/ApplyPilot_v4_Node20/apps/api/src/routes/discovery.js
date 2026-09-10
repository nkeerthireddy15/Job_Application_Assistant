import { Router } from "express";

import Source from "../models/Source.js";

import {
  importBySource,
} from "../services/importers.js";

import {
  discoverWithSerper,
  buildDiscoveryQueries,
} from "../services/discovery.js";

import {
  getProfile,
  processAndSaveJobs,
} from "../services/jobProcessor.js";

const router = Router();

router.get("/queries", async (_req, res) => {
  try {
    const profile = await getProfile();

    const queries =
      buildDiscoveryQueries(profile);

    return res.json({
      success: true,
      data: queries,
    });
  } catch (error) {
    console.error(
      "[Discovery Queries Error]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to build discovery queries",
    });
  }
});

router.post("/run", async (req, res) => {
  try {
    console.log(
      "\n========== DISCOVERY START =========="
    );

    const profile = await getProfile();

    const maxJobs = Math.min(
      Number(
        req.body?.maxJobs ||
          process.env.DISCOVERY_MAX_JOBS ||
          300
      ),
      500
    );

    const minScore = Number(
      req.body?.minScore ??
        process.env.DISCOVERY_MIN_SCORE ??
        55
    );

    const useAI =
      req.body?.useAI === true;

    const jobs = [];
    const errors = [];

    /*
     * --------------------------------------------------
     * ATS SOURCES
     * --------------------------------------------------
     */

    const sources = await Source.find({
      enabled: true,
      type: {
        $ne: "serper",
      },
    });

    console.log(
      `[Discovery] Enabled ATS sources: ${sources.length}`
    );

    for (const source of sources) {
      if (jobs.length >= maxJobs) {
        break;
      }

      try {
        console.log(
          `[ATS] Importing ${source.name} (${source.type})`
        );

        const fetched =
          await importBySource(source);

        jobs.push(...fetched);

        source.lastRunAt = new Date();
        source.lastFetched =
          fetched.length;
        source.lastError = "";

        await source.save();

        console.log(
          `[ATS] ${source.name}: ${fetched.length} jobs`
        );
      } catch (error) {
        const message = `${source.name}: ${error.message}`;

        console.error(
          "[ATS Error]",
          message
        );

        errors.push(message);

        source.lastRunAt = new Date();
        source.lastError =
          error.message;

        await source.save();
      }
    }

    /*
     * --------------------------------------------------
     * SERPER WEB DISCOVERY
     * --------------------------------------------------
     */

    const serperEnabled =
      Boolean(
        process.env.SERPER_API_KEY
      );

    console.log(
      `[Discovery] Serper enabled: ${serperEnabled}`
    );

    let serperFetched = 0;

    if (
      serperEnabled &&
      jobs.length < maxJobs
    ) {
      try {
        const discovered =
          await discoverWithSerper(
            profile,
            maxJobs - jobs.length
          );

        serperFetched =
          discovered.length;

        jobs.push(...discovered);

        console.log(
          `[Discovery] Serper fetched ${serperFetched} jobs`
        );
      } catch (error) {
        const message =
          `Web discovery: ${error.message}`;

        console.error(
          "[Serper Error]",
          message
        );

        errors.push(message);
      }
    } else if (!serperEnabled) {
      errors.push(
        "SERPER_API_KEY is not configured"
      );
    }

    /*
     * --------------------------------------------------
     * REMOVE DUPLICATES
     * --------------------------------------------------
     */

    const uniqueMap = new Map();

    for (const job of jobs) {
      if (!job?.url) {
        continue;
      }

      const key = String(job.url)
        .split("?")[0]
        .replace(/\/$/, "")
        .toLowerCase();

      if (!uniqueMap.has(key)) {
        uniqueMap.set(
          key,
          job
        );
      }
    }

    const uniqueJobs = [
      ...uniqueMap.values(),
    ].slice(0, maxJobs);

    console.log(
      `[Discovery] Total raw jobs: ${jobs.length}`
    );

    console.log(
      `[Discovery] Unique jobs: ${uniqueJobs.length}`
    );

    /*
     * --------------------------------------------------
     * MATCH + SAVE
     * --------------------------------------------------
     */

    const result =
      await processAndSaveJobs(
        uniqueJobs,
        {
          useAI,
          minScore,
        }
      );

    console.log(
      "[Discovery] Processing result:",
      result
    );

    console.log(
      "========== DISCOVERY END ==========\n"
    );

    return res.json({
      success: true,

      fetched:
        uniqueJobs.length,

      rawFetched:
        jobs.length,

      serperFetched,

      atsFetched:
        jobs.length -
        serperFetched,

      ...result,

      errors,

      serperEnabled,

      minScore,

      useAI,
    });
  } catch (error) {
    console.error(
      "[Discovery Run Error]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Discovery failed",
    });
  }
});

export default router;