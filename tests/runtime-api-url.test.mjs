import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimeApiUrl } from "../lib/runtime-api-url.ts";

test("web keeps same-origin app market routes", () => {
  assert.equal(resolveRuntimeApiUrl("/api/app-market/apps-lite", { native: false, remoteBase: "https://float.example" }), "/api/app-market/apps-lite");
});

test("native APK sends app market routes to the deployed backend", () => {
  assert.equal(resolveRuntimeApiUrl("/api/app-market/apps-lite?mine=1", { native: true, remoteBase: "https://float.example/" }), "https://float.example/api/app-market/apps-lite?mine=1");
});
