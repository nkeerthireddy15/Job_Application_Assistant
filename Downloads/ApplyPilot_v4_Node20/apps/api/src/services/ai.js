function parseJsonLoose(text = "") {
  const clean = String(text).replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI response did not contain JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

async function gemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } })
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
}

export async function aiScoreJob(job, profile, localResult) {
  if (!process.env.GEMINI_API_KEY) return null;
  const prompt = `You are ranking a software job for a candidate. Return JSON only: {"score":0-100,"summary":"one sentence","reasons":["..."],"risks":["..."]}.\nCandidate: ${JSON.stringify({ title: profile.currentTitle, years: profile.yearsExperience, skills: profile.skills, targetRoles: profile.targetRoles, locations: profile.preferredLocations, noticePeriod: profile.noticePeriod })}\nJob: ${JSON.stringify({ title: job.title, company: job.company, location: job.location, description: String(job.description || "").slice(0, 9000) })}\nLocal matcher score: ${localResult.score}. Penalize clear seniority or stack mismatches. Do not invent facts.`;
  const text = await gemini(prompt);
  return text ? parseJsonLoose(text) : null;
}

export async function generateAnswer({ question, job, profile }) {
  const customEntries = profile.customAnswers instanceof Map ? [...profile.customAnswers.entries()] : Object.entries(profile.customAnswers || {});
  const lower = question.toLowerCase();
  for (const [key, value] of customEntries) if (lower.includes(String(key).toLowerCase())) return { answer: String(value), generatedBy: "profile" };
  if (/notice period/.test(lower)) return { answer: profile.noticePeriod || "", generatedBy: "profile" };
  if (/current.*ctc|current.*compensation|current.*salary/.test(lower)) return { answer: profile.currentCTC || "", generatedBy: "profile" };
  if (/expected.*ctc|expected.*compensation|expected.*salary/.test(lower)) return { answer: profile.expectedCTC || "", generatedBy: "profile" };
  if (/sponsor|visa/.test(lower)) return { answer: profile.sponsorshipAnswer || "", generatedBy: "profile" };

  if (!process.env.GEMINI_API_KEY) {
    return { answer: `I have ${profile.yearsExperience || 0} years of experience as a ${profile.currentTitle || "software developer"}, with hands-on work across ${(profile.skills || []).slice(0, 6).join(", ")}. My experience aligns well with the responsibilities described for ${job.title}.`, generatedBy: "local" };
  }
  const prompt = `Draft a concise truthful job-application answer. Return JSON only: {"answer":"..."}. Never invent achievements, employers, dates, degrees, metrics or tools not provided.\nQuestion: ${question}\nCandidate: ${JSON.stringify({ title: profile.currentTitle, years: profile.yearsExperience, skills: profile.skills, about: profile.about, noticePeriod: profile.noticePeriod, currentCTC: profile.currentCTC, expectedCTC: profile.expectedCTC, sponsorship: profile.sponsorshipAnswer })}\nJob: ${JSON.stringify({ title: job.title, company: job.company, description: String(job.description || "").slice(0, 6000) })}`;
  const text = await gemini(prompt);
  const parsed = parseJsonLoose(text);
  return { answer: parsed.answer || "", generatedBy: "gemini" };
}
