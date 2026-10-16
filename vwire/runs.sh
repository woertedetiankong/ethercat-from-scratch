#!/bin/sh
# Every run the course quotes, in one place. Output in data/ (trace = JSON lines, pcap opens in Wireshark).
set -e
cd "$(dirname "$0")"
./build.sh >/dev/null
mkdir -p data
# scan: find slaves, measure delays (ep02, ep05a)
VWIRE_TRACE=data/scan.jsonl VWIRE_PCAP=data/scan.pcap VWIRE_HOPS=all ./build/scan vwire:chain3 > data/scan.txt
# cable cut after slave 2 (ep02)
VWIRE_TRACE=data/break2.jsonl VWIRE_BREAK=2 VWIRE_HOPS=all ./build/scan vwire:chain3 > data/break2.txt
# act on frame arrival, no distributed clock (ep01, ep05c)
VWIRE_TRACE=data/frame.jsonl ./build/cycle vwire:chain3 --frame --seconds 3 > data/frame.txt
# SYNC0 from distributed clocks (ep05b, ep05c)
CYCLE_DIFF_LOG=data/dc_diff.jsonl VWIRE_TRACE=data/dc.jsonl ./build/cycle vwire:chain3 --dc --seconds 3 > data/dc.txt
echo "runs done: $(ls data | tr '\n' ' ')"
