package com.jinjeongwoo.todaytasks;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
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
 * 위젯용 "오늘 할일 스냅샷"을 네이티브에서 생성·저장한다(앱이 닫혀 있어도 가능 — 목표② 기초).
 * 토큰(Phase 2 GoogleSignIn+GoogleAuthUtil 재활용) → 구글 Tasks REST 호출 →
 * notes 마커/오늘-필터를 JS와 동일 규칙으로 재구현 → SharedPreferences("CapacitorStorage")에 저장.
 *
 * ⚠️ 오늘-필터(isTaskOnDate)·마커 파싱은 src/utils/{date.js,taskNotes.js}와 이중 관리 — 규칙 변경 시 함께 수정.
 */
@CapacitorPlugin(name = "TodaySnapshot")
public class TodaySnapshotPlugin extends Plugin {

    private static final String BASE = "https://tasks.googleapis.com/tasks/v1";
    private static final String TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
    private static final String PREFS = "CapacitorStorage"; // @capacitor/preferences와 같은 store
    private static final String KEY = "tt_today_snapshot";

    // notes 끝줄 마커: \n*⟦tt … ⟧[ \t]*$  (⟦=U+27E6, ⟧=U+27E7) — taskNotes.js MARKER_RE와 동일
    private static final Pattern MARKER_RE = Pattern.compile("\\n*⟦tt[^⟧]*⟧[ \\t]*$");
    private static final Pattern START_RE = Pattern.compile("start=(\\d{4}-\\d{2}-\\d{2})");
    private static final Pattern TIME_RE = Pattern.compile("time=(([01]\\d|2[0-3]):[0-5]\\d)");

    @PluginMethod
    public void refreshTodaySnapshot(PluginCall call) {
        new Thread(() -> {
            try {
                GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());
                if (account == null || account.getAccount() == null) {
                    call.reject("NO_ACCOUNT");
                    return;
                }
                String token = GoogleAuthUtil.getToken(getContext(), account.getAccount(), "oauth2:" + TASKS_SCOPE);
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
                            t.put("time", time == null ? JSONObject.NULL : time);
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
                String json = snapshot.toString();

                getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().putString(KEY, json).apply();

                JSObject ret = new JSObject();
                ret.put("count", outTasks.length());
                ret.put("snapshot", json);
                call.resolve(ret);
            } catch (Exception e) {
                // 실패 시 기존 스냅샷 유지(skip) — 위젯이 빈 화면 되지 않게
                call.reject("SNAPSHOT_FAILED: " + e.getMessage());
            }
        }).start();
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

    // date.js isTaskOnDate와 동일: 시작~종료 범위가 있으면 그 사이 모든 날, 없으면 (종료||시작)==오늘
    private static boolean isTaskOnDate(String date, String dueDate, String today) {
        if (date != null && dueDate != null && date.compareTo(dueDate) <= 0) {
            return today.compareTo(date) >= 0 && today.compareTo(dueDate) <= 0;
        }
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
            int code = conn.getResponseCode();
            InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
            StringBuilder sb = new StringBuilder();
            if (is != null) {
                BufferedReader r = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                r.close();
            }
            if (code < 200 || code >= 300) throw new Exception("HTTP " + code + ": " + sb);
            return sb.toString();
        } finally {
            conn.disconnect();
        }
    }
}
