# ClipMiner Web — 진행 상태 (STATUS)

> 최종 갱신: 2026-06-27 (Phase 1.5 문서 정합화 완료)

---

## 현재 단계

**Phase 1 완료 + Phase 1.5(문서 정합화) 완료.** 다음 단계는 **Phase 2 Vercel 기본 배포**.

웹 앱 골격(기본 페이지)까지 구성됨. Supabase/인증/DB/수집 기능은 아직 구현하지 않는다.

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

## 미완료 (이후 단계)

### Phase 2 — Vercel 기본 배포 (다음)
- [ ] Vercel 프로젝트 연결 및 기본 배포
- [ ] 도메인 연결 준비 (clipminer.cozybuilder.co.kr)

### Phase 3+ — 데이터/세션/수집 (MVP)
- [ ] Supabase 독립 프로젝트 생성 및 환경변수 확정
- [ ] DB 마이그레이션 작성 (`videos` 테이블)
- [ ] `cm_session` 발급/검증 연동 (homepage `/apps/clipminer` 진입 흐름)
- [ ] 영상 등록/목록/조회/삭제 기능 구현

---

## 환경 메모

- 작업 폴더: `C:\projects\clipminer-web`
- Git 저장소 초기화 완료, `origin` = https://github.com/cozybuilder/clipminer-web.git
- Phase 1에서 추가된 의존성은 `node_modules/`(gitignore)로 관리.
- 에이전트 기준 문서는 `CLAUDE.md` + `docs/` 로 통일 (AGENTS.md 제거됨).

---

## 결정사항 반영 현황 (A~H)

모두 `docs/DESIGN.md §7` 매핑 표에 반영 완료.

| 결정 | 반영 |
| --- | --- |
| A 신원·세션·RLS | ✅ |
| B Supabase 독립 프로젝트 | ✅ |
| C 태그 `text[]` | ✅ |
| D 제목 직접 입력 | ✅ |
| E app_key / 제품 구분 | ✅ |
| F Settings 생략 | ✅ |
| G 세션 TTL 7일 | ✅ |
| H 도메인/배포 | ✅ |
