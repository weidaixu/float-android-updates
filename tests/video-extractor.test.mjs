import assert from "node:assert/strict";
import test from "node:test";

import { evenlySpacedVideoTimes } from "../lib/chat-attachments/video-extractor.ts";

test("browser keyframe times are evenly spaced and capped at twelve", () => {
  assert.deepEqual(evenlySpacedVideoTimes(10, 4), [0, 10 / 3, 20 / 3, 10]);
  assert.equal(evenlySpacedVideoTimes(20, 99).length, 12);
});

test("zero-duration videos still produce one safe timestamp", () => {
  assert.deepEqual(evenlySpacedVideoTimes(0, 12), [0]);
});
