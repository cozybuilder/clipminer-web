# ClipMiner Web — 진행 상태 (STATUS)

> 최종 갱신: 2026-06-27 (Phase 5 로컬 파일 첨부 MVP)

---

## 현재 단계

**Phase 5 — 로컬 영상 파일 첨부(Local File Attachment) MVP 완료.**
영상 추가 모달에서 로컬 mp4/webm/mov 선택 → 현재 세션 메모리(ObjectURL)로 카드/상세에서 재생.
파일 본체는 서버/IndexedDB에 저장하지 않고 **메타데이터(이름/형식/크기)만** 저장.
**스키마 v4**: `localFileName/localFileType/localFileSize` 추가. 새로고침 시 파일 재연결 안내.

다음: 로컬 폴더 권한 영속(File System Access) 등은 이후 검토.

> **저장 전략 변경 (2026-06-27):** MVP는 **Local-First**로 확정.
> 메타데이터·태그·메모·제작 상태 → 브라우저 **IndexedDB(Dexie)**,
> 실제 영상 파일 → **사용자 PC 지정 폴더**. **외부 DB / Supabase / 인증 / `cm_session` 은 MVP 제외.**

---

## 완료

### Phase 0 — 설계 문서 안착
- [x] 핵심 결정사항 A~H 확정
- [x] 설계 문서 안착 — `docs/DESIGN.md`
- [x] DB 스키마 설계 — `docs/DB.md`
- [x] 로드맵 — `docs/ROADMAP.md`
- [x] 진행 상태 문서 — `docs/STATUS.md` (본 문서)
- [x] `README.md`
- [x] Claude 작업 가이드 — `CLAUDE.md`
- [x] Git 저장소 초기화 / origin 연결 / Phase 0 문서 push
      (commit `9485137` → `origin/main`)

### Phase 1 — Next.js 초기화 (2026-06-27)
- [x] Next.js 16 + TypeScript + App Router 초기화
- [x] Tailwind v4 적용
- [x] ESLint 기본 설정 (eslint-config-next)
- [x] `src/` 구조 사용
- [x] 기본 페이지 생성 (`src/app/page.tsx` — ClipMiner Web 골격)
- [x] 기존 문서(README/CLAUDE/docs) 보존
- [x] 검증: `npm install` / `npm run lint` / `npm run build` 통과
- [x] 커밋/푸시 (commit `4f0355c` → `origin/main`)

> 스택: Next.js 16.2.9 · React 19.2.4 · Tailwind v4 · TypeScript 5

### Phase 1.5 — 문서 정합화 (2026-06-27)
- [x] CLAUDE.md 현재 단계 → Phase 1 완료 / 다음 Phase 2 명시
- [x] README.md → 실제 Next.js 구조 · 실행 명령 · 미구현 상태 반영
- [x] AGENTS.md 삭제 (create-next-app 기본 생성물) — 기준 문서를 CLAUDE.md + docs/ 로 통일
- [x] docs/STATUS.md · docs/ROADMAP.md 정합화

### 저장 전략 전환 — Local-First (2026-06-27, 문서 반영)
- [x] DESIGN.md · DB.md · CLAUDE.md · README.md · ROADMAP.md · STATUS.md 를 Local-First로 갱신
- [x] Supabase/Auth/cm_session 전제를 폐기(superseded)로 기록 보존

### Phase 2 — Vercel 배포 준비 (2026-06-27)
- [x] 배포 가능 상태 점검: `npm run lint` / `npm run build` 통과
- [x] 빌드 설정 확인: `next.config.ts`(기본), `package.json` 스크립트(`build`/`start`) 정상
- [x] 표준 Next.js 16 → Vercel 자동 감지 대상 확인
- [x] Vercel 설정값 문서화 (README "배포 (Vercel)") — env 불필요(Local-First)
- [x] `.env*` / `.vercel` gitignore 확인
- [ ] (승인 후) Vercel 프로젝트 연결 및 첫 배포
- [ ] (승인 후) 도메인 연결 (clipminer.cozybuilder.co.kr) — DNS 변경은 별도 범위

### Phase 3 — Local-First 데이터 계층 / MVP (2026-06-27)
- [x] Dexie 설치 (dexie 4.4.4)
- [x] IndexedDB DB 정의 (`src/lib/db.ts`) — `videos`, `tags` 스토어 (스키마 v1)
- [x] 타입 정의 (`src/lib/types.ts`) — `VideoItem` / `VideoStatus` / `TagItem`
- [x] CRUD 유틸 — 영상 추가/목록/단건/수정/삭제 (`src/lib/videos.ts`), 태그 생성/조회 (`src/lib/tags.ts`)
- [x] 개발 확인용 UI (`src/app/videos/page.tsx`) — URL/제목/태그/메모/상태 저장·목록·삭제
- [x] 수동 검증: 추가→IndexedDB 기록, 새로고침 후 유지, 삭제 반영 확인
- [x] 검증: `npm run lint` / `npm run build` 통과
- 범위 제외(다음 단계): 실제 영상 파일 저장, File System Access API, JSON Import/Export

### Phase 4 — Video Library UI / MVP (2026-06-27)
- [x] `/videos` 정식 라이브러리 화면 (헤더 + 등록 폼 + 카드 목록)
- [x] 카드: 제목/URL/태그/메모/상태 배지/생성·수정일/삭제
- [x] 상태 필터 (전체·아이디어·진행중·완료, 카운트 표시)
- [x] 텍스트 검색 (제목·URL·태그·메모) + 태그 칩 클릭 검색
- [x] 카드 내 상태 즉시 변경 (셀렉트 → IndexedDB 반영)
- [x] 빈 상태 UI (데이터 없음 / 검색 결과 없음 구분)
- [x] 루트(`/`)에 "내 라이브러리 열기" 진입 버튼
- [x] 수동 검증: 추가/조회/상태변경/필터/검색/삭제/새로고침 유지 확인
- [x] 검증: `npm run lint` / `npm run build` 통과

### Phase 4-B — ClipMiner Desktop 보드형 UI 이식 (2026-06-27)
- [x] Desktop 디자인 토큰 이식 (globals.css `@theme`: background/card/border/primary/accent/text/subtext, radius-card)
- [x] lucide-react 아이콘 도입 (Desktop과 동일)
- [x] 좌측 사이드바: 제작 상태 필터(전체/미제작/제작중/제작완료, 카운트) + 태그 필터(빈도순)
- [x] 상단 툴바: 검색 + 정렬(최근수정/오래된/제목) + "영상 추가"(모달)
- [x] 9:16 쇼츠 카드 그리드 (2~6열 반응형), 썸네일 중심 + URL 자동 썸네일(유튜브) + No Preview 플레이스홀더
- [x] 카드: 상태 배지(색상) / 태그칩 / 메모 / 상태 즉시 변경 / 삭제
- [x] 영상 추가 모달 (URL/제목/태그/메모/상태) — 등록 폼이 화면을 차지하지 않음
- [x] 상태 라벨 Desktop 표기로 변경 (미제작/제작중/제작완료) — 스키마 값(idea/in_progress/done) 무변경
- [x] 수동 검증: 추가/썸네일/상태변경/상태필터/태그필터/검색/삭제/새로고침 유지
- [x] 검증: `npm run lint` / `npm run build` 통과

### Phase 4-C — Desktop StatCard 필터 구조 정합 (2026-06-27)
- [x] 좌측 사이드바 필터 제거
- [x] 상단 StatCard 필터 구성 (전체/미제작/제작중/제작완료, 아이콘+카운트, active=primary ring) — Desktop StatCard 구조 동일
- [x] 보조 태그 필터 라인 (StatCard 아래, 빈도순 칩 + "전체" 해제)
- [x] 헤더: 로고 + 검색 + 정렬 + "영상 추가" (Desktop Dashboard 헤더 배치)
- [x] 9:16 카드 그리드 / 카드 UI / 추가 모달 유지
- [x] 수동 검증: StatCard 필터/태그 필터/검색/추가/상태변경/삭제/새로고침 유지
- [x] 검증: `npm run lint` / `npm run build` 통과

### Phase 4-D — Desktop 카드/상세 흐름 보강 (2026-06-27)
- [x] 스키마 v2: `VideoItem.platform` 추가, Dexie `db.version(2)` migration(기존 레코드 URL→platform 백필)
- [x] 플랫폼 추정 유틸 (`src/lib/platform.ts`): YouTube/Douyin/Xiaohongshu/TikTok/기타 + 배지
- [x] 카드 보강: 플랫폼 배지(좌하단) + 상태 배지 + 태그 + 메모 미리보기 + 상태 선택 + URL 복사 + 날짜
- [x] 카드 클릭 → 상세 모달: 9:16 썸네일 / URL(열기·복사) / 태그 / 제작 상태 변경 / 메모 수정(인라인) / 삭제
- [x] 추가 모달: URL 입력 시 플랫폼 자동 추정 배지 표시
- [x] 수동 검증: 추가/플랫폼 추정·저장(DB v2)/카드·상세 표시/메모 수정/상태 변경/URL 복사/삭제/새로고침 유지
- [x] 검증: `npm run lint` / `npm run build` 통과

### Phase 4-E — 즐겨찾기 + 다중선택 + 일괄작업 (2026-06-27)
- [x] 스키마 v3: `VideoItem.isFavorite` 추가, Dexie `db.version(3)` migration(기존 레코드 false 백필)
      — boolean은 IndexedDB 인덱스 불가라 비인덱스 필드로 두고 메모리 필터 사용
- [x] 데이터 함수: `setFavorite` / `bulkSetStatus` / `bulkSetFavorite` / `bulkDelete`
- [x] 카드: 좌상단 선택 체크박스(hover/선택 시), 우상단 즐겨찾기 별 토글, 선택 시 ring 강조
- [x] 상세 모달: 즐겨찾기 토글 버튼
- [x] StatCard 추가: "즐겨찾기(미제작)" (isFavorite && status≠done)
- [x] 일괄작업 바: 전체 선택/해제 · 제작완료 · 즐겨찾기 추가/해제 · 선택 삭제, "N개 선택" 카운트
- [x] 필터/검색 변경 시 선택 초기화 (Desktop 동일)
- [x] 수동 검증: 즐겨찾기 토글·StatCard 카운트·다중선택·선택해제·일괄 제작완료·즐겨찾기 추가/해제·선택 삭제·새로고침 유지
- [x] 검증: `npm run lint` / `npm run build` 통과

### Phase 5 — 로컬 파일 첨부 MVP (2026-06-27)
- [x] 스키마 v4: `localFileName/localFileType/localFileSize` 추가 (선택적 비인덱스 필드, db.version(4) 표식)
- [x] 영상 추가 모달: 로컬 영상 파일 선택(`accept="video/*"`) + 미리보기 video + 파일명→제목 자동
- [x] 현재 세션 재생: File→ObjectURL을 메모리(`fileUrls`)로 보관, 카드 썸네일 영역 video(hover 무음 재생)
- [x] 상세 모달: 로컬 파일 정보 표시 + 세션 내 video 재생 + 새로고침 후 "다시 연결" 안내/입력
- [x] 파일 본체/Blob은 서버·IndexedDB에 저장하지 않음 (메타데이터만)
- [x] 수동 검증: mp4 첨부/카드·상세 video/새로고침 후 메타 유지·재연결 안내/재연결/URL-only 카드 정상/상태·즐겨찾기·일괄 회귀 없음
- [x] 검증: `npm run lint` / `npm run build` 통과
- 카드 hover 무음 재생은 현재 세션 ObjectURL 기준으로 구현(Desktop hover 재생과 동일 개념)

## 미완료 (이후 단계)

### Phase 6 — 파일 영속 / 편집
- [ ] File System Access API 디렉토리 권한 영속(새로고침 후 자동 재연결) 검토
- [ ] 영상 편집(제목/URL/태그) UI (현재는 상태/메모/즐겨찾기/파일연결)

### 이후 (선택적)
- [ ] JSON Import/Export (백업 파일)
- [ ] Backup/Sync — 선택적 클라우드 동기화 (이때 외부 DB/인증 재검토)

---

## 환경 메모

- 작업 폴더: `C:\projects\clipminer-web`
- Git 저장소 초기화 완료, `origin` = https://github.com/cozybuilder/clipminer-web.git
- Phase 1에서 추가된 의존성은 `node_modules/`(gitignore)로 관리.
- 에이전트 기준 문서는 `CLAUDE.md` + `docs/` 로 통일 (AGENTS.md 제거됨).

---

## 결정사항 현황 (Local-First 전환 반영)

상세는 `docs/DESIGN.md` §6(유지) / §9(폐기) 참고.

| 결정 | 상태 |
| --- | --- |
| A 신원·세션·RLS (cm_session/service-role) | ⛔ MVP 폐기 (Local-First) |
| B Supabase 독립 프로젝트 | ⛔ MVP 폐기 (외부 DB 미사용) |
| C 태그 | ✅ 유지 (저장소만 IndexedDB로 변경) |
| D 제목 직접 입력 | ✅ 유지 |
| E app_key / 제품 구분 | ✅ 유지 |
| F Settings 생략 | ✅ 유지 (최소 폴더 지정만) |
| G 세션 TTL 7일 | ⛔ MVP 폐기 (세션 없음) |
| H 도메인/배포 | ✅ 유지 (서버는 앱만 서빙) |
