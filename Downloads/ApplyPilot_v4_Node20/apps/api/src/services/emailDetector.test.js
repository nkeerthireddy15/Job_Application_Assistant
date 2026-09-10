import test from "node:test";
import assert from "node:assert/strict";
import { detectHiringSignal } from "./emailDetector.js";

test("detects interview email", () => {
  const result = detectHiringSignal({ subject: "Technical interview - next round", body: "Please schedule a call." });
  assert.equal(result.isHiringSignal, true);
  assert.equal(result.type, "interview");
});

test("ignores generic newsletter", () => {
  const result = detectHiringSignal({ subject: "Weekly engineering newsletter", body: "Here are this week's links." });
  assert.equal(result.isHiringSignal, false);
});
