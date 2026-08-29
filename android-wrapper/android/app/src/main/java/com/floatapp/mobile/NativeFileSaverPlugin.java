package com.floatapp.mobile;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
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

        SaveSession(Uri uri, OutputStream output) {
            this.uri = uri;
            this.output = output;
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
            sessions.put(sessionId, new SaveSession(uri, output));
            JSObject resultData = new JSObject();
            resultData.put("sessionId", sessionId);
            call.resolve(resultData);
        } catch (Exception error) {
            call.reject("无法创建保存文件", error);
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
            JSObject resultData = new JSObject();
            resultData.put("uri", session.uri.toString());
            call.resolve(resultData);
        } catch (Exception error) {
            call.reject("完成文件保存失败", error);
        }
    }

    @PluginMethod
    public void abortSave(PluginCall call) {
        closeSession(call.getString("sessionId"));
        call.resolve();
    }

    private void closeSession(String sessionId) {
        if (sessionId == null) return;
        SaveSession session = sessions.remove(sessionId);
        if (session == null) return;
        try {
            session.output.close();
        } catch (IOException ignored) {
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (String sessionId : sessions.keySet()) closeSession(sessionId);
        super.handleOnDestroy();
    }
}
