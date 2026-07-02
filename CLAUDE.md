# CLAUDE.md — ClipMiner Web 작업 가이드

Claude Code가 이 저장소에서 작업할 때 따르는 지침.

---

## 0. 작업 폴더 확인 (필수, 매 작업 시작 시)

- 지정 Repository: **clipminer-web**
- 현재 작업 폴더가 지정 Repository와 다르면 **코드/문서 수정·명령 실행을 중단**하고
  `"작업 폴더가 잘못되었습니다"` 라고 보고한다.

---

## 1. 현재 단계

**Phase 8 — Browser Connector(확장) 기반 수집 + 라이브러리 자동 등록.**

진행 요약:
- Phase 0~1.5 ✅ 설계/초기화/문서 정합화
- Phase 2~6 ✅ Vercel 준비 · Local-First 데이터/라이브러리 UI(Desktop 보드형) · 작업 폴더(File System Access)
- Phase 7(yt-dlp/cookies 다운로드) → **미채택**. 코드는 `reference/`로 분리(커밋 제외).
- Phase 8 ✅ ClipMiner Connector 확장으로 Douyin 수집 → 작업 폴더 저장 + IndexedDB 자동 등록

저장 전략은 **Local-First**(IndexedDB/Dexie + 로컬 폴더, §3). **Supabase / 인증 / cm_session 제외.**

> 단계 전환·기능 추가는 사장님 승인으로만 한다. 세부 진행 상태는 [docs/STATUS.md](docs/STATUS.md) 기준.

---

## 2. 제품 핵심

- `app_key = clipminer`, 정식 launch 대상은 **ClipMiner Web**. Desktop은 보조(다운로드 안내).
- 영상(`videos`) 중심, 태그는 사용자가 직접 부착(레코드의 배열 필드), 제목은 사용자 직접 입력.
- **핵심 대상 플랫폼: Douyin(1순위) · Xiaohongshu(2순위).** YouTube는 보조 지원이며 핵심이 아니다.
  - Douyin/Xiaohongshu는 URL만으로 미리보기/메타데이터를 안정적으로 얻기 어려워,
    **"다운로드 → 로컬 파일 생성 → 라이브러리 표시"** 흐름을 전제로 한다.
  - "YouTube 전용 다운로드 도구"처럼 보이게 하지 않는다. 제품은 **콘텐츠 리서치·관리 플랫폼**(이용 정책: DESIGN §1.1).
- **수집(다운로드)은 ClipMiner Connector 브라우저 확장에서 실행**한다. Douyin 페이지에서 확장이
  영상 URL/제목을 추출·다운로드 → 작업 폴더 저장 → ClipMiner Web 라이브러리에 자동 등록(미제작).
  - Web 화면에는 다운로드 버튼/엔진을 두지 않는다(`/download`은 안내·연결 상태 화면).
  - **cookies.txt 수동 업로드 / 서버 yt-dlp 방식은 미채택**(`reference/phase7-ytdlp/`로 분리, 커밋 제외).
  - 확장 ↔ Web: `window.postMessage`(web-bridge) 기반. 등록 수신부는 `/videos`(`src/lib/connector.ts`).
- 배포: Vercel / 도메인 `clipminer.cozybuilder.co.kr` (앱만 서빙. 서버 다운로드 없음 → 운영비 0원).
- 확장 PoC: `poc/douyin-extractor/`. 설계: [docs/BROWSER_CONNECTOR.md](docs/BROWSER_CONNECTOR.md), [docs/DOWNLOAD_ARCHITECTURE_OPTIONS.md](docs/DOWNLOAD_ARCHITECTURE_OPTIONS.md).

자세한 결정은 [docs/DESIGN.md](docs/DESIGN.md) 참고.

---

## 3. 저장 전략 — Local First (MVP 절대 규칙)

> 2026-06-27 전환. 이전의 Supabase/세션/`user_id` 스코프 규칙은 **MVP에서 폐기**되었다.

1. **외부 DB를 쓰지 않는다.** 영상 메타데이터·태그·메모·제작 상태는 브라우저
   **IndexedDB(Dexie)** 에 저장한다.
2. **실제 영상 파일**은 사용자 PC의 **지정 폴더**에 저장한다. 파일 본체는 IndexedDB에 넣지 않으며,
   메타 레코드는 파일 참조만 보관한다.
3. **인증/세션(`cm_session`) 없음.** 단일 로컬 사용자 전제. 서버 측 사용자 스코프/RLS 개념 없음.
4. **서버는 사용자 데이터를 보관하지 않는다.** 데이터는 기본적으로 사용자 기기에 남는다.
5. Backup/Sync(선택적 클라우드 동기화)는 **MVP 이후 별도 기능**으로만 검토한다.
   (그 시점에 인증/외부 저장소 재도입 여부 재논의)

> Supabase / Auth / DB 연결 / env 비밀키는 MVP 구현 대상이 아니다.

---

## 4. 문서 지도

| 문서 | 용도 |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | 제품·아키텍처 결정 · 결정사항 A~H 매핑 · 콘텐츠 이용 원칙 |
| [docs/DB.md](docs/DB.md) | 실제 저장 구조 (IndexedDB/Dexie 스토어 · 스키마 v1~v6) |
| [docs/STATUS.md](docs/STATUS.md) | 현재 살아있는 진행 상태 · 다음 작업 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 단계별 계획 (Phase 0~8 완료 · 이후 후보) |
| [docs/BROWSER_CONNECTOR.md](docs/BROWSER_CONNECTOR.md) | 브라우저 확장 기반 수집 구조 (현재 구현) |
| [docs/DOWNLOAD_ARCHITECTURE_OPTIONS.md](docs/DOWNLOAD_ARCHITECTURE_OPTIONS.md) | 다운로드 아키텍처 옵션 검토 (결정 근거) |

> 문서 역할 분리: README=진입 요약 · STATUS=현재 상태 · ROADMAP=단계 계획 ·
> DESIGN=결정 · DB=저장 구조 · BROWSER_CONNECTOR=확장/수집. 같은 사실을 중복 서술하지 않는다.
> 오래된 결정은 삭제하지 말고 각 문서의 "폐기된 결정 / Superseded" 섹션으로 이동한다.

작업으로 사실이 바뀌면 해당 문서(특히 STATUS.md)를 갱신한다.

---

## 5. 환경 / 스택

- OS: Windows / Shell: PowerShell (POSIX 스크립트는 Bash 도구)
- 작업 폴더: `C:\projects\clipminer-web`
- 스택: Next.js 16.2.9 · React 19.2.4 · TypeScript 5 · Tailwind v4 · App Router (`src/` 구조)
- 실행: `npm install` → `npm run dev` / `npm run lint` / `npm run build`

> Next.js 16은 이전 버전과 API·규약·파일 구조가 다를 수 있다. 코드 작성 전
> `node_modules/next/dist/docs/`의 관련 가이드를 확인하고 deprecation 안내를 따른다.
> (이 저장소의 에이전트 기준 문서는 **CLAUDE.md + docs/** 로 통일한다.)
