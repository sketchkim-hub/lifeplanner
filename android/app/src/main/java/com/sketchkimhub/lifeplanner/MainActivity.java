package com.sketchkimhub.lifeplanner;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }
        // Iframes (YouTube, Coupang widgets, Firebase) stay in the WebView.
        // A top-level navigation away from https://localhost — including mailto: —
        // is handed to the system (browser or email app).
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && !request.isForMainFrame()) {
                    return false;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
