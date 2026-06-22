package com.jinjeongwoo.todaytasks;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 스냅샷을 읽어 오늘 할일을 렌더한다. 펼친 상위(tt_widget_expanded) 아래에 하위행을 끼워 넣어
 * 하나의 평탄화 목록으로 만든다(상위행=widget_row, 하위행=widget_subrow / viewTypeCount=2).
 * 상위행: 네모 체크 + 제목/시각 + (하위 있으면) 카운트 n/m + 펼침 토글.
 * 하위행: 들여쓴 원 체크 + 제목. 상위 데이터가 없거나 오늘이 아니면 빈 목록.
 */
public class TodayWidgetFactory implements android.widget.RemoteViewsService.RemoteViewsFactory {

    /** 평탄화 행: 상위(sub=null) 또는 하위(parent=소속 상위). */
    private static class Row {
        final boolean isSub;
        final JSONObject parent;
        final JSONObject sub;
        Row(boolean isSub, JSONObject parent, JSONObject sub) { this.isSub = isSub; this.parent = parent; this.sub = sub; }
    }

    private final Context ctx;
    private final List<Row> rows = new ArrayList<>();
    private WidgetTheme theme = WidgetTheme.LIGHT;

    TodayWidgetFactory(Context ctx) { this.ctx = ctx; }

    @Override public void onCreate() {}
    @Override public void onDestroy() { rows.clear(); }
    @Override public int getCount() { return rows.size(); }
    @Override public int getViewTypeCount() { return 2; } // 상위행 / 하위행
    @Override public long getItemId(int position) { return position; }
    @Override public boolean hasStableIds() { return false; }
    @Override public RemoteViews getLoadingView() { return null; }

    @Override
    public void onDataSetChanged() {
        rows.clear();
        theme = WidgetTheme.of(ctx);
        String json = SnapshotEngine.readSnapshot(ctx);
        if (json == null) return;
        Set<String> expanded = SnapshotEngine.getExpandedIds(ctx);
        try {
            JSONObject snap = new JSONObject(json);
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            if (!today.equals(snap.optString("date"))) return; // 자정 넘어가면 어제 목록 표시 안 함
            JSONArray arr = snap.optJSONArray("tasks");
            if (arr == null) return;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject p = arr.getJSONObject(i);
                rows.add(new Row(false, p, null));
                JSONArray subs = p.optJSONArray("subtasks");
                if (subs != null && subs.length() > 0 && expanded.contains(p.optString("id"))) {
                    for (int j = 0; j < subs.length(); j++) rows.add(new Row(true, p, subs.getJSONObject(j)));
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public RemoteViews getViewAt(int position) {
        Row row = rows.get(position);
        return row.isSub ? subRow(row) : parentRow(row.parent);
    }

    private RemoteViews parentRow(JSONObject t) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_row);
        String id = t.optString("id");
        String listId = t.optString("listId");
        boolean done = t.optBoolean("done", false);
        String meta = t.isNull("meta") ? null : t.optString("meta", null); // 제목 옆 괄호 라벨((21:30)/(~6.25(목) 18:30))

        rv.setTextViewText(R.id.row_title, label(t.optString("title", ""), done));
        rv.setInt(R.id.row_check, "setImageResource", done ? R.drawable.ic_check_square_on : R.drawable.ic_check_square_off);
        rv.setInt(R.id.row_title, "setTextColor", done ? theme.mute : theme.ink);

        if (meta != null && meta.length() > 0) {
            rv.setTextViewText(R.id.row_meta, meta);
            rv.setInt(R.id.row_meta, "setTextColor", theme.meta); // 강조색(세이지) — 회색 카운트와 구분
            rv.setViewVisibility(R.id.row_meta, View.VISIBLE);
        } else {
            rv.setViewVisibility(R.id.row_meta, View.GONE);
        }

        JSONArray subs = t.optJSONArray("subtasks");
        int total = subs == null ? 0 : subs.length();
        if (total > 0) {
            int doneCount = 0;
            for (int i = 0; i < total; i++) if (subs.optJSONObject(i).optBoolean("done", false)) doneCount++;
            rv.setTextViewText(R.id.row_count, doneCount + "/" + total);
            rv.setInt(R.id.row_count, "setTextColor", theme.mute);
            boolean expanded = SnapshotEngine.getExpandedIds(ctx).contains(id);
            rv.setInt(R.id.row_toggle, "setImageResource", expanded ? R.drawable.ic_chevron_down : R.drawable.ic_chevron_right);
            rv.setInt(R.id.row_toggle, "setColorFilter", theme.iconTint);
            rv.setViewVisibility(R.id.row_expand, View.VISIBLE);
            // 카운트+토글 묶음 전체가 펼침 탭 영역(넓은 타깃)
            rv.setOnClickFillInIntent(R.id.row_expand, fill(TodayWidgetProvider.WA_EXPAND, id, listId, null, false, "expand/" + id));
        } else {
            rv.setViewVisibility(R.id.row_expand, View.GONE);
        }

        rv.setOnClickFillInIntent(R.id.row_body, fill(TodayWidgetProvider.WA_OPEN, id, listId, null, false, "open/" + id));
        rv.setOnClickFillInIntent(R.id.row_check, fill(TodayWidgetProvider.WA_TOGGLE, id, listId, null, !done, "toggle/" + id));
        return rv;
    }

    private RemoteViews subRow(Row row) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_subrow);
        JSONObject s = row.sub;
        String parentId = row.parent.optString("id");
        String listId = row.parent.optString("listId");
        String subId = s.optString("id");
        boolean done = s.optBoolean("done", false);

        rv.setTextViewText(R.id.subrow_title, label(s.optString("title", ""), done));
        rv.setInt(R.id.subrow_check, "setImageResource", done ? R.drawable.ic_check_circle_on : R.drawable.ic_check_circle_off);
        rv.setInt(R.id.subrow_title, "setTextColor", done ? theme.mute : theme.ink);

        // 체크/텍스트(행 전체) 어디를 탭해도 하위 완료 write-back (부모 id 함께 전달)
        Intent toggle = fill(TodayWidgetProvider.WA_TOGGLE_SUB, subId, listId, parentId, !done, "togglesub/" + subId);
        rv.setOnClickFillInIntent(R.id.subrow_check, toggle);
        rv.setOnClickFillInIntent(R.id.subrow_body, toggle);
        return rv;
    }

    /** 완료면 삭선(StrikethroughSpan은 ParcelableSpan이라 RemoteViews로 전달 가능). */
    private static CharSequence label(String text, boolean done) {
        if (!done || text.isEmpty()) return text;
        SpannableString ss = new SpannableString(text);
        ss.setSpan(new StrikethroughSpan(), 0, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return ss;
    }

    /** fillInIntent 빌더 — data uri로 행/액션별 유니크 보장(템플릿 dedupe 방지). */
    private static Intent fill(String wa, String taskId, String listId, String parentId, boolean targetDone, String uniq) {
        Intent i = new Intent()
                .putExtra(TodayWidgetProvider.EXTRA_WIDGET_ACTION, wa)
                .putExtra(TodayWidgetProvider.EXTRA_TASK_ID, taskId)
                .putExtra(TodayWidgetProvider.EXTRA_LIST_ID, listId)
                .putExtra(TodayWidgetProvider.EXTRA_TARGET_DONE, targetDone);
        if (parentId != null) i.putExtra(TodayWidgetProvider.EXTRA_PARENT_ID, parentId);
        i.setData(Uri.parse("ttwidget://" + uniq));
        return i;
    }
}
