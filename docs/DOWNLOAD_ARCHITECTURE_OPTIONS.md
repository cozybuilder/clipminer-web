# ClipMiner — 다운로드 아키텍처 옵션 조사 (Phase 8 사전)

> **상태:** 옵션 조사·결정 근거(historical). **결정 결과 = 브라우저 확장 온페이지 추출**
> (서버 yt-dlp/cookies.txt/네이티브 메시징은 미채택). 현재 구현은 [BROWSER_CONNECTOR.md](BROWSER_CONNECTOR.md) 참고.
> Vercel 프로덕션은 앱만 서빙하며 **서버 다운로드 연산을 수행하지 않는다.**
> **제약(확정):** 사용자가 cookies.txt / 별도 프로그램 설치 / 방화벽 허용 / 백신 경고를
> 경험하면 안 된다. 운영비 0원. Desktop 자산 최대 활용.
>
> 사장 결정 반영: ❌ Desktop 연계, ❌ 네이티브 메시징 헬퍼(.exe/권한/방화벽/백신 문제).
> → **확장만으로(추가 설치 없이) 다운로드**가 가능한지를 중심으로 조사.

---

## 1. SnapTik류 사이트 구조 분석

- 구조: 사용자 URL 입력 → **자체 서버 백엔드**가 영상 페이지/플랫폼 API를 호출해 직접 mp4 링크 추출 → 사용자에게 반환(워터마크 제거 등).
- 특징: **서버 비용 발생**, 플랫폼 API/서명 변경에 따라 잦은 유지보수, ToS/저작권 리스크를 운영자가 부담.
- 쿠키: 공개 TikTok은 대체로 쿠키 없이 가능. **Douyin(중국 본토)** 은 지역/로그인/서명 장벽으로 더 어렵다.
- **ClipMiner 부적합 이유:** 서버 운영비(0원 위배) + 운영자 법적 노출 + 차단 시 전체 중단.

## 2. Douyin Downloader 서비스 구조

- 방식: 서버가 Douyin 웹 API(아이템 상세)로 `play_addr` 추출. 최근 Douyin은 **요청 서명(a_bogus / X-Bogus)** 요구가 늘어 서버가 서명을 재현해야 함(난도↑, 자주 깨짐).
- 상용은 **RapidAPI 등 유료 3rd-party API**에 의존(비용 발생).
- **ClipMiner 부적합 이유:** 서명 재현 유지보수 + 유료 API + 서버 비용.

## 3. 브라우저 확장만으로 가능한 범위 (핵심)

확장은 일반 웹페이지보다 훨씬 많은 것을 할 수 있다:
- **로그인 세션 그대로 사용**: 사용자가 Douyin에 로그인된 상태에서 확장이 동작 → 별도 쿠키 입력 불필요.
- **content script가 영상 페이지의 데이터 접근**: 사용자가 보고 있는 영상의 **직접 재생 URL(play address)** 은
  이미 페이지의 내장 JSON(`RENDER_DATA`/initial state)·DOM(`<video src>`)·네트워크 응답에 존재한다. 확장이 이를 읽을 수 있다.
- **세션으로 직접 fetch + 저장**: 추출한 play URL을 같은 세션으로 `fetch` → Blob → `chrome.downloads` 또는
  ClipMiner Web의 작업 폴더(File System Access)로 저장.
- **메타데이터 동시 수집**: 제목/작성자/통계도 페이지에서 함께 스크랩 → originalTitle 확보 → 번역/태그(기존 자산).

→ **서버·yt-dlp·서명 재현 없이**, "확장이 사용자 화면의 영상 데이터를 읽어 받는" 방식이 가능. (추가 설치는 확장뿐)

한계/리스크:
- Douyin 페이지 구조/필드명이 바뀌면 추출 셀렉터 갱신 필요(유지보수, 단 서버 서명보다 가벼움).
- 일부 영상은 분할 스트림(HLS/DASH)일 수 있음 → §6 ffmpeg.wasm 보강 검토.
- 스토어 정책/ToS(§9).

## 4. yt-dlp 없이 가능한 방법

1. **확장 content-script 추출(권장)**: 페이지 내장 데이터에서 play URL 추출 → 세션 fetch → 저장. 서명 불필요(페이지가 이미 서명된 요청을 수행함).
2. **확장 webRequest/네트워크 관찰**: 영상 재생 시 미디어 응답 URL을 포착해 재사용.
3. 플랫폼 웹 API 직접 호출 + 서명 재현: 난도 높음(비권장).
→ 1번이 "추가 설치 없음 + 0원 + 서명 불필요"에 가장 부합.

## 5. WebAssembly 대안 존재 여부

- **yt-dlp(Python)의 실용적 WASM 포팅은 없음.** Pyodide로 Python 구동은 가능하나 네트워크/CORS/서명 문제로
  브라우저 내 yt-dlp는 비실용적. → **yt-dlp WASM 경로는 채택하지 않음.**
- 즉, "yt-dlp를 브라우저에 이식"이 아니라 "확장이 직접 추출"이 정답(§3·§4).

## 6. ffmpeg.wasm 활용 가능성

- ffmpeg.wasm = 브라우저(WASM)에서 mux/concat/변환 가능, 0원(클라이언트 연산).
- **필요한 경우에만**: 영상이 단일 progressive mp4면 불필요(대부분의 Douyin play_addr). HLS(.m3u8 세그먼트)나
  영상/오디오 분리 스트림일 때 **세그먼트 합치기/먹싱**에 사용.
- 비용: 초기 로드 ~25MB(런타임), 연산은 사용자 기기. → 필요한 플로우에서만 lazy-load.

## 7. 운영비 0원 유지 가능성

- 확장(클라이언트) + ClipMiner Web(Vercel 무료 정적/SPA) + 필요 시 ffmpeg.wasm(클라이언트) → **서버 0원**.
- 비용: Chrome Web Store 등록 **1회성 $5**(반복 없음). 그 외 반복 비용 없음.
- 다운로드 연산이 **사용자 브라우저**에서 일어나므로(서버 fetch 아님) 트래픽/컴퓨트 비용 없음. → **0원 유지 가능.**

## 8. 사용자 추가 설치 필요 여부

- **확장 1개만 설치**(이미 Connector로 필요). 네이티브 헬퍼/.exe/방화벽/백신 경고 **없음.**
- cookies.txt 노출 없음(확장이 세션을 자연스럽게 사용).
- → 목표 UX(확장 설치 → 로그인 → 연결 허용 → 끝)와 **정확히 일치.**

## 9. 법적 / 보안 이슈

- **ToS:** Douyin/TikTok 약관상 다운로드 제한 가능. ClipMiner 정책(DESIGN §1.1)으로 "적법 범위·리서치 목적·
  사용자 책임"을 이미 명시. 무단 재배포 비권장 유지.
- **저작권:** 활용 책임은 사용자(정책 반영됨).
- **스토어 정책:** Chrome Web Store는 일부 "다운로더" 확장에 민감(정책 위반 사례 있음). → 제품을
  **"콘텐츠 리서치·관리 도구"** 로 포지셔닝하고, 권한 최소화·용도 명시로 심사 리스크 완화. (리스크는 존재 — 사전 점검 필요)
- **보안:** 권한 최소(cookies는 §Connector, 추출은 해당 도메인 host_permission + 사용자 행동 시), 무저장,
  로그 비노출, 원격코드 없음, 오리진 화이트리스트.

## 10. 추천 아키텍처

**Connector Extension = "쿠키 브리지"에서 "온페이지 추출 다운로더"로 확장.**

```
사용자 (Douyin 로그인됨)
  └─ ClipMiner 확장(content script, douyin/xhs 도메인)
       1) 현재 영상의 play URL + 메타데이터를 페이지 데이터에서 추출
       2) 세션으로 직접 fetch → Blob
       3) (분할 스트림이면) ffmpeg.wasm로 먹싱 — 필요 시에만
  └─ ClipMiner Web
       4) Blob을 작업 폴더(File System Access)에 mp4 저장
       5) originalTitle → translatedTitle(번역) → 태그 추출 → IndexedDB 등록(미제작)
       6) 라이브러리 카드 표시 / Hover·상세 자동재생
```

- **장점:** 서버 0원 · 추가 설치 없음(확장뿐) · cookies.txt 미노출 · 서명 재현 불필요 · 목표 UX 충족.
- **재사용(Desktop/Web 자산):** titleTranslate·해시태그·URL 정규화·제목 이중화·작업 폴더 저장·카드/상세/Hover·등록 순서 = 그대로.
- **신규 작업(최소):** ① 확장 content-script 추출기(Douyin → XHS), ② 확장↔Web Blob 전달, ③ (옵션) ffmpeg.wasm 먹싱.
- **YouTube(보조):** 공개 영상이라 추출/기존 경로 유지. 핵심은 Douyin·XHS.

### 리스크 요약 (의사결정 참고)
- (중) Douyin 페이지 구조 변경 시 추출기 유지보수 → 서버 서명보다는 가벼움.
- (중) 일부 영상 HLS → ffmpeg.wasm 필요(로드 용량).
- (중) 스토어 심사 정책(다운로더 민감) → 리서치 도구 포지셔닝 + 권한 최소화로 완화, 사전 점검 필요.
- (저) 단일 영상 progressive면 ffmpeg 불필요.

### 권장 다음 단계
1. **PoC(로컬, 압축해제 확장):** Douyin 영상 1개에서 content-script로 play URL + 제목 추출 → Blob fetch 검증.
2. 검증되면 ClipMiner Web과 Blob 브리지 연결 → 기존 등록/번역/태그 파이프라인에 연결.
3. XHS 추출기 추가 → ffmpeg.wasm 필요 여부 판정.
4. 스토어 정책 사전 점검 → 등록.

> 본 문서는 조사/설계안이며 구현은 사장 승인 후 위 순서로 착수한다.
> (수동 cookies.txt 코드는 개발 참고용 유지, 서비스 UX 미채택)
