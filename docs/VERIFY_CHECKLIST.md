# v18 검증 체크리스트

## 로컬 실행
```
cd reba-nextjs-full
npm install
npm run dev
```
브라우저 → http://localhost:3000/login → 비번 `NB`

## 환경변수 (.env.local)
```
GITHUB_TOKEN=ghp_xxx                     # 승인 저장 · 실측 반영 · CSV 업로드
GITHUB_REPO=kanghg61-del/nb-rebalance   # 실 리포지토리
GEMINI_API_KEY=AI...                     # AI 채팅
REBA_PASSWORD=NB                        # 로그인 (기본 spao)
```

## 헬스체크
- `/api/health/gh` → { env: { GITHUB_TOKEN: '✓', GEMINI_API_KEY: '✓' }, github.user }

## 탭별 실 검증
- 🗳️ 오늘의 결재: 승인 후 execution_log id 배지 갱신, 3버튼 다운로드
- 🛡️ 재배치(기본): 이동수량 셀 클릭 → 편집 → Enter 저장 → 이동 후 재고 실시간 재계산
- 🎛️ 재배치(임의): 5 슬라이더 · 재계산 · 매트릭스
- 📈 실행 효과: 실제효과·추가판매·메모 셀 편집 → 저장 → GH 갱신, 매출 자료 CSV 업로드 → 실측 자동 반영
- 🧩 추가 분배: 6 KPI · 진단 · 핵심 10 · 전체 리스트 필터 3종
- 🚨 리오더 요청: 채널별 4 KPI · 우선 검토 10 · 선택 스타일 요청서 xlsx
- 🏬 통합 재고뷰: 3 KPI + 채널 표 + 외부창고 세부 표
- 📊 채널별 세부: 4 서브탭 · StyleImg · sojin
- 🚫 채널 IN-OUT: 3채널 카드 · 방향 필터 · 대량 추가 · 인라인 편집 · GitHub 저장
- 🤖 AI 요약: hero + brief 자동 생성 + TOP10 이미지 표 + 챗봇 (LLM fallback debug caption)

## 모바일 검증
- @media (max-width: 768px) 반응형 CSS 활성 확인
- iPhone Safari · Android Chrome 실기기 테스트

## 브라우저 렌더링
- 로컬 실행 후 각 탭 스크린샷 → Streamlit과 나란히 비교
