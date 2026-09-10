import Job from "../models/Job.js";
import Profile from "../models/Profile.js";
import Resume from "../models/Resume.js";

import {
  scoreJob,
  evaluateJobQuality,
} from "./matcher.js";

import {
  aiScoreJob,
} from "./ai.js";

import {
  selectResume,
} from "./resumeSelector.js";

export async function getProfile() {
  return Profile.findOneAndUpdate(
    {
      singletonKey:
        "default",
    },
    {
      $setOnInsert: {
        singletonKey:
          "default",
      },
    },
    {
      upsert: true,
      new: true,
    }
  ).lean();
}

export async function processAndSaveJobs(
  rawJobs,
  {
    useAI = false,
    minScore = 0,
  } = {}
) {
  const profile =
    await getProfile();

  const resumes =
    await Resume.find().lean();

  let saved = 0;

  let ignored = 0;

  let rejectedQuality = 0;

  const rejectionSummary = {};

  for (const rawJob of rawJobs) {
    /*
     * --------------------------------
     * QUALITY GATE
     * --------------------------------
     */

    const quality =
      evaluateJobQuality(
        rawJob,
        profile
      );

    if (!quality.accepted) {
      rejectedQuality += 1;

      const reason =
        quality.reason ||
        "Quality filter";

      rejectionSummary[
        reason
      ] =
        (
          rejectionSummary[
            reason
          ] || 0
        ) + 1;

      continue;
    }

    /*
     * --------------------------------
     * LOCAL MATCHING
     * --------------------------------
     */

    const local =
      scoreJob(
        rawJob,
        profile
      );

    /*
     * --------------------------------
     * OPTIONAL AI RESCORING
     * --------------------------------
     */

    let ai = null;

    const shouldUseAI =
      useAI &&
      Boolean(
        process.env
          .GEMINI_API_KEY
      ) &&
      local.score >=
        Math.max(
          40,
          Number(
            minScore
          ) - 15
        );

    if (shouldUseAI) {
      try {
        ai =
          await aiScoreJob(
            rawJob,
            profile,
            local
          );
      } catch (error) {
        console.warn(
          "AI score failed:",
          error.message
        );
      }
    }

    /*
     * --------------------------------
     * FINAL SCORE
     * --------------------------------
     */

    const finalScore =
      ai?.score != null
        ? Math.round(
            local.score *
              0.65 +
              Number(
                ai.score
              ) *
                0.35
          )
        : local.score;

    if (
      finalScore <
      Number(
        minScore || 0
      )
    ) {
      ignored += 1;

      continue;
    }

    /*
     * --------------------------------
     * RESUME SELECTION
     * --------------------------------
     */

    const resume =
      selectResume(
        rawJob,
        resumes
      );

    /*
     * --------------------------------
     * SAVE
     * --------------------------------
     */

    try {
      await Job.findOneAndUpdate(
        {
          url: rawJob.url,
        },

        {
          $set: {
            ...rawJob,

            localScore:
              local.score,

            aiScore:
              ai?.score ??
              null,

            matchScore:
              finalScore,

            matchReasons: [
              ...local.reasons,

              ...(
                ai?.reasons ||
                []
              ),
            ].slice(0, 8),

            aiSummary:
              ai?.summary ||
              "",

            recommendedResumeId:
              resume?._id ||
              null,

            minExperience:
              local.minExperience ??
              rawJob.minExperience ??
              null,

            maxExperience:
              local.maxExperience ??
              rawJob.maxExperience ??
              null,

            skills:
              local.skillMatches ||
              [],
          },
        },

        {
          upsert: true,
          new: true,
          setDefaultsOnInsert:
            true,
        }
      );

      saved += 1;
    } catch (error) {
      if (
        error?.code !==
        11000
      ) {
        throw error;
      }
    }
  }

  console.log(
    "[Quality Filter]",
    {
      total:
        rawJobs.length,

      saved,

      ignoredByScore:
        ignored,

      rejectedQuality,

      rejectionSummary,
    }
  );

  return {
    saved,

    ignored,

    rejectedQuality,

    rejectionSummary,
  };
}