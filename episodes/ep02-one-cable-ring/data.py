"""Episode 2's numbers, from vwire/runs.sh (real SOEM scanning the virtual line), and the SOEM lines it quotes.

    python3 data.py            # re-runs vwire/runs.sh, checks every stated property, writes ep02_data.js

Run "scan":   vwire:chain3 intact (3 slaves, J2's port 1 has no cable).
Run "break2": the same line with the cable after slave 2 (J1) cut.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
VW = os.path.join(ROOT, 'vwire')
SRC = os.path.join(ROOT, 'soem', 'src')

subprocess.run([os.path.join(VW, 'runs.sh')], check=True, stdout=subprocess.DEVNULL)

def load(name):
    txt = open(os.path.join(VW, 'data', name + '.txt')).read()
    ev = [json.loads(l) for l in open(os.path.join(VW, 'data', name + '.jsonl'))]
    rows = re.findall(r'^(\d+)\s+0x[0-9a-f]+\s+0x\d+\s+(.+?)\s{2,}0x\S+\s+0x\S+\s+([01]{2})\s', txt, re.M)
    count = int(re.match(r'(\d+) slaves', txt).group(1))
    # the path of each frame's first bit through every slave (ns after the master sent it); identical for every frame?
    paths = {}
    for e in ev:
        if e['ev'] == 'path':
            paths.setdefault(e['f'], {})[e['s']] = {k: e[k] for k in ('in0_ns', 'pu_ns', 'in1_ns', 'out0_ns')}
    full = [p for p in paths.values() if len(p) == count]
    rtts = {e['rtt_ns'] for e in ev if e['ev'] == 'frame'}
    # SOEM's slave count: the first broadcast read (BRD, command 0x07) and its working counter after each slave
    brd, f = [], None
    for e in ev:
        if e['ev'] == 'hop':
            h = bytes.fromhex(e['ecat'])
            if h[2] == 0x07 and f in (None, e['f']):
                f = e['f']; brd.append(int.from_bytes(h[-2:], 'little'))
    # what SOEM read back from register 0x0110 (FPRD, command 0x04) of each slave, as it arrived at the master
    dl = {}
    for e in ev:
        if e['ev'] == 'hop' and e['at'] == 'master_rx':
            h = bytes.fromhex(e['ecat'])
            if h[2] == 0x04 and h[6:8] == b'\x10\x01':
                dl.setdefault(int.from_bytes(h[4:6], 'little') - 0x1000, int.from_bytes(h[10 + 2:10 + 4], 'little'))
    op = next(e for e in ev if e['ev'] == 'open')
    return {'count': count, 'ports': [r[2] for r in rows], 'names': [r[1] for r in rows],
            'path': full[0], 'same_every_frame': all(p == full[0] for p in full), 'frames': len(full),
            'rtt': sorted(rtts), 'dlstat': [dl.get(i + 1) for i in range(count)], 'brd_wkc': brd, 'fwd_ns': op['fwd_ns'], 'ret_ns': op['ret_ns'], 'cable_ns_per_m': op['cable_ns_per_m']}

R = {'scan': load('scan'), 'break2': load('break2')}
s, k = R['scan'], R['break2']
P, Q = s['path'], k['path']

ok = True
def need(cond, what):
    global ok
    print(('ok   ' if cond else 'FAIL ') + what)
    ok &= bool(cond)
need(s['count'] == 3 and s['ports'] == ['11', '11', '10'], 'intact: 3 slaves, ports 11 / 11 / 10')
need(s['same_every_frame'] and s['rtt'] == [1485], f'intact: every frame ({s["frames"]}) takes the same path, back after 1485 ns')
need([P[1]['in0_ns'], P[2]['in0_ns'], P[3]['in0_ns']] == [10, 320, 630], 'intact: reaches slave 1 / J1 / J2 at 10 / 320 / 630 ns')
need([P[3]['out0_ns'], P[2]['out0_ns'], P[1]['out0_ns']] == [935, 1205, 1475], 'intact: leaves J2 / J1 / slave 1 at 935 / 1205 / 1475 ns')
need(P[3]['in1_ns'] == -1 and P[2]['in1_ns'] >= 0, 'intact: nothing enters J2 port 1 (turns around inside J2)')
need(s['fwd_ns'] == 305 and s['ret_ns'] == 265 and s['cable_ns_per_m'] == 5, 'model: 305 ns out, 265 ns back, 5 ns/m (labelled simulated)')
need(all(P[i]['out0_ns'] - P[i]['in1_ns'] == 265 for i in (1, 2)), 'intact: each slave adds 265 ns on the way back')
need(P[2]['in0_ns'] - P[1]['in0_ns'] == 310 and P[3]['in0_ns'] - P[2]['in0_ns'] == 310, 'intact: 305 ns chip + 5 ns cable per hop out')
need(s['brd_wkc'] == [0, 1, 2, 3, 3], 'intact: counting read comes back with 3 (0 → 1 → 2 → 3)')
need(k['count'] == 2 and k['ports'] == ['11', '10'], 'cut after J1: 2 slaves, ports 11 / 10')
need(k['rtt'] == [905] and Q[2]['in1_ns'] == -1, 'cut after J1: turns at J1, back after 905 ns')
need(k['brd_wkc'] == [0, 1, 2, 2], 'cut after J1: counting read comes back with 2')
bits = lambda v, p: (v >> (8 + 2 * p)) & 3  # 2 = "10": open and communicating, 1 = "01": closed
need([[bits(v, 0), bits(v, 1)] for v in s['dlstat']] == [[2, 2], [2, 2], [2, 1]], 'intact: 0x0110 read back: port 1 is 10 / 10 / 01')
need([[bits(v, 0), bits(v, 1)] for v in k['dlstat']] == [[2, 2], [2, 1]], 'cut after J1: 0x0110 read back: port 1 is 10 / 01')
wire_us = (60 + 4 + 8) * 8 / 100  # shortest frame: 60 bytes + 4 FCS + 8 preamble, at 100 Mbit/s
need(abs(wire_us - 5.76) < 1e-9 and P[1]['out0_ns'] + 10 < wire_us * 1000, 'teaser: head back (1.5 µs) before a 5.8 µs frame has left')

# the SOEM lines on screen, cut verbatim with file:line
def cut(fn, a, b):
    L = open(os.path.join(SRC, fn)).read().split('\n')
    return {'file': 'soem/src/' + fn, 'from': a, 'to': b, 'lines': L[a - 1:b]}
code = {'count': cut('ec_config.c', 72, 72), 'ports': cut('ec_config.c', 279, 292), 'keep': cut('ec_config.c', 307, 307)}
need('ecx_BRD' in code['count']['lines'][0] and 'detect number of slaves' in code['count']['lines'][0], 'code: ec_config.c:72 is the counting BRD')
need('ECT_REG_DLSTAT' in code['ports']['lines'][0] and '0x0c00' in code['ports']['lines'][9] and 'activeports = b' in code['keep']['lines'][0], 'code: ec_config.c:279/288/307 read 0x0110 and keep the open ports')

D = {'scan': s, 'break2': k, 'code': code, 'wire_us': round(wire_us, 2)}
open(os.path.join(HERE, 'ep02_data.js'), 'w').write('// generated by data.py from vwire/runs.sh (vwire:chain3) and soem/ at v2.0.1; do not edit\nconst D = ' + json.dumps(D, ensure_ascii=False) + ';\n')
if not ok: sys.exit('a stated property failed: fix the script or the run')
print('path (ns):', json.dumps(P))
