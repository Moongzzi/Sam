# 샘 운영 시스템 MVP

## 1. 프로젝트 분석 결과

현재 폴더는 빈 상태였기 때문에 신규 React + TypeScript + Supabase 구조로 제작했습니다. 모바일 참가자와 현장 운영자 사용성을 우선해 첫 화면은 `샘 운영자 메뉴`, `샘 참가자 메뉴` 두 가지로 나뉩니다.

## 2. 필요한 데이터 모델

- `stores`: 3개 매장 정보
- `themes`: 매장별 테마와 기본 플레이/정리 시간
- `sam_events`: 샘 운영 회차
- `teams`: 사전 등록된 A-I팀
- `theme_runs`: 팀별 테마 입장/퇴장 기록
- `team_route_plans`: 팀별 추천/확정 이동 순서
- `operator_logs`: 운영자 수정 로그

## 3. DB 설계

모든 주요 테이블은 `id`, `created_at`, `updated_at`을 포함합니다. 참가자 화면은 읽기 중심, 운영자 화면은 `theme_runs` 수정 중심으로 설계했습니다.

## 4. SQL Migration

Supabase SQL Editor에서 `supabase/migrations/001_initial_sam_schema.sql`을 실행하면 됩니다.

## 5. RLS 정책

MVP는 참가자 현황 조회를 위해 주요 테이블의 `select`를 `anon`에 공개합니다. 운영자 코드는 프론트 진입 제어 용도이며, 실제 쓰기 권한은 추후 Supabase Auth + 운영자 role 정책으로 전환해야 합니다.

## 6. API 설계

현재 진행 현황 조회:

```txt
GET /rest/v1/theme_runs?select=*,teams(*),themes(*,stores(*))&event_id=eq.{event_id}
인증: 불필요
관련 테이블: theme_runs, teams, themes, stores
```

팀별 다음 테마 조회:

```txt
GET /rest/v1/team_route_plans?select=*,themes(*,stores(*))&event_id=eq.{event_id}&team_id=eq.{team_id}&order=route_order.asc
인증: 불필요
관련 테이블: team_route_plans, themes, stores
```

입장/퇴장 기록 수정:

```txt
PATCH /rest/v1/theme_runs?id=eq.{run_id}
인증: 운영자 필요
관련 테이블: theme_runs
```

## 7. 수정 또는 생성 파일 목록

- `src/app/App.tsx`
- `src/entities/types.ts`
- `src/entities/samApi.ts`
- `src/features/recommendations.ts`
- `src/data/mockData.ts`
- `src/lib/supabase.ts`
- `src/styles.css`
- `supabase/migrations/001_initial_sam_schema.sql`
- `.env.example`

## 8. React 연동 코드

Supabase 환경 변수가 없으면 mock 데이터로 동작합니다. 실제 연동 시 `.env`에 아래 값을 넣습니다.

```txt
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

운영자 코드는 현재 `src/app/App.tsx`의 `OPERATOR_CODE = "0724"`입니다.

## 9. 테스트 방법

```bash
npm install
npm run dev
npm run build
```

확인 항목:

- 메인에서 운영자/참가자 메뉴 이동
- 운영자 코드 `0724` 입력 성공
- 잘못된 운영자 코드 입력 시 에러 표시
- 참가자 화면에서 A-I팀 선택
- 선택 팀의 다음 추천 테마 표시
- 전체 테마의 입장 중/비어 있음 상태 표시
- 운영자 화면에서 입장/퇴장 버튼 동작

## 10. 추가 확인 필요 사항

- 실제 매장명과 테마명
- 테마별 정확한 기본 플레이 시간
- 샘 당일 시작 시간과 팀별 첫 배정표
- 운영자 수정 권한을 Supabase Auth로 전환할 시점
- 자동 최적화 기준에 이동 거리, 난이도 균형, 팀 선호도를 포함할지 여부
