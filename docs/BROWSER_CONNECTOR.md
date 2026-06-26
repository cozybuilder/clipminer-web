# ClipMiner Browser Connector — 설계 (Phase 8)

> **상태:** 설계 문서(구현 전). 이 문서 승인 후 구현 착수.
> **목적:** 일반 사용자가 `cookies.txt`의 존재조차 모르고도 Douyin/Xiaohongshu 콘텐츠를
> 수집할 수 있게 하는 브라우저 확장 기반 연결 구조.
>
> 제품 방향(확정):
> - Desktop ClipMiner = 내부 기준(SSOT)
> - ClipMiner Web = 실제 서비스 제품
> - **Browser Connector = 일반 사용자 UX 해결책**
>
> 수동 `cookies.txt` 업로드/브라우저별 설정은 **서비스 UX로 채택하지 않는다.**
> (개발 검증용 cookies 코드는 유지하되 서비스 기능은 Connector로 대체)

---

## 0. 해결하려는 문제

Douyin/Xiaohongshu는 로그인 쿠키(특히 `httpOnly` 세션 쿠키) 없이는 다운로드가 막힌다.
- 페이지 JS(`document.cookie`)로는 `httpOnly` 쿠키를 읽을 수 없다.
- 사용자가 직접 `cookies.txt`를 내보내 업로드하는 방식은 일반 사용자에게 너무 어렵다.

→ **브라우저 확장만이 로그인 세션 쿠키에 안전하게 접근**할 수 있다. 확장이 쿠키를 대신 읽어
ClipMiner에 "연결"해 주면, 사용자는 로그인만 하면 된다.

목표 UX:
```
확장 설치 → Douyin 로그인 → "ClipMiner 연결 허용" → 끝
```

---

## 1. Extension 구조 (Manifest V3, Chromium)

```
clipminer-connector/
├─ manifest.json          # MV3
├─ background.js          # service worker — 쿠키 읽기/응답
├─ popup.html / popup.js  # 연결 상태 + "연결 허용" 토글
└─ icons/
```

**manifest.json 핵심**
- `manifest_version: 3`
- `permissions: ["cookies"]`
- `host_permissions: ["https://*.douyin.com/*", "https://*.xiaohongshu.com/*", "https://*.xhslink.com/*"]`
- `externally_connectable.matches`: ClipMiner Web 오리진만 허용
  - `https://clipminer.cozybuilder.co.kr/*`, `http://localhost:3000/*`(개발)
- `background.service_worker: "background.js"`
- 원격 코드 로드 없음(스토어 정책 충족), 최소 권한.

**background.js 역할**
- ClipMiner Web에서 온 메시지(`getCookies`, `ping`)만 처리.
- `chrome.cookies.getAll({ domain })` 로 해당 플랫폼 쿠키(httpOnly 포함) 수집.
- Netscape `cookies.txt` 형식 문자열로 변환해 응답.

**popup**
- "ClipMiner 연결" on/off, 현재 로그인/연결 상태 표시. (사용자 안심용. 실제 권한은 설치 시 부여)

---

## 2. Web ↔ Extension 통신 방식

**채택: `externally_connectable` + `chrome.runtime.sendMessage`** (Chromium 공통)

```
[ClipMiner Web 페이지]
  chrome.runtime.sendMessage(EXTENSION_ID, { type: "getCookies", platform: "douyin" }, cb)
        │
        ▼
[확장 background.js]
  chrome.cookies.getAll({ domain: ".douyin.com" })  → Netscape cookies.txt 문자열
        │  (사용자 연결 동의 상태일 때만)
        ▼
[ClipMiner Web]  → 받은 cookies 문자열을 기존 /api/download 의 `cookies` 파라미터로 전달
```

- **기존 `/api/download` 의 `cookies` 입력을 그대로 재사용** → 백엔드 변경 최소.
  (수동 업로드 대신 확장이 자동으로 같은 형식을 공급)
- **설치 감지:** 페이지가 `sendMessage(EXTENSION_ID, {type:"ping"})` → 응답 있으면 "연결됨".
  (대안: 확장 content script가 ClipMiner 오리진에 `window.__clipminerConnector = true` 주입)
- Firefox는 `externally_connectable` 미지원 → content script + `window.postMessage` 브리지로 대체(후순위).

---

## 3. Chromium 공통 지원 범위

| 브라우저 | 지원 | 비고 |
| --- | --- | --- |
| Chrome | ✅ 1순위 | 기준 |
| Edge | ✅ | 동일 MV3 패키지 |
| Whale | ✅ | Chromium 기반, 동일 |
| Brave | ✅ | cookies API 동작(쉴드와 무관, 확장 권한 사용) |
| Firefox | ⏳ 후순위 | `browser.*`, externally_connectable 미지원 → postMessage 브리지 |
| Safari | ⏳ 후순위 | Safari Web Extension 별도 변환 |

- **하나의 MV3 패키지**로 Chrome/Edge/Whale/Brave 공통 동작(API 표면 동일).
- 배포: 개발 = "압축해제된 확장 로드", 서비스 = Chrome Web Store 1건(Edge/Brave/Whale에서도 설치 가능)
  + 필요 시 Edge Add-ons/Whale 스토어 추가 등록.

---

## 4. Douyin/XHS 쿠키 접근 방식

1. 사용자가 브라우저에서 **Douyin(douyin.com)에 정상 로그인**.
2. 확장이 `chrome.cookies.getAll({ domain: ".douyin.com" })` 호출 → `httpOnly` 세션 쿠키(`sessionid` 등) 포함 전체 수집.
   - (페이지 JS로는 불가능한 부분 — 확장이 필요한 핵심 이유)
3. 쿠키 객체 → **Netscape cookies.txt** 라인으로 변환:
   `domain` / `includeSubdomains` / `path` / `secure` / `expirationDate` / `name` / `value` (탭 구분)
4. ClipMiner Web으로 전달 → `/api/download` `cookies` 로 넘김 → yt-dlp `--cookies` 적용.
- Xiaohongshu(`.xiaohongshu.com`, `.xhslink.com`)도 동일 구조.
- 쿠키는 **다운로드 요청 순간에만** 읽어 전달(상시 수집/저장 안 함).

---

## 5. 사용자 최초 설정 UX

```
1) ClipMiner Web에서 "브라우저 연결" 안내 → 확장 설치 링크(스토어)
2) Douyin 로그인 (평소처럼)
3) ClipMiner Web /download 의 "브라우저 연결" 버튼 클릭
4) 확장 동의(최초 1회) → "연결됨" 표시
5) 이후 URL 붙여넣고 다운로드 → 쿠키 자동 처리(사용자는 cookies.txt를 모름)
```
- 미설치 시: "ClipMiner 브라우저 연결 확장을 설치하세요" + 스토어 버튼.
- 미로그인 시: "Douyin에 로그인되어 있어야 합니다" 안내.
- 연결 상태 배지(연결됨/미연결)와 "연결 해제"(확장 비활성/제거 안내).

---

## 6. 보안 정책

- **오리진 화이트리스트:** 확장은 `externally_connectable`에 선언된 ClipMiner 오리진 메시지만 응답. 그 외 거부.
- **명시적 동의 + 사용자 행동 시에만** 쿠키 읽기(다운로드 버튼). 상시 백그라운드 수집 없음.
- **도메인 한정:** host_permissions를 douyin/xiaohongshu로 제한. 타 사이트 쿠키 접근 불가.
- **무저장:** 확장은 쿠키를 영구 저장하지 않음(요청 시 읽어 즉시 전달). ClipMiner Web도 쿠키를
  서버/DB/외부에 저장하지 않음(다운로드 시 로컬 `/api/download`의 임시파일로만, 직후 삭제).
- **로그 비노출:** 쿠키 전체 값을 콘솔/로그에 출력하지 않음.
- **원격 코드 없음 / 최소 권한 / MV3**(스토어 심사 통과 기준).
- 사용자는 언제든 확장 비활성/제거로 연결 차단 가능.

---

## 7. 운영비 0원 유지 방안

전제: **추가 백엔드 서버를 두지 않는다**(0원 유지). Vercel은 ClipMiner Web(정적/SPA)만 서빙.

- 확장 = 100% 클라이언트, 서버 비용 없음. Chrome Web Store 등록은 **1회성 $5**(반복 비용 아님).
- **다운로드 연산 위치(핵심 결정):** Vercel(서버리스)에서는 yt-dlp 실행 불가 → 다운로드 연산은
  **사용자 기기에서** 수행해야 0원이 유지된다. 후보:
  1. **로컬 네이티브 메시징 호스트**(확장 ↔ 사용자 PC의 소형 헬퍼가 yt-dlp 실행) — Desktop의
     yt-dlp 자산 재사용, 0원. (사용자가 1회 헬퍼 설치 필요)
  2. **ClipMiner Desktop를 다운로드 엔진으로 연계**(이미 yt-dlp 내장) — Web은 메타/관리, Desktop은 수집.
  3. (제약 큼) 확장 단독으로 플랫폼 미디어 직접 fetch — Douyin URL 파싱이 어려워 yt-dlp 대체 곤란.
- **권장:** 쿠키는 확장이 해결, 다운로드 연산은 (1) 네이티브 메시징 헬퍼 또는 (2) Desktop 연계로
  사용자 기기에서 처리 → **서버 0원 + 일반 사용자 UX** 양립. (개발용 `/api/download`는 로컬 dev 전용 유지)
- Vercel 프로덕션에서 다운로드가 "그냥 된다"고 표현하지 않는다(연산은 사용자 기기).

---

## 8. Desktop 로직 재사용 범위

| 자산 | 재사용 | 위치 |
| --- | --- | --- |
| 제목 번역(중→한) | ✅ 이미 포팅 | `src/lib/titleTranslate.ts` |
| 해시태그 추출 | ✅ 이미 포팅 | `titleTranslate.ts` |
| 플랫폼 감지 / URL 정규화(modal_id) | ✅ 이미 포팅 | `src/lib/platform.ts` |
| 제목 이중화(original/translated) | ✅ 이미 포팅 | `types.ts` / `videos.ts` |
| yt-dlp 호출 인자/파싱 | ♻️ 재사용 | Desktop `electron/main.cjs` → 헬퍼/로컬 엔진 |
| cookies.txt 형식 변환 | 🆕 확장 신규 | Netscape 포맷 빌더(확장) |
| 카드/상세/Hover 재생 | ✅ 이미 포팅 | `src/app/videos/page.tsx` |
| 등록 순서(다운로드 성공→번역/태그→등록) | ✅ 이미 포팅 | `/download` 흐름 |

→ **신규 작업은 "확장 + 쿠키 브리지 + (다운로드 연산 위치)"** 에 한정. 나머지는 Desktop/Web 자산 활용.

---

## 9. 단계 제안 (구현 착수 시)

1. 확장 스캐폴드(MV3) + `ping`/`getCookies`(Douyin) — 압축해제 로드로 검증
2. ClipMiner Web "브라우저 연결" 감지/연결 UI → 받은 cookies를 기존 `/api/download`로 전달(로컬 검증)
3. Xiaohongshu 확장 도메인 추가
4. 다운로드 연산 위치 결정(네이티브 메시징 헬퍼 vs Desktop 연계) — 0원 제약 기준
5. 스토어 등록(Chrome) + Edge/Whale 확인

> 본 문서는 설계안이며, 구현은 사장 승인 후 위 순서로 착수한다.
> (수동 cookies.txt 코드는 개발 참고용으로 유지, 서비스 UX로는 미채택)
