# ClipMiner Web — 데이터 저장 설계 (DB)

> **저장 전략: Local-First.** MVP는 외부 DB를 사용하지 않는다.
> 영상 메타데이터·태그·메모·제작 상태는 브라우저 **IndexedDB(Dexie)** 에,
> 실제 영상 파일은 **사용자 PC의 지정 폴더**(File System Access)에 저장한다.
> 이 문서는 **실제 구현된 저장 구조**만 다룬다. 폐기된 Postgres/Supabase 설계는 §4에 기록으로만 남긴다.

구현 위치: `src/lib/db.ts`(스키마) · `src/lib/types.ts`(타입) · `src/lib/videos.ts` · `src/lib/tags.ts` · `src/lib/workspace.ts`.

---

## 1. 기본 원칙

- 저장소: 브라우저 **IndexedDB**, 접근 라이브러리는 **Dexie 4**. DB 이름 `clipminer`.
- 외부 DB / 서버 저장소 없음. 인증/세션 없음 (단일 로컬 사용자 전제).
- **영상 파일 본체/Blob/ObjectURL은 IndexedDB에 넣지 않는다.** 파일은 사용자가 지정한
  로컬 폴더에 저장하고, 메타 레코드는 파일명 등 참조만 보관한다.

---

## 2. Dexie 스토어 (object store)

현재 스키마 버전 **v6**. 3개 스토어: `videos` · `tags` · `settings`.

### 2.1 `videos` — 영상 메타데이터 (중심 스토어)

기본 키 `id`. 인덱스: `id, status, platform, updatedAt, createdAt, *tags`.

| 필드 | 타입 | 설명 | 도입 |
| --- | --- | --- | --- |
| `id` | string (uuid) | 기본 키 (`crypto.randomUUID()`) | v1 |
| `url` | string | 영상 원본 URL / 출처 | v1 |
| `platform` | string | URL로 추정한 플랫폼(youtube/douyin/xiaohongshu/tiktok/other) | v2 |
| `title` | string | 관리용 제목 (표시 우선순위: translatedTitle → originalTitle → title) | v1 |
| `originalTitle` | string? | 원본 제목 (플랫폼 원문, 예: 중국어) | v6 |
| `translatedTitle` | string? | 번역 제목 (한국어 관리용, titleTranslate) | v6 |
| `tags` | string[] | 태그 배열 (multi-entry 인덱스 `*tags`) | v1 |
| `note` | string | 사용자 메모 | v1 |
| `status` | string | 제작 상태 `idea` / `in_progress` / `done` | v1 |
| `isFavorite` | boolean | 즐겨찾기 (IndexedDB 인덱스 불가 → 비인덱스, 메모리 필터) | v3 |
| `localFileName` | string? | 작업 폴더에 저장된 파일명 | v4 |
| `localFileType` | string? | 파일 MIME (예: video/mp4) | v4 |
| `localFileSize` | number? | 파일 크기(bytes) | v4 |
| `createdAt` | number (epoch ms) | 생성 시각 | v1 |
| `updatedAt` | number (epoch ms) | 수정 시각 (목록 최신순 정렬 기준) | v1 |

### 2.2 `tags` — 태그 카탈로그 스토어

기본 키 `name`. 인덱스: `name, createdAt`. 필드: `{ name: string, createdAt: number }`.

- 영상에 부착된 태그 이름을 **별도 카탈로그로도 보장**한다(자동완성/빈도 집계 기반).
- `addVideo` / `updateVideo` 가 `ensureTags()` 로 부착 태그를 이 스토어에 upsert(기존 것은 유지).
- 영상↔태그는 정규화된 다대다 조인이 아니라, **videos.tags 배열(SSOT) + tags 이름 카탈로그**의 조합이다.

### 2.3 `settings` — 앱 설정 스토어

기본 키 `key`. 필드: `{ key: string, handle?: FileSystemDirectoryHandle, name?: string, content?: string }`.

- 작업 폴더 **디렉터리 핸들**을 구조화 복제로 영속(파일 본체는 저장하지 않음).
- 권한(readwrite)은 브라우저가 세션/오리진 단위로 관리하며, 재방문 시 재확인할 수 있다.

---

## 3. 영상 파일 저장 (로컬 폴더, File System Access)

- 실제 영상 파일은 사용자가 선택한 **작업 폴더**(FileSystemDirectoryHandle)에 저장한다.
- 저장/읽기/삭제: `saveFileToWorkspace` / `readFileFromWorkspace` / `deleteFileFromWorkspace` (`workspace.ts`).
- `videos.localFileName` 이 폴더 내 파일을 다시 찾기 위한 참조다.
- 정합성 정책:
  - 영상 삭제 시 `localFileName` 이 있으면 작업 폴더의 해당 파일도 삭제(확인창, best-effort).
  - 파일 삭제 실패(폴더 미연결/권한 없음/미존재)해도 DB 레코드 삭제는 진행한다.
  - 삭제는 경로 구분자 없는 단일 파일명만 허용(작업 폴더 밖/폴더 통째 삭제 금지).

---

## 4. 스키마 버전 / 마이그레이션 요약 (`db.ts`)

| 버전 | 변경 | 마이그레이션 |
| --- | --- | --- |
| v1 | `videos`(id, status, updatedAt, createdAt, *tags) · `tags`(name, createdAt) | — |
| v2 | `videos.platform` 인덱스 추가 | 기존 레코드 URL→platform 백필 |
| v3 | `videos.isFavorite` 추가(비인덱스) | 기존 레코드 false 백필 |
| v4 | `localFileName/Type/Size` 추가(비인덱스) | 없음(버전 표식) |
| v5 | `settings` 스토어(key PK) 추가 | 없음 |
| v6 | `originalTitle/translatedTitle` 추가(비인덱스) | 없음(버전 표식) |

---

## 5. 폐기된 설계 (Superseded, 기록 보존)

> 아래는 Phase 0의 서버 DB(Postgres/Supabase) 설계로, Local-First 전환으로 **MVP에서 폐기**.
> 향후 Backup/Sync 검토 시 참고용으로만 남긴다.

- **저장소:** clipminer-web 전용 독립 Supabase(Postgres) 프로젝트.
- **테이블 `videos`** (Postgres): `id uuid PK`, `user_id text`, `title text`, `url text`,
  `tags text[]`, `note text`, `created_at timestamptz`, `updated_at timestamptz`.
  인덱스: `user_id`, `tags` GIN, `(user_id, created_at desc)`.
- **접근 규칙:** service-role 키 + 서버 세션에서 도출한 `user_id` 수동 스코프, RLS 미사용.
- **미채택:** `auth.users`/RLS, 크로스 프로젝트 FK, `profiles` 테이블.

---

## 6. 향후 확장 후보 (참고, MVP 아님)

- 선택적 클라우드 Backup/Sync (이 시점에 외부 DB/인증 재도입 검토)
- 영상 메타데이터 enrich (제공자/썸네일/duration)
- 태그 자동완성 / 사용 빈도 집계 (tags 카탈로그 활용)
- 컬렉션/폴더 개념
