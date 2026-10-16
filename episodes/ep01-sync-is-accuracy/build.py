# Stitch the player: head.html (engine + primitives) + scenes.js (this episode) + tail.html (chrome, render loop, player),
# with timeline.json inlined. Open index.html to preview; record.mjs renders it.
import json,re
tl=open('timeline.json',encoding='utf-8').read()
s=open('head.html',encoding='utf-8').read()+open('ep01_data.js',encoding='utf-8').read()+open('scenes.js',encoding='utf-8').read()+open('tail.html',encoding='utf-8').read()
zh=''.join(sorted(set(re.findall(r'[\u3000-\u9fff\uff00-\uffef]',open('scenes.js',encoding='utf-8').read()))))
s=s.replace("'__AUTO__'",repr(zh))
open('index.html','w',encoding='utf-8').write(s.replace('/*TIMELINE*/null', tl))
