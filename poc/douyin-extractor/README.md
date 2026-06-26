# ClipMiner PoC — Douyin On-page Extractor

> **PoC만 수행.** ClipMiner Web/IndexedDB/번역/태그/UI 연결 없음. Chrome · Douyin 1개 영상 검증용.
> 로컬 unpacked 확장. 스토어 배포/XHS/Firefox/Safari는 후순위.

## 무엇을 검증하나 (성공 기준 5)

1. 로그인된 Douyin 영상 페이지에서 동작
2. play URL 추출 성공
3. 제목 추출 성공
4. fetch 후 Blob 생성 성공
5. mp4 파일 다운로드 성공

확장이 **위 기준을 화면 패널 + 콘솔로 자가진단**한다(✓/✗).

## ⚠️ 검증 주체

이 PoC는 **로그인된 Douyin 세션이 있는 실제 Chrome**에서만 결과가 나옵니다.
(개발 환경엔 Douyin 계정/세션이 없고 지역 제한이 있어 에이전트가 대신 실행/판정할 수 없습니다.)
→ 아래 절차로 **사장님이 1회 실행**하면 5개 기준의 성공/실패가 즉시 표시됩니다.

## 실행 방법 (Chrome)

1. Chrome에서 Douyin(douyin.com)에 **로그인**.
2. 주소창에 `chrome://extensions` → 우측 상단 **개발자 모드 ON**.
3. **압축해제된 확장 프로그램을 로드** → 이 폴더(`poc/douyin-extractor`) 선택.
4. Douyin **영상 페이지**로 이동 (예: `https://www.douyin.com/video/{영상ID}`).
5. 우측 하단 **ClipMiner PoC 패널**의 **"추출 시도"** 클릭.
6. 패널/콘솔(F12)에서 ✓/✗ 결과 확인. 성공 시 mp4가 다운로드 폴더에 저장됨.

## 결과 보고 부탁 (실패 시 즉시)

- 패널 캡처 또는 콘솔 로그(`[ClipMiner PoC]`)
- 특히: play URL 추출 ✓/✗, fetch 상태(HTTP 코드/에러), Blob 크기, mp4 저장 여부
- 실패 시 어느 단계인지: 구조 접근 / 서명 필요 / 세션 fetch 차단 / Blob 불가 / 권한 한계

## 동작 개요

- `content.js`: 페이지의 `_ROUTER_DATA`/`RENDER_DATA`/SSR 스크립트에서 `play_addr.url_list`(또는 .mp4 URL)와
  제목(desc/og:title)을 추출 → 후보 play URL 결정.
- `background.js`: host_permissions로 cross-origin **세션 fetch**(페이지 CORS 우회) → ArrayBuffer 반환.
  실패 시 대안으로 `chrome.downloads`로 직접 저장 시도.
- `content.js`: 받은 바이트로 **Blob 생성** → `<a download>`로 mp4 저장.

## v0.0.2 변경 (fetch 실패 대응)

1차 실행 결과: 추출/제목/play URL ✓, **세션 fetch만 실패("Failed to fetch")**.
"Failed to fetch"는 HTTP 403이 아니라 **응답 전 실패**(권한 누락/CORS/네트워크). play URL host가
`lf3-static.bytednsdoc.com`였는데 host_permissions에 빠져 있었음 → 다음을 반영:

- **host_permissions에 bytedance/douyin CDN 도메인 다수 추가**(`*.bytednsdoc.com` 포함).
- **동적 권한 요청**: "추출 시도" 클릭 시 play URL 호스트에 대해 `chrome.permissions.request`(가능 환경) →
  manifest에 없는 CDN 도메인도 사용자 동의로 즉시 허용(질문 3 대응).
- **에러 유형 구분**: `phase:"network"`(권한/CORS) vs `phase:"http"`(403 = 서명/Referer/TTL).
- **바이트 전송 base64**(메시징 안전) → Blob 생성/저장.
- **추출 우선순위**: `play_addr`(영상) 우선, cover/avatar/image 제외 → 커버 이미지 오추출 방지.
- content-type이 영상이 아니면 경고(커버 URL 오선택 점검).

→ **재실행 후 결과로 원인 확정**:
- fetch가 통과하면 = **권한 도메인 문제였음**(해결).
- 여전히 실패하고 `HTTP 403`이면 = **서명(a_bogus)/Referer/TTL 문제** → 다음 단계로 Referer 주입(declarativeNetRequest) 검토.
- 권한 동의창이 뜨면 **"허용"** 후 재시도.

## v0.0.3 변경 (권한 변수 완전 제거)

2차 결과: play URL host가 또 바뀜(`v5-dy-ov-experiment.zjcdn.com`), 동적 권한 = **unsupported**
(`chrome.permissions.request`는 content script에서 동작 안 함). ByteDance CDN은 도메인/프리픽스가
계속 회전(`v3-web…`, `v5-dy-ov…`)하므로 열거로는 못 따라감. → **host_permissions를 `https://*/*`(광역)** 로
변경해 권한/CORS 변수를 한 번에 제거. (PoC 진단 전용 — 운영판은 좁힌다)

재실행 판정:
- fetch ✓ → **권한 문제였고 해결**(다음: Web 연결/XHS)
- fetch ✗ + `HTTP 403` → **서명(a_bogus)/Referer/TTL** 문제(다음: declarativeNetRequest로 Referer 주입)

> ByteDance/Douyin 영상 CDN 패턴(참고, 회전·비고정): `*.zjcdn.com`, `*.bytednsdoc.com`,
> `*.douyinvod.com`, `*.byteimg.com`, `*.bytecdn.com`, `*.bytetos.com`, `*.pstatp.com`,
> `*.snssdk.com`, `*.amemv.com`, `v[N]-…` 프리픽스 등. → 운영판은 광역 대신 **DNR 헤더 주입 + 좁힌 허용목록** 권장.

## v0.0.4 변경 (실제 영상만 선별 — content-type 검증)

3차 결과: **fetch 통과(권한 종결, 서명 문제 아님)** 이지만 저장 파일이 **image/png(1349B)** = 커버 URL 오선택.
→ content-type 기반 검증으로 전환:

- **이미지 제외:** 이미지 키(cover/avatar/origin_cover/dynamic_cover…) + 이미지 확장자(.jpg/.png/.webp…) 후보 제외.
- **후보 전체를 패널에 번호로 표시**(source 태그: play_addr/video-el/perf 등).
- **각 후보 Range GET probe** → `content-type` 확인. **video/* 또는 application/octet-stream 만 영상으로 인정**, image/*는 실패.
- 영상 후보를 찾은 **뒤에만** 전체 fetch → Blob → mp4 저장. 최종 content-type이 image면 저장 안 함.
- 영상 후보가 없으면 **"영상 URL 없음 / 커버 URL만 발견"** 명확 표시(→ 영상 페이지 `/video/{id}`에서 재시도 또는 네트워크 캡처 필요 신호).
- 후보 소스에 **`performance.getEntriesByType('resource')`**(이미 로드된 mp4/미디어) 추가 — 플레이어가 실제 사용한 URL 포착 시도.

재실행 판정:
- 영상 후보가 video/* 로 확인되고 저장 → **성공**(다음: Web 연결/XHS).
- "커버만 발견"이면 → 현재 페이지(feed/modal) 데이터에 play_addr 부재 → **/video/{id} 단독 페이지에서 재시도** 또는 네트워크 캡처(webRequest) 설계로.

## v0.1.0 — ClipMiner Web 라이브러리 자동 등록 (Phase 8)

PoC 추출 성공(video/mp4) 후, **ClipMiner Web에 자동 등록**까지 연결.

흐름:
```
Douyin content.js  : 제목/video URL 추출 → content-type 검증 → Blob(b64)
   → background     : registerToWeb → ClipMiner Web 탭 찾기 → web-bridge로 payload 전달
   → web-bridge.js  : window.postMessage(clipminer:register) → 페이지
   → ClipMiner Web  : 검증(영상/중복/작업폴더) → 작업 폴더 저장 + IndexedDB 등록 → 결과 회신
   → background→Douyin: 패널에 등록 결과 표시
```
- **등록 조건(Web에서 강제):** 실제 mp4 bytes + content-type video/* + 작업 폴더 저장 성공일 때만. URL만 등록 금지.
- **번역/태그:** Web이 `titleTranslate`(Desktop 포팅)로 translatedTitle/tags 생성. platform=douyin.
- **중복 방지:** sourceUrl 또는 localFileName 일치 시 재등록 안 함.
- **Web이 닫혀 있으면:** 확장이 로컬에 mp4 저장 + 패널에 "ClipMiner Web 열기 / 재등록 시도" 버튼.

### 테스트 절차 (사장)
1. ClipMiner Web을 **localhost:3000/videos** 에서 열고 **작업 폴더 연결**(권한 허용).
2. 같은 Chrome에 이 확장 로드/새로고침.
3. Douyin 영상 페이지 → "추출 시도" → video/mp4 확인되면 → 자동으로 Web 전송.
4. ClipMiner Web 라이브러리에 **즉시 카드 표시**(제목/originalTitle·translatedTitle/platform=douyin), 로컬 재생 확인.
5. 같은 영상 재시도 → "이미 등록됨"(중복 방지).
6. Web 탭을 닫고 시도 → "ClipMiner Web 열기" 버튼 표시.

> Web 수신부(검증/중복/작업폴더/이미지거부)는 로컬에서 합성 메시지로 확인됨.
> Douyin 추출~전송 전 구간은 **로그인 Chrome에서 사장님 검증** 필요.

## 알려진 리스크 (실패 가능 지점)

- 메인 피드 `<video>`는 **blob:(MSE)** 라 직접 fetch 불가 → 데이터의 play_addr 사용.
- play URL이 **서명(a_bogus)/TTL/Referer** 제약이면 fetch 403(= 서명 문제 신호).
- 동적 권한 미지원 환경이면 정적 host_permissions로만 동작 → 미포함 CDN이면 콘솔 에러로 표시.

> 이 PoC 결과(특히 fetch 통과 / 403 여부)에 따라 다음 단계(Referer 주입, Web 연결, XHS, ffmpeg.wasm)를 결정한다.
