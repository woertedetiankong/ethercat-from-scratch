# EtherCAT from Scratch

[中文](README.md)

A video course (videos + slides) on how EtherCAT communicates and keeps time. No hardware needed:
the master is real SOEM code, the slaves are simulated EtherCAT slave controllers (ESCs) in `vwire/`.

## Layout

| Path | What it is |
|---|---|
| `soem/` | The SOEM master, a git submodule pinned at **v2.0.1** (`49fc349`). Videos quote it by line number; don't move it casually. |
| `vwire/` | The virtual line: SOEM's Linux NIC driver compiled unchanged, its socket calls wired to simulated slaves. |
| `vwire/src/vwire.c` | The simulated slave chain: ports, processing on the fly, registers, SII EEPROM, FMMUs, distributed clocks, SYNC0. |
| `vwire/apps/` | Small master programs: `scan` (find slaves, measure delays), `cycle` (go to OP, run cyclic data, with or without DC). |
| `vwire/runs.sh` | Every run the course quotes; output in `vwire/data/` (traces are JSON lines, `.pcap` opens in Wireshark). |
| `episodes/epNN-*/` | Each episode's video build folder (script, animation, narration, slides). |
| `site/` | The course home: `cd site && npm start`. |

## Commands

```sh
git submodule update --init          # fetch SOEM the first time
vwire/build.sh                       # build (macOS / Linux, plain cc)
vwire/build/scan vwire:chain3        # scan the virtual line: 3 slaves and the delays between them
vwire/build/cycle vwire:chain3 --frame   # no distributed clock: joints act when a frame arrives
vwire/build/cycle vwire:chain3 --dc      # distributed clock: joints act on SYNC0
vwire/runs.sh                        # regenerate all data the course uses
```

Lines: `vwire:ai1` (one analog input card), `vwire:chain3` (the card + 2 joint drives), `vwire:arm6` (6 joints).
Environment: `VWIRE_TRACE`, `VWIRE_PCAP`, `VWIRE_HOPS=1|all` (log the frame after every slave), `VWIRE_FWD_NS`,
`VWIRE_RET_NS`, `VWIRE_CABLE_NS_PER_M`, `VWIRE_BREAK=k` (cable cut after slave k), `VWIRE_NO_DRIFT=1` (perfect crystals).

## What is real and what is simulated

- **Real:** every byte the master sends, every decision SOEM makes (scan, EEPROM reads, mapping, delay measurement,
  offsets), and the real jitter of the master's cycle on the Mac.
- **Simulated (labelled in the videos):** cable delay (5 ns/m) and delays inside each slave chip (ET1100 datasheet averages: 305 ns through the processing unit, 265 ns alongside it; PHY delays not modelled), each slave's
  crystal error (tens of ppm), the ESC's time control loop, the slave applications (the card's voltages, the joint drives).
  The parameters are at the top of `vwire/src/vwire.c`.

## Pitfalls met so far

- macOS lacks `clock_nanosleep` and `ppoll`: `vwire/shim/` supplies just those two; SOEM's source is not changed.
- When two slaves share vendor, product and revision, SOEM reuses the first one's SII data (`ecx_lookup_prev_sii`),
  so both joint drives carry the same name.

## License

SOEM is GPLv3; `vwire/` links it and is GPLv3 too.
