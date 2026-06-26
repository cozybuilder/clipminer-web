# ClipMiner Web — 설계 문서 (DESIGN)

> Phase 0 설계 안착본. 이 문서는 구현 이전의 **결정 기록**이며, 코드와 충돌할 경우
> 코드를 우선하되 문서를 갱신한다.

---

## 1. 제품 개요

ClipMiner Web은 사용자가 영상 클립을 모아 직접 제목과 태그를 붙여 정리하는 웹 앱이다.

- **제품 구분 (`app_key`):** `clipminer`
- **정식 launch 대상:** ClipMiner Web
- **ClipMiner Desktop:** 보조 제품으로만 유지하며, 웹에서 다운로드 안내 링크로만 노출한다.
  (별도 기능 동기화/연동은 MVP 범위 밖)

---

## 2. 신원 · 세션 · 접근 제어 (결정 A)

### 2.1 세션 모델
- 사용자는 homepage `/apps/clipminer` 진입 흐름을 통해 ClipMiner Web에 들어온다.
- 진입 시 **`cm_session` 쿠키**가 발급된다.
- 서버는 이 쿠키로 사용자를 식별하고, 모든 데이터 접근에 사용할 `user_id`를 도출한다.

### 2.2 데이터 접근 방식
- 서버는 Supabase에 **service-role 키**로 접근한다.
- `user_id`는 **서버가 세션에서 도출하여 수동으로 쿼리에 스코프**한다.
  (예: 모든 `videos` 조회/변경 시 `where user_id = :session_user_id`)
- **MVP에서는 Supabase native auth `auth.uid()` 기반 RLS를 사용하지 않는다.**

### 2.3 보안 규칙 (필수)
- **클라이언트가 전송한 `user_id`는 절대 신뢰하지 않는다.** 항상 서버 세션값을 사용한다.
- service-role 키는 서버 환경에서만 사용하며 클라이언트에 노출하지 않는다.
- 사용자 데이터 접근 경로마다 `user_id` 스코프 누락이 없는지 코드 리뷰에서 점검한다.

### 2.4 세션 수명 (결정 G)
- `cm_session` TTL = **7일**
- 만료 시 사용자에게 homepage `/apps/clipminer` 재진입을 안내한다.

> **위험 메모:** RLS 미사용으로 인해 `user_id` 스코프가 애플리케이션 코드에 전적으로 의존한다.
> 스코프 누락 = 데이터 유출이므로, Phase 1에서 공통 데이터 접근 레이어(헬퍼)로
> 스코프를 강제하는 설계를 권장한다.

---

## 3. Supabase 구성 (결정 B)

- ClipMiner Web은 **독립 Supabase 프로젝트**를 사용한다. (homepage와 분리)
- `user_id`는 **homepage `user.id`의 참조값**으로 저장한다. (homepage 사용자 식별자를 그대로 보관)
- **크로스 프로젝트 FK는 두지 않는다.** `user_id`는 단순 값으로 저장하며,
  외래 키 제약 없이 애플리케이션 레벨에서만 일관성을 관리한다.

---

## 4. 데이터 모델 개요

상세 스키마는 [DB.md](DB.md) 참고. 핵심 요약:

- 중심 엔터티는 **`videos`**.
- **태그는 `videos.tags text[]` 컬럼에 저장** (결정 C). MVP에서는 별도 `tags` 테이블을 두지 않는다.
- **제목은 사용자가 직접 입력** (결정 D). 자동 변환/추출 로직은 MVP 제외.

---

## 5. 화면 / UX 범위

### 5.1 포함 (MVP)
- 진입(세션 확인) → 영상 목록
- 영상 등록: URL/식별 정보 + **사용자 직접 제목 입력** + 태그 입력
- 영상 목록 조회 / 단건 조회 / 삭제
- 태그로 필터(기본 수준)

### 5.2 제외 (결정 F)
- 별도 Settings / Profile 화면은 만들지 않는다.
- 필요 시 상단에 **homepage로 돌아가기 링크**만 제공한다.

---

## 6. 배포 (결정 H)

- **도메인:** https://clipminer.cozybuilder.co.kr
- **호스팅:** Vercel
- 서버 환경변수로 Supabase URL / service-role 키 / 세션 비밀값을 주입한다.
  (구체적 키 목록은 Phase 1 착수 시 확정)

---

## 7. 결정사항 매핑 (A~H)

| 결정 | 내용 | 반영 위치 |
| --- | --- | --- |
| A | cm_session 쿠키 + service-role + user_id 수동 스코프, native RLS 미사용, 클라 user_id 금지 | §2 |
| B | 독립 Supabase 프로젝트, user_id는 homepage user.id 참조값, 크로스 FK 없음 | §3 |
| C | `videos.tags text[]` 사용, tags 테이블 미사용 | §4, DB.md |
| D | 제목 자동 변환 제외, 사용자 직접 입력 | §4, §5.1 |
| E | `app_key = clipminer`, Web 정식 launch, Desktop 보조 | §1 |
| F | 별도 Settings 생략, homepage 링크만 | §5.2 |
| G | cm_session TTL 7일, 만료 시 재진입 안내 | §2.4 |
| H | clipminer.cozybuilder.co.kr, Vercel 배포 | §6 |

---

## 8. 명시적 비목표 (Non-goals, MVP)

- Supabase native auth / `auth.uid()` RLS
- 제목 자동 생성/변환
- 정규화된 `tags` 테이블 및 다대다 관계
- 크로스 프로젝트 외래 키
- 독립 Settings/Profile 기능
- Desktop ↔ Web 데이터 동기화
