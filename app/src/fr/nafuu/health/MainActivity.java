package fr.nafuu.health;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/www/index.html";
    private static final int MAX_IMPORT = 2 * 1024 * 1024;
    private static final int REQ_FILE = 41;

    private WebView web;
    private boolean pageReady = false;
    private String pendingImport = null;
    private ValueCallback<Uri[]> fileCallback = null;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // Thème clair : la WebView suit le thème de l'app (Material Light).
        int bg = Color.rgb(0xee, 0xf2, 0xf4);
        getWindow().getDecorView().setBackgroundColor(bg);
        if (Build.VERSION.SDK_INT >= 30) {
            int light = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            getWindow().getDecorView().post(() -> {
                android.view.WindowInsetsController c = getWindow().getInsetsController();
                if (c != null) c.setSystemBarsAppearance(light, light);
            });
        } else {
            getWindow().setStatusBarColor(bg);
            getWindow().setNavigationBarColor(bg);
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }

        web = new WebView(this);
        web.setBackgroundColor(bg);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setDatabaseEnabled(false);
        s.setGeolocationEnabled(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        WebView.setWebContentsDebuggingEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serveAsset(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                // Aucune navigation hors de l'app.
                return !HOST.equals(req.getUrl().getHost());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                deliverPending();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(i, REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "NafuuBridge");

        web.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(b.left, b.top, b.right, b.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        setContentView(web);
        if (state == null) {
            web.loadUrl(START);
        } else {
            web.restoreState(state);
            if (web.getUrl() == null) web.loadUrl(START);
        }
        handleIntent(getIntent());
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /* ---------- Fichiers de l'app servis depuis l'APK ---------- */

    private WebResourceResponse serveAsset(Uri uri) {
        if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return blocked();
        String path = uri.getPath();
        if (path == null || !path.startsWith("/www/") || path.contains("..")) return blocked();
        String asset = path.substring(1);
        try {
            InputStream in = getAssets().open(asset);
            WebResourceResponse r = new WebResourceResponse(mime(asset), mime(asset).startsWith("text/") || asset.endsWith(".js") ? "utf-8" : null, in);
            java.util.Map<String, String> h = new java.util.HashMap<>();
            h.put("Cache-Control", "no-store");
            h.put("X-Content-Type-Options", "nosniff");
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return blocked();
        }
    }

    private static WebResourceResponse blocked() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(403, "Blocked");
        return r;
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    /* ---------- Fichiers reçus (WhatsApp, gestionnaire de fichiers) ---------- */

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            if (Build.VERSION.SDK_INT >= 33) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            else uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null || !"content".equals(uri.getScheme())) return;
        String text = readUri(uri);
        if (text == null) {
            Toast.makeText(this, "Impossible de lire ce fichier.", Toast.LENGTH_LONG).show();
            return;
        }
        pendingImport = text;
        deliverPending();
    }

    private String readUri(Uri uri) {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n, total = 0;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_IMPORT) return null;
                out.write(buf, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException | SecurityException e) {
            return null;
        }
    }

    private void deliverPending() {
        if (!pageReady || pendingImport == null) return;
        String js = "window.nafuuReceive && window.nafuuReceive(" + JSONObject.quote(pendingImport) + ")";
        pendingImport = null;
        web.evaluateJavascript(js, null);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (res == RESULT_OK && data != null && data.getData() != null) result = new Uri[] { data.getData() };
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    /* ---------- Retour ---------- */

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.nafuuBack ? window.nafuuBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("NafuuBridge");
            web.destroy();
        }
        super.onDestroy();
    }

    /* ---------- Pont JavaScript : uniquement ces quatre fonctions ---------- */

    private class Bridge {
        @JavascriptInterface
        public void shareFile(String name, String content, String message) {
            if (content == null || content.length() > 8 * 1024 * 1024) return;
            String safe = name == null ? "" : name.toLowerCase().replaceAll("[^a-z0-9._-]", "-");
            if (safe.isEmpty() || safe.length() > 120 || !safe.endsWith(".json")) safe = "nafuu-health.json";
            final String fname = safe;
            runOnUiThread(() -> {
                try {
                    File dir = ShareProvider.shareDir(MainActivity.this);
                    File[] old = dir.listFiles();
                    if (old != null) for (File f : old) f.delete();
                    File f = new File(dir, fname);
                    try (FileOutputStream out = new FileOutputStream(f)) {
                        out.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                    Uri uri = new Uri.Builder().scheme("content").authority(ShareProvider.AUTHORITY).appendPath(fname).build();
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("application/json");
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    if (message != null && !message.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, message.length() > 500 ? message.substring(0, 500) : message);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    Intent chooser = Intent.createChooser(send, "Envoyer avec");
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(chooser);
                } catch (IOException | ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "Envoi impossible.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void keepAwake(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void vibrate(int ms) {
            int d = Math.max(10, Math.min(ms, 1500));
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
        }

        @JavascriptInterface
        public void openWhatsApp(String phone, String text) {
            String digits = phone == null ? "" : phone.replaceAll("\\D", "");
            if (digits.length() < 6 || digits.length() > 15) return;
            String msg = text == null ? "" : (text.length() > 500 ? text.substring(0, 500) : text);
            Uri uri = Uri.parse("https://wa.me/" + digits + "?text=" + Uri.encode(msg));
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "WhatsApp n'est pas installé.", Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}
