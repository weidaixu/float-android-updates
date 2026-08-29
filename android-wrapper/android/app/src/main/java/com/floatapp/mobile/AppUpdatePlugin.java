package com.floatapp.mobile;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    static boolean isAllowedDownloadUrl(String value) {
        if (value == null) return false;
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
        } catch (RuntimeException error) {
            return false;
        }
    }

    static boolean sha256Matches(String actual, String expected) {
        return actual != null && expected != null
                && actual.matches("(?i)^[a-f0-9]{64}$")
                && expected.matches("(?i)^[a-f0-9]{64}$")
                && actual.equalsIgnoreCase(expected);
    }

    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            JSObject result = new JSObject();
            result.put("versionCode", versionCode);
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("无法读取应用版本", "VERSION_READ_FAILED", error);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url", "");
        String expectedSha = call.getString("sha256", "");
        if (!isAllowedDownloadUrl(url)) {
            call.reject("更新地址必须使用 HTTPS", "UNSAFE_UPDATE_URL");
            return;
        }
        if (!expectedSha.matches("(?i)^[a-f0-9]{64}$")) {
            call.reject("更新包 SHA-256 无效", "INVALID_UPDATE_HASH");
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            call.reject("请允许 Float 安装未知应用后返回重试", "INSTALL_PERMISSION_REQUIRED");
            return;
        }

        new Thread(() -> downloadAndLaunch(call, url, expectedSha), "float-app-update").start();
    }

    private void downloadAndLaunch(PluginCall call, String urlValue, String expectedSha) {
        File updateDir = new File(getContext().getCacheDir(), "updates");
        File apk = new File(updateDir, "Float-update.apk");
        HttpURLConnection connection = null;
        try {
            if (!updateDir.exists() && !updateDir.mkdirs()) throw new IllegalStateException("无法创建更新目录");
            connection = (HttpURLConnection) new URL(urlValue).openConnection();
            connection.setConnectTimeout(20_000);
            connection.setReadTimeout(60_000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream");
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("下载失败 HTTP " + status);
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) {
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
            }
            String actualSha = sha256(apk);
            if (!sha256Matches(actualSha, expectedSha)) {
                apk.delete();
                throw new SecurityException("更新包校验失败");
            }
            Uri apkUri = FileProvider.getUriForFile(getContext(),
                    getContext().getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(apkUri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(install);
            JSObject result = new JSObject();
            result.put("launched", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "更新失败" : error.getMessage(), "UPDATE_FAILED", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) digest.update(buffer, 0, count);
        }
        StringBuilder hex = new StringBuilder(64);
        for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value));
        return hex.toString();
    }
}

