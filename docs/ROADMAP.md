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

---

## Phase 2 — Vercel 기본 배포 (다음)

- Vercel 프로젝트 연결
- main 브랜치 기본 배포(골격 상태) 동작 확인
- 도메인 `clipminer.cozybuilder.co.kr` 연결 준비
- 환경변수 주입 구조만 준비(값은 이후), `.env*`는 커밋하지 않음

---

## Phase 3 — 데이터 / 세션 기반

- Supabase **독립 프로젝트** 생성, 환경변수 확정
  - Supabase URL / service-role 키 / `cm_session` 서명 비밀값
- `videos` 테이블 마이그레이션 (DB.md 기준)
- `cm_session` 발급/검증 연동 (homepage `/apps/clipminer` 진입 흐름)
  - TTL 7일, 만료 시 재진입 안내
- 공통 데이터 접근 헬퍼 — `user_id` 서버 스코프 강제 (DESIGN.md §2.3)

---

## Phase 4 — 핵심 기능 (MVP)

- 영상 등록 (URL + **사용자 직접 제목** + 태그)
- 영상 목록 / 단건 조회 / 삭제
- 태그 기반 필터(기본)
- 상단 homepage 복귀 링크 (Settings 화면 없음)
- ClipMiner Desktop 다운로드 안내 링크 (보조)

**MVP 완료 기준:** 사용자가 진입 → 영상 등록 → 목록/태그 정리 → 삭제까지
독립 Supabase에 `user_id` 스코프로 안전하게 저장/조회된다.

---

## 이후 — 확장 후보 (미확정)

> 우선순위 미정. 필요해질 때 재논의.

- 영상 메타데이터 enrich (제공자/썸네일/duration)
- 태그 자동완성 / 사용 빈도 → 필요 시 `tags` 정규화 재검토
- 컬렉션/폴더 구조
- 공유/공개 링크
- (검토) Supabase native auth + RLS 전환
- (검토) Desktop ↔ Web 연동

---

## 의존 / 선행 조건

- homepage `/apps/clipminer` 진입 흐름과 `cm_session` 발급 규격 합의 (Phase 3 선행)
- homepage `user.id` 포맷 확정 (`videos.user_id` 저장 형식)
- 독립 Supabase 프로젝트 접근 권한 / 키 확보
