import Source from "../models/Source.js";
import { importBySource } from "./importers.js";
import { discoverWithSerper } from "./discovery.js";
import { getProfile, processAndSaveJobs } from "./jobProcessor.js";

let lastRunKey = "";
export function startDailyDiscovery() {
  if (String(process.env.DAILY_DISCOVERY_ENABLED || "true").toLowerCase() !== "true") return;
  const hour = Number(process.env.DAILY_DISCOVERY_HOUR || 7);
  const minute = Number(process.env.DAILY_DISCOVERY_MINUTE || 0);
  setInterval(async () => {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (now.getHours() !== hour || now.getMinutes() !== minute || lastRunKey === key) return;
    lastRunKey = key;
    try {
      const profile = await getProfile();
      const sources = await Source.find({ enabled: true, type: { $ne: "serper" } });
      const jobs = [];
      for (const source of sources) {
        try { jobs.push(...await importBySource(source)); source.lastRunAt = new Date(); source.lastError = ""; await source.save(); }
        catch (error) { source.lastError = error.message; await source.save(); }
      }
      const maxJobs = Number(process.env.DISCOVERY_MAX_JOBS || 500);
      if (process.env.SERPER_API_KEY && jobs.length < maxJobs) jobs.push(...await discoverWithSerper(profile, maxJobs - jobs.length));
      const unique = [...new Map(jobs.map((j) => [j.url, j])).values()].slice(0, maxJobs);
      const result = await processAndSaveJobs(unique, { useAI: Boolean(process.env.GEMINI_API_KEY), minScore: Number(process.env.DISCOVERY_MIN_SCORE || 55) });
      console.log(`[daily-discovery] fetched=${unique.length} saved=${result.saved} ignored=${result.ignored}`);
    } catch (error) { console.error("[daily-discovery]", error); }
  }, 60_000).unref();
}
