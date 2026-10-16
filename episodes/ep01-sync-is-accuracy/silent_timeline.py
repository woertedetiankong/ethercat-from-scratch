"""No-narration stand-in for tts.py: times each subtitle by reading speed, writes timeline.json + silent narration.wav/mp3.

Use it to preview the look before spending TTS quota (or when the user wants a subtitles-only video).
Scenes written against this timeline still work after tts.py: beats move, but scenes.js times off b[i].
"""
import json, re, wave, subprocess
S = json.load(open('script.json', encoding='utf-8'))
RATE = 48000
LEAD, GAP, TAIL = 0.9, 0.6, 1.6   # unhurried: subtitles stay long enough to read and think
def dur(en, zh, l_pause=False):  # long enough to read both rows
    words = len(en.split()); han = len(re.findall(r'[一-鿿]', zh))
    return round(max(3.2, words / 2.3, han / 4.2) + 0.6 + (2.0 if l_pause else 0), 3)
out = []; t = 0.0
for sc in S:
    start = t; t += LEAD; beats = []
    for i, l in enumerate(sc['lines']):
        d = dur(l[0], l[1], len(l) > 3 and l[3] == 'pause'); beats.append({'text': l[0], 'zh': l[1], 'start': round(t - start, 3), 'dur': d})
        t += d + (GAP if i < len(sc['lines']) - 1 else TAIL)
    out.append({'id': sc['id'], 'title': sc['title'], 'zh': sc['zh'], 'start': round(start, 3), 'dur': round(t - start, 3), 'beats': beats})
json.dump({'total': round(t, 3), 'scenes': out}, open('timeline.json', 'w'), ensure_ascii=False, indent=1)
with wave.open('narration.wav', 'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(RATE); f.writeframes(b'\x00\x00' * int(t * RATE))
print('total', round(t, 2))
for s in out: print(s['id'], s['dur'], [b['start'] for b in s['beats']])
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'narration.wav', '-b:a', '64k', 'narration.mp3'], check=True)
