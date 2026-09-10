import {
  expandListingSeeds,
} from "./listingExpander.js";

import {
  enrichJobs,
} from "./jobEnricher.js";

const cleanUrl = (url = "") => {
  try {
    const parsed = new URL(
      String(url)
    );

    parsed.hash = "";

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "source",
      "trk",
    ];

    trackingParams.forEach(
      (key) => {
        parsed.searchParams.delete(
          key
        );
      }
    );

    return parsed
      .toString()
      .replace(/\/$/, "");
  } catch {
    return String(url)
      .split("#")[0]
      .replace(/\/$/, "");
  }
};

function sourceTypeFromUrl(
  url = ""
) {
  const value = String(
    url
  ).toLowerCase();

  if (
    value.includes(
      "linkedin.com"
    )
  ) {
    return "linkedin";
  }

  if (
    value.includes(
      "indeed."
    )
  ) {
    return "indeed";
  }

  if (
    value.includes(
      "naukri.com"
    )
  ) {
    return "naukri";
  }

  if (
    value.includes(
      "wellfound.com"
    )
  ) {
    return "wellfound";
  }

  if (
    value.includes(
      "cutshort.io"
    )
  ) {
    return "cutshort";
  }

  if (
    value.includes(
      "instahyre.com"
    )
  ) {
    return "instahyre";
  }

  if (
    value.includes(
      "hirist.tech"
    ) ||
    value.includes(
      "hirist.com"
    )
  ) {
    return "hirist";
  }

  if (
    value.includes(
      "ycombinator.com/jobs"
    )
  ) {
    return "yc";
  }

  if (
    value.includes(
      "glassdoor."
    )
  ) {
    return "glassdoor";
  }

  if (
    value.includes(
      "greenhouse.io"
    ) ||
    value.includes(
      "boards.greenhouse.io"
    )
  ) {
    return "greenhouse";
  }

  if (
    value.includes(
      "lever.co"
    )
  ) {
    return "lever";
  }

  if (
    value.includes(
      "ashbyhq.com"
    )
  ) {
    return "ashby";
  }

  if (
    value.includes(
      "workable.com"
    )
  ) {
    return "workable";
  }

  return "web";
}

async function serperSearch(
  q,
  num = 20
) {
  const key =
    process.env.SERPER_API_KEY;

  if (!key) {
    throw new Error(
      "SERPER_API_KEY is not configured"
    );
  }

  const response =
    await fetch(
      "https://google.serper.dev/search",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "X-API-KEY":
            key,
        },

        body: JSON.stringify({
          q,
          num,

          gl: "in",

          hl: "en",
        }),
      }
    );

  const raw =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Serper search failed (${response.status}): ${raw.slice(
        0,
        300
      )}`
    );
  }

  try {
    return JSON.parse(
      raw
    );
  } catch {
    throw new Error(
      "Serper returned invalid JSON"
    );
  }
}

/*
 * =====================================================
 * DISCOVERY QUERIES
 * =====================================================
 */

export function buildDiscoveryQueries(
  profile = {}
) {
  const roles =
    profile?.targetRoles
      ?.length > 0
      ? profile.targetRoles.slice(
          0,
          5
        )
      : [
          "MERN Stack Developer",
          "Full Stack Developer",
          "React Developer",
          "Node.js Developer",
          "Frontend Developer",
        ];

  const locations =
    profile
      ?.preferredLocations
      ?.length > 0
      ? profile.preferredLocations.slice(
          0,
          3
        )
      : [
          "India",
          "Remote",
        ];

  const currentYear =
    new Date().getFullYear();

  const currentMonth =
    new Intl.DateTimeFormat(
      "en",
      {
        month: "long",
      }
    ).format(
      new Date()
    );

  const queries = [];

  for (
    const role of roles
  ) {
    /*
     * Fresh/general discovery
     */

    queries.push(
      `${role} hiring India ${currentMonth} ${currentYear}`
    );

    queries.push(
      `${role} 2 3 4 years India ${currentMonth} ${currentYear}`
    );

    queries.push(
      `${role} remote India hiring ${currentMonth} ${currentYear}`
    );

    for (
      const location of locations
    ) {
      queries.push(
        `${role} hiring ${location} ${currentMonth} ${currentYear}`
      );
    }

    /*
     * Lower-noise developer/startup portals.
     *
     * Do not use site: because Serper free
     * accounts can reject it.
     */

    queries.push(
      `${role} Cutshort India`
    );

    queries.push(
      `${role} Instahyre India`
    );

    queries.push(
      `${role} Hirist India`
    );

    queries.push(
      `${role} Wellfound India`
    );

    queries.push(
      `${role} YC startup India`
    );

    /*
     * High-volume boards used as
     * additional coverage.
     */

    queries.push(
      `${role} LinkedIn India hiring`
    );

    queries.push(
      `${role} Naukri India hiring`
    );

    queries.push(
      `${role} Indeed India hiring`
    );

    /*
     * Direct ATS sources.
     */

    queries.push(
      `${role} Greenhouse India`
    );

    queries.push(
      `${role} Lever India`
    );

    queries.push(
      `${role} Ashby India`
    );

    queries.push(
      `${role} Workable India`
    );
  }

  /*
   * Keep API usage reasonable.
   */

  return [
    ...new Set(
      queries.map(
        (query) =>
          query
            .replace(
              /\s+/g,
              " "
            )
            .trim()
      )
    ),
  ].slice(
    0,
    44
  );
}

/*
 * =====================================================
 * TITLE HELPERS
 * =====================================================
 */

function cleanTitle(
  title = ""
) {
  return String(title)
    .replace(
      /\s*[-|–—]\s*LinkedIn.*$/i,
      ""
    )
    .replace(
      /\s*[-|–—]\s*Indeed.*$/i,
      ""
    )
    .replace(
      /\s*[-|–—]\s*Naukri.*$/i,
      ""
    )
    .replace(
      /\s*[-|–—]\s*Wellfound.*$/i,
      ""
    )
    .replace(
      /\s*[-|–—]\s*Glassdoor.*$/i,
      ""
    )
    .replace(
      /\s*\|\s*LinkedIn.*$/i,
      ""
    )
    .trim();
}

function guessCompany(
  item = {}
) {
  const title =
    String(
      item.title ||
        ""
    ).trim();

  /*
   * Example:
   *
   * React Developer | Company
   * React Developer - Company
   */

  const parts =
    title
      .split(
        /\s+[|–—]\s+/
      )
      .map(
        (part) =>
          part.trim()
      )
      .filter(
        Boolean
      );

  if (
    parts.length >= 2
  ) {
    const candidate =
      parts[
        parts.length -
          1
      ];

    const ignored = [
      "linkedin",
      "indeed",
      "naukri",
      "wellfound",
      "glassdoor",
      "jobs",
      "careers",
    ];

    const bad =
      ignored.some(
        (word) =>
          candidate
            .toLowerCase()
            .includes(
              word
            )
      );

    if (!bad) {
      return candidate;
    }
  }

  try {
    const hostname =
      new URL(
        item.link
      )
        .hostname
        .replace(
          /^www\./,
          ""
        );

    const genericDomains =
      [
        "linkedin.com",
        "indeed.com",
        "indeed.co.in",
        "naukri.com",
        "wellfound.com",
        "glassdoor.co.in",
        "glassdoor.com",
      ];

    if (
      genericDomains.some(
        (domain) =>
          hostname.includes(
            domain
          )
      )
    ) {
      return "Unknown Company";
    }

    return hostname;
  } catch {
    return "Unknown Company";
  }
}

/*
 * =====================================================
 * GENERIC TITLE DETECTION
 * =====================================================
 */

function genericTitleReason(
  title = ""
) {
  const value =
    String(title)
      .toLowerCase()
      .trim();

  /*
   * Examples:
   *
   * 6000+ Developer Jobs
   * 300 Openings
   */

  if (
    /\b\d+\+?\s+(jobs|openings|results|vacancies)\b/i.test(
      value
    )
  ) {
    return "Title contains job count";
  }

  /*
   * Generic role listings.
   */

  if (
    /\b(remote\s+)?(full stack|mern stack|react|node\.?js|frontend|backend|software)\s+(developer|engineer)?\s*jobs\b/i.test(
      value
    )
  ) {
    return "Generic role jobs title";
  }

  if (
    /\b(developer|engineer)\s+jobs$/i.test(
      value
    )
  ) {
    return "Generic jobs title";
  }

  const patterns = [
    /\bjobs in\b/i,

    /\bjob openings in\b/i,

    /\bdeveloper jobs in\b/i,

    /\bfresher jobs\b/i,

    /\bjobs for freshers\b/i,

    /\bremote jobs\b/i,

    /\bjobs india\b/i,

    /\bjobs in india\b/i,

    /\bjob vacancies\b/i,

    /\blatest jobs\b/i,
  ];

  if (
    patterns.some(
      (pattern) =>
        pattern.test(
          value
        )
    )
  ) {
    return "Generic search/listing title";
  }

  return null;
}

/*
 * =====================================================
 * DIRECT JOB URL DETECTION
 * =====================================================
 */

function inspectJobUrl(
  url = ""
) {
  let parsed;

  try {
    parsed =
      new URL(
        url
      );
  } catch {
    return {
      direct: false,

      reason:
        "Invalid URL",
    };
  }

  const host =
    parsed.hostname.toLowerCase();

  const path =
    parsed.pathname.toLowerCase();

  const query =
    parsed.search.toLowerCase();

  /*
   * --------------------------
   * LINKEDIN
   * --------------------------
   */

  if (
    host.includes(
      "linkedin.com"
    )
  ) {
    if (
      path.includes(
        "/jobs/view/"
      )
    ) {
      return {
        direct: true,

        reason:
          "LinkedIn individual job",
      };
    }

    return {
      direct: false,

      reason:
        "LinkedIn listing/search page",
    };
  }

  /*
   * --------------------------
   * INDEED
   * --------------------------
   */

  if (
    host.includes(
      "indeed."
    )
  ) {
    if (
      path.includes(
        "/viewjob"
      ) ||
      parsed.searchParams.has(
        "jk"
      ) ||
      path.includes(
        "/rc/clk"
      )
    ) {
      return {
        direct: true,

        reason:
          "Indeed individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Indeed listing/search page",
    };
  }

  /*
   * --------------------------
   * NAUKRI
   * --------------------------
   */

  if (
    host.includes(
      "naukri.com"
    )
  ) {
    const listingPatterns =
      [
        /-jobs$/,

        /-jobs-in-/,

        /-fresher-jobs/,

        /\/jobs-in-/,

        /\/job-search/,

        /\/jobs$/,

        /\/search/,
      ];

    if (
      listingPatterns.some(
        (pattern) =>
          pattern.test(
            path
          )
      )
    ) {
      return {
        direct: false,

        reason:
          "Naukri listing/search page",
      };
    }

    /*
     * Naukri detail URLs often have
     * numeric IDs.
     */

    const hasLongNumericId =
      /\d{6,}/.test(
        path
      );

    if (
      hasLongNumericId ||
      path.includes(
        "job-listings"
      )
    ) {
      return {
        direct: true,

        reason:
          "Naukri individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Naukri URL not confirmed as individual job",
    };
  }

  /*
   * --------------------------
   * WELLFOUND
   * --------------------------
   */

  if (
    host.includes(
      "wellfound.com"
    )
  ) {
    if (
      path.includes(
        "/jobs/"
      ) &&
      !path.includes(
        "/role/"
      )
    ) {
      return {
        direct: true,

        reason:
          "Wellfound individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Wellfound listing/search page",
    };
  }

  /*
   * --------------------------
   * CUTSHORT
   * --------------------------
   */

  if (
    host.includes(
      "cutshort.io"
    )
  ) {
    if (
      path.includes(
        "/job/"
      )
    ) {
      return {
        direct: true,

        reason:
          "Cutshort individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Cutshort listing/search page",
    };
  }

  /*
   * --------------------------
   * INSTAHYRE
   * --------------------------
   */

  if (
    host.includes(
      "instahyre.com"
    )
  ) {
    /*
     * Instahyre individual opportunities
     * often include job/opportunity paths.
     */

    if (
      path.includes(
        "/job/"
      ) ||
      path.includes(
        "/jobs/"
      ) ||
      path.includes(
        "/opportunity/"
      ) ||
      path.includes(
        "/opportunities/"
      )
    ) {
      return {
        direct: true,

        reason:
          "Instahyre individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Instahyre listing/search page",
    };
  }

  /*
   * --------------------------
   * HIRIST
   * --------------------------
   */

  if (
    host.includes(
      "hirist.tech"
    ) ||
    host.includes(
      "hirist.com"
    )
  ) {
    if (
      path.includes(
        "/job/"
      ) ||
      path.includes(
        "/j/"
      ) ||
      /\d{5,}/.test(
        path
      )
    ) {
      return {
        direct: true,

        reason:
          "Hirist individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Hirist listing/search page",
    };
  }

  /*
   * --------------------------
   * YC
   * --------------------------
   */

  if (
    host.includes(
      "ycombinator.com"
    )
  ) {
    if (
      path.includes(
        "/jobs/"
      ) &&
      path.split(
        "/"
      ).filter(
        Boolean
      ).length >=
        2
    ) {
      return {
        direct: true,

        reason:
          "YC individual job",
      };
    }

    return {
      direct: false,

      reason:
        "YC jobs listing page",
    };
  }

  /*
   * --------------------------
   * GLASSDOOR
   * --------------------------
   */

  if (
    host.includes(
      "glassdoor."
    )
  ) {
    if (
      path.includes(
        "/job-listing/"
      ) ||
      path.includes(
        "/partner/joblisting"
      )
    ) {
      return {
        direct: true,

        reason:
          "Glassdoor individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Glassdoor listing/search page",
    };
  }

  /*
   * --------------------------
   * GREENHOUSE
   * --------------------------
   */

  if (
    host.includes(
      "greenhouse.io"
    )
  ) {
    if (
      path.includes(
        "/jobs/"
      ) ||
      parsed.searchParams.has(
        "gh_jid"
      )
    ) {
      return {
        direct: true,

        reason:
          "Greenhouse individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Greenhouse board page",
    };
  }

  /*
   * --------------------------
   * LEVER
   * --------------------------
   */

  if (
    host.includes(
      "lever.co"
    )
  ) {
    const segments =
      path
        .split(
          "/"
        )
        .filter(
          Boolean
        );

    if (
      segments.length >=
      2
    ) {
      return {
        direct: true,

        reason:
          "Lever individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Lever company board",
    };
  }

  /*
   * --------------------------
   * ASHBY
   * --------------------------
   */

  if (
    host.includes(
      "ashbyhq.com"
    )
  ) {
    const segments =
      path
        .split(
          "/"
        )
        .filter(
          Boolean
        );

    if (
      segments.length >=
      2
    ) {
      return {
        direct: true,

        reason:
          "Ashby individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Ashby board page",
    };
  }

  /*
   * --------------------------
   * WORKABLE
   * --------------------------
   */

  if (
    host.includes(
      "workable.com"
    )
  ) {
    if (
      path.includes(
        "/j/"
      ) ||
      path.includes(
        "/view/"
      )
    ) {
      return {
        direct: true,

        reason:
          "Workable individual job",
      };
    }

    return {
      direct: false,

      reason:
        "Workable listing page",
    };
  }

  /*
   * =================================================
   * OTHER COMPANY CAREER SITES
   * =================================================
   */

  const obviousListingPatterns =
    [
      "/jobs/search",

      "/search/jobs",

      "/job-search",

      "/jobs-in-",

      "/careers/search",

      "/career-search",
    ];

  if (
    obviousListingPatterns.some(
      (pattern) =>
        `${path}${query}`.includes(
          pattern
        )
    )
  ) {
    return {
      direct: false,

      reason:
        "Generic careers search page",
    };
  }

  /*
   * Detail-like URL.
   */

  const detailWords = [
    "/job/",

    "/jobs/",

    "/job-listing/",

    "/position/",

    "/positions/",

    "/opening/",

    "/openings/",

    "/vacancy/",

    "/opportunity/",

    "/opportunities/",
  ];

  if (
    detailWords.some(
      (word) =>
        path.includes(
          word
        )
    )
  ) {
    return {
      direct: true,

      reason:
        "Likely company career detail page",
    };
  }

  /*
   * Some career platforms use
   * ID-based URLs.
   */

  const numericDetailId =
    /\d{6,}/.test(
      path
    );

  if (
    numericDetailId
  ) {
    return {
      direct: true,

      reason:
        "Likely ID-based job detail page",
    };
  }

  return {
    direct: false,

    reason:
      "URL not confirmed as individual job",
  };
}

/*
 * =====================================================
 * BASIC RESULT VALIDATION
 * =====================================================
 */

function looksLikeJobResult(
  item = {}
) {
  const title =
    String(
      item.title ||
        ""
    ).toLowerCase();

  const snippet =
    String(
      item.snippet ||
        ""
    ).toLowerCase();

  const url =
    String(
      item.link ||
        ""
    ).toLowerCase();

  const text =
    `${title} ${snippet}`;

  const roleWords = [
    "developer",

    "engineer",

    "software",

    "frontend",

    "front end",

    "backend",

    "back end",

    "full stack",

    "fullstack",

    "react",

    "node",

    "javascript",

    "mern",
  ];

  const hiringWords =
    [
      "job",

      "jobs",

      "hiring",

      "apply",

      "position",

      "opening",

      "opportunity",
    ];

  const jobDomains = [
    "linkedin.com/jobs",

    "indeed.",

    "naukri.com",

    "wellfound.com",

    "cutshort.io",

    "instahyre.com",

    "hirist.tech",

    "hirist.com",

    "ycombinator.com/jobs",

    "glassdoor.",

    "greenhouse.io",

    "lever.co",

    "ashbyhq.com",

    "workable.com",

    "jobs.",

    "careers.",
  ];

  const roleMatch =
    roleWords.some(
      (word) =>
        text.includes(
          word
        )
    );

  const hiringMatch =
    hiringWords.some(
      (word) =>
        text.includes(
          word
        )
    );

  const domainMatch =
    jobDomains.some(
      (domain) =>
        url.includes(
          domain
        )
    );

  return (
    roleMatch &&
    (
      hiringMatch ||
      domainMatch
    )
  );
}

/*
 * =====================================================
 * POST AGE
 * =====================================================
 */

function detectPostedAgeDays(
  item = {}
) {
  const combined =
    `${item.date || ""} ${
      item.snippet ||
      ""
    }`.toLowerCase();

  if (
    /\btoday\b/i.test(
      combined
    )
  ) {
    return 0;
  }

  if (
    /\byesterday\b/i.test(
      combined
    )
  ) {
    return 1;
  }

  const hourMatch =
    combined.match(
      /(\d+)\s*(?:hours?|hrs?)\s*ago/
    );

  if (
    hourMatch
  ) {
    return 0;
  }

  const dayMatch =
    combined.match(
      /(\d+)\s*days?\s*ago/
    );

  if (
    dayMatch
  ) {
    return Number(
      dayMatch[1]
    );
  }

  const weekMatch =
    combined.match(
      /(\d+)\s*weeks?\s*ago/
    );

  if (
    weekMatch
  ) {
    return (
      Number(
        weekMatch[1]
      ) *
      7
    );
  }

  const monthMatch =
    combined.match(
      /(\d+)\s*months?\s*ago/
    );

  if (
    monthMatch
  ) {
    return (
      Number(
        monthMatch[1]
      ) *
      30
    );
  }

  if (
    item.date
  ) {
    const parsed =
      new Date(
        item.date
      );

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      const diff =
        Date.now() -
        parsed.getTime();

      return Math.max(
        0,

        Math.floor(
          diff /
            (
              1000 *
              60 *
              60 *
              24
            )
        )
      );
    }
  }

  return null;
}

/*
 * =====================================================
 * PRE-ENRICHMENT QUALITY FILTERS
 * =====================================================
 */

function hasExcludedIntent(
  item = {}
) {
  const text =
    `${item.title || ""} ${
      item.snippet ||
      ""
    }`
      .toLowerCase();

  const excluded = [
    "internship",

    "intern ",

    " internship",

    "fresher",

    "freshers",

    "walk-in",

    "walk in",

    "salary",

    "course",

    "training",

    "bootcamp",
  ];

  return excluded.some(
    (word) =>
      text.includes(
        word
      )
  );
}

function looksTooOldBeforeEnrichment(
  item = {}
) {
  const age =
    detectPostedAgeDays(
      item
    );

  return (
    age !== null &&
    age > 45
  );
}

/*
 * =====================================================
 * SOURCE PRIORITY
 * =====================================================
 */

function sourcePriority(
  sourceType = "web"
) {
  const priorities = {
    greenhouse: 100,

    lever: 100,

    ashby: 100,

    workable: 95,

    yc: 92,

    cutshort: 90,

    instahyre: 90,

    hirist: 88,

    wellfound: 85,

    web: 75,

    naukri: 70,

    indeed: 65,

    linkedin: 60,

    glassdoor: 55,
  };

  return (
    priorities[
      sourceType
    ] ??
    50
  );
}

function preEnrichmentPriority(
  job = {}
) {
  const age =
    job
      ?.metadata
      ?.postedAgeDays;

  let freshness = 20;

  if (
    age === 0
  ) {
    freshness = 45;
  } else if (
    typeof age ===
    "number"
  ) {
    if (
      age <= 3
    ) {
      freshness = 40;
    } else if (
      age <= 7
    ) {
      freshness = 32;
    } else if (
      age <= 14
    ) {
      freshness = 24;
    } else if (
      age <= 30
    ) {
      freshness = 14;
    } else {
      freshness = 0;
    }
  }

  const directBonus =
    job
      ?.source
      ?.startsWith(
        "serper:"
      )
      ? 8
      : 0;

  return (
    sourcePriority(
      job.sourceType
    ) +
    freshness +
    directBonus
  );
}

/*
 * =====================================================
 * SOURCE BALANCING
 * =====================================================
 */

const SOURCE_QUOTAS = {
  greenhouse: 10,

  lever: 8,

  ashby: 8,

  workable: 6,

  cutshort: 8,

  instahyre: 6,

  hirist: 6,

  wellfound: 8,

  naukri: 8,

  indeed: 5,

  linkedin: 8,

  yc: 6,

  web: 10,

  glassdoor: 4,
};

function balanceBySource(
  jobs = [],
  maxJobs = 70
) {
  const buckets =
    new Map();

  for (
    const job of jobs
  ) {
    const source =
      job.sourceType ||
      "web";

    if (
      !buckets.has(
        source
      )
    ) {
      buckets.set(
        source,
        []
      );
    }

    buckets
      .get(
        source
      )
      .push(
        job
      );
  }

  /*
   * Sort every bucket by
   * freshness/source quality.
   */

  for (
    const bucket of
      buckets.values()
  ) {
    bucket.sort(
      (
        a,
        b
      ) =>
        preEnrichmentPriority(
          b
        ) -
        preEnrichmentPriority(
          a
        )
    );
  }

  const selected =
    [];

  /*
   * ATS and lower-competition
   * sources come first.
   */

  const sourceOrder =
    [
      "greenhouse",

      "lever",

      "ashby",

      "workable",

      "cutshort",

      "instahyre",

      "hirist",

      "wellfound",

      "yc",

      "web",

      "naukri",

      "indeed",

      "linkedin",

      "glassdoor",
    ];

  /*
   * First pass:
   * respect source quotas.
   */

  for (
    const source of
      sourceOrder
  ) {
    if (
      selected.length >=
      maxJobs
    ) {
      break;
    }

    const bucket =
      buckets.get(
        source
      ) ||
      [];

    const quota =
      SOURCE_QUOTAS[
        source
      ] ??
      5;

    selected.push(
      ...bucket.slice(
        0,

        Math.min(
          quota,

          maxJobs -
            selected.length
        )
      )
    );
  }

  /*
   * Second pass:
   *
   * If quotas don't fill the target,
   * use remaining jobs based on
   * quality.
   */

  if (
    selected.length <
    maxJobs
  ) {
    const selectedUrls =
      new Set(
        selected.map(
          (job) =>
            cleanUrl(
              job.url
            )
              .toLowerCase()
        )
      );

    const leftovers =
      jobs
        .filter(
          (job) =>
            !selectedUrls.has(
              cleanUrl(
                job.url
              )
                .toLowerCase()
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            preEnrichmentPriority(
              b
            ) -
            preEnrichmentPriority(
              a
            )
        );

    selected.push(
      ...leftovers.slice(
        0,

        maxJobs -
          selected.length
      )
    );
  }

  return selected.slice(
    0,
    maxJobs
  );
}

function logSourceDistribution(
  label,
  jobs = []
) {
  const counts = {};

  for (
    const job of jobs
  ) {
    const source =
      job.sourceType ||
      "web";

    counts[source] =
      (
        counts[
          source
        ] ||
        0
      ) +
      1;
  }

  console.log(
    `[Source Distribution] ${label}`,
    counts
  );
}

/*
 * =====================================================
 * DISCOVERY
 * =====================================================
 */

export async function discoverWithSerper(
  profile = {},
  maxJobs = 300
) {
  const queries =
    buildDiscoveryQueries(
      profile
    );

  /*
   * directJobs:
   * individual jobs only.
   *
   * discoverySeeds:
   * listing/search pages that may
   * later be expanded.
   */

  const directJobs =
    [];

  const discoverySeeds =
    [];

  const seenDirect =
    new Set();

  const seenSeeds =
    new Set();

  const stats = {
    direct: 0,

    seeds: 0,

    invalid: 0,

    duplicate: 0,

    genericTitles: 0,

    listingUrls: 0,

    prefilteredExcluded:
      0,

    prefilteredOld:
      0,
  };

  console.log(
    `[Discovery] Running ${queries.length} Serper searches`
  );

  for (
    const query of
      queries
  ) {
    if (
      directJobs.length >=
      maxJobs
    ) {
      break;
    }

    try {
      console.log(
        `[Serper] Searching: ${query}`
      );

      const data =
        await serperSearch(
          query,
          20
        );

      const results =
        Array.isArray(
          data?.organic
        )
          ? data.organic
          : [];

      console.log(
        `[Serper] "${query}" -> ${results.length} organic results`
      );

      for (
        const item of
          results
      ) {
        /*
         * ----------------------------------------
         * BASIC VALIDATION
         * ----------------------------------------
         */

        if (
          !item?.link ||
          !looksLikeJobResult(
            item
          )
        ) {
          stats.invalid +=
            1;

          continue;
        }

        const url =
          cleanUrl(
            item.link
          );

        const title =
          cleanTitle(
            item.title
          );

        if (
          !url ||
          !title
        ) {
          stats.invalid +=
            1;

          continue;
        }

        /*
         * ----------------------------------------
         * CHEAP FILTERS BEFORE ENRICHMENT
         * ----------------------------------------
         */

        if (
          hasExcludedIntent(
            item
          )
        ) {
          stats.prefilteredExcluded +=
            1;

          continue;
        }

        if (
          looksTooOldBeforeEnrichment(
            item
          )
        ) {
          stats.prefilteredOld +=
            1;

          continue;
        }

        /*
         * ----------------------------------------
         * CLASSIFY TITLE + URL
         * ----------------------------------------
         */

        const titleReject =
          genericTitleReason(
            title
          );

        const urlInspection =
          inspectJobUrl(
            url
          );

        /*
         * ========================================
         * DIRECT INDIVIDUAL JOB
         * ========================================
         */

        if (
          urlInspection.direct &&
          !titleReject
        ) {
          const dedupeKey =
            url.toLowerCase();

          if (
            seenDirect.has(
              dedupeKey
            )
          ) {
            stats.duplicate +=
              1;

            continue;
          }

          seenDirect.add(
            dedupeKey
          );

          const postedAgeDays =
            detectPostedAgeDays(
              item
            );

          const sourceType =
            sourceTypeFromUrl(
              url
            );

          directJobs.push(
            {
              externalId:
                `serper:${Buffer.from(
                  url
                )
                  .toString(
                    "base64url"
                  )
                  .slice(
                    0,
                    80
                  )}`,

              source:
                `serper:${sourceType}`,

              sourceType,

              company:
                guessCompany(
                  item
                ),

              title,

              location:
                "",

              url,

              description:
                item.snippet ||
                "",

              employmentType:
                "",

              metadata: {
                searchQuery:
                  query,

                position:
                  item.position ??
                  null,

                publishedText:
                  item.date ||
                  "",

                postedAgeDays,

                listingPage:
                  false,

                directJob:
                  true,

                discoverySeed:
                  false,

                directJobReason:
                  urlInspection.reason,
              },
            }
          );

          stats.direct +=
            1;

          console.log(
            `[Direct Job] ${title} -> ${url}`
          );

          continue;
        }

        /*
         * ========================================
         * DISCOVERY SEED
         * ========================================
         */

        const seedKey =
          url.toLowerCase();

        if (
          seenSeeds.has(
            seedKey
          )
        ) {
          stats.duplicate +=
            1;

          continue;
        }

        seenSeeds.add(
          seedKey
        );

        const sourceType =
          sourceTypeFromUrl(
            url
          );

        discoverySeeds.push(
          {
            title,

            url,

            sourceType,

            searchQuery:
              query,

            snippet:
              item.snippet ||
              "",

            reason:
              titleReject ||
              urlInspection.reason,

            postedAgeDays:
              detectPostedAgeDays(
                item
              ),
          }
        );

        stats.seeds +=
          1;

        if (
          titleReject
        ) {
          stats.genericTitles +=
            1;
        }

        if (
          !urlInspection.direct
        ) {
          stats.listingUrls +=
            1;
        }

        console.log(
          `[Discovery Seed] ${
            titleReject ||
            urlInspection.reason
          }: ${url}`
        );
      }
    } catch (
      error
    ) {
      console.error(
        `[Serper] Failed "${query}":`,
        error.message
      );
    }
  }

  /*
   * =================================================
   * SERPER SUMMARY
   * =================================================
   */

  console.log(
    "\n========== SERPER DISCOVERY SUMMARY =========="
  );

  console.log(
    `Direct jobs: ${directJobs.length}`
  );

  console.log(
    `Discovery seeds: ${discoverySeeds.length}`
  );

  console.log(
    `Invalid results: ${stats.invalid}`
  );

  console.log(
    `Duplicates: ${stats.duplicate}`
  );

  console.log(
    `Generic-title seeds: ${stats.genericTitles}`
  );

  console.log(
    `Listing/non-direct seeds: ${stats.listingUrls}`
  );

  console.log(
    `Pre-filtered excluded/fresher/intern results: ${stats.prefilteredExcluded}`
  );

  console.log(
    `Pre-filtered old results: ${stats.prefilteredOld}`
  );

  /*
   * Show a few seeds for debugging.
   */

  if (
    discoverySeeds.length >
    0
  ) {
    console.log(
      "\nExample discovery seeds:"
    );

    discoverySeeds
      .slice(
        0,
        10
      )
      .forEach(
        (
          seed,
          index
        ) => {
          console.log(
            `${index + 1}. [${seed.sourceType}] ${seed.title}`
          );

          console.log(
            `   ${seed.url}`
          );
        }
      );
  }

  console.log(
    "==============================================\n"
  );

  /*
   * =================================================
   * EXPAND DISCOVERY SEEDS
   * =================================================
   */

  console.log(
    "\n========== LISTING EXPANSION =========="
  );

  /*
   * Prioritize ATS/niche sources before
   * LinkedIn/Indeed/etc.
   */

  const prioritizedSeeds =
    [
      ...discoverySeeds,
    ]
      .filter(
        (seed) =>
          !(
            seed
              .postedAgeDays !==
              null &&
            seed
              .postedAgeDays >
              45
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          sourcePriority(
            b.sourceType
          ) -
          sourcePriority(
            a.sourceType
          )
      );

  const expansion =
    await expandListingSeeds(
      prioritizedSeeds,
      {
        maxSeeds: 24,

        maxLinksPerSeed:
          12,
      }
    );

  console.log(
    `Expanded individual URLs: ${expansion.jobs.length}`
  );

  /*
   * Convert expanded URLs
   * into raw job candidates.
   */

  for (
    const expanded of
      expansion.jobs
  ) {
    const normalizedUrl =
      cleanUrl(
        expanded.url
      );

    if (
      !normalizedUrl
    ) {
      continue;
    }

    const key =
      normalizedUrl.toLowerCase();

    if (
      seenDirect.has(
        key
      )
    ) {
      continue;
    }

    const urlInspection =
      inspectJobUrl(
        normalizedUrl
      );

    /*
     * Skip obvious listing/search
     * URLs before enrichment.
     */

    if (
      !urlInspection.direct
    ) {
      continue;
    }

    seenDirect.add(
      key
    );

    directJobs.push(
      {
        externalId:
          `expanded:${Buffer.from(
            normalizedUrl
          )
            .toString(
              "base64url"
            )
            .slice(
              0,
              80
            )}`,

        source:
          `expanded:${expanded.sourceType}`,

        sourceType:
          expanded.sourceType,

        company:
          "Unknown Company",

        title:
          "Job opening",

        location:
          "",

        url:
          normalizedUrl,

        description:
          "",

        employmentType:
          "",

        metadata: {
          directJob:
            true,

          listingPage:
            false,

          discoverySeed:
            false,

          expandedFrom:
            expanded.parentSeedUrl,

          directJobReason:
            urlInspection.reason,
        },
      }
    );
  }

  /*
   * =================================================
   * PRIORITIZE BEFORE ENRICHMENT
   * =================================================
   */

  const prioritizedJobs =
    [
      ...directJobs,
    ]
      .filter(
        (job) =>
          !(
            job
              ?.metadata
              ?.postedAgeDays !==
              null &&
            job
              ?.metadata
              ?.postedAgeDays >
              45
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          preEnrichmentPriority(
            b
          ) -
          preEnrichmentPriority(
            a
          )
      );

  /*
   * Log source distribution before
   * applying quotas.
   */

  logSourceDistribution(
    "Before balancing",
    prioritizedJobs
  );

  /*
   * Prevent LinkedIn/Wellfound from
   * dominating the enrichment pool.
   */

  const balancedJobs =
    balanceBySource(
      prioritizedJobs,
      70
    );

  logSourceDistribution(
    "Selected for enrichment",
    balancedJobs
  );

  console.log(
    `Total direct + expanded jobs: ${directJobs.length}`
  );

  console.log(
    `Priority candidates before balancing: ${prioritizedJobs.length}`
  );

  console.log(
    `Balanced candidates before enrichment: ${balancedJobs.length}`
  );

  console.log(
    "=======================================\n"
  );

  /*
   * =================================================
   * JOB ENRICHMENT
   * =================================================
   */

  console.log(
    "\n========== JOB ENRICHMENT =========="
  );

  const enrichedJobs =
    await enrichJobs(
      balancedJobs,
      {
        maxJobs: 70,

        concurrency:
          8,
      }
    );

  console.log(
    `Enriched jobs returned: ${enrichedJobs.length}`
  );

  /*
   * Useful final visibility:
   * check whether enrichment remained
   * source-balanced.
   */

  logSourceDistribution(
    "After enrichment",
    enrichedJobs
  );

  console.log(
    "====================================\n"
  );

  return enrichedJobs;
}