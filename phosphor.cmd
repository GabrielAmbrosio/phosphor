@echo off
rem PHOSPHOR launcher. No arguments opens PowerShell; with arguments it runs that command (e.g. phosphor.cmd claude).
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" . %*
