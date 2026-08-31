export type DownloadSaveMode = "android-downloads" | "android-picker" | "browser";

export function resolveDownloadSaveMode(input: {
  androidNative: boolean;
  automaticAndroidSave?: boolean;
}): DownloadSaveMode {
  if (!input.androidNative) return "browser";
  return input.automaticAndroidSave ? "android-downloads" : "android-picker";
}
