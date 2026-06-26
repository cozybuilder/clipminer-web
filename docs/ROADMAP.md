# ClipMiner Web — 로드맵 (ROADMAP)

---

## Phase 0 — 설계 문서 안착 ✅

- 결정사항 A~H 확정
- 설계/DB/상태/로드맵/README/CLAUDE 문서 작성
- Git 초기화 / origin 연결 / 문서 push (commit `9485137`)
- **구현 없음**

---

## Phase 1 — Next.js 초기화 ✅

- Next.js 16 + TypeScript + App Router + Tailwind v4 + ESLint
- `src/` 구조, 기본 골격 페이지
- 검증(lint/build) 통과, push (commit `4f0355c`)

## Phase 1.5 — 문서 정합화 ✅

- CLAUDE.md / README.md / STATUS.md / ROADMAP.md 실제 상태에 맞춰 정합화
- AGENTS.md 제거 → 기준 문서를 CLAUDE.md + docs/ 로 통일

## 저장 전략 전환 — Local-First ✅ (2026-06-27, 문서 반영)

- MVP는 외부 DB를 사용하지 않음. 메타데이터는 IndexedDB(Dexie), 영상 파일은 로컬 폴더.
- Supabase/Auth/`cm_session` 은 MVP 제외 → 폐기(superseded) 기록 보존.

---

## Phase 2 — Vercel 기본 배포 (다음)

- Vercel 프로젝트 연결
- main 브랜치 기본 배포(골격 상태) 동작 확인
- 도메인 `clipminer.cozybuilder.co.kr` 연결 준비
- 서버는 앱만 서빙 — 사용자 데이터/비밀키 없음. `.env*`는 커밋하지 않음

---

## Phase 3 — Local-First 데이터 계층 (MVP)

- **IndexedDB(Dexie)** `videos` 스토어 구성 (DB.md 기준)
  - 필드: 제목·URL/출처·태그·메모·제작 상태·파일 참조·타임스탬프
- **로컬 폴더 지정** 흐름 + 실제 영상 파일 저장/참조
  - 폴더 접근 방식(File System Access API 등)은 구현 시 확정
- 파일/메타데이터 정합성 정책 (삭제·이동 처리)

---

## Phase 4 — 핵심 기능 (MVP)

- 영상 등록 (URL/출처 + **사용자 직접 제목** + 태그 + 메모 + 제작 상태)
- 영상 목록 / 단건 조회 / 수정 / 삭제
- 태그 기반 필터(기본)
- 상단 homepage 복귀 링크 (Settings 화면 없음)
- ClipMiner Desktop 다운로드 안내 링크 (보조)

**MVP 완료 기준:** 사용자가 영상 등록 → 목록/태그/메모/상태 정리 → 수정/삭제까지,
**메타데이터는 IndexedDB, 영상 파일은 로컬 폴더**에 안전하게 저장/조회된다.

---

## 이후 — 확장 후보 (미확정)

> 우선순위 미정. 필요해질 때 재논의.

- **Backup / Sync** — 선택적 클라우드 동기화 (이 시점에 외부 DB/인증 재도입 검토)
- 영상 메타데이터 enrich (제공자/썸네일/duration)
- 태그 자동완성 / 사용 빈도 집계
- 컬렉션/폴더 구조
- (검토) Desktop ↔ Web 연동

---

## 의존 / 선행 조건

- 로컬 폴더 접근 방식(브라우저 파일 시스템 능력) 확정 — Phase 3 선행
- (Sync 검토 시점에) 외부 저장소/인증 규격 재논의
