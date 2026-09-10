const normalize = (
  value = ""
) =>
  String(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9+#.\-– ]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

const COMMON_ROLE_WORDS =
  new Set([
    "developer",
    "engineer",
    "software",
    "stack",
    "full",
    "senior",
    "junior",
    "remote",
  ]);

export function extractExperience(
  text = ""
) {
  const value =
    normalize(text);

  const patterns = [
    /(\d+)\s*[-–to]+\s*(\d+)\s*(?:years|yrs|year)/i,

    /(\d+)\s*(?:to)\s*(\d+)\s*(?:years|yrs|year)/i,

    /(\d+)\+?\s*(?:years|yrs|year)/i,

    /minimum\s*(\d+)\s*(?:years|yrs|year)/i,

    /at\s*least\s*(\d+)\s*(?:years|yrs|year)/i,
  ];

  for (const pattern of patterns) {
    const match =
      value.match(pattern);

    if (!match) {
      continue;
    }

    if (match[2]) {
      return {
        min: Number(
          match[1]
        ),
        max: Number(
          match[2]
        ),
      };
    }

    return {
      min: Number(
        match[1]
      ),
      max: null,
    };
  }

  return {
    min: null,
    max: null,
  };
}

function roleWords(
  role = ""
) {
  return normalize(role)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !COMMON_ROLE_WORDS.has(
          word
        )
    );
}

function getRoleMatch(
  title,
  targetRoles = []
) {
  const normalizedTitle =
    normalize(title);

  let best = null;
  let bestStrength = 0;

  for (const role of targetRoles) {
    const normalizedRole =
      normalize(role);

    if (
      normalizedTitle.includes(
        normalizedRole
      )
    ) {
      return {
        role,
        strength: 1,
      };
    }

    const words =
      roleWords(role);

    if (!words.length) {
      continue;
    }

    const matches =
      words.filter((word) =>
        normalizedTitle.includes(
          word
        )
      );

    const strength =
      matches.length /
      words.length;

    if (
      strength >
      bestStrength
    ) {
      bestStrength =
        strength;

      best = role;
    }
  }

  if (
    best &&
    bestStrength >= 0.5
  ) {
    return {
      role: best,
      strength:
        bestStrength,
    };
  }

  return null;
}

function detectSeniorityMismatch(
  title = "",
  yearsExperience = 0
) {
  const value =
    normalize(title);

  if (
    yearsExperience < 5 &&
    /\b(principal|staff|architect|director|head|vp|vice president)\b/.test(
      value
    )
  ) {
    return true;
  }

  if (
    yearsExperience < 4 &&
    /\bsenior\b/.test(
      value
    )
  ) {
    return true;
  }

  return false;
}

function findSkillMatches(
  jobText,
  skills = []
) {
  const normalizedText =
    normalize(jobText);

  return skills.filter(
    (skill) => {
      const normalizedSkill =
        normalize(skill);

      if (
        !normalizedSkill
      ) {
        return false;
      }

      return normalizedText.includes(
        normalizedSkill
      );
    }
  );
}

function freshnessScore(
  postedAgeDays
) {
  if (
    postedAgeDays == null
  ) {
    return {
      points: 4,
      label:
        "Posting age unknown",
    };
  }

  if (
    postedAgeDays <= 2
  ) {
    return {
      points: 10,
      label:
        `Fresh posting: ${postedAgeDays} day${
          postedAgeDays === 1
            ? ""
            : "s"
        } old`,
    };
  }

  if (
    postedAgeDays <= 7
  ) {
    return {
      points: 8,
      label:
        `Posted ${postedAgeDays} days ago`,
    };
  }

  if (
    postedAgeDays <= 14
  ) {
    return {
      points: 5,
      label:
        `Posted ${postedAgeDays} days ago`,
    };
  }

  if (
    postedAgeDays <= 30
  ) {
    return {
      points: 2,
      label:
        `Older posting: ${postedAgeDays} days`,
    };
  }

  return {
    points: 0,
    label:
      `Old posting: ${postedAgeDays} days`,
  };
}

export function evaluateJobQuality(
  job,
  profile
) {
  const reasons = [];

  const yearsExperience =
    Number(
      profile?.yearsExperience ||
        0
    );

  const title =
    normalize(job.title);

  const description =
    normalize(
      job.description
    );

  const combined = `${title} ${description}`;

  if (
    job?.metadata
      ?.listingPage === true
  ) {
    return {
      accepted: false,
      reason:
        "Generic job listing/search page",
    };
  }

  const excludedKeywords =
    profile?.excludedKeywords ||
    [];

  const excludedMatch =
    excludedKeywords.find(
      (keyword) =>
        combined.includes(
          normalize(keyword)
        )
    );

  if (excludedMatch) {
    return {
      accepted: false,
      reason: `Excluded keyword: ${excludedMatch}`,
    };
  }

  if (
    detectSeniorityMismatch(
      job.title,
      yearsExperience
    )
  ) {
    return {
      accepted: false,
      reason:
        "Seniority above target experience",
    };
  }

  const expFromText =
    extractExperience(
      `${job.title} ${job.description}`
    );

  const minExperience =
    job.minExperience ??
    expFromText.min;

  const maxExperience =
    job.maxExperience ??
    expFromText.max;

 if (minExperience != null) {
  /*
   * Candidate has ~3 years.
   *
   * Accept:
   * 1+, 2+, 3+, 4+
   *
   * Reject only when the role is clearly
   * outside a realistic stretch.
   */
  const allowedStretch = 1.5;

  if (
    minExperience >
    yearsExperience + allowedStretch
  ) {
    return {
      accepted: false,
      reason: `Requires ${minExperience}+ years`,
    };
  }
}

  const postedAgeDays =
    job?.metadata
      ?.postedAgeDays;

  if (
    postedAgeDays != null &&
    postedAgeDays > 30
  ) {
    return {
      accepted: false,
      reason: `Posting appears ${postedAgeDays} days old`,
    };
  }

  const roleMatch =
    getRoleMatch(
      job.title,
      profile?.targetRoles ||
        []
    );

  if (!roleMatch) {
    const relevantRoleWords =
      [
        "react",
        "node",
        "mern",
        "frontend",
        "backend",
        "fullstack",
        "full stack",
        "javascript",
      ];

    const relevant =
      relevantRoleWords.some(
        (word) =>
          combined.includes(
            word
          )
      );

    if (!relevant) {
      return {
        accepted: false,
        reason:
          "Role does not match target job families",
      };
    }
  }

  return {
    accepted: true,
    reasons,
  };
}

export function scoreJob(
  job,
  profile
) {
  const title =
    normalize(job.title);

  const description =
    normalize(
      job.description
    );

  const location =
    normalize(
      job.location
    );

  const combined =
    `${title} ${description} ${location}`;

  const reasons = [];

  let score = 0;

  /*
   * ----------------------------------
   * ROLE MATCH — 25
   * ----------------------------------
   */

  const roleMatch =
    getRoleMatch(
      job.title,
      profile?.targetRoles ||
        []
    );

  if (roleMatch) {
    const rolePoints =
      Math.round(
        25 *
          roleMatch.strength
      );

    score += rolePoints;

    reasons.push(
      `Role match: ${roleMatch.role}`
    );
  }

  /*
   * ----------------------------------
   * CORE SKILLS — 30
   * ----------------------------------
   */

  const skillMatches =
    findSkillMatches(
      combined,
      profile?.skills || []
    );

  if (
    skillMatches.length > 0
  ) {
    const skillPoints =
      Math.min(
        30,
        skillMatches.length *
          6
      );

    score += skillPoints;

    reasons.push(
      `${skillMatches.length} skill matches: ${skillMatches
        .slice(0, 6)
        .join(", ")}`
    );
  }

  /*
   * ----------------------------------
   * EXPERIENCE — 20
   * ----------------------------------
   */

  const expFromText =
    extractExperience(
      `${job.title} ${job.description}`
    );

  const minExperience =
    job.minExperience ??
    expFromText.min;

  const maxExperience =
    job.maxExperience ??
    expFromText.max;

  const years =
    Number(
      profile?.yearsExperience ||
        0
    );

  if (
    minExperience == null
  ) {
    score += 10;

    reasons.push(
      "No blocking experience requirement found"
    );
  } else if (
    years >= minExperience &&
    (maxExperience == null ||
      years <=
        maxExperience + 1)
  ) {
    score += 20;

    reasons.push(
      `Experience fits ${
        maxExperience
          ? `${minExperience}-${maxExperience}`
          : `${minExperience}+`
      } years`
    );
   } else if (
  years + 1.5 >= minExperience
) {
  score += 12;

  reasons.push(
    `Realistic experience stretch: requires ${minExperience}+ years`
  );
}

  /*
   * ----------------------------------
   * LOCATION — 10
   * ----------------------------------
   */

  const preferredLocation =
    (
      profile?.preferredLocations ||
      []
    ).find((loc) =>
      combined.includes(
        normalize(loc)
      )
    );

  if (preferredLocation) {
    score += 10;

    reasons.push(
      `Preferred location: ${preferredLocation}`
    );
  } else if (
    /\bremote\b/.test(
      combined
    )
  ) {
    score += 8;

    reasons.push(
      "Remote opportunity"
    );
  } else if (
    /\bindia\b/.test(
      combined
    )
  ) {
    score += 6;

    reasons.push(
      "India-based role"
    );
  }

  /*
   * ----------------------------------
   * FRESHNESS — 10
   * ----------------------------------
   */

  const freshness =
    freshnessScore(
      job?.metadata
        ?.postedAgeDays
    );

  score +=
    freshness.points;

  reasons.push(
    freshness.label
  );

  /*
   * ----------------------------------
   * BONUS RELEVANCE — 5
   * ----------------------------------
   */

  const bonusWords = [
    "next.js",
    "nextjs",
    "express",
    "mongodb",
    "rest api",
    "typescript",
    "react native",
    "git",
    "aws",
  ];

  const bonusMatches =
    bonusWords.filter(
      (word) =>
        combined.includes(
          normalize(word)
        )
    );

  if (
    bonusMatches.length
  ) {
    const bonus =
      Math.min(
        5,
        bonusMatches.length
      );

    score += bonus;

    reasons.push(
      `Relevant extras: ${bonusMatches
        .slice(0, 4)
        .join(", ")}`
    );
  }

  /* SOURCE PRIORITY - up to 5. Prefer direct ATS/developer-focused sources when matches are otherwise similar. */
  const sourcePriority = { greenhouse: 5, lever: 5, ashby: 5, workable: 5, cutshort: 5, instahyre: 5, hirist: 5, yc: 5, wellfound: 4, web: 4, naukri: 2, indeed: 1, linkedin: 0 };
  const sourceBonus = sourcePriority[String(job?.sourceType || "").toLowerCase()] ?? 2;
  if (sourceBonus > 0) { score += sourceBonus; reasons.push(`Source priority bonus: +${sourceBonus}`); }

  /*
   * ----------------------------------
   * PENALTIES
   * ----------------------------------
   */

  if (
    detectSeniorityMismatch(
      job.title,
      years
    )
  ) {
    score -= 25;

    reasons.push(
      "Seniority mismatch"
    );
  }

  if (
    job?.metadata
      ?.listingPage === true
  ) {
    score -= 40;

    reasons.push(
      "Generic listing page"
    );
  }

  return {
    score: Math.max(
      0,
      Math.min(
        100,
        Math.round(score)
      )
    ),

    reasons:
      reasons.slice(0, 8),

    skillMatches,

    roleMatch:
      roleMatch?.role || null,

    minExperience,

    maxExperience,
  };
}