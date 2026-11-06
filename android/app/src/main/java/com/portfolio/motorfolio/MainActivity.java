package com.portfolio.motorfolio;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalVaultPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().getSettings().setTextZoom(
            Math.round(100 * getResources().getConfiguration().fontScale)
        );
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(
                    "(function(){var dialog=document.querySelector('dialog[open]');" +
                    "if(!dialog)return false;dialog.dispatchEvent(new Event('cancel',{cancelable:true}));return true;})()",
                    result -> {
                        if (!"true".equals(result)) {
                            setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                            setEnabled(true);
                        }
                    }
                );
            }
        });
    }
}
