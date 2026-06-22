package com.jinjeongwoo.todaytasks;

import android.content.Context;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/** WorkManager 주기 안전망(30분) 등록. KEEP 정책이라 여러 번 불러도 안전(위젯 배치/부팅/앱시작에서 호출). */
public final class SnapshotScheduler {

    private SnapshotScheduler() {}

    static final String WORK_NAME = "tt_snapshot_periodic";
    static final long INTERVAL_MINUTES = 30; // 사용자 결정: 30분

    static void ensureScheduled(Context ctx) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(
                SnapshotWorker.class, INTERVAL_MINUTES, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(ctx)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req);
    }
}
