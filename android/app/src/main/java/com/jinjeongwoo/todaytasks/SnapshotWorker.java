package com.jinjeongwoo.todaytasks;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

/**
 * 주기 안전망: 화면을 오래 안 켜도 ~30분마다 스냅샷을 갱신해 위젯 최신성을 유지.
 * 디바운스: 최근 갱신(10분 이내)이면 재조회를 건너뜀(잦은 트리거와 중복 방지).
 * Doze/절전 시 정시 보장은 안 됨(수용).
 */
public class SnapshotWorker extends Worker {

    private static final long DEBOUNCE_MS = 10 * 60 * 1000L;

    public SnapshotWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        try {
            if (recentlyUpdated(ctx)) return Result.success(); // 최근 갱신됨 → skip
            SnapshotEngine.build(ctx);
            WidgetUpdater.updateAll(ctx);
        } catch (Exception ignored) {
            // 실패 시 기존 스냅샷 유지, 다음 주기에 재시도(success로 주기 유지)
        }
        return Result.success();
    }

    private static boolean recentlyUpdated(Context ctx) {
        String json = SnapshotEngine.readSnapshot(ctx);
        if (json == null) return false;
        try {
            long updatedAt = new JSONObject(json).optLong("updatedAt", 0);
            return updatedAt > 0 && (System.currentTimeMillis() - updatedAt) < DEBOUNCE_MS;
        } catch (Exception e) {
            return false;
        }
    }
}
