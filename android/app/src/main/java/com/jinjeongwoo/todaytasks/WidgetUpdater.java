package com.jinjeongwoo.todaytasks;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

/**
 * 위젯 갱신의 단일 진입점 — 모든 트리거(plugin·WorkManager·위젯 체크/새로고침)가 이 메서드로 위젯을 새로 그린다.
 * 헤더/상태(onUpdate 재실행) + 리스트 데이터(notifyAppWidgetViewDataChanged) 둘 다 갱신한다.
 */
public final class WidgetUpdater {

    private WidgetUpdater() {}

    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        ComponentName cn = new ComponentName(ctx, TodayWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(cn);
        if (ids == null || ids.length == 0) return;

        // 리스트(컬렉션) 데이터 무효화 → RemoteViewsFactory.onDataSetChanged 재호출
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);

        // 헤더/버튼/상태 영역 재구성 → provider.onUpdate 재실행
        Intent intent = new Intent(ctx, TodayWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(intent);
    }

    /** 목록만 가볍게 새로고침(헤더 재구성 없음) — 체크 토글처럼 잦은 갱신에 사용. */
    static void refreshList(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, TodayWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
    }
}
