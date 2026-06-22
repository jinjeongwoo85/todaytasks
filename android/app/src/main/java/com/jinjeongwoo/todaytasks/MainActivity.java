package com.jinjeongwoo.todaytasks;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    // 위젯 → 앱 라우팅을 전달하는 Preferences 키(@capacitor/preferences와 같은 store).
    // JS가 mount/resume 시 이 키를 읽고 라우팅한 뒤 삭제한다(콜드/웜 스타트 공통, 브리지 준비 타이밍 무관).
    private static final String ROUTE_KEY = "tt_widget_route";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuthPlugin.class);
        registerPlugin(TodaySnapshotPlugin.class);
        super.onCreate(savedInstanceState);
        SnapshotScheduler.ensureScheduled(this); // 앱 시작 시 안전망 보장(KEEP라 멱등)
        handleWidgetRoute(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWidgetRoute(intent);
    }

    /** 위젯에서 온 라우팅 intent를 Preferences에 기록. JS가 소비한다. */
    private void handleWidgetRoute(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra(TodayWidgetProvider.EXTRA_ROUTE);
        if (route == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("route", route);
            o.put("taskId", intent.getStringExtra(TodayWidgetProvider.EXTRA_TASK_ID));
            o.put("listId", intent.getStringExtra(TodayWidgetProvider.EXTRA_LIST_ID));
            o.put("ts", System.currentTimeMillis());
            getSharedPreferences(SnapshotEngine.PREFS, Context.MODE_PRIVATE)
                    .edit().putString(ROUTE_KEY, o.toString()).apply();
        } catch (Exception ignored) {}
        // intent 소비 표시 — 재진입 시 같은 route 재처리 방지
        intent.removeExtra(TodayWidgetProvider.EXTRA_ROUTE);
    }
}
