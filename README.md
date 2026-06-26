# ClipMiner Web

영상 클립을 모으고, 직접 제목과 태그를 붙여 정리하는 웹 애플리케이션.

> **상태:** Phase 1 완료 — Next.js 앱 골격 초기화 완료.
> **저장 전략은 Local-First**(브라우저 IndexedDB + 로컬 폴더). MVP는 외부 DB·인증·세션을 쓰지 않는다.
> 다음 단계는 Phase 2 Vercel 기본 배포.

---

## 한눈에 보기

| 항목 | 값 |
| --- | --- |
| 제품 구분 (`app_key`) | `clipminer` |
| 정식 launch 대상 | **ClipMiner Web** |
| 보조 제품 | ClipMiner Desktop (다운로드 안내로만 유지) |
| 프레임워크 | Next.js 16.2.9 (App Router, `src/` 구조) |
| 언어 | TypeScript 5 / React 19.2.4 |
| 스타일 | Tailwind CSS v4 |
| 데이터 저장 | **Local-First** — 메타데이터는 IndexedDB(Dexie), 영상 파일은 사용자 PC 지정 폴더 |
| 외부 DB / 인증 | 없음 (MVP 제외) |
| 배포 | Vercel (앱만 서빙, 사용자 데이터 비보관) |
| 도메인 | https://clipminer.cozybuilder.co.kr |

---

## 시작하기

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:3000)
npm run lint     # ESLint 검사
npm run build    # 프로덕션 빌드
```

> Local-First 구조라 MVP에 외부 DB/비밀키가 필요 없다. 환경변수(`.env*`)는 저장소에 커밋하지 않는다.

## 프로젝트 구조

```
clipminer-web/
├─ src/
│  └─ app/                # App Router
│     ├─ layout.tsx       # 루트 레이아웃 / 메타데이터
│     ├─ page.tsx         # 홈 (현재 골격 페이지)
│     └─ globals.css      # 전역 스타일 (Tailwind v4)
├─ public/                # 정적 자산
├─ docs/                  # 설계 · DB · 상태 · 로드맵 문서
├─ CLAUDE.md              # 에이전트 작업 가이드
├─ eslint.config.mjs      # ESLint (flat config, eslint-config-next)
├─ next.config.ts
├─ tsconfig.json
└─ package.json
```

## 현재 구현 상태

- ✅ Next.js 앱 골격 / 기본 홈 페이지
- ⬜ IndexedDB(Dexie) 메타데이터 저장 (미구현)
- ⬜ 로컬 폴더 영상 파일 저장 (미구현)
- ⬜ 영상 등록·목록·태그·메모·제작 상태 기능 (미구현)
- ⛔ 외부 DB / 인증 / 세션 — MVP 제외

---

## 핵심 개념 (Local-First)

- **데이터 위치:** 영상 메타데이터·태그·메모·제작 상태는 브라우저 **IndexedDB(Dexie)** 에,
  실제 영상 파일은 **사용자 PC의 지정 폴더**에 저장한다.
- **서버 역할:** 서버는 앱만 제공하고 사용자 데이터를 보관하지 않는다.
- **인증 없음:** MVP는 로그인/세션 없이 단일 로컬 사용자로 동작한다.
- **데이터 모델:** 영상을 중심으로, 태그는 레코드의 배열 필드로 저장한다.
- **제목:** 자동 변환 없이 사용자가 직접 입력한다.
- **동기화:** 멀티 기기 동기화는 MVP에 없으며, Backup/Sync는 이후 선택적 기능으로 검토한다.

---

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | 시스템 설계 · Local-First 저장 전략 · 아키텍처 결정 |
| [docs/DB.md](docs/DB.md) | 데이터 저장 설계 (IndexedDB/Dexie 스토어 · 로컬 파일) |
| [docs/STATUS.md](docs/STATUS.md) | 현재 진행 상태 · 완료/미완료 항목 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 0~1.5 완료 · Phase 2(Vercel)~ 이후 계획 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 작업 가이드라인 · 제약 |

---

## MVP 범위 (요약)

**포함**
- 로컬 폴더 지정 (영상 파일 저장 위치)
- 영상 등록 (URL/출처 + 사용자 직접 제목 + 태그 + 메모 + 제작 상태)
- 메타데이터를 IndexedDB(Dexie)에 저장
- 영상 목록/조회/수정/삭제, 태그 필터(기본)

**제외**
- 외부 DB(Supabase 등) / 인증 / 세션(`cm_session`)
- 서버 측 사용자 데이터 보관 / RLS
- 제목 자동 변환
- 멀티 기기 동기화 (이후 선택적 Backup/Sync로 검토)
- 별도 Settings/Profile 화면

자세한 범위는 [docs/DESIGN.md](docs/DESIGN.md) 및 [docs/ROADMAP.md](docs/ROADMAP.md) 참고.
