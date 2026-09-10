import test from "node:test";
import assert from "node:assert/strict";
import { selectResume } from "./resumeSelector.js";

test("selects targeted resume", () => {
  const resumes = [
    { _id: "1", name: "General", isDefault: true, targetRoles: [], targetSkills: [] },
    { _id: "2", name: "React Native", targetRoles: ["React Native Developer"], targetSkills: ["React Native"] }
  ];
  const selected = selectResume({ title: "React Native Developer", description: "React Native mobile app" }, resumes);
  assert.equal(selected._id, "2");
});
