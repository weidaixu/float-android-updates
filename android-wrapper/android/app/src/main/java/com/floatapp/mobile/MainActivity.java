package com.floatapp.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Build;
import android.os.Bundle;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

public class MainActivity extends BridgeActivity {
    private final OnBackInvokedCallback backCallback = this::handleBack;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeFileSaverPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(VideoAnalysisPlugin.class);
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }

    private void handleBack() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            finish();
            return;
        }
        final android.webkit.WebView webView = getBridge().getWebView();
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        webView.evaluateJavascript(
                "(function(){var e=document.querySelector('.phone-shell[data-active-app]');" +
                        "return e&&e.getAttribute('data-active-app')?'APP':'HOME';})()",
                value -> {
                    if ("\"APP\"".equals(value)) {
                        webView.evaluateJavascript("window.dispatchEvent(new Event('androidBack'))", null);
                    } else {
                        finish();
                    }
                });
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    @Override
    public void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        }
        super.onDestroy();
    }
}
