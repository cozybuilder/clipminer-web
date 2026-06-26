# ClipMiner Web — 데이터베이스 설계 (DB)

> Phase 0 설계 안착본. **마이그레이션/실제 스키마는 아직 작성하지 않는다.**
> 이 문서는 Phase 1 마이그레이션 작성 시의 기준이 된다.

---

## 1. 기본 원칙

- 데이터베이스: **clipminer-web 전용 독립 Supabase 프로젝트** (결정 B)
- 접근: 서버에서 **service-role 키**로 접근, `user_id`는 서버 세션에서 도출하여 수동 스코프 (결정 A)
- **Supabase native auth / RLS(`auth.uid()`)는 MVP에서 사용하지 않는다.**
- `user_id`는 **homepage `user.id`의 참조값**으로 저장하며, **크로스 프로젝트 FK는 두지 않는다.**

---

## 2. 테이블

### 2.1 `videos`

영상 클립의 중심 테이블.

| 컬럼 | 타입 | 제약 / 기본값 | 설명 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | 영상 식별자 |
| `user_id` | `text` | NOT NULL, 인덱스 | homepage `user.id` 참조값 (FK 아님) |
| `title` | `text` | NOT NULL | **사용자가 직접 입력한 제목** (자동 변환 없음, 결정 D) |
| `url` | `text` | NOT NULL | 영상 원본 URL |
| `tags` | `text[]` | NOT NULL, default `'{}'` | 태그 배열 (결정 C, 별도 tags 테이블 없음) |
| `note` | `text` | NULL 허용 | 사용자 메모 (선택) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | 생성 시각 |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | 수정 시각 |

> `url` 외에 영상 제공자/썸네일/길이 등 메타 컬럼은 Phase 1 구현 시 필요 범위에서 확정한다.
> MVP에서는 최소 컬럼으로 시작한다.

#### 인덱스 (권장)
- `user_id` 단일 인덱스 — 사용자별 목록 조회 핵심 경로.
- `tags` GIN 인덱스 — 태그 필터(`tags @> ...`, `tags && ...`)를 쓸 경우.
- `(user_id, created_at desc)` 복합 인덱스 — 최신순 목록 정렬 시 고려.

---

## 3. 미채택 항목 (MVP 제외)

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| `tags` 테이블 (정규화) | 미사용 (C) | `videos.tags text[]`로 충분, 복잡도 절감 |
| `auth.users` / RLS | 미사용 (A) | service-role + 수동 스코프 사용 |
| 크로스 프로젝트 FK | 미사용 (B) | 독립 프로젝트, `user_id`는 참조값으로만 보관 |
| `settings` / `profiles` 테이블 | 미사용 (F) | 별도 Settings 화면 없음 |

---

## 4. 데이터 접근 규칙 (구현 시 강제)

1. 모든 `videos` 쿼리는 **반드시 `user_id = <세션 user_id>`로 스코프**한다.
2. `user_id`는 **클라이언트 입력에서 받지 않는다.** 서버 세션(`cm_session`)에서만 도출한다.
3. service-role 키는 서버에서만 사용한다.
4. 스코프 누락을 막기 위해 공통 데이터 접근 헬퍼를 두는 것을 권장한다. (DESIGN.md §2.3 위험 메모)

---

## 5. 향후 확장 후보 (참고, MVP 아님)

- 영상 메타데이터 enrich (제공자, 썸네일, duration 등)
- 태그 사용 빈도 집계 / 자동완성 → 필요해지면 `tags` 정규화 재검토
- 컬렉션/폴더 개념
- 공유/공개 링크
