package com.portfolio.motorfolio;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocalVault")
public class LocalVaultPlugin extends Plugin {
    private SQLiteOpenHelper helper;

    @Override public void load() {
        helper = new SQLiteOpenHelper(getContext(), "workspace.db", null, 1) {
            @Override public void onCreate(SQLiteDatabase db) {
                db.execSQL("CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, json TEXT NOT NULL)");
            }
            @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
                throw new IllegalStateException("Unsupported database upgrade; export a backup first.");
            }
        };
    }

    @PluginMethod public void load(PluginCall call) {
        try (Cursor cursor = helper.getReadableDatabase().rawQuery("SELECT json FROM snapshot WHERE id=1", null)) {
            JSObject result = new JSObject();
            result.put("json", cursor.moveToFirst() ? cursor.getString(0) : JSObject.NULL);
            call.resolve(result);
        } catch (Exception error) { call.reject("Local storage could not be read. Your records have not been replaced."); }
    }

    @PluginMethod public synchronized void save(PluginCall call) {
        String json = call.getString("json");
        Integer expected = call.getInt("expected");
        if (json == null || expected == null) { call.reject("Invalid save request."); return; }
        SQLiteDatabase db = null;
        try {
            db = helper.getWritableDatabase();
            db.beginTransaction();
            try (Cursor cursor = db.rawQuery("SELECT revision FROM snapshot WHERE id=1", null)) {
            int actual = cursor.moveToFirst() ? cursor.getInt(0) : 0;
            if (actual != expected) { call.reject("Another view changed your records. Reload before saving."); return; }
            ContentValues values = new ContentValues();
            values.put("id", 1); values.put("revision", expected + 1); values.put("json", json);
            long inserted = db.insertWithOnConflict("snapshot", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            if (inserted == -1) throw new IllegalStateException("Write failed");
            db.setTransactionSuccessful();
            }
        } catch (Exception error) { call.reject("Could not save. Storage may be full. Previous records are safe."); return; }
        finally { if (db != null && db.inTransaction()) db.endTransaction(); }
        call.resolve();
    }

    @Override protected void handleOnDestroy() { if (helper != null) helper.close(); }

    @PluginMethod public void exportFile(PluginCall call) {
        String name = call.getString("name", "export.txt");
        String content = call.getString("content", "");
        String mime = call.getString("type", "application/octet-stream");
        if (!name.matches("[a-zA-Z0-9_. -]{1,120}") || name.contains("..")) {
            name = "workspace-export";
        }
        try {
            File directory = new File(getContext().getCacheDir(), "exports");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException();
            File target = new File(directory, name);
            byte[] bytes = Boolean.TRUE.equals(call.getBoolean("base64", false))
                ? Base64.decode(content, Base64.DEFAULT) : content.getBytes(StandardCharsets.UTF_8);
            try (FileOutputStream stream = new FileOutputStream(target)) { stream.write(bytes); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", target);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mime); intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try { getActivity().startActivity(Intent.createChooser(intent, "Save or share your export")); call.resolve(); }
                catch (Exception error) { call.reject("No application is available to save or share this file."); }
            });
        } catch (Exception error) { call.reject("Export could not be created. Check available device storage."); }
    }
}
