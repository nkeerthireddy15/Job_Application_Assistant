const stripHtml = (html = "") => String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&quot;|&#39;/g, " ").replace(/\s+/g, " ").trim();

async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "user-agent": "ApplyPilot/2.0", accept: "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Import failed (${response.status}) for ${url}`);
  return response.json();
}

export async function importGreenhouse(boardToken, company = "") {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`);
  return (data.jobs || []).map((job) => ({
    externalId: String(job.id), source: `greenhouse:${boardToken}`, sourceType: "greenhouse",
    company: company || boardToken, title: job.title, location: job.location?.name || "",
    url: job.absolute_url, description: stripHtml(job.content || ""), employmentType: "",
    metadata: { departments: job.departments || [], offices: job.offices || [] }
  }));
}

export async function importLever(site, company = "") {
  const data = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`);
  return (data || []).map((job) => ({
    externalId: String(job.id), source: `lever:${site}`, sourceType: "lever",
    company: company || site, title: job.text, location: job.categories?.location || "",
    url: job.hostedUrl, description: stripHtml(`${job.descriptionPlain || ""} ${job.additionalPlain || ""}`),
    employmentType: job.categories?.commitment || "", metadata: { team: job.categories?.team || "" }
  }));
}

export async function importAshby(boardName, company = "") {
  const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardName)}?includeCompensation=true`);
  return (data.jobs || []).filter((j) => j.isListed !== false).map((job) => ({
    externalId: String(job.jobUrl || job.applyUrl || job.title), source: `ashby:${boardName}`, sourceType: "ashby",
    company: company || boardName, title: job.title, location: job.location || "",
    url: job.jobUrl || job.applyUrl, description: stripHtml(job.descriptionHtml || job.descriptionPlain || ""),
    employmentType: job.employmentType || "", metadata: { department: job.department || "", team: job.team || "", compensation: job.compensation || null }
  })).filter((j) => j.url);
}

export async function importWorkable(subdomain, company = "") {
  const data = await getJson(`https://www.workable.com/api/accounts/${encodeURIComponent(subdomain)}`);
  return (data.jobs || []).map((job) => ({
    externalId: String(job.shortcode || job.code || job.url), source: `workable:${subdomain}`, sourceType: "workable",
    company: company || data.name || subdomain, title: job.title, location: [job.city, job.state, job.country].filter(Boolean).join(", "),
    url: job.url || `https://apply.workable.com/${subdomain}/j/${job.shortcode}/`,
    description: stripHtml(job.description || job.full_description || ""), employmentType: job.type || "",
    metadata: { department: job.department || "" }
  }));
}

export async function importBySource(source) {
  if (source.type === "greenhouse") return importGreenhouse(source.value, source.company);
  if (source.type === "lever") return importLever(source.value, source.company);
  if (source.type === "ashby") return importAshby(source.value, source.company);
  if (source.type === "workable") return importWorkable(source.value, source.company);
  throw new Error(`Unsupported ATS source: ${source.type}`);
}
