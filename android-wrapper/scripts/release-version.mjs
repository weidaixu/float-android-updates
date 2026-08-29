export function nextPatchVersion(versionName) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(versionName));
  if (!match) throw new Error(`Invalid versionName: ${versionName}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function nextReleaseMetadata(manifest) {
  const versionCode = Number(manifest?.versionCode);
  if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error("latest.json versionCode must be a positive integer");
  return { versionCode: versionCode + 1, versionName: nextPatchVersion(manifest.versionName) };
}

export function replaceGradleVersion(source, release) {
  const withCode = source.replace(/versionCode\s+\d+/, `versionCode ${release.versionCode}`);
  const withName = withCode.replace(/versionName\s+"[^"]+"/, `versionName "${release.versionName}"`);
  if (withName === source || !withName.includes(`versionCode ${release.versionCode}`) || !withName.includes(`versionName "${release.versionName}"`)) throw new Error("Could not update Android Gradle version fields");
  return withName;
}

export function createManifest(release, sha256, repository, notes) {
  const fileName = `Float-Android-v${release.versionName}.apk`;
  return {
    versionCode: release.versionCode,
    versionName: release.versionName,
    apkUrl: `https://github.com/${repository}/releases/download/v${release.versionName}/${fileName}`,
    sha256: String(sha256).toUpperCase(),
    notes,
    mandatory: false,
  };
}
