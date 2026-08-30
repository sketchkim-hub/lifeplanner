# 라이프플래너 — 경건에 이르는 훈련 배포 가이드

이 문서는 `index.html`(+ `manifest.json`, `sw.js`, `icons/`)로 만든 플래너를
① 실제 회원가입/데이터 저장이 되는 웹앱으로 배포하고, ② 안드로이드 앱(Play 스토어)으로
패키징하고, ③ 쿠팡 파트너스 상품을 연결하는 방법을 순서대로 안내합니다.

먼저 정직하게 말씀드릴 부분이 있어요: 저(Claude)는 여기서 Firebase 프로젝트를 직접
만들어드리거나, 서명된 안드로이드 APK/AAB를 직접 빌드하거나, 실제 쿠팡 파트너스
링크를 발급해드릴 수는 없어요. 이 세 가지는 각각 J님 소유의 Firebase 계정,
Google Play 개발자 계정(1회 $25), 쿠팡 파트너스 승인 계정이 필요한 절차라서요.
대신 코드 쪽은 전부 준비해 두었고, 아래는 J님이 직접 따라 하시면 되는 순서예요.

---

## 1. Firebase 설정 (회원가입 · 데이터 저장)

1. https://console.firebase.google.com 에서 새 프로젝트를 만듭니다.
2. 왼쪽 메뉴 **Authentication → 시작하기 → Sign-in method** 에서 **이메일/비밀번호**를
   사용 설정합니다.
3. 왼쪽 메뉴 **Firestore Database → 데이터베이스 만들기** 로 Firestore를 생성합니다.
   (위치는 `asia-northeast3`(서울)를 추천해요.)
4. **Firestore → 규칙(Rules)** 탭에서 아래 규칙으로 교체하고 게시합니다. 각 사용자가
   자기 데이터만 읽고 쓸 수 있도록 하는 규칙이에요.
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
5. **프로젝트 설정(톱니바퀴) → 내 앱 → 웹 앱 추가(</>)** 로 웹 앱을 등록하면
   `firebaseConfig` 값이 나옵니다. 이 값을 `index.html` 상단의 아래 부분에
   그대로 붙여넣으세요.
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

이제 앱을 열면 로그인/회원가입 화면이 먼저 뜨고, 이메일·비밀번호로 가입한 뒤부터는
모든 데이터(성경읽기 진도, 암송카드, 묵상노트, 교제노트, 포인트)가 그 계정의
Firestore 문서(`users/{내uid}`)에 저장돼요. 여러 기기에서 같은 계정으로 로그인하면
데이터가 그대로 동기화됩니다. '계정' 탭에서 데이터 내보내기/가져오기/초기화/회원탈퇴도
할 수 있어요.

---

## 2. 웹으로 배포하기 (GitHub Pages)

기존에 쓰시던 방식 그대로예요.

1. `sketchkim-hub` 계정의 저장소에 `index.html`, `manifest.json`, `sw.js`,
   `icons/` 폴더를 통째로 올립니다.
2. 저장소 **Settings → Pages** 에서 배포 브랜치를 지정하면 자동으로
   `https://sketchkim-hub.github.io/저장소이름/` 형태의 HTTPS 주소가 생깁니다.
3. 음성 암송 인식(마이크) 기능과 서비스워커(오프라인 캐싱)는 **HTTPS 환경에서만**
   동작하니, GitHub Pages처럼 HTTPS가 기본 제공되는 곳에 올리는 게 중요해요.

배포된 주소를 크롬 안드로이드에서 열고 **⋮ 메뉴 → 홈 화면에 추가**를 누르면
그 자체로 아이콘이 생기고 전체화면 앱처럼 실행돼요(PWA). 아래 3번은 이걸
Play 스토어에 올릴 수 있는 앱(APK/AAB)으로 한 단계 더 포장하는 방법입니다.

---

## 3. 안드로이드 앱으로 패키징하기

세 가지 방법이 있고, 난이도 순으로 정리했어요. 셋 다 2번에서 배포한
**HTTPS 주소가 먼저 있어야** 진행할 수 있어요.

### 방법 A. PWABuilder (제일 쉬움, 코드 설치 불필요)
1. https://www.pwabuilder.com 접속 → 배포한 사이트 주소 입력 → "Start".
2. 매니페스트/아이콘을 자동으로 읽어옵니다(이미 `manifest.json`과 `icons/`를
   준비해 두었어요).
3. **Android** 패키지를 선택하면 서명까지 된 `.aab`(Play 스토어 업로드용) 또는
   테스트용 `.apk`를 바로 내려받을 수 있어요.
4. Google Play Console(https://play.google.com/console, 1회 $25)에 새 앱을
   만들고 이 `.aab`를 업로드하면 됩니다.

### 방법 B. Bubblewrap (구글 공식 TWA 도구, 커맨드라인)
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest="https://sketchkim-hub.github.io/저장소이름/manifest.json"
bubblewrap build
```
- 진행 중 서명 키(keystore)를 새로 만들거나 기존 것을 지정합니다.
- 빌드가 끝나면 `app-release-signed.apk` / `.aab`가 생성돼요.
- **중요**: 이 방식은 앱이 실제로는 브라우저(TWA)로 여러분의 사이트를 여는
  방식이라, 주소창 없는 "진짜 앱처럼" 보이려면 사이트 루트에
  `.well-known/assetlinks.json` 파일을 아래 형태로 올려야 해요.
  ```json
  [{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tjcar.deungbul",
      "sha256_cert_fingerprints": ["여기에 keystore의 SHA-256 지문"]
    }
  }]
  ```
  SHA-256 지문은 `bubblewrap fingerprint` 명령이나 Play Console의
  **설정 → 앱 무결성 → 앱 서명** 페이지에서 확인할 수 있어요.

### 방법 C. Capacitor (네이티브 기능을 더 붙이고 싶을 때)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "라이프플래너" com.tjcar.deungbul
npx cap add android
npx cap open android   # Android Studio가 열립니다
```
- Android Studio에서 서명 후 빌드하면 `.aab`가 나옵니다.
- 이 방식은 로컬에 Android Studio/SDK 설치가 필요해요(제 작업 환경에는
  Android SDK가 없어서 이 부분은 직접 진행해 주셔야 해요).

### 공통으로 필요한 것
- Google Play 개발자 계정 (1회 $25)
- **개인정보처리방침 URL** — 회원가입·데이터 저장 기능이 있는 앱은 Play
  등록 시 필수 제출 항목이에요. 수집 항목(이메일, 성경읽기/암송/묵상 기록)과
  Firebase를 통해 저장된다는 점을 간단히 안내하는 페이지를 만들어 링크하시면 됩니다.
- 앱 아이콘/스크린샷 — `icons/` 폴더의 아이콘을 활용하시고, 스크린샷은 실행
  화면을 캡처하시면 돼요.

---

## 4. 쿠팡 파트너스 연동

1. https://partners.coupang.com 에서 파트너스 가입 후 승인을 받습니다.
2. 승인 후 원하는 상품(다이어리, 필사노트, 암송카드, 문구류 등) 페이지에서
   "링크 생성"으로 본인 파트너스 ID가 포함된 링크를 발급받습니다.
3. `index.html`의 `COUPANG_PRODUCTS` 배열(전체 검색: `COUPANG_PRODUCTS`)에서
   각 상품의 `name`, `note`, `price`, `link` 값을 실제 상품 정보와 발급받은
   링크로 교체하세요. 지금은 예시 데이터라 `link`가 비어 있어 "링크 준비 중"
   버튼으로 표시돼요.
   ```js
   {name:"묵상 다이어리", note:"...", price:"12,900원", link:"https://link.coupang.com/a/실제코드"}
   ```
4. **고지문구는 절대 지우지 마세요.** "추천 상품" 탭 상단의
   "이 포스팅은 쿠팡 파트너스 활동의 일환으로…" 문구는 쿠팡 파트너스
   운영정책상 필수 표기 사항이에요.
5. 정책상 유의사항: 클릭을 유도하는 과장 문구·낚시성 문구 금지, 링크를
   숨기거나 다른 링크로 위장(클로킹) 금지, 청소년 보호법상 제한 카테고리
   상품 홍보 금지, 파트너스 활동임을 앱/게시물에서 투명하게 밝힐 것.
   자세한 내용은 쿠팡 파트너스 운영정책 페이지에서 최신 내용을 확인해 주세요.

---

## 파일 구성
```
index.html          앱 본체 (Firebase 회원가입/데이터, 성경읽기표, 성경암송, 캘린더,
                     묵상노트, 교제노트, 배지·포인트, 추천 상품, 계정 관리)
manifest.json        PWA 매니페스트 (앱 이름/아이콘/색상)
sw.js                 오프라인 캐싱용 서비스워커
icons/                192px·512px 일반/마스커블 아이콘
README_배포가이드.md   이 문서
```
