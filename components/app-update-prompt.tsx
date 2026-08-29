"use client";

import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { isUpdateAvailable, parseUpdateManifest, type AppUpdateManifest } from "@/lib/app-update";

const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/weidaixu/float-android-updates/main/latest.json";
const SNOOZE_KEY = "float_android_update_snooze_v1";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

type AppUpdateNative = {
  getCurrentVersion(): Promise<{ versionCode: number; versionName: string }>;
  downloadAndInstall(options: { url: string; sha256: string }): Promise<{ launched: boolean }>;
};

const AppUpdate = registerPlugin<AppUpdateNative>("AppUpdate");

function wasSnoozed(versionCode: number): boolean {
  try {
    const value = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "null") as { versionCode?: number; until?: number } | null;
    return value?.versionCode === versionCode && Number(value.until) > Date.now();
  } catch {
    return false;
  }
}

export function AppUpdatePrompt() {
  const [manifest, setManifest] = useState<AppUpdateManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
          if (!response.ok) return;
          const next = parseUpdateManifest(await response.json());
          const current = await AppUpdate.getCurrentVersion();
          if (isUpdateAvailable(Number(current.versionCode), next) && !wasSnoozed(next.versionCode)) {
            setManifest(next);
          }
        } catch {
          // Update checks are best-effort and must never block app startup.
        }
      })();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!manifest) return null;

  const remindLater = () => {
    if (manifest.mandatory) return;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({
      versionCode: manifest.versionCode,
      until: Date.now() + SNOOZE_MS,
    }));
    setManifest(null);
  };

  const install = async () => {
    setBusy(true);
    setError("");
    try {
      await AppUpdate.downloadAndInstall({ url: manifest.apkUrl, sha256: manifest.sha256 });
    } catch (reason) {
      const value = reason as { code?: string; message?: string };
      setError(value.code === "INSTALL_PERMISSION_REQUIRED"
        ? "请在刚打开的系统页面允许 Float 安装未知应用，然后返回这里再次点击更新。"
        : value.message || "更新下载失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-5" role="dialog" aria-modal="true" aria-label="发现新版本">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-[#17171b] shadow-2xl">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#ff5c8a]">Float Update</div>
        <h2 className="text-[22px] font-bold">发现新版本 {manifest.versionName}</h2>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-[#666]">
          {manifest.notes || "修复问题并提升使用体验。"}
        </p>
        {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void install()}
          className="mt-5 w-full rounded-2xl bg-[#17171b] px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? "正在下载并校验…" : "下载并安装"}
        </button>
        {!manifest.mandatory ? (
          <button type="button" disabled={busy} onClick={remindLater} className="mt-2 w-full px-4 py-2 text-[14px] text-[#777]">
            稍后提醒
          </button>
        ) : null}
      </div>
    </div>
  );
}

