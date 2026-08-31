export type DownloadSaveMode = "android-download-manager" | "android-downloads" | "android-picker" | "browser";

export function resolveDownloadSaveMode(input: {
  androidNative: boolean;
  automaticAndroidSave?: boolean;
  directRemoteDownload?: boolean;
}): DownloadSaveMode {
  if (!input.androidNative) return "browser";
  if (input.directRemoteDownload) return "android-download-manager";
  return input.automaticAndroidSave ? "android-downloads" : "android-picker";
}
