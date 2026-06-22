package com.jinjeongwoo.todaytasks;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 위젯용 "오늘 할일 스냅샷"을 네이티브에서 생성·저장하는 Capacitor 브리지(JS에서 호출).
 * 실제 생성 로직은 {@link SnapshotEngine}에 있고(plugin·WorkManager·위젯 체크가 공유), 여기선 호출만 한다.
 * 저장 직후 위젯도 갱신한다(앱 내 변경 → 위젯 즉시 반영 경로).
 */
@CapacitorPlugin(name = "TodaySnapshot")
public class TodaySnapshotPlugin extends Plugin {

    @PluginMethod
    public void refreshTodaySnapshot(PluginCall call) {
        new Thread(() -> {
            try {
                int count = SnapshotEngine.build(getContext());
                WidgetUpdater.updateAll(getContext());
                JSObject ret = new JSObject();
                ret.put("count", count);
                ret.put("snapshot", SnapshotEngine.readSnapshot(getContext()));
                call.resolve(ret);
            } catch (SnapshotEngine.NoAccountException e) {
                call.reject("NO_ACCOUNT");
            } catch (Exception e) {
                // 실패 시 기존 스냅샷 유지(skip) — 위젯이 빈 화면 되지 않게
                call.reject("SNAPSHOT_FAILED: " + e.getMessage());
            }
        }).start();
    }
}
