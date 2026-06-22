package com.jinjeongwoo.todaytasks;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 재부팅 후 WorkManager 주기 안전망을 재보장(KEEP라 멱등). */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            SnapshotScheduler.ensureScheduled(ctx);
        }
    }
}
