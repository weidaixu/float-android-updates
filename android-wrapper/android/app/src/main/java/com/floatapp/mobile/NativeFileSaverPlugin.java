package com.floatapp.mobile;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "NativeFileSaver")
public class NativeFileSaverPlugin extends Plugin {
    private static final String DEFAULT_FILENAME = "download.bin";

    private static final class SaveSession {
        final Uri uri;
        final OutputStream output;
        final boolean pendingMediaStore;

        SaveSession(Uri uri, OutputStream output, boolean pendingMediaStore) {
            this.uri = uri;
            this.output = output;
            this.pendingMediaStore = pendingMediaStore;
        }
    }

    private final Map<String, SaveSession> sessions = new ConcurrentHashMap<>();

    static String sanitizeFilename(String filename) {
        if (filename == null) return DEFAULT_FILENAME;
        String normalized = filename.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        String leaf = slash >= 0 ? normalized.substring(slash + 1) : normalized;
        leaf = leaf.replaceAll("[\\x00-\\x1f\\x7f]", "").trim();
        if (leaf.isEmpty() || leaf.matches("\\.+")) return DEFAULT_FILENAME;
        return leaf;
    }

    static void writeChunk(OutputStream output, byte[] bytes) throws IOException {
        output.write(bytes);
    }

    @PluginMethod
    public void startSave(PluginCall call) {
        String filename = sanitizeFilename(call.getString("filename", DEFAULT_FILENAME));
        String mimeType = call.getString("mimeType", "application/octet-stream");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType == null || mimeType.isBlank() ? "application/octet-stream" : mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveDestinationResult");
    }

    @ActivityCallback
    private void saveDestinationResult(PluginCall call, ActivityResult result) {
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("保存已取消", "SAVE_CANCELLED");
            return;
        }

        Uri uri = data.getData();
        try {
            OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w");
            if (output == null) throw new IOException("无法打开目标文件");
            String sessionId = UUID.randomUUID().toString();
            sessions.put(sessionId, new SaveSession(uri, output, false));
            JSObject resultData = new JSObject();
            resultData.put("sessionId", sessionId);
            call.resolve(resultData);
        } catch (Exception error) {
            call.reject("无法创建保存文件", error);
        }
    }

    @PluginMethod
    public void startAutomaticSave(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("当前安卓版本需要手动选择保存位置", "AUTOMATIC_SAVE_UNAVAILABLE");
            return;
        }
        String filename = sanitizeFilename(call.getString("filename", DEFAULT_FILENAME));
        String mimeType = call.getString("mimeType", "application/octet-stream");
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType == null || mimeType.isBlank() ? "application/octet-stream" : mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Float");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = null;
        try {
            uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("无法创建下载文件");
            OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w");
            if (output == null) throw new IOException("无法打开下载文件");
            String sessionId = UUID.randomUUID().toString();
            sessions.put(sessionId, new SaveSession(uri, output, true));
            JSObject resultData = new JSObject();
            resultData.put("sessionId", sessionId);
            call.resolve(resultData);
        } catch (Exception error) {
            if (uri != null) getContext().getContentResolver().delete(uri, null, null);
            call.reject("无法写入 Download/Float", error);
        }
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        String sessionId = call.getString("sessionId");
        String data = call.getString("data");
        SaveSession session = sessionId == null ? null : sessions.get(sessionId);
        if (session == null) {
            call.reject("保存会话不存在或已结束");
            return;
        }
        if (data == null) {
            call.reject("文件分块为空");
            return;
        }

        try {
            writeChunk(session.output, Base64.decode(data, Base64.DEFAULT));
            call.resolve();
        } catch (Exception error) {
            closeSession(sessionId);
            call.reject("写入备份文件失败", error);
        }
    }

    @PluginMethod
    public void finishSave(PluginCall call) {
        String sessionId = call.getString("sessionId");
        SaveSession session = sessionId == null ? null : sessions.remove(sessionId);
        if (session == null) {
            call.reject("保存会话不存在或已结束");
            return;
        }
        try {
            session.output.flush();
            session.output.close();
            if (session.pendingMediaStore && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                getContext().getContentResolver().update(session.uri, values, null, null);
            }
            JSObject resultData = new JSObject();
            resultData.put("uri", session.uri.toString());
            call.resolve(resultData);
        } catch (Exception error) {
            call.reject("完成文件保存失败", error);
        }
    }

    @PluginMethod
    public void abortSave(PluginCall call) {
        closeSession(call.getString("sessionId"), true);
        call.resolve();
    }

    private void closeSession(String sessionId) {
        closeSession(sessionId, false);
    }

    private void closeSession(String sessionId, boolean deletePending) {
        if (sessionId == null) return;
        SaveSession session = sessions.remove(sessionId);
        if (session == null) return;
        try {
            session.output.close();
        } catch (IOException ignored) {
        }
        if (deletePending && session.pendingMediaStore) {
            getContext().getContentResolver().delete(session.uri, null, null);
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (String sessionId : sessions.keySet()) closeSession(sessionId, true);
        super.handleOnDestroy();
    }
}
