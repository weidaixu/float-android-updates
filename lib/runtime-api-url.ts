export type RuntimeApiUrlOptions = { native?: boolean; remoteBase?: string };

function isNativeWebView(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "capacitor:" || window.location.protocol === "ionic:";
}

export function resolveRuntimeApiUrl(path: string, options: RuntimeApiUrlOptions = {}): string {
  if (!path.startsWith("/api/")) return path;
  if (!(options.native ?? isNativeWebView())) return path;
  const base = (options.remoteBase ?? process.env.NEXT_PUBLIC_FLOAT_WEB_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("APK 未配置 Float 网页服务地址，无法使用资源集市。");
  return `${base}${path}`;
}
