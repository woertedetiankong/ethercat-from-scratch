#!/bin/sh
# Episode 1's runs: 3 × "act on frame" and 3 × "act on SYNC0" on vwire:chain3, 3 s each.
# Writes data/ep01.json and ep01_data.js, and checks every number the subtitles state.
cd "$(dirname "$0")/.." && python3 data.py 3
