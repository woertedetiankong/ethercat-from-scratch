# Stitch the player: head.html (engine + primitives) + any *_data.js (numbers generated from real runs, e.g. by data.py)
# + scenes.js (this episode) + tail.html (chrome, render loop, player), with timeline.json inlined.
# Open index.html to preview; record.mjs renders it.
import glob,json,re
tl=open('timeline.json',encoding='utf-8').read()
parts=['head.html']+sorted(glob.glob('*_data.js'))+['scenes.js','tail.html']
s=''.join(open(f,encoding='utf-8').read() for f in parts)
zh=''.join(sorted(set(re.findall(r'[\u3000-\u9fff\uff00-\uffef]',open('scenes.js',encoding='utf-8').read()))))
s=s.replace("'__AUTO__'",repr(zh))
open('index.html','w',encoding='utf-8').write(s.replace('/*TIMELINE*/null', tl))
