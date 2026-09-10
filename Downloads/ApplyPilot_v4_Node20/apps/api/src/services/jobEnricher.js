const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function stripHtml(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findJobPosting(json) {
  if (!json) return null;

  if (Array.isArray(json)) {
    for (const item of json) {
      const found = findJobPosting(item);
      if (found) return found;
    }

    return null;
  }

  if (
    typeof json === "object"
  ) {
    if (
      json["@type"] ===
      "JobPosting"
    ) {
      return json;
    }

    if (
      Array.isArray(
        json["@graph"]
      )
    ) {
      for (const item of json["@graph"]) {
        const found =
          findJobPosting(item);

        if (found) return found;
      }
    }
  }

  return null;
}

function extractJsonLdJob(html = "") {
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = regex.exec(html))) {
    try {
      const parsed =
        JSON.parse(
          match[1].trim()
        );

      const job =
        findJobPosting(parsed);

      if (job) {
        return job;
      }
    } catch {
      // ignore malformed blocks
    }
  }

  return null;
}

function extractMeta(
  html,
  key
) {
  const escaped =
    key.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),

    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),

    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match =
      html.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractTitleTag(
  html = ""
) {
  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  return match?.[1]
    ? stripHtml(match[1])
    : "";
}

function extractLocation(
  jobPosting
) {
  const location =
    jobPosting?.jobLocation;

  if (!location) {
    return "";
  }

  const items =
    Array.isArray(location)
      ? location
      : [location];

  const parts = [];

  for (const item of items) {
    const address =
      item?.address || {};

    const value = [
      address.addressLocality,
      address.addressRegion,
      address.addressCountry,
    ]
      .filter(Boolean)
      .join(", ");

    if (value) {
      parts.push(value);
    }
  }

  return [
    ...new Set(parts),
  ].join(" | ");
}

function extractCompany(
  jobPosting
) {
  return (
    jobPosting?.hiringOrganization?.name ||
    jobPosting?.organization?.name ||
    ""
  );
}

function extractPostedDate(
  jobPosting
) {
  return (
    jobPosting?.datePosted ||
    ""
  );
}

function calculateAgeDays(
  date
) {
  if (!date) {
    return null;
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() -
        parsed.getTime()) /
        (1000 *
          60 *
          60 *
          24)
    )
  );
}

async function fetchHtml(url) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      6000
    );

  try {
    const response =
      await fetch(url, {
        headers:
          DEFAULT_HEADERS,

        redirect:
          "follow",

        signal:
          controller.signal,
      });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const type =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      !type.includes(
        "text/html"
      )
    ) {
      throw new Error(
        `Unsupported content type: ${type}`
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichJob(
  job
) {
  try {
    const html =
      await fetchHtml(
        job.url
      );

    const posting =
      extractJsonLdJob(
        html
      );

    const title =
      posting?.title ||
      extractMeta(
        html,
        "og:title"
      ) ||
      extractTitleTag(
        html
      ) ||
      job.title;

    const company =
      extractCompany(
        posting
      ) ||
      job.company;

    const description =
      stripHtml(
        posting?.description ||
        extractMeta(
          html,
          "description"
        ) ||
        job.description ||
        ""
      );

    const location =
      extractLocation(
        posting
      ) ||
      job.location ||
      "";

    const datePosted =
      extractPostedDate(
        posting
      );

    const postedAgeDays =
      calculateAgeDays(
        datePosted
      ) ??
      job?.metadata
        ?.postedAgeDays ??
      null;

    return {
      ...job,

      title,

      company,

      description,

      location,

      metadata: {
        ...(job.metadata ||
          {}),

        enriched: true,

        datePosted,

        postedAgeDays,
      },
    };
  } catch (error) {
    console.log(
      `[Enrich Failed] ${job.url} -> ${error.message}`
    );

    return {
      ...job,

      metadata: {
        ...(job.metadata ||
          {}),

        enriched: false,

        enrichError:
          error.message,
      },
    };
  }
}

export async function enrichJobs(
  jobs = [],
  {
    maxJobs = 60,
    concurrency = 8,
  } = {}
) {
  const selected = jobs.slice(0, maxJobs);

  let success = 0;
  let failed = 0;
  let completed = 0;

  const enriched = new Array(selected.length);

  async function worker() {
    while (true) {
      const index = completed++;

      if (index >= selected.length) {
        return;
      }

      const job = selected[index];

      console.log(
        `[Enrich ${index + 1}/${selected.length}] ${job.title || job.url}`
      );

      const result = await enrichJob(job);

      if (result?.metadata?.enriched) {
        success += 1;
      } else {
        failed += 1;
      }

      enriched[index] = result;
    }
  }

  const workerCount = Math.min(
    concurrency,
    selected.length
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker()
    )
  );

  console.log(
    "[Job Enrichment Summary]",
    {
      attempted: selected.length,
      success,
      failed,
    }
  );

  return enriched;
}