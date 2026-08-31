import assert from "node:assert/strict";
import test from "node:test";

import { resolveDownloadSaveMode } from "../lib/download-save-mode.ts";

test("resource downloads use automatic Android Downloads storage", () => {
  assert.equal(resolveDownloadSaveMode({ androidNative: true, directRemoteDownload: true }), "android-download-manager");
});

test("ordinary exports keep the Android document picker", () => {
  assert.equal(resolveDownloadSaveMode({ androidNative: true, automaticAndroidSave: false }), "android-picker");
});

test("web downloads keep the browser path", () => {
  assert.equal(resolveDownloadSaveMode({ androidNative: false, automaticAndroidSave: true }), "browser");
});
