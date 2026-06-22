package com.jinjeongwoo.todaytasks;

import android.content.Context;

/**
 * 위젯 색 테마(라이트/다크). 배경 drawable + 텍스트/아이콘 색을 한 곳에 모아
 * Provider(헤더)와 Factory(행)가 같은 값을 쓰게 한다. 체크 아이콘(sage)·진행바는 두 테마 공통.
 */
final class WidgetTheme {
    final int bgRes;     // 루트 배경 drawable
    final int ink;       // 기본 텍스트(미완 제목)
    final int mute;      // 하위 달성 카운트 / 완료 제목 (회색 — 카운트 역할)
    final int meta;      // 시간/기간 라벨 강조색 (카운트와 안 헷갈리게 다른 색조 = 세이지 그린)
    final int iconTint;  // 새로고침·추가·테마·chevron 틴트
    final int empty;     // "오늘 할 일 없음"

    private WidgetTheme(int bgRes, int ink, int mute, int meta, int iconTint, int empty) {
        this.bgRes = bgRes; this.ink = ink; this.mute = mute; this.meta = meta; this.iconTint = iconTint; this.empty = empty;
    }

    static final WidgetTheme LIGHT = new WidgetTheme(
            R.drawable.widget_bg, 0xFF232323, 0xFFA8A29A, 0xFF5C7A5C, 0xFF6B6862, 0xFF9AA0A6);
    static final WidgetTheme DARK = new WidgetTheme(
            R.drawable.widget_bg_dark, 0xFFF5F5F5, 0xFF808080, 0xFF9CC09C, 0xFFD0D0D0, 0xFF808080);

    static WidgetTheme of(Context ctx) {
        return SnapshotEngine.isDarkTheme(ctx) ? DARK : LIGHT;
    }
}
