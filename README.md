# ClipMiner Web

영상 레퍼런스를 모아 제목·태그·메모·제작 상태로 정리하는 **콘텐츠 리서치·관리 플랫폼**.
(단순 "다운로드 도구"가 아니라, 적법한 범위에서 콘텐츠를 수집·분석·관리·재창작하기 위한 도구다 — [콘텐츠 이용 원칙](#콘텐츠-이용-원칙-저작권이용-정책) 참고.)

> **상태:** Phase 8 — ClipMiner Connector(브라우저 확장)로 Douyin 수집 → 라이브러리 자동 등록.
> **저장 전략은 Local-First**(브라우저 IndexedDB + 로컬 폴더). 외부 DB·인증·세션·서버 다운로드 없음.

---

## 한눈에 보기

| 항목 | 값 |
| --- | --- |
| 제품 구분 (`app_key`) | `clipminer` |
| 정식 launch 대상 | **ClipMiner Web** |
| 핵심 대상 플랫폼 | **Douyin(1순위) · Xiaohongshu(2순위)** / YouTube(보조) |
| 콘텐츠 수집 | **ClipMiner Connector 브라우저 확장**에서 실행 → 작업 폴더 저장 + 라이브러리 자동 등록. (Web에 다운로드 버튼/서버 없음. cookies.txt·yt-dlp 방식 미채택) |
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

## 배포 (Vercel)

> **상태:** Phase 2 — 배포 준비 완료(코드/설정 점검 통과). 실제 Vercel 연결·배포는 사장 승인 후 진행.

표준 Next.js 16 프로젝트이므로 Vercel이 프레임워크를 자동 감지한다. **MVP는 Local-First라
서버 환경변수/비밀키가 필요 없다.**

### Vercel 프로젝트 설정값
| 항목 | 값 |
| --- | --- |
| Framework Preset | Next.js (자동 감지) |
| Root Directory | `./` (저장소 루트) |
| Build Command | `next build` (기본값, 비워두면 자동) |
| Install Command | `npm install` (기본값, `package-lock.json` 존재) |
| Output | Next.js 프리셋 (수동 설정 불필요) |
| Production Branch | `main` |
| Environment Variables | **없음** (외부 DB/인증 미사용) |
| Node.js Version | 기본값(20.x/22.x) 사용 가능 — 별도 고정 불필요 |

### 전제 조건 / 후속(이번 범위 밖)
- 도메인 `clipminer.cozybuilder.co.kr` 연결은 첫 배포 이후 Vercel Domains에서 설정.
- DNS(Cloudflare 등) 변경은 본 단계 범위 밖 — 별도 승인/작업으로 진행.
- `.env*` / `.vercel` 은 커밋하지 않는다(`.gitignore` 처리됨).

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

---

## 콘텐츠 이용 원칙 (저작권·이용 정책)

ClipMiner는 다운로드 자체를 목적으로 하는 불법 복제 도구가 아니라, **적법한 범위 내에서
콘텐츠를 수집·분석·관리·재창작하기 위한 리서치·관리 플랫폼**이다.

1. ClipMiner는 사용자가 **적법한 권한을 가진 콘텐츠**, 또는 분석·연구 목적으로 수집한 자료를
   관리하기 위한 도구이다.
2. 사용자는 각 플랫폼(YouTube, Douyin, Xiaohongshu, TikTok 등)의 **이용약관과 관련 법률을
   준수**해야 한다.
3. 원본 영상의 **무단 재배포·재업로드·저작권 침해 행위는 지원하거나 권장하지 않는다.**
4. ClipMiner의 주된 목적:
   - 쇼핑 트렌드 분석
   - 마케팅 리서치
   - 태그/제목 관리
   - 편집 스타일 연구
   - 레퍼런스 수집
   - 새로운 콘텐츠 제작을 위한 참고 자료 정리
5. 사용자가 수행한 **다운로드 및 활용에 대한 법적 책임은 사용자 본인**에게 있다.
6. 제품 소개 문구에서는 "다운로드 도구"보다 **"콘텐츠 리서치·관리 플랫폼"** 표현을 우선 사용한다.

> 이 원칙은 향후 다운로드 기능 설계의 기준 정책이며, 공개 전 이용약관/정책 페이지에도 반영한다.
