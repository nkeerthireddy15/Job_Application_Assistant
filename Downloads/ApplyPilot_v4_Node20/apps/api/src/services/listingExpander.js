const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function normalizeUrl(baseUrl, href) {
  try {
    const url = new URL(href, baseUrl);

    url.hash = "";

    const tracking = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "source",
      "trk",
    ];

    tracking.forEach((key) => {
      url.searchParams.delete(key);
    });

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function sourceTypeFromUrl(url = "") {
  const value = String(url).toLowerCase();

  if (value.includes("linkedin.com")) return "linkedin";
  if (value.includes("indeed.")) return "indeed";
  if (value.includes("naukri.com")) return "naukri";
  if (value.includes("wellfound.com")) return "wellfound";
  if (value.includes("glassdoor.")) return "glassdoor";
  if (value.includes("cutshort.io")) return "cutshort";
  if (value.includes("hirist.tech")) return "hirist";
  if (value.includes("foundit.")) return "foundit";
  if (value.includes("instahyre.com")) return "instahyre";
  if (value.includes("greenhouse.io")) return "greenhouse";
  if (value.includes("lever.co")) return "lever";
  if (value.includes("ashbyhq.com")) return "ashby";
  if (value.includes("workable.com")) return "workable";

  return "web";
}

function looksLikeDirectJobUrl(url = "") {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (host.includes("linkedin.com")) {
    return path.includes("/jobs/view/");
  }

  if (host.includes("indeed.")) {
    return (
      path.includes("/viewjob") ||
      parsed.searchParams.has("jk")
    );
  }

  if (host.includes("naukri.com")) {
    if (
      /-jobs$/.test(path) ||
      /-jobs-in-/.test(path) ||
      /\/job-search/.test(path) ||
      /\/jobs-in-/.test(path)
    ) {
      return false;
    }

    return (
      /\/job-listings-/.test(path) ||
      /\d{6,}/.test(path)
    );
  }

  if (host.includes("wellfound.com")) {
    return (
      path.includes("/jobs/") &&
      !path.includes("/role/")
    );
  }

  if (host.includes("glassdoor.")) {
    return path.includes("/job-listing/");
  }

  if (host.includes("cutshort.io")) {
    return (
      path.includes("/job/") ||
      path.includes("/jobs/")
    );
  }

  if (host.includes("hirist.tech")) {
    return (
      path.includes("/j/") ||
      /\d{5,}/.test(path)
    );
  }

  if (host.includes("foundit.")) {
    return (
      path.includes("/job/") ||
      path.includes("/job-detail/")
    );
  }

  if (host.includes("instahyre.com")) {
    return (
      path.includes("/job/") ||
      path.includes("/jobs/")
    );
  }

  if (host.includes("greenhouse.io")) {
    return (
      path.includes("/jobs/") ||
      parsed.searchParams.has("gh_jid")
    );
  }

  if (host.includes("lever.co")) {
    return path.split("/").filter(Boolean).length >= 2;
  }

  if (host.includes("ashbyhq.com")) {
    return path.split("/").filter(Boolean).length >= 2;
  }

  if (host.includes("workable.com")) {
    return (
      path.includes("/j/") ||
      path.includes("/view/")
    );
  }

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
  ];

  return detailWords.some((word) =>
    path.includes(word)
  );
}

function extractAnchorHrefs(html = "") {
  const hrefs = [];

  const regex =
    /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>/gi;

  let match;

  while ((match = regex.exec(html))) {
    hrefs.push(match[1]);
  }

  return hrefs;
}

function extractJsonLdUrls(html = "") {
  const urls = [];

  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = scriptRegex.exec(html))) {
    try {
      const raw = match[1].trim();

      if (!raw) continue;

      const data = JSON.parse(raw);

      const items = Array.isArray(data)
        ? data
        : [data];

      for (const item of items) {
        if (
          item?.["@type"] === "JobPosting" &&
          typeof item?.url === "string"
        ) {
          urls.push(item.url);
        }

        if (
          item?.["@graph"] &&
          Array.isArray(item["@graph"])
        ) {
          for (const graphItem of item["@graph"]) {
            if (
              graphItem?.["@type"] === "JobPosting" &&
              typeof graphItem?.url === "string"
            ) {
              urls.push(graphItem.url);
            }
          }
        }
      }
    } catch {
      // ignore broken JSON-LD blocks
    }
  }

  return urls;
}

async function fetchHtml(url) {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const type =
      response.headers.get("content-type") || "";

    if (!type.includes("text/html")) {
      throw new Error(
        `Unsupported content type: ${type}`
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function expandListingSeed(
  seed,
  {
    maxLinks = 25,
  } = {}
) {
  const result = {
    seedUrl: seed.url,
    sourceType:
      seed.sourceType ||
      sourceTypeFromUrl(seed.url),
    jobs: [],
    error: null,
  };

  try {
    const html = await fetchHtml(
      seed.url
    );

    const hrefs = [
      ...extractAnchorHrefs(html),
      ...extractJsonLdUrls(html),
    ];

    const seen = new Set();

    for (const href of hrefs) {
      if (
        result.jobs.length >= maxLinks
      ) {
        break;
      }

      const normalized =
        normalizeUrl(seed.url, href);

      if (!normalized) {
        continue;
      }

      if (
        !looksLikeDirectJobUrl(
          normalized
        )
      ) {
        continue;
      }

      const key =
        normalized.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      result.jobs.push({
        url: normalized,
        sourceType:
          sourceTypeFromUrl(
            normalized
          ),
        parentSeedUrl:
          seed.url,
      });
    }
  } catch (error) {
    result.error =
      error?.message ||
      "Failed to expand seed";
  }

  return result;
}

export async function expandListingSeeds(
  seeds = [],
  {
    maxSeeds = 30,
    maxLinksPerSeed = 20,
  } = {}
) {
  const selected =
    seeds.slice(0, maxSeeds);

  const expandedJobs = [];

  const seenJobs = new Set();

  const stats = {
    attemptedSeeds:
      selected.length,
    successfulSeeds: 0,
    failedSeeds: 0,
    extractedJobs: 0,
  };

  for (const seed of selected) {
    const result =
      await expandListingSeed(
        seed,
        {
          maxLinks:
            maxLinksPerSeed,
        }
      );

    if (result.error) {
      stats.failedSeeds += 1;

      console.log(
        `[Seed Expand Failed] ${seed.url} -> ${result.error}`
      );

      continue;
    }

    stats.successfulSeeds += 1;

    console.log(
      `[Seed Expanded] ${seed.url} -> ${result.jobs.length} candidate links`
    );

    for (const job of result.jobs) {
      const key =
        job.url.toLowerCase();

      if (seenJobs.has(key)) {
        continue;
      }

      seenJobs.add(key);

      expandedJobs.push(job);
    }
  }

  stats.extractedJobs =
    expandedJobs.length;

  console.log(
    "[Seed Expansion Summary]",
    stats
  );

  return {
    jobs: expandedJobs,
    stats,
  };
}