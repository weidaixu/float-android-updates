import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createManifest, nextReleaseMetadata, replaceGradleVersion } from "./release-version.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const wrapperRoot = path.join(repositoryRoot, "android-wrapper");
const manifestPath = path.join(repositoryRoot, "latest.json");
const gradlePath = path.join(wrapperRoot, "android", "app", "build.gradle");
const outputPath = process.env.GITHUB_OUTPUT;
const mode = process.argv[2];

function output(key, value) {
  if (outputPath) fs.appendFileSync(outputPath, `${key}=${value}\n`);
  else console.log(`${key}=${value}`);
}

const currentManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (mode === "version") {
  const release = nextReleaseMetadata(currentManifest);
  fs.writeFileSync(gradlePath, replaceGradleVersion(fs.readFileSync(gradlePath, "utf8"), release));
  output("version_code", release.versionCode);
  output("version_name", release.versionName);
  output("tag", `v${release.versionName}`);
  output("apk_name", `Float-Android-v${release.versionName}.apk`);
} else if (mode === "manifest") {
  const apkPath = process.argv[3];
  const repository = process.argv[4];
  const notes = process.argv[5] || "同步 Float 作者最新源码并重新构建 Android 版本。";
  if (!apkPath || !repository) throw new Error("manifest mode requires APK path and repository");
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(apkPath)).digest("hex");
  const gradle = fs.readFileSync(gradlePath, "utf8");
  const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
  const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
  const manifest = createManifest({ versionCode, versionName }, sha256, repository, notes);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  output("sha256", manifest.sha256);
} else {
  throw new Error("Usage: prepare-auto-release.mjs <version|manifest>");
}
