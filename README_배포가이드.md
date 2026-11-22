# 라이프플래너 — 경건에 이르는 훈련 배포 가이드

이 문서는 `index.html`(+ `manifest.json`, `sw.js`, `icons/`)로 만든 플래너를
① 실제 회원가입/데이터 저장이 되는 웹앱으로 배포하고, ② 안드로이드 앱(Play 스토어)으로
패키징하고, ③ 쿠팡 파트너스 상품을 연결하는 방법을 순서대로 안내합니다.

웹앱은 이 저장소 루트의 정적 파일 그대로 GitHub Pages에 올라갑니다.
안드로이드는 그 파일을 앱 안에 넣고(원격 주소만 여는 방식이 아니에요) 기존 Play 앱을
업데이트하는 Capacitor 프로젝트예요. 서명된 AAB는 GitHub Actions가 기존 키스토어
시크릿으로 만들고, Play 비공개 테스트에 올리는 단계만 J님이 하시면 됩니다.
Firebase 프로젝트와 쿠팡 파트너스 계정은 원래부터 J님 소유예요.

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
       match /users/{userId}/{kind}/{photoId} {
         // 묵상노트 본문 사진 (passages: 원본, passageThumbs: 썸네일)
         allow read, delete: if request.auth != null && request.auth.uid == userId
                             && kind in ['passages', 'passageThumbs'];
         allow create, update: if request.auth != null && request.auth.uid == userId
                             && kind in ['passages', 'passageThumbs']
                             && request.resource.data.keys().hasOnly(['data','entryId','date','month','createdAt','w','h'])
                             && request.resource.data.data is string
                             && request.resource.data.data.size() < 750000;
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
그 자체로 아이콘이 생기고 전체화면 앱처럼 실행돼요(PWA). 이 웹/PWA 동작은
그대로 두었어요. 아래 3번은 이미 Play에 올라가 있는 안드로이드 앱을
Capacitor 업데이트로 바꾸는 방법입니다.

---

## 3. 안드로이드 앱 (Capacitor) — 기존 Play 앱 업데이트

패키지 이름은 **`com.sketchkimhub.lifeplanner`** 입니다.
(예전 안내의 `com.sketchkim.lifeplanner`는 오타였어요. Play에 올라가 있는 이름과
같아야 기존 테스터 폰에 업데이트로 깔립니다.)

| 항목 | 이전 TWA | 이 업데이트 |
| --- | --- | --- |
| 패키지 | `com.sketchkimhub.lifeplanner` | 같음 |
| versionCode | 7 | **8** (`android/app/build.gradle`) |
| versionName | 1.0.6 | 1.0.7 |
| 내용 | Chrome이 `https://sketchkim-hub.github.io/lifeplanner/` 를 염 | `index.html`과 같은 폴더의 파일을 앱 안에 넣음 |
| 서명 | `android.p12` (alias `lifeplanner`) | 같은 업로드 키 |

앱은 사이트를 원격으로 띄우지 않아요. `server.url`은 설정하지 않았고,
`npm run sync:android`가 루트의 정적 파일을 `www/`로 복사한 뒤 Android 자산으로 넣어요.
나중에 `bible/` 같은 폴더가 저장소 루트에 추가되면 그 폴더도 같이 들어갑니다.
(`node_modules`, `android`, `.github` 같은 도구 폴더는 빼요.)

### 3-1. 기존 사용자와 데이터

- **같은 패키지 + 더 높은 versionCode + 같은 업로드 키**이면 Play가 새 앱이 아니라
  업데이트로 받아요. 테스터는 앱을 지우지 않아도 됩니다.
- 로그인 상태는 TWA 때 **Chrome 쪽**에 있었어요. Capacitor WebView는 그 쿠키를
  물려받지 못해서, 업데이트 후 **한 번 다시 로그인**해야 해요.
- 기록은 Firestore `users/{uid}`에 그대로 있어요. 같은 이메일로 로그인하면
  성경읽기, 암송, 묵상, 기도, 교제, 사진이 다시 따라옵니다.
- 폰의 앱 전용 폴더는 업데이트 때 유지되지만, TWA는 거기에 로그인 정보를
  넣어 두지 않았어요.

### 3-2. Play 앱 서명 (업로드 키만 있으면 됩니다)

2021년 8월 이후 만든 앱은 Play 앱 서명이 기본이에요. 이 경우

- GitHub 시크릿의 `android.p12`는 **업로드 키**입니다.
- AAB를 그 키로 서명해서 올리면, Google이 **앱 서명 키**로 다시 서명해 사용자에게 배포합니다.
- 사용자 폰에 깔린 앱의 서명은 앱 서명 키라서, 업로드 키만 이전과 같으면 업데이트가 됩니다.
- 예전 `.well-known/assetlinks.json`에 SHA-256이 두 개 있던 이유가 이거예요.
  하나는 업로드 인증서, 하나는 Play 앱 서명 인증서입니다. Capacitor는 URL을
  앱에 연결하지 않으므로 그 파일이 더 이상 필요 없어요.

앱 서명을 쓰지 않는 아주 오래된 앱이라면 그 p12 자체가 앱 서명 키이고,
역시 같은 파일로 서명하면 업데이트가 됩니다. 어느 쪽이든 **새 키스토어를 만들면 안 됩니다.**

### 3-3. J님이 하실 일

#### (1) GitHub 시크릿 — 이름 그대로

저장소 **Settings → Secrets and variables → Actions**. 새 이름은 없어요.
TWA 워크플로에 쓰던 세 개가 있으면 됩니다.

| 시크릿 | 내용 |
| --- | --- |
| `ANDROID_KEYSTORE_B64` | `android.p12`를 base64로 인코딩한 값 |
| `BUBBLEWRAP_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `BUBBLEWRAP_KEY_PASSWORD` | 키 비밀번호 |

키 별칭(alias)은 **`lifeplanner`** 입니다. 빌드 로그에 alias를 찾을 수 없다는
오류가 나면, 저장소 **Variables**에 `ANDROID_KEY_ALIAS`를 실제 별칭으로 추가하세요.
비어 있으면 `lifeplanner`를 씁니다.

#### (2) Firebase 콘솔 — 승인된 도메인

앱 안 주소는 `https://localhost` 입니다. (`capacitor://`가 아니에요.)

1. https://console.firebase.google.com → 프로젝트 **deungbul-app**
2. **Authentication → Settings → Authorized domains**
3. 목록에 **`localhost`** 가 있는지 확인합니다. 기본값으로 들어 있어요.
   지워져 있으면 `localhost`만 추가하세요. `https://`는 붙이지 않습니다.
4. 웹 API 키에 HTTP 리퍼러 제한을 걸어 두었다면, Google Cloud 콘솔
   **APIs & Services → Credentials**에서 `index.html`의 `firebaseConfig.apiKey`와
   같은 키를 열고, 웹사이트 제한에 다음을 추가합니다.
   - `https://sketchkim-hub.github.io/*` (원래 있던 것)
   - `https://localhost/*`
5. 로그인이 `auth/unauthorized-domain`이면 3번, `api-key-not-valid`이면 4번입니다.

Firestore 보안 규칙은 바꾸지 않아도 됩니다. 이메일/비밀번호 로그인은
WebView에서 Firebase JS SDK로 호출하고, 데이터는 같은 `deungbul-app` 프로젝트에 남아요.

#### (3) 서명된 AAB를 만들어 비공개 테스트에 올리기

이 워크플로는 Play에 자동으로 올리지 않아요. 태그도 릴리스를 만들지 않아요.

1. GitHub 저장소 **Actions → Capacitor Android Build → Run workflow**
2. variant는 **release** (서명된 `.aab`). `debug`는 테스트용 APK만 만듭니다.
3. 끝난 뒤 Artifacts에서 `lifeplanner-aab`를 받습니다.
4. https://play.google.com/console 에서 **이미 있는** 라이프플래너 앱을 엽니다.
   새 앱을 만들면 패키지가 갈라져서 기존 테스터가 업데이트를 받지 못해요.
5. **테스트 → 비공개 테스트 → 새 버전 만들기**에 AAB를 올리고 기존 테스터 트랙에 출시합니다.
6. versionCode 8이 7보다 크다고 나오면 정상입니다.

`android-v*` 태그를 푸시해도 같은 서명 AAB 아티팩트가 만들어집니다.
태그는 Play 업로드나 GitHub Release가 아닙니다. 준비되기 전에는 태그를 푸시하지 마세요.

### 3-4. 앱 안에서 달라지는 동작

- **서비스 워커**는 앱(WebView)에서 등록하지 않아요. 캐시가 예전 화면을 붙잡는 일을
  막기 위해서입니다. GitHub Pages / PWA에서는 `sw.js`가 이전과 같이 등록됩니다.
- **쿠팡 링크, 유튜브 페이지 링크**는 시스템 브라우저(Chrome Custom Tabs)로 열어요.
  본문에 삽입된 유튜브·쿠팡 iframe은 앱 안에 남습니다.
- **개인정보처리방침**, **계정 삭제 안내**는 앱에 복사본이 있지만, 버튼은
  공개 주소(`https://sketchkim-hub.github.io/lifeplanner/...`)를 브라우저로 엽니다.
- **mailto:** 는 기본 메일 앱으로 넘깁니다.
- **뒤로 가기**: 사진 보기 → 열린 창 → 암송 테스트 → 이전에 보던 탭 → 홈에서
  한 번 더 누르면 앱이 닫혀요. 홈에서 한 번은 "한 번 더 누르면 앱이 닫혀요" 안내만 나와요.

### 3-5. 로컬에서 디버그 APK

```bash
npm ci
npm test
npm run build:debug
```

Android SDK(compileSdk 36)와 JDK 21이 필요합니다. 결과물은
`android/app/build/outputs/apk/debug/app-debug.apk` 입니다.
릴리스 AAB는 업로드 키가 있어야 하고, 보통은 Actions에서 만듭니다.

### 3-6. 웹(GitHub Pages)은 그대로

Pages는 저장소 루트의 `index.html`을 계속 서빙합니다. `node_modules/`, `www/`,
Android 빌드 출력, 서명 파일은 gitignore라 사이트에 섞이지 않아요.
`.nojekyll`은 Jekyll을 끄기 위해 그대로 둡니다.

`.well-known/assetlinks.json`은 이 저장소에서 뺐어요. TWA가 URL 권한을
증명하려고 둔 파일이고, Capacitor는 그 증명이 필요 없습니다.
이 파일의 실제 주소는 `https://sketchkim-hub.github.io/lifeplanner/.well-known/assetlinks.json`
이라, Android가 확인하는 호스트 루트
`https://sketchkim-hub.github.io/.well-known/assetlinks.json` 와는 달랐어요.
호스트 루트 저장소는 건드리지 않았습니다. 거기에 파일이 남아 있어도
Capacitor 앱은 그 주소의 인텐트 필터를 갖고 있지 않아서, 웹사이트는 브라우저로 열립니다.

### 공통으로 필요한 것
- Google Play 개발자 계정 (이미 비공개 테스트 중이라면 추가 가입은 없어요)
- **개인정보처리방침 URL** — `privacy-policy.html` (Pages 주소 그대로 쓰시면 됩니다)
- 앱 아이콘 — `icons/`의 마스커블 아이콘을 런처 아이콘으로 넣었어요.

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
    match /users/{userId}/{kind}/{photoId} {
      // 묵상노트 본문 사진 (passages: 원본, passageThumbs: 썸네일)
      allow read, delete: if request.auth != null && request.auth.uid == userId
                          && kind in ['passages', 'passageThumbs'];
      allow create, update: if request.auth != null && request.auth.uid == userId
                          && kind in ['passages', 'passageThumbs']
                          && request.resource.data.keys().hasOnly(['data','entryId','date','month','createdAt','w','h'])
                          && request.resource.data.data is string
                          && request.resource.data.data.size() < 750000;
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
   "HTTP 리퍼러(웹사이트)" 선택 → 본인 배포 주소(`https://sketchkim-hub.github.io/*`)와
   안드로이드 앱 주소(`https://localhost/*`)를 등록 → 저장.
   (Firebase API 키를 제한했던 것과 같은 방식이에요. `localhost`를 빼면
   웹에서는 되고 앱의 성경이야기 탭만 실패해요.)
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
index.html                 앱 본체 (웹과 안드로이드가 같은 파일)
native-shell.js            Capacitor에서만 동작하는 링크·뒤로가기 처리 (웹에서는 아무 것도 안 함)
manifest.json              PWA 매니페스트
sw.js                      웹/PWA용 서비스워커 (앱 안에서는 등록하지 않음)
icons/                     192px·512px 일반/마스커블 아이콘
capacitor.config.json      앱 ID, 로컬 번들(www), https://localhost
package.json               Capacitor 의존성
scripts/copy-web.mjs       루트 정적 파일을 www/로 복사 (bible/ 같은 향후 폴더 포함)
android/                   Capacitor Android 프로젝트 (applicationId, versionCode 8)
.github/workflows/capacitor-android.yml
                           수동 실행 또는 android-v* 태그로 서명 AAB
README_배포가이드.md        이 문서
```
