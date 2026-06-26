# ClipMiner Web — 진행 상태 (STATUS)

> 최종 갱신: 2026-06-26 (Phase 0)

---

## 현재 단계

**Phase 0 — 설계 문서 안착**

설계 초안을 repo 문서로 정리하는 단계. **앱 구현은 시작하지 않았다.**

---

## 완료

- [x] 핵심 결정사항 A~H 확정
- [x] 설계 문서 안착 — `docs/DESIGN.md`
- [x] DB 스키마 설계 — `docs/DB.md`
- [x] 로드맵 — `docs/ROADMAP.md`
- [x] 진행 상태 문서 — `docs/STATUS.md` (본 문서)
- [x] `README.md`
- [x] Claude 작업 가이드 — `CLAUDE.md`

## 미완료 (의도적으로 보류 — Phase 1 이후)

- [ ] Git 저장소 초기화 / 원격 연결
- [ ] Next.js 프로젝트 초기화
- [ ] Supabase 독립 프로젝트 생성 및 환경변수 확정
- [ ] DB 마이그레이션 작성 (`videos` 테이블)
- [ ] `cm_session` 발급/검증 연동 (homepage `/apps/clipminer` 진입 흐름)
- [ ] 영상 등록/목록/조회/삭제 기능 구현
- [ ] Vercel 배포 및 도메인 연결 (clipminer.cozybuilder.co.kr)

---

## 환경 메모

- 작업 폴더: `C:\projects\clipminer-web`
- **현재 폴더는 비어 있고 git 저장소로 초기화되어 있지 않음** (Phase 0 문서가 첫 산출물).
  → 사장님 측에서 원격 repo 연결/초기화 상태 확인 필요.

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
