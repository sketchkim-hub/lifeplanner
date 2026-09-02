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
      "package_name": "com.sketchkim.lifeplanner",
      "sha256_cert_fingerprints": ["여기에 keystore의 SHA-256 지문"]
    }
  }]
  ```
  SHA-256 지문은 `bubblewrap fingerprint` 명령이나 Play Console의
  **설정 → 앱 무결성 → 앱 서명** 페이지에서 확인할 수 있어요.

### 방법 C. Capacitor (네이티브 기능을 더 붙이고 싶을 때)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "라이프플래너" com.sketchkim.lifeplanner
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

"추천 상품" 탭은 이제 코드를 직접 고치지 않아도, **관리자 계정(kimsketch@naver.com)으로
로그인해서 '계정' 탭에서 상품을 등록·수정·삭제**할 수 있어요. 등록한 상품은
Firestore의 공용 컬렉션(`shopProducts`)에 저장되고, 모든 사용자의 '추천 상품'
탭에 똑같이 보여요.

### 4-1. Firestore 보안 규칙 갱신 (필수)

관리자만 쓰기가 가능하고, 로그인한 누구나 읽을 수 있도록 규칙을 추가해야 해요.
Firebase 콘솔 → Firestore Database → **규칙** 탭에서 기존 내용을 아래로
통째로 교체하고 **게시**하세요 (1단계에서 넣었던 `users` 규칙에 `shopProducts`,
`quotes` 규칙이 추가된 버전이에요 — 영적 명언 관리자 기능도 같은 규칙을 써요):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /shopProducts/{productId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == 'kimsketch@naver.com';
    }
    match /quotes/{quoteId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == 'kimsketch@naver.com';
    }
  }
}
```

관리자 이메일을 바꾸고 싶다면, 이 규칙의 `kimsketch@naver.com` 부분과
`index.html`에서 `ADMIN_EMAIL`을 검색해 나오는 값을 같이 바꿔주세요.

### 4-2. 쿠팡 파트너스 가입 및 링크 발급

1. https://partners.coupang.com 에서 파트너스 가입 후 승인을 받습니다.
2. 승인 후 원하는 상품(다이어리, 필사노트, 암송카드, 문구류 등) 페이지에서
   "링크 생성"으로 본인 파트너스 ID가 포함된 링크를 발급받습니다.

### 4-3. 앱에서 상품 등록

1. `kimsketch@naver.com` 계정으로 앱에 로그인합니다.
2. **계정** 탭으로 이동하면 "🛍️ 추천 상품 관리 (관리자)" 카드가 보여요.
   (다른 계정으로 로그인하면 이 카드는 아예 보이지 않아요.)
3. 상품명 · 설명 · 가격 · 쿠팡 링크를 입력하고, 원하면 썸네일 사진도
   올립니다 (자동으로 축소·압축돼서 저장돼요). **상품 추가**를 누르면
   바로 모든 사용자에게 보여요.
4. 목록의 ✎(수정) · ✕(삭제) 버튼으로 언제든 고칠 수 있어요.

### 4-4. 정책 유의사항

**고지문구는 절대 지우지 마세요.** "추천 상품" 탭 상단의
"이 포스팅은 쿠팡 파트너스 활동의 일환으로…" 문구는 쿠팡 파트너스
운영정책상 필수 표기 사항이에요. 그 외 유의사항: 클릭을 유도하는 과장
문구·낚시성 문구 금지, 링크를 숨기거나 다른 링크로 위장(클로킹) 금지,
청소년 보호법상 제한 카테고리 상품 홍보 금지, 파트너스 활동임을
앱/게시물에서 투명하게 밝힐 것. 자세한 내용은 쿠팡 파트너스 운영정책
페이지에서 최신 내용을 확인해 주세요.

### 4-5. 영적 명언 관리 (관리자)

같은 관리자 계정(`kimsketch@naver.com`)으로 로그인하면 **계정** 탭에
"🕯️ 영적 명언 관리 (관리자)" 카드도 함께 보여요. 명언 내용과 저자를
입력해 추가하면, 앱에 기본으로 들어있는 명언들과 합쳐져서 '영적 명언'
탭과 홈 화면의 랜덤 명언에 똑같이 나타나요. 위 4-1번 규칙(`quotes`
컬렉션 포함)을 게시해야 정상 작동해요.

---

## 5. 성경이야기 연동 (유튜브)

"성경이야기" 탭은 유튜브 재생목록에 올려둔 영상을 자동으로 불러와 보여줘요.
새 숏폼을 그 재생목록에 추가하기만 하면 앱에도 자동으로 나타나요.

1. 유튜브에 성경 영적 교훈을 다루는 1분 이내 숏폼들을 업로드합니다.
2. 유튜브 스튜디오(또는 유튜브 앱)에서 그 영상들을 모을 **재생목록(플레이리스트)**을
   하나 만듭니다 (예: "성경이야기"). 재생목록 페이지 주소창의
   `list=` 뒤에 있는 값이 재생목록 ID예요.
   `https://www.youtube.com/playlist?list=PL여기부분이ID`
3. https://console.cloud.google.com/apis/library/youtube.googleapis.com 에서
   **YouTube Data API v3**를 사용 설정합니다. (Firebase와 같은 구글 계정 /
   같은 프로젝트를 써도 되고, 새 프로젝트를 만들어도 돼요.)
4. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**로
   새 키를 발급받습니다.
5. 발급받은 키를 클릭 → **API 제한사항**에서 "키 제한" 선택 →
   `YouTube Data API v3`만 체크 → **애플리케이션 제한사항**에서
   "HTTP 리퍼러(웹사이트)" 선택 → 본인 배포 주소(`https://sketchkim-hub.github.io/*`)
   등록 → 저장. (앞서 Firebase API 키를 제한했던 것과 같은 방식이에요.)
6. `index.html` 상단에서 `YOUTUBE_CONFIG`를 검색해 아래처럼 값을 채웁니다.
   ```js
   const YOUTUBE_CONFIG = {
     apiKey: "발급받은 유튜브 API 키",
     playlistId: "2번에서 확인한 재생목록 ID"
   };
   ```
7. GitHub에 다시 업로드하면 "성경이야기" 탭에서 재생목록의 영상들이
   세로형 카드로 자동으로 나타나요.

**참고**
- 유튜브 데이터 API는 하루 10,000 단위의 무료 할당량을 주는데, 재생목록을
  불러오는 호출은 1회당 1단위밖에 안 써서 거의 걱정 없이 쓰실 수 있어요.
- 영상은 유튜브의 개인정보 보호 강화 모드(youtube-nocookie.com)로
  삽입돼서, 재생 전까지는 불필요한 쿠키를 심지 않아요.
- 재생목록에만 있는 영상이 나오는 방식이라, 채널에 올린 영상 중
  "이 앱에 보여줄 것"만 그 재생목록에 골라 담으면 자연스럽게 큐레이션이 돼요.

---

## 파일 구성
```
index.html          앱 본체 (Firebase 회원가입/데이터, 성경읽기표, 성경암송, 캘린더,
                     묵상노트, 기도노트, 교제노트, 배지·포인트, 성경이야기,
                     추천 상품, 계정 관리)
manifest.json        PWA 매니페스트 (앱 이름/아이콘/색상)
sw.js                 오프라인 캐싱용 서비스워커
icons/                192px·512px 일반/마스커블 아이콘
README_배포가이드.md   이 문서
```
