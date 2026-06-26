# CLAUDE.md — ClipMiner Web 작업 가이드

Claude Code가 이 저장소에서 작업할 때 따르는 지침.

---

## 0. 작업 폴더 확인 (필수, 매 작업 시작 시)

- 지정 Repository: **clipminer-web**
- 현재 작업 폴더가 지정 Repository와 다르면 **코드/문서 수정·명령 실행을 중단**하고
  `"작업 폴더가 잘못되었습니다"` 라고 보고한다.

---

## 1. 현재 단계

**Phase 1 완료 — Next.js 초기화 완료.** 다음 단계는 **Phase 2 Vercel 기본 배포 준비**.

진행 이력:
- Phase 0 ✅ 설계 문서 안착 (commit `9485137`)
- Phase 1 ✅ Next.js 16 + TypeScript + App Router + Tailwind v4 초기화 (commit `4f0355c`)
- Phase 1.5 ✅ 문서 정합화
- **다음 → Phase 2: Vercel 기본 배포 준비**

현재까지 구현 범위: 앱 골격(기본 페이지)만 존재.
**Supabase / 인증 / DB / cm_session / 수집 기능은 아직 미구현**이며, 별도 승인된 단계에서 진행한다.

> 단계 전환·기능 추가는 사장님 승인으로만 한다. 세부 진행 상태는 [docs/STATUS.md](docs/STATUS.md) 기준.

---

## 2. 제품 핵심

- `app_key = clipminer`, 정식 launch 대상은 **ClipMiner Web**. Desktop은 보조(다운로드 안내).
- 영상(`videos`) 중심, 태그는 `videos.tags text[]`, 제목은 사용자 직접 입력.
- 배포: Vercel / 도메인 `clipminer.cozybuilder.co.kr`.

자세한 결정은 [docs/DESIGN.md](docs/DESIGN.md) 참고.

---

## 3. 절대 규칙 (구현 단계에서도 유지)

1. **클라이언트가 보낸 `user_id`를 신뢰하지 않는다.** `user_id`는 서버가 `cm_session`에서만 도출한다.
2. 모든 사용자 데이터 쿼리는 **`user_id`로 스코프**한다. 스코프 누락 = 데이터 유출.
3. service-role 키는 **서버에서만** 사용한다. 클라이언트 노출 금지.
4. MVP에서는 Supabase native auth(`auth.uid()`) RLS를 사용하지 않는다 — 보호는 애플리케이션 코드 책임.
5. 크로스 프로젝트 FK를 만들지 않는다. `user_id`는 homepage `user.id` 참조값으로만 저장.

---

## 4. 문서 지도

| 문서 | 용도 |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | 설계 · 결정사항 A~H 매핑 |
| [docs/DB.md](docs/DB.md) | DB 스키마 설계 |
| [docs/STATUS.md](docs/STATUS.md) | 진행 상태 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 단계별 계획 |

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
