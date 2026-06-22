package com.jinjeongwoo.todaytasks;

import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

/**
 * 네이티브 Google 로그인 플러그인.
 * GoogleSignIn(계정 선택/동의, 일반 Intent라 Capacitor 액티비티 결과 흐름에 깔끔히 연결) +
 * GoogleAuthUtil.getToken(기기 계정으로 Tasks 액세스 토큰을 조용히 발급)을 조합한다.
 * JS는 { accessToken } 문자열만 받으면 되고, 이후 Tasks REST 호출(googleTasks.js)은 변경 없이 동작한다.
 */
@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    private static final String TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
    // GoogleAuthUtil 스코프 지정 형식: "oauth2:<scope>"
    private static final String TOKEN_SCOPE_SPEC = "oauth2:" + TASKS_SCOPE;

    private GoogleSignInClient client;

    @Override
    public void load() {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(new Scope(TASKS_SCOPE))
                .build();
        client = GoogleSignIn.getClient(getContext(), gso);
    }

    /**
     * Tasks 액세스 토큰 발급.
     * silent(기본 true): UI 없이만 시도 — 이미 로그인/동의돼 있으면 토큰, 아니면 reject(=JS가 로그인 화면 표시).
     * silent=false: 필요 시 계정 선택·동의 화면을 띄움(로그인 버튼 탭).
     */
    @PluginMethod
    public void getAccessToken(PluginCall call) {
        boolean silent = Boolean.TRUE.equals(call.getBoolean("silent", true));
        GoogleSignInAccount last = GoogleSignIn.getLastSignedInAccount(getContext());

        if (last != null && last.getAccount() != null) {
            fetchToken(call, last, silent);
            return;
        }

        if (silent) {
            // 마지막 계정이 없으면 조용한 재로그인 시도(세션 살아있으면 성공)
            client.silentSignIn()
                    .addOnSuccessListener(acct -> fetchToken(call, acct, true))
                    .addOnFailureListener(e -> call.reject("NO_ACCOUNT"));
        } else {
            // 최초 로그인: 계정 선택 + Tasks 권한 동의(일반 Intent)
            startActivityForResult(call, client.getSignInIntent(), "signInResult");
        }
    }

    @ActivityCallback
    private void signInResult(PluginCall call, ActivityResult activityResult) {
        Intent data = activityResult.getData();
        try {
            GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(data)
                    .getResult(ApiException.class);
            fetchToken(call, account, false);
        } catch (ApiException e) {
            call.reject("SIGNIN_FAILED: code " + e.getStatusCode());
        }
    }

    /** 계정으로 액세스 토큰을 네트워크에서 발급(백그라운드 스레드 필수). */
    private void fetchToken(PluginCall call, GoogleSignInAccount account, boolean silent) {
        new Thread(() -> {
            try {
                String token = GoogleAuthUtil.getToken(getContext(), account.getAccount(), TOKEN_SCOPE_SPEC);
                JSObject ret = new JSObject();
                ret.put("accessToken", token);
                call.resolve(ret);
            } catch (UserRecoverableAuthException e) {
                if (silent) {
                    call.reject("NEEDS_CONSENT");
                } else {
                    // 사용자 동의가 필요 → 복구 Intent를 띄우고, 복귀 후 재시도
                    Intent recover = e.getIntent();
                    getActivity().runOnUiThread(() -> startActivityForResult(call, recover, "recoverToken"));
                }
            } catch (Exception e) {
                call.reject("TOKEN_FAILED: " + e.getMessage());
            }
        }).start();
    }

    @ActivityCallback
    private void recoverToken(PluginCall call, ActivityResult activityResult) {
        GoogleSignInAccount acct = GoogleSignIn.getLastSignedInAccount(getContext());
        if (acct != null && acct.getAccount() != null) {
            fetchToken(call, acct, false);
        } else {
            call.reject("NO_ACCOUNT_AFTER_CONSENT");
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        client.signOut().addOnCompleteListener(t -> call.resolve());
    }
}
