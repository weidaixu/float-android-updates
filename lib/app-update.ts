export type AppUpdateManifest = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  notes: string;
  mandatory: boolean;
};

export function parseUpdateManifest(input: unknown): AppUpdateManifest {
  if (!input || typeof input !== "object") throw new Error("更新清单格式无效");
  const value = input as Record<string, unknown>;
  const versionCode = Number(value.versionCode);
  const versionName = String(value.versionName ?? "").trim();
  const apkUrl = String(value.apkUrl ?? "").trim();
  const sha256 = String(value.sha256 ?? "").trim().toLowerCase();
  const notes = String(value.notes ?? "").trim();
  if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error("versionCode 无效");
  if (!versionName) throw new Error("versionName 不能为空");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apkUrl);
  } catch {
    throw new Error("APK 地址无效");
  }
  if (parsedUrl.protocol !== "https:") throw new Error("APK 地址必须使用 HTTPS");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("APK SHA-256 无效");
  return { versionCode, versionName, apkUrl, sha256, notes, mandatory: value.mandatory === true };
}

export function isUpdateAvailable(currentVersionCode: number, manifest: AppUpdateManifest): boolean {
  return Number.isSafeInteger(currentVersionCode) && manifest.versionCode > currentVersionCode;
}

