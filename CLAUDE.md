# CLAUDE.md

Production repo for the bilingual video course "EtherCAT 从零读懂 / EtherCAT from Scratch". Layout, commands and pitfalls: @README.en.md

Use the course-studio skill for episode and site work. Decisions (2026-10-15, the user):

- **Video-first**: each episode ships video + 课件 only (no lab, map, dojo or flowchart).
- **No narration for now**: build timelines with `silent_timeline.py`, never `tts.py`; bilingual subtitles carry everything.
- **Goal is understanding the protocol**, not mastering SOEM: pictures and the running example first; code only as a few lines of evidence. No "write your own master" episode.
- **Simple examples only where the idea is hard**, always on the same 3-slave line (vwire:chain3) and its real numbers.

## Rules

- **Keep `soem/` at v2.0.1 (`49fc349`).** Videos quote it by line number. Moving the pin is the user's decision and means re-running `vwire/runs.sh` and re-checking every quoted line.
- **Never edit SOEM to make vwire work.** Platform gaps go in `vwire/shim/` (force-included headers).
- **Numbers on screen come from `vwire/runs.sh` output.** Label every modelled quantity (cable/forwarding delays, crystal ppm, the ESC time control loop, slave applications) as 模拟 / simulated. Things worked out from the code are 按代码推演.
- **Code on screen is verbatim**, cut by script from `soem/` with `file:line`; follow the call chain without jumps.
- **Bilingual:** every learner-facing string gets Chinese and English in the same edit.
- **Never write API keys into any file.** Keys live in `~/.config/course-studio/.env`.
- `site/content/` is generated: change `episodes/` and run `python3 site/dev/sync_content.py`.
