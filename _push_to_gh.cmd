@echo off
cd /d "%~dp0"
echo === NB REBA GitHub Push ===
echo.

if exist .git rmdir /s /q .git

git init -b main
if errorlevel 1 goto :err

git add .
if errorlevel 1 goto :err

git -c user.email="kanghg61@gmail.com" -c user.name="kanghg61-del" commit -m "init"
if errorlevel 1 goto :err

git remote add origin https://github.com/kanghg61-del/nb-rebalance.git

echo.
echo === Pushing (browser login may appear) ===
git push -u origin main --force
if errorlevel 1 goto :err

echo.
echo *** DONE! https://github.com/kanghg61-del/nb-rebalance
pause
exit /b 0

:err
echo.
echo *** ERROR - check message above ***
pause
exit /b 1
