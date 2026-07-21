# REBA Next.js Full - 뉴발란스 온라인 재고관리 Agent

**Streamlit REBA (nb-rebal.streamlit.app) → Next.js 15 전체 이식 프로젝트**

## 상태
- **Phase 1** ✅ 완료 (UI shell · 10탭 레이아웃 · 로그인)
- **Phase 2** ⏳ 진행 중 (통합 재고뷰만 DaaS 실 연동 · 나머지 9탭 placeholder)
- **Phase 3** ⏳ 예정 (재배치 엔진 · LLM · CSV 파이프라인 · GitHub API)

## 스택
- Next.js 15 · React 19 · TypeScript · Node LTS · npm 단일
- pg (PostgreSQL) · DaaS 연결

## 보안 (N-003 fail-closed)
- 로그인 필수 (비밀번호 `spao` · 8시간 세션 쿠키)
- httpOnly 쿠키 · secure (production) · sameSite lax
- DB 자격증명 env 전용 (하드코딩 절대 금지)

## 로컬 실행
```bash
cp .env.example .env.local  # 편집 후 실키 입력
npm install
npm run dev                 # http://localhost:3000
```

## NoA Vibe 배포 환경변수
| Key | Value |
|---|---|
| NEXT_PUBLIC_APP_NAME | 온라인 재고관리 Agent |
| NEXT_PUBLIC_APP_VERSION | 0.1.0 |
| NEXT_PUBLIC_APP_STAGE | v0.9 |
| APP_PASSWORD | spao |
| DAAS_DB_HOST | noa-vibe-prd-dw-rds.cxyq8eokin4g.ap-northeast-2.rds.amazonaws.com |
| DAAS_DB_PORT | 5432 |
| DAAS_DB_NAME | postgres |
| DAAS_DB_USER | (사용자ID) |
| DAAS_DB_PASSWORD | (비밀번호) |
| DAAS_DB_SSL | true |

## 격리 원칙
이 프로젝트는 **기존 Streamlit REBA와 완전 분리** 되어 있습니다.
- Streamlit 소스: github.com/kanghg61-del/nb-rebalance (**손대지 않음**)
- Streamlit 배포: nb-rebal.streamlit.app (**계속 운영**)
- 이 프로젝트: reba-nextjs-full (신규 · 독립)
