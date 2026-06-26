# CLAUDE.md — ClipMiner Web 작업 가이드

Claude Code가 이 저장소에서 작업할 때 따르는 지침.

---

## 0. 작업 폴더 확인 (필수, 매 작업 시작 시)

- 지정 Repository: **clipminer-web**
- 현재 작업 폴더가 지정 Repository와 다르면 **코드/문서 수정·명령 실행을 중단**하고
  `"작업 폴더가 잘못되었습니다"` 라고 보고한다.

---

## 1. 현재 단계

**Phase 0 — 설계 문서 안착.** 앱은 아직 구현하지 않는다.

Phase 0 제약 (이 단계에서 금지):
- 앱 구현 금지
- Next.js 초기화 금지
- Supabase 마이그레이션 작성 금지
- 코드 작성 금지
- **문서만 작성**
- commit / push는 작성 완료 후 **보고하고 승인받은 뒤** 진행

> Phase 1로 넘어가면 위 금지는 해제된다. 단계 전환은 사장님 승인으로만 한다.

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

## 5. 환경

- OS: Windows / Shell: PowerShell (POSIX 스크립트는 Bash 도구)
- 작업 폴더: `C:\projects\clipminer-web`
