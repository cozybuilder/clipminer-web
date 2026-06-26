# ClipMiner Web

영상 클립을 모으고, 직접 제목과 태그를 붙여 정리하는 웹 애플리케이션.

> **상태:** Phase 0 — 설계 문서 안착 단계 (앱 미구현)

---

## 한눈에 보기

| 항목 | 값 |
| --- | --- |
| 제품 구분 (`app_key`) | `clipminer` |
| 정식 launch 대상 | **ClipMiner Web** |
| 보조 제품 | ClipMiner Desktop (다운로드 안내로만 유지) |
| 프레임워크 | Next.js (예정, Phase 1에서 초기화) |
| 데이터베이스 | Supabase (clipminer-web 전용 독립 프로젝트) |
| 배포 | Vercel |
| 도메인 | https://clipminer.cozybuilder.co.kr |

---

## 핵심 개념

- **로그인/세션:** homepage `/apps/clipminer` 진입 시 발급되는 `cm_session` 쿠키 기반.
  Supabase native auth(`auth.uid()`)는 MVP에서 사용하지 않는다.
- **사용자 스코프:** 서버에서 service-role 키로 Supabase에 접근하고, `user_id`를
  서버가 세션에서 도출하여 수동으로 스코프한다. 클라이언트가 보낸 `user_id`는 신뢰하지 않는다.
- **데이터 모델:** 영상(`videos`)을 중심으로, 태그는 `videos.tags text[]` 컬럼에 저장한다.
- **제목:** 자동 변환 없이 사용자가 직접 입력한다.

---

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | 시스템 설계 · 신원/세션/RLS · 아키텍처 결정 |
| [docs/DB.md](docs/DB.md) | 데이터베이스 스키마 설계 (테이블/컬럼/인덱스) |
| [docs/STATUS.md](docs/STATUS.md) | 현재 진행 상태 · 완료/미완료 항목 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 0 → 1 → 이후 단계 계획 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 작업 가이드라인 · 제약 |

---

## MVP 범위 (요약)

**포함**
- `cm_session` 쿠키 기반 진입
- 영상 등록 (URL/메타 + 사용자 직접 제목 입력)
- 태그 부착 (`text[]`)
- 영상 목록/조회/삭제

**제외**
- Supabase native auth RLS
- 제목 자동 변환
- 별도 `tags` 테이블
- 별도 Settings/Profile 화면
- 크로스 프로젝트 FK

자세한 범위는 [docs/DESIGN.md](docs/DESIGN.md) 및 [docs/ROADMAP.md](docs/ROADMAP.md) 참고.
