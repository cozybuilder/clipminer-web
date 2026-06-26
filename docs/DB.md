# ClipMiner Web — 데이터 저장 설계 (DB)

> **저장 전략: Local-First (2026-06-27).** MVP는 외부 DB를 사용하지 않는다.
> 영상 메타데이터·태그·메모·제작 상태는 브라우저 **IndexedDB(Dexie)** 에,
> 실제 영상 파일은 **사용자 PC의 지정 폴더**에 저장한다.
> 이전 Postgres/Supabase 스키마 설계는 §4에 폐기 기록으로만 남긴다.

---

## 1. 기본 원칙

- 저장소: 브라우저 **IndexedDB**, 접근 라이브러리는 **Dexie**.
- 외부 DB / 서버 저장소 없음. 인증/세션 없음 (단일 로컬 사용자 전제).
- **영상 파일 본체는 IndexedDB에 넣지 않는다.** 사용자가 지정한 로컬 폴더에 저장하고,
  메타 레코드는 그 파일에 대한 참조만 보관한다.

---

## 2. Dexie 스토어 (object store)

### 2.1 `videos`

영상 클립의 중심 스토어. (필드 구성은 구현 단계에서 확정되는 초안)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string (uuid) | 영상 식별자 (기본 키) |
| `title` | string | **사용자가 직접 입력한 제목** (자동 변환 없음) |
| `url` | string | 영상 원본 URL / 출처 |
| `tags` | string[] | 태그 배열 (사용자 직접 부착, 별도 스토어 없음) |
| `note` | string \| null | 사용자 메모 (선택) |
| `status` | string | 제작 상태 (예: 대기/진행/완료 — 값 집합은 구현 시 확정) |
| `fileRef` | object \| null | 로컬 폴더에 저장된 실제 파일 참조 (핸들/경로 등, 구현 시 확정) |
| `createdAt` | number (epoch ms) | 생성 시각 |
| `updatedAt` | number (epoch ms) | 수정 시각 |

#### 인덱스 (권장, Dexie 스키마 기준)
- `id` (primary key)
- `updatedAt` / `createdAt` — 최신순 목록 정렬용
- `*tags` (multi-entry 인덱스) — 태그 필터용
- `status` — 상태별 필터 시

> 위 필드/인덱스는 초안이며, 실제 Dexie 스키마 버전·마이그레이션은 구현 단계에서 확정한다.

---

## 3. 영상 파일 저장 (로컬 폴더)

- 실제 영상 파일은 사용자가 지정한 **로컬 폴더**에 저장한다.
- 폴더 지정/파일 읽기·쓰기 방식(예: File System Access API의 디렉터리 핸들 등)은
  구현 단계에서 확정한다.
- `videos.fileRef`는 이 폴더 내 파일을 다시 찾기 위한 참조를 담는다.
- 파일 본체와 메타데이터의 정합성(파일 삭제/이동 시 처리)은 구현 시 정책으로 정한다.

---

## 4. 폐기된 설계 (Superseded, 기록 보존)

> 아래는 Phase 0의 서버 DB(Postgres/Supabase) 설계로, Local-First 전환으로 **MVP에서 폐기**.
> 향후 Backup/Sync 기능 검토 시 참고용으로만 남긴다.

- **저장소:** clipminer-web 전용 독립 Supabase(Postgres) 프로젝트.
- **테이블 `videos`** (Postgres): `id uuid PK`, `user_id text`, `title text`, `url text`,
  `tags text[]`, `note text`, `created_at timestamptz`, `updated_at timestamptz`.
  인덱스: `user_id`, `tags` GIN, `(user_id, created_at desc)`.
- **접근 규칙:** service-role 키 + 서버 세션에서 도출한 `user_id` 수동 스코프,
  `auth.uid()` RLS 미사용, 클라이언트 `user_id` 금지.
- **미채택:** 정규화 `tags` 테이블, `auth.users`/RLS, 크로스 프로젝트 FK, `settings`/`profiles` 테이블.

---

## 5. 향후 확장 후보 (참고, MVP 아님)

- 선택적 클라우드 Backup/Sync (이 시점에 외부 DB/인증 재도입 검토)
- 영상 메타데이터 enrich (제공자/썸네일/duration)
- 태그 자동완성 / 사용 빈도 집계
- 컬렉션/폴더 개념
