@echo off
: 'main'
choice /N /C:123 /M "1: Start, 2: Stop, 3: Restart"%1
if ERRORLEVEL==3 pm2 restart sheetBot.js
if ERRORLEVEL==2 pm2 stop sheetBot.js
if ERRORLEVEL==1 pm2 start sheetBot.js