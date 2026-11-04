@echo off
REM Runs every check for Yooper Trivia. Needs Node.js (nodejs.org) and Playwright.
REM Pass means every line in CHECK RESULTS.txt says FAIL=0.
cd /d "%~dp0"
node "tests\check_all.js"
start "" notepad "CHECK RESULTS.txt"
pause
