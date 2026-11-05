@echo off
chcp 65001 > nul
title 고양이 스티커 다이어리 웹앱 실행기
echo ========================================================
echo   🐾 고양이 스티커 다이어리 (Cat Sticker Diary) 
echo ========================================================
echo   브라우저 웹서버를 실행하고 웹앱을 엽니다...
echo   종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8088
pause
