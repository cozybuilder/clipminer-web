# ClipMiner Browser Connector — 수집 구조 (Phase 8, 구현됨)

> **상태:** 구현·검증 완료(Phase 8). 이 문서는 **현재 구현된 확장 기반 수집 구조**만 다룬다.
> 이전의 cookies.txt 브리지 / 서버 yt-dlp / `/api/download` 설계는 **미채택**이며 §7에 기록으로만 남긴다.
> 확장 소스: `poc/douyin-extractor/` (로컬 unpacked, Chrome MV3).

제품 방향:
- ClipMiner Web = 실제 서비스 제품, 라이브러리·저장 주체.
- Browser Connector(확장) = Douyin 페이지에서 영상을 **추출**해 Web으로 넘기는 수집 도구.
- 서버 다운로드 연산 없음 → **운영비 0원**(Vercel은 앱만 서빙).

---

## 0. 접근 방식 (핵심)

Douyin/Xiaohongshu는 URL만으로 미리보기/메타데이터를 안정적으로 얻기 어렵다.
→ **확장이 Douyin 페이지 안에서 직접 영상 URL/제목을 추출**하고, 실제 mp4 바이트를 받아
ClipMiner Web으로 넘긴다. **cookies.txt·yt-dlp·서버 API는 쓰지 않는다.**

목표 UX (사용자는 확장/추출을 의식하지 않음):
```
확장 최초 1회 설치 → Douyin 로그인 → /download 에 링크 붙여넣기 → [영상 저장하기] → 끝
```

---

## 1. Extension 구조 (Manifest V3, Chromium)

```
poc/douyin-extractor/
├─ manifest.json      # MV3
├─ background.js      # service worker — 탭 오케스트레이션 / cross-origin fetch / content-type probe
├─ content.js         # Douyin 페이지 주입 — 내장 데이터에서 영상 URL/제목 추출
└─ web-bridge.js      # ClipMiner Web 오리진 주입 — 페이지 ↔ background 중계
```

**manifest.json 핵심**
- `manifest_version: 3`
- `permissions: ["tabs", "scripting"]` (cookies/downloads 미사용)
- `host_permissions: ["https://*/*"]` — Douyin 및 회전하는 CDN 도메인에서 cross-origin fetch 필요
- `content_scripts`:
  - `content.js` → `https://www.douyin.com/*`, `https://www.iesdouyin.com/share/video/*`
  - `web-bridge.js` → `http://localhost:3000/*`, `https://clipminer.cozybuilder.co.kr/*`
- 확장 표시명은 `ClipMiner` (사용자 노출 문구에 PoC/Connector 등 내부 용어 미노출).
- 원격 코드 로드 없음(스토어 정책 충족), 최소 권한.

---

## 2. Web ↔ Extension 통신 (window.postMessage 브리지)

`externally_connectable` 이 아니라, **ClipMiner 오리진에 주입된 `web-bridge.js`** 가 페이지의
`window.postMessage` 와 확장 `chrome.runtime` 사이를 중계한다.

주요 메시지:
| 방향 | 메시지 | 역할 |
| --- | --- | --- |
| 페이지 → 확장 | `clipminer:connector-ping` / `clipminer:save` | 확장 존재 감지 / 저장 요청 |
| 확장 → 페이지 | `clipminer:connector-ready` / `clipminer:save-status` | 준비됨 / 진행 상태(사용자 언어) |
| 확장 → 페이지 | `clipminer:register-payload` | 추출한 mp4 payload 전달 |
| 페이지 → 확장 | `clipminer:save-result` | 저장 결과 회신(백그라운드 탭 정리) |

`requestId` 는 background가 생성·관리한다.

---

## 3. 저장 흐름 (한 번의 [영상 저장하기])

```
[/download] 링크 붙여넣기 + [영상 저장하기]
   │  postMessage(clipminer:save)
   ▼
[web-bridge.js] → chrome.runtime(saveDouyin)
   ▼
[background.js]
   1) requestId 생성, Douyin 탭을 백그라운드(active:false)로 open
   2) 로드 완료 → content.js 핸드셰이크(ping) → 'save' 명령 주입(scripting.executeScript)
   ▼
[content.js] Douyin 페이지 내부
   3) _ROUTER_DATA / RENDER_DATA / SSR 스크립트에서 play_addr 등 영상 후보 URL + 제목 추출
   4) background가 후보를 content-type(Range GET)로 검증 → 실제 영상만 선택 (image/* 거부)
   5) background가 host_permissions 로 cross-origin fetch → mp4 bytes → base64 회신
   6) payload(platform/제목/sourceUrl/파일명/mimeType/bytesBase64)를 registerToPage 로 회신
   ▼
[background.js] → /download 탭으로 clipminer:register-payload 중계
   ▼
[/download] registerFromConnector (src/lib/connector.ts)
   7) 작업 폴더(File System Access)에 mp4 저장 + IndexedDB 등록
      - 영상 ID(aweme_id/modal_id) 기준 중복 판정, 제목 번역(titleTranslate)·해시태그
   8) 결과를 clipminer:save-result 로 회신 → background가 백그라운드 Douyin 탭 정리
```

- 최종 저장 위치는 **작업 폴더뿐**이다. 브라우저 다운로드 폴더(`chrome.downloads`/`<a download>`)는 사용하지 않는다.
- URL만으로 등록하지 않는다: 실제 mp4 bytes + content-type 영상 + 작업 폴더 저장 성공 시에만 등록.

---

## 4. 지원 브라우저

| 브라우저 | 지원 | 비고 |
| --- | --- | --- |
| Chrome | ✅ 1순위 | 기준 |
| Edge | ✅ | 동일 MV3 패키지 |
| Brave | ✅ | Chromium 기반 |
| Firefox / Safari | ❌ | 미지원(별도 변환 필요, 후순위) |

배포: 개발/현재는 **압축해제된 확장 로드**(ZIP 배포 후 `chrome://extensions`에서 로드).
Chrome Web Store 등록은 이후 과제(현재 미채택 범위). File System Access는 HTTPS/secure context 필요.

---

## 5. 사용자 최초 설정 UX (`/download`)

```
1) 작업 폴더 선택
2) [확장 프로그램 다운로드] (ZIP)
3) chrome://extensions → 개발자 모드
4) [압축해제된 확장 프로그램 로드] → ClipMiner 폴더 선택
5) 홈페이지 새로고침 → "브라우저 준비 완료"
이후: Douyin 로그인 상태에서 링크 붙여넣고 [영상 저장하기]
```
- Douyin **로그인 필수**(비로그인 시 페이지가 영상 데이터를 내려주지 않아 추출 실패 가능).

---

## 6. Desktop 로직 재사용 범위

| 자산 | 위치 |
| --- | --- |
| 제목 번역(중→한) / 해시태그 추출 | `src/lib/titleTranslate.ts` |
| 플랫폼 감지 / URL 정규화(modal_id) / 영상 ID 추출 | `src/lib/platform.ts` |
| 제목 이중화(original/translated) | `types.ts` / `videos.ts` |
| 등록·중복판정·작업 폴더 저장 | `src/lib/connector.ts` / `workspace.ts` |
| 카드/상세/Hover 재생 | `src/app/videos/page.tsx` |
| 수신부(콘텐츠 저장) | `src/app/download/page.tsx` |

---

## 7. 폐기된 설계 (Superseded, 기록 보존)

> 아래는 초기 Connector 설계로, **현재 구현에서 채택하지 않았다.** 참고용으로만 남긴다.

- **cookies.txt 브리지:** 확장이 `chrome.cookies.getAll` 로 httpOnly 세션 쿠키를 읽어
  Netscape `cookies.txt` 로 변환 → `/api/download` 의 `cookies` 파라미터로 전달.
  → **미채택.** 현재는 쿠키를 읽지 않고, 로그인된 페이지에서 직접 추출한다.
- **`externally_connectable` + `chrome.runtime.sendMessage`(오리진 화이트리스트):**
  → **미채택.** `web-bridge.js` + `window.postMessage` 브리지로 대체.
- **서버 yt-dlp / `/api/download`(Node 런타임):** Vercel 서버리스에서 yt-dlp 실행 불가.
  → **미채택.** 코드는 `reference/phase7-ytdlp/`로 분리(커밋 제외). 다운로드 연산은 확장/사용자 기기에서.
- **네이티브 메시징 호스트 / exe 헬퍼:** → **미채택**(사용자 설치 부담).
- Vercel 프로덕션에서 서버가 다운로드를 수행하지 않는다(추출·저장은 전부 브라우저·확장).
