# ClipMiner Web — 진행 상태 (STATUS)

> 최종 갱신: 2026-06-27 (저장 전략 → Local-First 전환)

---

## 현재 단계

**Phase 1 완료 + Phase 1.5(문서 정합화) 완료.** 다음 단계는 **Phase 2 Vercel 기본 배포**.

웹 앱 골격(기본 페이지)까지 구성됨.

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

## 미완료 (이후 단계)

### Phase 2 — Vercel 기본 배포 (다음)
- [ ] Vercel 프로젝트 연결 및 기본 배포 (앱만 서빙)
- [ ] 도메인 연결 준비 (clipminer.cozybuilder.co.kr)

### Phase 3 — Local-First 데이터 계층 (MVP)
- [ ] IndexedDB(Dexie) `videos` 스토어 구성
- [ ] 로컬 폴더 지정 + 영상 파일 저장/참조 흐름
- [ ] 영상 등록/목록/조회/수정/삭제 + 태그/메모/제작 상태

### 이후 (선택적)
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
