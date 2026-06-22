package com.jinjeongwoo.todaytasks;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 오늘 할일 홈 위젯(classic RemoteViews 컬렉션 위젯).
 * 목록 데이터는 {@link TodayWidgetService}/{@link TodayWidgetFactory}가 스냅샷에서 렌더한다.
 * 상호작용:
 *  - 헤더 탭 → 앱(오늘 뷰), 추가 버튼 → 앱(퀵추가), 새로고침 버튼 → 스냅샷 재조회.
 *  - 행 본문 탭 → 앱(상세), 체크박스 탭 → 완료 write-back(낙관적 갱신).
 */
public class TodayWidgetProvider extends AppWidgetProvider {

    static final String PKG = "com.jinjeongwoo.todaytasks";
    static final String ACTION_REFRESH = PKG + ".widget.REFRESH";
    static final String ACTION_THEME = PKG + ".widget.THEME";   // 라이트/다크 토글
    static final String ACTION_ITEM = PKG + ".widget.ITEM"; // 리스트 행 클릭 템플릿

    // 라우팅/페이로드 extra 키 (MainActivity 딥링크 + 행 fillInIntent 공용)
    static final String EXTRA_ROUTE = "tt_route";          // "today" | "detail" | "add"
    static final String EXTRA_TASK_ID = "tt_taskId";
    static final String EXTRA_LIST_ID = "tt_listId";
    static final String EXTRA_PARENT_ID = "tt_parentId";    // 하위행 토글 시 부모 id
    static final String EXTRA_WIDGET_ACTION = "tt_wa";      // "open" | "toggle" | "expand" | "togglesub"
    static final String EXTRA_TARGET_DONE = "tt_targetDone";
    static final String WA_OPEN = "open";
    static final String WA_TOGGLE = "toggle";
    static final String WA_EXPAND = "expand";
    static final String WA_TOGGLE_SUB = "togglesub";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateWidget(ctx, mgr, id, false);
    }

    @Override
    public void onEnabled(Context ctx) {
        // 위젯 첫 배치 → WorkManager 안전망 등록 + 초기 스냅샷 1회 시도
        SnapshotScheduler.ensureScheduled(ctx);
        runRefresh(ctx);
    }

    private static void updateWidget(Context ctx, AppWidgetManager mgr, int id, boolean refreshing) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_today);

        rv.setTextViewText(R.id.widget_title, new SimpleDateFormat("M.d(E)", Locale.KOREA).format(new Date()));

        // 새로고침 진행 표시: 진행 중이면 아이콘 숨기고 스피너 노출
        rv.setViewVisibility(R.id.widget_refresh, refreshing ? android.view.View.GONE : android.view.View.VISIBLE);
        rv.setViewVisibility(R.id.widget_progress, refreshing ? android.view.View.VISIBLE : android.view.View.GONE);

        // 테마(라이트/다크) 적용 — 배경 + 헤더 텍스트/아이콘 색
        WidgetTheme th = WidgetTheme.of(ctx);
        rv.setInt(R.id.widget_root, "setBackgroundResource", th.bgRes);
        rv.setTextColor(R.id.widget_title, th.ink);
        rv.setTextColor(R.id.widget_empty, th.empty);
        rv.setInt(R.id.widget_refresh, "setColorFilter", th.iconTint);
        rv.setInt(R.id.widget_add, "setColorFilter", th.iconTint);
        rv.setInt(R.id.widget_theme, "setColorFilter", th.iconTint);

        // 목록 어댑터(컬렉션) 연결 — id별로 유니크한 data로 인스턴스 분리
        Intent svc = new Intent(ctx, TodayWidgetService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        rv.setRemoteAdapter(R.id.widget_list, svc);
        rv.setEmptyView(R.id.widget_list, R.id.widget_empty);

        // 행 클릭 템플릿(브로드캐스트) — 행의 fillInIntent가 wa/payload를 채움. (FLAG_MUTABLE 필수)
        Intent tmpl = new Intent(ctx, TodayWidgetProvider.class).setAction(ACTION_ITEM);
        PendingIntent tmplPi = PendingIntent.getBroadcast(ctx, 0, tmpl,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        rv.setPendingIntentTemplate(R.id.widget_list, tmplPi);

        // 헤더 탭 → 앱(오늘), 추가 버튼 → 앱(퀵추가)
        rv.setOnClickPendingIntent(R.id.widget_header, openAppPi(ctx, 1, "today", null, null));
        rv.setOnClickPendingIntent(R.id.widget_add, openAppPi(ctx, 2, "add", null, null));
        // 새로고침 버튼 → 스냅샷 재조회(브로드캐스트)
        Intent refresh = new Intent(ctx, TodayWidgetProvider.class).setAction(ACTION_REFRESH);
        rv.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(ctx, 3, refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        // 테마 버튼 → 라이트/다크 토글(브로드캐스트)
        Intent theme = new Intent(ctx, TodayWidgetProvider.class).setAction(ACTION_THEME);
        rv.setOnClickPendingIntent(R.id.widget_theme, PendingIntent.getBroadcast(ctx, 4, theme,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        mgr.updateAppWidget(id, rv);
    }

    /** 앱(MainActivity)을 띄우는 PendingIntent. route/taskId/listId를 extra로 전달 → 딥링크 라우팅. */
    private static PendingIntent openAppPi(Context ctx, int req, String route, String taskId, String listId) {
        Intent i = new Intent(ctx, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(EXTRA_ROUTE, route)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (taskId != null) i.putExtra(EXTRA_TASK_ID, taskId);
        if (listId != null) i.putExtra(EXTRA_LIST_ID, listId);
        // route별 유니크 data로 PendingIntent 구분
        i.setData(Uri.parse("ttwidget://open/" + route + (taskId != null ? "/" + taskId : "")));
        return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (ACTION_REFRESH.equals(action)) {
            showRefreshing(ctx);   // 스피너 즉시 표시
            runRefresh(ctx);       // 백그라운드 재조회 → 완료 후 아이콘 복원
            return;
        }
        if (ACTION_THEME.equals(action)) {
            SnapshotEngine.toggleTheme(ctx);
            WidgetUpdater.updateAll(ctx); // 헤더+행 재색칠
            return;
        }
        if (ACTION_ITEM.equals(action)) {
            String wa = intent.getStringExtra(EXTRA_WIDGET_ACTION);
            if (WA_OPEN.equals(wa)) {
                openAppNow(ctx, "detail", intent.getStringExtra(EXTRA_TASK_ID), intent.getStringExtra(EXTRA_LIST_ID));
            } else if (WA_TOGGLE.equals(wa)) {
                runToggle(ctx, intent.getStringExtra(EXTRA_TASK_ID), intent.getStringExtra(EXTRA_LIST_ID),
                        intent.getBooleanExtra(EXTRA_TARGET_DONE, true));
            } else if (WA_EXPAND.equals(wa)) {
                String taskId = intent.getStringExtra(EXTRA_TASK_ID);
                if (taskId != null) {
                    SnapshotEngine.toggleExpanded(ctx, taskId);
                    WidgetUpdater.updateAll(ctx); // 목록 재구성(펼침/접힘 반영)
                }
            } else if (WA_TOGGLE_SUB.equals(wa)) {
                runToggleSub(ctx, intent.getStringExtra(EXTRA_PARENT_ID), intent.getStringExtra(EXTRA_TASK_ID),
                        intent.getStringExtra(EXTRA_LIST_ID), intent.getBooleanExtra(EXTRA_TARGET_DONE, true));
            }
            return;
        }
        super.onReceive(ctx, intent); // ACTION_APPWIDGET_UPDATE 등 표준 처리 → onUpdate
    }

    private static void openAppNow(Context ctx, String route, String taskId, String listId) {
        Intent i = new Intent(ctx, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(EXTRA_ROUTE, route)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (taskId != null) i.putExtra(EXTRA_TASK_ID, taskId);
        if (listId != null) i.putExtra(EXTRA_LIST_ID, listId);
        ctx.startActivity(i);
    }

    /** 새로고침 진행 표시: 모든 위젯을 스피너 상태로 즉시 다시 그림. */
    private static void showRefreshing(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new android.content.ComponentName(ctx, TodayWidgetProvider.class));
        for (int id : ids) updateWidget(ctx, mgr, id, true);
    }

    /** 새로고침: 전량 재조회 → 위젯 갱신(백그라운드). */
    private void runRefresh(Context ctx) {
        final PendingResult pr = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try { SnapshotEngine.build(app); } catch (Exception ignored) {}
            WidgetUpdater.updateAll(app);
            pr.finish();
        }).start();
    }

    /**
     * 체크 완료 write-back(낙관적, 앱과 동일한 "쏘고 잊기"):
     * 즉시 스냅샷 토글 + 목록만 가볍게 갱신 → 백그라운드 PATCH만(전량 재조회 없음) → 실패 시에만 롤백.
     * 전량 재조회(build)를 빼서 연속 체크가 서로를 덮어쓰지 않음. 외부 변경 동기화는 새로고침/앱진입/주기 트리거가 담당.
     */
    private void runToggle(Context ctx, String taskId, String listId, boolean targetDone) {
        if (taskId == null || listId == null) return;
        SnapshotEngine.setSnapshotDone(ctx, taskId, targetDone);
        WidgetUpdater.refreshList(ctx);

        final PendingResult pr = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                String token = SnapshotEngine.getToken(app);
                SnapshotEngine.patchTaskStatus(app, listId, taskId, targetDone, token);
            } catch (Exception e) {
                SnapshotEngine.setSnapshotDone(app, taskId, !targetDone); // 롤백
                WidgetUpdater.refreshList(app);
            }
            pr.finish();
        }).start();
    }

    /** 하위할일 체크 write-back(낙관적, 쏘고 잊기): 즉시 토글+목록 갱신 → 백그라운드 PATCH만, 실패 시에만 롤백. */
    private void runToggleSub(Context ctx, String parentId, String subId, String listId, boolean targetDone) {
        if (parentId == null || subId == null || listId == null) return;
        SnapshotEngine.setSnapshotSubtaskDone(ctx, parentId, subId, targetDone);
        WidgetUpdater.refreshList(ctx);

        final PendingResult pr = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                String token = SnapshotEngine.getToken(app);
                SnapshotEngine.patchTaskStatus(app, listId, subId, targetDone, token);
            } catch (Exception e) {
                SnapshotEngine.setSnapshotSubtaskDone(app, parentId, subId, !targetDone); // 롤백
                WidgetUpdater.refreshList(app);
            }
            pr.finish();
        }).start();
    }
}
