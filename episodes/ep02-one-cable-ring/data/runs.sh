#!/bin/sh
# Episode 2's runs: vwire/runs.sh (scan of vwire:chain3, intact and with the cable cut after J1).
# Checks every number the subtitles state and writes ep02_data.js (incl. the SOEM lines on screen).
cd "$(dirname "$0")/.." && python3 data.py
