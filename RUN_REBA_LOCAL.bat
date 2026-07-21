@echo off
chcp 65001 > nul
title REBA Next.js Full - Local Dev Server
cd /d "%~dp0reba-nextjs-full"
echo ================================================
echo   REBA Next.js Full - Local Development Server
echo ================================================
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js가 설치되지 않았습니다. https://nodejs.org
    pause & exit /b 1
)
echo [INFO] Node.js: & node --version
if not exist "node_modules\next" (
    echo [INFO] 첫 실행 - 의존성 설치 중 (3~5분 소요)...
    call npm install --no-audit --no-fund
)
if not exist ".env.local" (
    echo [WARN] .env.local 없음 - 생성 필요
    echo NEXT_PUBLIC_APP_NAME=온라인 재고관리 Agent > .env.local
    echo NEXT_PUBLIC_APP_VERSION=0.1.0 >> .env.local
    echo NEXT_PUBLIC_APP_STAGE=v0.9 >> .env.local
    echo APP_PASSWORD=spao >> .env.local
    echo DAAS_DB_HOST=noa-vibe-prd-dw-rds.cxyq8eokin4g.ap-northeast-2.rds.amazonaws.com >> .env.local
    echo DAAS_DB_PORT=5432 >> .env.local
    echo DAAS_DB_NAME=postgres >> .env.local
    echo DAAS_DB_USER=kang_hoonkoo >> .env.local
    echo DAAS_DB_PASSWORD=KANG_HOONKOO1! >> .env.local
    echo DAAS_DB_SSL=true >> .env.local
    echo [INFO] .env.local 생성 완료
)
echo [INFO] 개발 서버 시작 - http://localhost:3000 (로그인: spao)
call npm run dev
pause
