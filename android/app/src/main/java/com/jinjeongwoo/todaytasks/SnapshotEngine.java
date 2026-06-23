package com.jinjeongwoo.todaytasks;

import android.content.Context;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * "오늘 할일 스냅샷" 생성/저장의 단일 출처(plugin·WorkManager·위젯 체크 write-back이 공유).
 * Phase 3의 TodaySnapshotPlugin 로직을 여기로 추출해 이중 관리를 막는다.
 *
 * 토큰(Phase 2 GoogleSignIn+GoogleAuthUtil) → Google Tasks REST →
 * notes 마커/오늘-필터를 JS와 동일 규칙으로 재구현 → SharedPreferences("CapacitorStorage")에 저장.
 *
 * ⚠️ 오늘-필터(isTaskOnDate)·마커 파싱은 src/utils/{date.js,taskNotes.js}와 이중 관리 — 규칙 변경 시 함께 수정.
 */
public final class SnapshotEngine {

    private SnapshotEngine() {}

    static final String BASE = "https://tasks.googleapis.com/tasks/v1";
    static final String TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
    static final String PREFS = "CapacitorStorage"; // @capacitor/preferences와 같은 store
    static final String KEY = "tt_today_snapshot";
    static final String EXPANDED_KEY = "tt_widget_expanded"; // 위젯에서 펼친 상위 id 목록(JSON 배열)
    static final String THEME_KEY = "tt_widget_theme";       // "dark" | (그 외=light)

    // notes 끝줄 마커: \n*⟦tt … ⟧[ \t]*$  (⟦=U+27E6, ⟧=U+27E7) — taskNotes.js MARKER_RE와 동일
    private static final Pattern MARKER_RE = Pattern.compile("\\n*⟦tt[^⟧]*⟧[ \\t]*$");
    private static final Pattern START_RE = Pattern.compile("start=(\\d{4}-\\d{2}-\\d{2})");
    private static final Pattern TIME_RE = Pattern.compile("time=(([01]\\d|2[0-3]):[0-5]\\d)");

    /** 기기 계정으로 Tasks 액세스 토큰을 조용히 발급. 계정 없으면 NoAccountException. */
    static String getToken(Context ctx) throws Exception {
        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(ctx);
        if (account == null || account.getAccount() == null) {
            throw new NoAccountException();
        }
        return GoogleAuthUtil.getToken(ctx, account.getAccount(), "oauth2:" + TASKS_SCOPE);
    }

    public static class NoAccountException extends Exception {
        NoAccountException() { super("NO_ACCOUNT"); }
    }

    /**
     * 오늘 할일 스냅샷을 만들어 저장한다(전량 재조회). 반환=오늘 할일 개수, snapshot JSON은 prefs에 기록.
     * 실패는 예외로 던짐(호출부가 기존 스냅샷 유지 등 결정).
     */
    static int build(Context ctx) throws Exception {
        String token = getToken(ctx);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

        JSONArray outTasks = new JSONArray();

        JSONObject listsResp = new JSONObject(httpGet(BASE + "/users/@me/lists", token));
        JSONArray lists = listsResp.optJSONArray("items");
        if (lists != null) {
            for (int li = 0; li < lists.length(); li++) {
                String listId = lists.getJSONObject(li).getString("id");
                String url = BASE + "/lists/" + listId + "/tasks?showCompleted=true&showHidden=true&maxResults=100";
                JSONArray items = new JSONObject(httpGet(url, token)).optJSONArray("items");
                if (items == null) continue;

                // position(사전식 문자열)으로 정렬 — 앱과 동일한 순서
                List<JSONObject> all = new ArrayList<>();
                for (int i = 0; i < items.length(); i++) all.add(items.getJSONObject(i));
                Collections.sort(all, (a, b) -> a.optString("position", "").compareTo(b.optString("position", "")));

                // 부모/자식 분리 (자식 = parent 필드 있음)
                Map<String, List<JSONObject>> childrenByParent = new HashMap<>();
                List<JSONObject> parents = new ArrayList<>();
                for (JSONObject it : all) {
                    String parent = it.optString("parent", "");
                    if (parent.length() > 0) {
                        List<JSONObject> kids = childrenByParent.get(parent);
                        if (kids == null) { kids = new ArrayList<>(); childrenByParent.put(parent, kids); }
                        kids.add(it);
                    } else {
                        parents.add(it);
                    }
                }

                for (JSONObject p : parents) {
                    String dueDate = isoDate(p.optString("due", ""));
                    String startDate = markerValue(p.optString("notes", ""), START_RE);
                    String time = markerValue(p.optString("notes", ""), TIME_RE);
                    if (!isTaskOnDate(startDate, dueDate, today)) continue;

                    String pid = p.getString("id");
                    JSONObject t = new JSONObject();
                    t.put("id", pid);
                    t.put("listId", listId);
                    t.put("title", p.optString("title", ""));
                    // 표기는 meta(렌더된 라벨)로 단일화 — raw time 필드는 위젯이 안 쓰므로 저장 안 함.
                    String meta = widgetMeta(startDate, dueDate, time, today);
                    t.put("meta", meta == null ? JSONObject.NULL : meta);
                    t.put("done", "completed".equals(p.optString("status", "")));

                    JSONArray subs = new JSONArray();
                    List<JSONObject> kids = childrenByParent.get(pid);
                    if (kids != null) {
                        for (JSONObject k : kids) {
                            JSONObject s = new JSONObject();
                            s.put("id", k.getString("id"));
                            s.put("title", k.optString("title", ""));
                            s.put("done", "completed".equals(k.optString("status", "")));
                            subs.put(s);
                        }
                    }
                    t.put("subtasks", subs);
                    outTasks.put(t);
                }
            }
        }

        JSONObject snapshot = new JSONObject();
        snapshot.put("date", today);
        snapshot.put("updatedAt", System.currentTimeMillis());
        snapshot.put("tasks", outTasks);
        writeSnapshot(ctx, snapshot.toString());
        return outTasks.length();
    }

    /** 위젯 완료 write-back: 해당 할일/하위의 status를 PATCH(completed/needsAction). */
    static void patchTaskStatus(Context ctx, String listId, String taskId, boolean done, String token) throws Exception {
        JSONObject body = new JSONObject();
        body.put("status", done ? "completed" : "needsAction");
        httpPatch(BASE + "/lists/" + listId + "/tasks/" + taskId, token, body.toString());
    }

    static String readSnapshot(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
    }

    /** 낙관적 갱신: 저장된 스냅샷에서 taskId의 done을 즉시 토글(서버 왕복 전 0초 반영). 성공 여부 반환. */
    static boolean setSnapshotDone(Context ctx, String taskId, boolean done) {
        String json = readSnapshot(ctx);
        if (json == null) return false;
        try {
            JSONObject snap = new JSONObject(json);
            JSONArray tasks = snap.optJSONArray("tasks");
            if (tasks == null) return false;
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject t = tasks.getJSONObject(i);
                if (taskId.equals(t.optString("id"))) {
                    t.put("done", done);
                    writeSnapshot(ctx, snap.toString());
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    static void writeSnapshot(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
    }

    /** 낙관적 갱신: 하위할일(subId)의 done을 즉시 토글. 성공 여부 반환. */
    static boolean setSnapshotSubtaskDone(Context ctx, String parentId, String subId, boolean done) {
        String json = readSnapshot(ctx);
        if (json == null) return false;
        try {
            JSONObject snap = new JSONObject(json);
            JSONArray tasks = snap.optJSONArray("tasks");
            if (tasks == null) return false;
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject t = tasks.getJSONObject(i);
                if (!parentId.equals(t.optString("id"))) continue;
                JSONArray subs = t.optJSONArray("subtasks");
                if (subs == null) return false;
                for (int j = 0; j < subs.length(); j++) {
                    JSONObject s = subs.getJSONObject(j);
                    if (subId.equals(s.optString("id"))) {
                        s.put("done", done);
                        writeSnapshot(ctx, snap.toString());
                        return true;
                    }
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    /** 위젯 다크 테마 여부. */
    static boolean isDarkTheme(Context ctx) {
        return "dark".equals(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(THEME_KEY, "light"));
    }

    /** 라이트↔다크 토글 후 저장. */
    static void toggleTheme(Context ctx) {
        String next = isDarkTheme(ctx) ? "light" : "dark";
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(THEME_KEY, next).apply();
    }

    /** 위젯에서 펼친 상위 id 집합(없으면 빈 집합). */
    static java.util.Set<String> getExpandedIds(Context ctx) {
        java.util.Set<String> set = new java.util.HashSet<>();
        String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(EXPANDED_KEY, null);
        if (json == null) return set;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) set.add(arr.getString(i));
        } catch (Exception ignored) {}
        return set;
    }

    /** 펼침 토글(있으면 접고 없으면 펼침)하고 저장. */
    static void toggleExpanded(Context ctx, String taskId) {
        java.util.Set<String> set = getExpandedIds(ctx);
        if (!set.add(taskId)) set.remove(taskId);
        JSONArray arr = new JSONArray();
        for (String id : set) arr.put(id);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(EXPANDED_KEY, arr.toString()).apply();
    }

    // 'YYYY-MM-DD...' → 'YYYY-MM-DD' (없으면 null)
    private static String isoDate(String due) {
        if (due == null || due.length() < 10) return null;
        return due.substring(0, 10);
    }

    // notes 끝 마커에서 start=/time= 값 추출 (없으면 null) — taskNotes.js decode 규칙
    private static String markerValue(String notes, Pattern valueRe) {
        if (notes == null) return null;
        Matcher mk = MARKER_RE.matcher(notes);
        if (!mk.find()) return null;
        Matcher v = valueRe.matcher(mk.group());
        return v.find() ? v.group(1) : null;
    }

    // 위젯 행 우측 라벨(괄호). 위젯은 "오늘" 기준이라 단일 할일은 날짜 생략.
    //  - 기간(시작<종료): 종료=오늘이면 (~HH:mm)/(~오늘), 미래면 (~M.d(요일) HH:mm)
    //  - 단일: 시각 있으면 (HH:mm), 없으면 null(라벨 없음)
    //  - 날짜 미설정(시작·종료 둘 다 없음): "—"(괄호 안 em-dash) — 다른 라벨과 동일하게 괄호 표기
    // ⚠️ 표기 규칙은 위젯 전용 — 앱 rowDateLabel(date.js)과 별개(교차 결합 주의).
    private static String widgetMeta(String start, String due, String time, String today) {
        boolean hasTime = time != null && time.length() > 0;
        boolean isRange = start != null && due != null && start.compareTo(due) <= 0 && !start.equals(due);
        if (isRange) {
            if (due.equals(today)) return hasTime ? "(~" + time + ")" : "(~오늘)";
            return "(~" + mdLabel(due) + (hasTime ? " " + time : "") + ")";
        }
        if (due == null && start == null) return "(—)";
        return hasTime ? "(" + time + ")" : null;
    }

    // 'YYYY-MM-DD' → 'M.d(요일)' (앱 formatDate와 동일 표기)
    private static String mdLabel(String iso) {
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(iso);
            return new SimpleDateFormat("M.d(E)", Locale.KOREA).format(d);
        } catch (Exception e) {
            return iso;
        }
    }

    // date.js isTaskOnDate와 동일: 시작~종료 범위가 있으면 그 사이 모든 날, 없으면 (종료||시작)==오늘.
    // 날짜가 전혀 없으면(미설정) 항상 표시(오늘 스냅샷에 포함).
    private static boolean isTaskOnDate(String date, String dueDate, String today) {
        if (date != null && dueDate != null && date.compareTo(dueDate) <= 0) {
            return today.compareTo(date) >= 0 && today.compareTo(dueDate) <= 0;
        }
        if (dueDate == null && date == null) return true;
        String single = dueDate != null ? dueDate : date;
        return today.equals(single);
    }

    private static String httpGet(String urlStr, String token) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            return readResponse(conn);
        } finally {
            conn.disconnect();
        }
    }

    private static String httpPatch(String urlStr, String token, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        try {
            // 일부 환경에서 setRequestMethod("PATCH")가 막혀 X-HTTP-Method-Override로 우회
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
            return readResponse(conn);
        } finally {
            conn.disconnect();
        }
    }

    private static String readResponse(HttpURLConnection conn) throws Exception {
        int code = conn.getResponseCode();
        InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
        StringBuilder sb = new StringBuilder();
        if (is != null) {
            BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
        }
        if (code < 200 || code >= 300) throw new Exception("HTTP " + code + ": " + sb);
        return sb.toString();
    }
}
