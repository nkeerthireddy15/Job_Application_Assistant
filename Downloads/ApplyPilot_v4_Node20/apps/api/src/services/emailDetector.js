const INTERVIEW_PATTERNS = [
  /interview/i, /technical round/i, /coding round/i, /assessment/i, /hiring manager/i,
  /schedule.*call/i, /recruiter.*call/i, /next round/i, /shortlisted/i, /screening/i
];

export function detectHiringSignal({ subject = "", from = "", body = "" }) {
  const text = `${subject}\n${from}\n${body}`;
  const matched = INTERVIEW_PATTERNS.filter((r) => r.test(text)).map((r) => r.source);
  let type = "other";
  if (/interview|technical round|coding round|hiring manager|next round/i.test(text)) type = "interview";
  else if (/assessment|test|hackerrank|codility/i.test(text)) type = "assessment";
  else if (/shortlisted|screening|recruiter.*call|schedule.*call/i.test(text)) type = "recruiter";
  return { isHiringSignal: matched.length > 0, type, matched };
}

function decodeBase64Url(value = "") {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
function findText(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  return (payload.parts || []).map(findText).filter(Boolean).join("\n");
}

export async function scanGmail(accessToken, query = "newer_than:7d (interview OR assessment OR recruiter OR shortlisted OR application)") {
  if (!accessToken) throw new Error("GMAIL_ACCESS_TOKEN is not configured");
  const headers = { authorization: `Bearer ${accessToken}` };
  const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`, { headers });
  if (!list.ok) throw new Error(`Gmail list failed (${list.status})`);
  const data = await list.json();
  const out = [];
  for (const row of data.messages || []) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${row.id}?format=full`, { headers });
    if (!response.ok) continue;
    const msg = await response.json();
    const headersList = msg.payload?.headers || [];
    const header = (name) => headersList.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
    const item = { id: row.id, threadId: msg.threadId, subject: header("Subject"), from: header("From"), date: header("Date"), body: findText(msg.payload).slice(0, 12000) };
    const signal = detectHiringSignal(item);
    if (signal.isHiringSignal) out.push({ ...item, ...signal });
  }
  return out;
}
