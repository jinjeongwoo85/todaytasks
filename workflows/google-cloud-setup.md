# Google Cloud Console 초기 설정

**목적:** Google Tasks API 사용을 위한 OAuth 클라이언트 ID 발급  
**소요시간:** 약 10분  
**입력:** Google 계정, GitHub 저장소 이름  
**출력:** `.env` 파일에 `VITE_GOOGLE_CLIENT_ID` 설정 완료

---

## Step 1: 프로젝트 생성

1. [console.cloud.google.com](https://console.cloud.google.com) 접속
2. 상단 프로젝트 드롭다운 → **새 프로젝트**
3. 이름: `TodayTasks` → **만들기**

---

## Step 2: Tasks API 활성화

1. 왼쪽 메뉴 → **API 및 서비스** → **라이브러리**
2. `Tasks API` 검색 → **Google Tasks API** → **사용**

---

## Step 3: OAuth 동의 화면

1. **API 및 서비스** → **OAuth 동의 화면**
2. User Type:
   - Google Workspace 계정 → **내부**
   - 일반 Gmail → **외부** (테스트 사용자에 본인 이메일 추가 필요)
3. 앱 이름: `TodayTasks`, 지원 이메일: 본인 이메일
4. **범위 추가** → `https://www.googleapis.com/auth/tasks` 추가
5. 저장

---

## Step 4: OAuth Client ID 발급

1. **사용자 인증 정보** → **사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
2. 애플리케이션 유형: **웹 애플리케이션**
3. **승인된 JavaScript 출처:**
   ```
   http://localhost:5173
   https://[GitHub유저명].github.io
   ```
4. **승인된 리디렉션 URI:**
   ```
   http://localhost:5173
   https://[GitHub유저명].github.io/[저장소이름]
   ```
5. **만들기** → 클라이언트 ID 복사 (`xxxxx.apps.googleusercontent.com`)

---

## Step 5: .env 파일 생성

프로젝트 루트에 `.env` 파일 생성:
```
VITE_GOOGLE_CLIENT_ID=복사한클라이언트ID.apps.googleusercontent.com
```

`.env`는 `.gitignore`에 포함되어 있으므로 GitHub에 올라가지 않음.

---

## Step 6: vite.config.js 저장소 이름 반영

`vite.config.js` 상단의 `REPO_BASE` 값을 GitHub 저장소 이름으로 수정:
```js
const REPO_BASE = '/본인저장소이름/'
```

---

## 완료 확인

- [ ] `.env` 파일에 `VITE_GOOGLE_CLIENT_ID` 설정됨
- [ ] `vite.config.js`의 `REPO_BASE` 수정됨
- [ ] `npm run dev` 실행 후 앱이 정상 열림

완료되면 Claude에게 알리면 Phase 3 (OAuth 로그인 코드) 진행.

---

## 문제 발생 시

| 증상 | 원인 | 해결 |
|---|---|---|
| "redirect_uri_mismatch" 오류 | 리디렉션 URI가 정확히 일치하지 않음 | Google Cloud Console URI를 앱 주소와 정확히 동일하게 수정 |
| "access_blocked" 오류 | 외부 앱인데 테스트 사용자 미등록 | OAuth 동의 화면 → 테스트 사용자에 본인 이메일 추가 |
| Tasks API 비활성화 | Step 2 미완료 | API 라이브러리에서 Tasks API 다시 활성화 |
