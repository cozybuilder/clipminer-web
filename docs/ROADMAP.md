# ClipMiner Web — 로드맵 (ROADMAP)

> 이 문서는 **단계별 계획**을 담당한다. 살아있는 현재 상태·세부 항목은 [STATUS.md](STATUS.md) 기준.

---

## 완료된 단계

### Phase 0 — 설계 문서 안착 ✅
- 결정사항 A~H 확정, 설계/DB/상태/로드맵/README/CLAUDE 작성.

### Phase 1 · 1.5 — Next.js 초기화 / 문서 정합화 ✅
- Next.js 16 + TypeScript + App Router + Tailwind v4 + ESLint, `src/` 구조.
- 기준 문서를 CLAUDE.md + docs/ 로 통일.

### 저장 전략 전환 — Local-First ✅
- 외부 DB 미사용. 메타데이터는 IndexedDB(Dexie), 영상 파일은 로컬 폴더.
- Supabase/Auth/`cm_session` 은 MVP 제외 → 폐기(superseded) 기록 보존.

### Phase 2 — Vercel 배포 준비 ✅ (실제 배포는 승인 후)
- lint/build 통과, 표준 Next.js 자동 감지, env 불필요(Local-First), 운영비 0원.

### Phase 3 — Local-First 데이터 계층 ✅
- Dexie DB(`videos`/`tags`), CRUD 유틸, 타입 정의. (이후 v6까지 확장)

### Phase 4 (~4-E) — Video Library UI ✅
- Desktop 보드형 UI, StatCard 필터, 9:16 카드 그리드, 카드/상세 모달.
- 플랫폼 배지, 즐겨찾기, 다중선택·일괄작업.

### Phase 5 — 로컬 파일 첨부 ✅
- 스키마 v4, mp4 첨부·미리보기, 세션 ObjectURL 재생.

### Phase 6 — 작업 폴더 (File System Access) ✅
- 스키마 v5 `settings` 스토어, 디렉터리 핸들 영속·권한 관리.

### Phase 7 — 서버 다운로드(yt-dlp/cookies) → 미채택 ⛔
- 일반 사용자 UX·운영비 부적합 → `reference/phase7-ytdlp/` 로 분리(커밋 제외).

### Phase 8 — Browser Connector 수집 + 자동 등록 ✅
- 브라우저 확장(온페이지 추출) → `/download` 작업 폴더 저장 + IndexedDB 자동 등록.
- 소비자 원클릭 UX(`/download`), 확장 설치 가이드 + 배포 ZIP, Douyin 로그인 안내.
- 상세 UX: 미리보기 컨트롤 정리, "다운로드 관리" 카드, 저장 위치 안내.
- 삭제 시 로컬 파일 동반 삭제(확인창), 영상 ID(aweme_id/modal_id) 기준 중복 판정.
- 스키마 v6 제목 이중화, 추천 태그 한/중, CozyBuilder 공통 C 탭 아이콘.

---

## 다음 작업 (미완료)

- **배포:** (승인 후) Vercel 프로젝트 연결·첫 배포, 도메인 `clipminer.cozybuilder.co.kr` 연결(DNS 별도).
- **수집 신뢰성:** 백그라운드 탭 추출 안정화(로그인/지연 로드/페이지 구조 대응), Xiaohongshu 수집 확장.
- **확장 배포:** Chrome Web Store 등록 여부 검토(현재는 압축해제 로드).
- **편집/관리:** 영상 편집 UI 보강, 작업 폴더 파일 자동 매칭 고도화.

## 이후 — 확장 후보 (미확정)

> 우선순위 미정. 필요해질 때 재논의.

- JSON Import/Export (백업 파일)
- Backup / Sync — 선택적 클라우드 동기화 (이 시점에 외부 DB/인증 재검토)
- 태그 자동완성 / 사용 빈도 집계 (tags 카탈로그 활용), 컬렉션/폴더 개념
