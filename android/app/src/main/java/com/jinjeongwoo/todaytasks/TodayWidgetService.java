package com.jinjeongwoo.todaytasks;

import android.content.Intent;
import android.widget.RemoteViewsService;

/** 위젯 목록(컬렉션)의 RemoteViewsFactory 공급자. */
public class TodayWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new TodayWidgetFactory(getApplicationContext());
    }
}
