import test from "node:test";
import assert from "node:assert/strict";
import { createManifest, nextPatchVersion, nextReleaseMetadata, replaceGradleVersion } from "../scripts/release-version.mjs";

test("increments semantic patch and Android version code", () => {
  assert.equal(nextPatchVersion("1.1.9"), "1.1.10");
  assert.deepEqual(nextReleaseMetadata({ versionCode: 2, versionName: "1.1.0" }), { versionCode: 3, versionName: "1.1.1" });
});

test("updates both Gradle version fields", () => {
  const input = 'versionCode 2\nversionName "1.1.0"\n';
  assert.equal(replaceGradleVersion(input, { versionCode: 3, versionName: "1.1.1" }), 'versionCode 3\nversionName "1.1.1"\n');
});

test("creates a strict GitHub release manifest", () => {
  assert.deepEqual(createManifest({ versionCode: 3, versionName: "1.1.1" }, "ab12", "weidaixu/float-android-updates", "notes"), {
    versionCode: 3,
    versionName: "1.1.1",
    apkUrl: "https://github.com/weidaixu/float-android-updates/releases/download/v1.1.1/Float-Android-v1.1.1.apk",
    sha256: "AB12",
    notes: "notes",
    mandatory: false,
  });
});

test("rejects unsupported version formats", () => assert.throws(() => nextPatchVersion("1.1"), /Invalid versionName/));
