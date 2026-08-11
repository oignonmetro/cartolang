package app.cartolang;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Télécharge le nouvel APK et propose directement son installation, sans
 * repasser par le navigateur.
 *
 * Android exige toujours une confirmation explicite pour installer un paquet
 * venu d'ailleurs que d'un store : ce plugin ne contourne rien, il évite
 * seulement l'aller-retour par le navigateur et le gestionnaire de fichiers.
 * L'autorisation « installer des applications inconnues », une fois accordée
 * à Cartolang, reste valable pour les mises à jour suivantes.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private final Handler handler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL manquante.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            // Android ramène l'app au premier plan après le choix de
            // l'utilisateur ; handlePermissionResult reprend alors la main.
            call.setKeepAlive(true);
            Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            settingsIntent.setData(Uri.parse("package:" + getContext().getPackageName()));
            startActivityForResult(call, settingsIntent, "handlePermissionResult");
            return;
        }

        startDownload(call, url);
    }

    @ActivityCallback
    private void handlePermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("permission-denied");
            return;
        }
        startDownload(call, call.getString("url"));
    }

    private void startDownload(final PluginCall call, String url) {
        final DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) {
            call.reject("Gestionnaire de téléchargement indisponible.");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Cartolang");
        request.setDescription("Téléchargement de la mise à jour…");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, "cartolang-update.apk");
        request.setMimeType("application/vnd.android.package-archive");

        final long id = manager.enqueue(request);
        call.setKeepAlive(true);
        pollDownload(call, manager, id);
    }

    /**
     * Pas de `BroadcastReceiver` : sur les cibles récentes, l'enregistrer
     * exige de déclarer explicitement s'il est exporté ou non, une subtilité
     * versionnée à éviter ici. Un sondage simple toutes les 700 ms est tout
     * aussi fiable pour un fichier de quelques mégaoctets.
     */
    private void pollDownload(final PluginCall call, final DownloadManager manager, final long id) {
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
        Cursor cursor = manager.query(query);
        try {
            if (cursor != null && cursor.moveToFirst()) {
                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int status = statusIndex >= 0 ? cursor.getInt(statusIndex) : DownloadManager.STATUS_RUNNING;
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    launchInstall(call, manager, id);
                    return;
                }
                if (status == DownloadManager.STATUS_FAILED) {
                    call.reject("Le téléchargement a échoué.");
                    return;
                }
            }
        } finally {
            if (cursor != null) cursor.close();
        }

        handler.postDelayed(
            new Runnable() {
                @Override
                public void run() {
                    pollDownload(call, manager, id);
                }
            },
            700
        );
    }

    private void launchInstall(PluginCall call, DownloadManager manager, long id) {
        Uri uri = manager.getUriForDownloadedFile(id);
        if (uri == null) {
            call.reject("Fichier téléchargé introuvable.");
            return;
        }
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(install);
        call.resolve();
    }
}
