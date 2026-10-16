"""Copy finished episode media into content/, which the runner serves at /content/.

Episode build folders live next to this repo:  ../episodes/epNN-<slug>/
  video.mp4      rendered by record.mjs           → content/epNN/video.mp4
  timeline.json  written by tts.py                → content/epNN/chapters.json (scene start times + zh/en titles)
  lab.html       the interactive lab page         → content/epNN/lab.html
  flow.html      the flowchart page (optional)    → content/epNN/flow.html
  slides.html + slides/ + slides.pdf  the 课件 from slides.mjs (optional) → content/epNN/ (set slides: true in course.js)

Run after re-rendering a video or editing a lab page:  python3 dev/sync_content.py [epNN ...]
"""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPISODES = os.path.join(os.path.dirname(ROOT), "episodes")
only = set(sys.argv[1:])

for name in sorted(os.listdir(EPISODES)):
    m = re.match(r"^(ep\d+[a-z]?)(?:-|$)", name)
    src = os.path.join(EPISODES, name)
    if not m or not os.path.isdir(src) or (only and m.group(1) not in only):
        continue
    ep = m.group(1)
    out = os.path.join(ROOT, "content", ep)
    os.makedirs(out, exist_ok=True)
    v, dst = os.path.join(src, "video.mp4"), os.path.join(out, "video.mp4")
    if os.path.exists(v) and (not os.path.exists(dst) or os.path.getmtime(v) > os.path.getmtime(dst)):
        shutil.copy2(v, dst)
    tl = os.path.join(src, "timeline.json")
    if os.path.exists(tl):
        t = json.load(open(tl, encoding="utf-8"))
        # title is shown in Chinese mode, title_en in English mode (the page falls back to title)
        chapters = [{"t": round(s["start"], 2), "title": s.get("zh") or s["title"], "title_en": s["title"]} for s in t["scenes"]]
        json.dump({"duration": t["total"], "chapters": chapters}, open(os.path.join(out, "chapters.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if os.path.exists(os.path.join(src, "slides.html")):
        shutil.rmtree(os.path.join(out, "slides"), ignore_errors=True)
        shutil.copytree(os.path.join(src, "slides"), os.path.join(out, "slides"))
        for f in ("slides.html", "slides.pdf"):
            if os.path.exists(os.path.join(src, f)):
                shutil.copy2(os.path.join(src, f), os.path.join(out, f))
    for page in ("lab.html", "flow.html"):
        f = os.path.join(src, page)
        if not os.path.exists(f):
            continue
        body = open(f, encoding="utf-8").read()
        if not body.lstrip().lower().startswith("<!doctype"):  # a body fragment (e.g. also published as an artifact)
            body = '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n'
        open(os.path.join(out, page), "w", encoding="utf-8").write(body)
    print(ep, sorted(os.listdir(out)))
