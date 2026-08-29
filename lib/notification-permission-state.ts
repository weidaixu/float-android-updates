export type NotificationRuntime = "native" | "web";
export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export function shouldEnableNotificationSetting(input: {
  runtime: NotificationRuntime;
  requestGranted: boolean;
  browserPermission: BrowserNotificationPermission;
}): boolean {
  if (!input.requestGranted) return false;
  if (input.runtime === "native") return true;
  return input.browserPermission === "granted";
}

