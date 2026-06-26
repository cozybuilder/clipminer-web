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
저장 전략은 **Local-First**(IndexedDB/Dexie + 로컬 폴더, §3)로 확정.
**Supabase / 인증 / DB 연결 / cm_session 은 MVP 범위에서 제외**한다.

> 단계 전환·기능 추가는 사장님 승인으로만 한다. 세부 진행 상태는 [docs/STATUS.md](docs/STATUS.md) 기준.

---

## 2. 제품 핵심

- `app_key = clipminer`, 정식 launch 대상은 **ClipMiner Web**. Desktop은 보조(다운로드 안내).
- 영상(`videos`) 중심, 태그는 사용자가 직접 부착(레코드의 배열 필드), 제목은 사용자 직접 입력.
- 배포: Vercel / 도메인 `clipminer.cozybuilder.co.kr` (서버는 앱만 서빙).

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
