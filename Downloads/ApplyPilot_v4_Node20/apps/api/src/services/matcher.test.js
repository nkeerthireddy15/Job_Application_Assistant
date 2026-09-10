import test from "node:test";
import assert from "node:assert/strict";
import { scoreJob, extractExperience } from "./matcher.js";

test("extractExperience reads a range", () => {
  assert.deepEqual(extractExperience("We need 2-4 years of experience"), { min: 2, max: 4 });
});

test("scoreJob rewards role and skill matches", () => {
  const profile = {
    skills: ["React", "Node.js", "MongoDB"],
    targetRoles: ["Full Stack Developer"],
    preferredLocations: ["Remote"],
    yearsExperience: 3
  };
  const result = scoreJob({ title: "Full Stack Developer", description: "React Node.js MongoDB 2-4 years", location: "Remote" }, profile);
  assert.ok(result.score >= 70);
});
