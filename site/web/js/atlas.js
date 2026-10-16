/* Project atlas (项目地图): one map of the whole codebase for the whole course, lit up episode by episode.
   All content comes from window.ATLAS (js/atlas.data.js); this file only draws it. See references/atlas.md.
   Views: where (structure) · when (clocks / threads) · board (shared state: who writes, who reads) · route (one trip, guess-then-reveal) · quiz (find it on the map, change impact).
   Zoom: file → functions → real code, for nodes that have ATLAS.zoom[id]. */
(() => {
const A = window.ATLAS, M = A.meta;
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, a = {}, p) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.append(e); return e; };
const tx = (p, x, y, s, cls, anchor) => { const t = sv('text', {x, y, class: cls, 'text-anchor': anchor || 'start'}, p); t.textContent = s; return t; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const store = {get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
const LV = [L('还没学', 'Not yet'), L('见过', 'Seen'), L('读懂', 'Read')];

/* ---------- data ---------- */
const LAYERS = A.layers, LK = Object.fromEntries(LAYERS.map(l => [l.k, l]));
const N = A.nodes, BY = Object.fromEntries(N.map(n => [n.id, n]));
const CLOCKS = A.clocks || [], FIELDS = A.fields || [], ROUTES = A.routes || {}, ZOOM = A.zoom || {}, EPS = A.eps || {};
const BOARD = N.find(n => n.board);
// values from real runs (window.ATLAS_RUNS, written into atlas.data.js by a course script): a route with run: '<key>'
// fills {name} in its text and in the values shown beside its code lines, so the map quotes the video's numbers
const RUNS = window.ATLAS_RUNS || {};
const fv = (s, R) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => R?.run && RUNS[R.run]?.[k] != null ? RUNS[R.run][k] : m);
const kv = k => `var(--L-${k})`;
// an episode split into parts (ep11a…ep11d) shares one map section: its id is the first part's, its title eps[n].t if given
const epInfo = n => { const es = (window.EPISODES || []).filter(e => e.n === n), t = es.length > 1 && window.ATLAS.eps?.[n]?.t;
  return es.length ? (t ? {...es[0], title: t} : es[0]) : {id: 'ep' + String(n).padStart(2, '0'), n, title: ''}; };
const VIEWS = [
 {id: 'where', t: L('在哪', 'Where'), s: M.viewSub?.where || L('文件和分层', 'files and layers')},
 {id: 'when', t: L('什么时候跑', 'When'), s: M.viewSub?.when || L('谁把代码叫起来', 'what wakes the code')},
 {id: 'board', t: L('数据怎么交接', 'Handoffs'), s: M.viewSub?.board || (BOARD ? BOARD.t : '')},
 {id: 'route', t: L('一条路走到底', 'One trip'), s: M.viewSub?.route || L('按步骤看', 'step by step')},
 {id: 'quiz', t: L('考考你', 'Quiz'), s: M.viewSub?.quiz || L('在地图上找', 'find it on the map')},
].filter(v => v.id !== 'when' || CLOCKS.length).filter(v => v.id !== 'board' || (BOARD && FIELDS.length));

// layer colours: [light, dark] per layer key, injected as tokens for both themes
(() => {
  const c = i => LAYERS.map(l => `--L-${l.k}:${l.color[i]};`).join('') + `--L-${BOARD ? BOARD.k : 'data'}:var(--ink);`;
  const st = document.createElement('style');
  st.textContent = `:root{${c(0)}} @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${c(1)}}} :root[data-theme="dark"]{${c(1)}}`;
  document.head.append(st);
})();

/* ---------- state ---------- */
// learners see only released episodes (course.js status other than 'planned'); atlas.html?all shows every episode that has map data (for authors)
const released = n => { const e = (window.EPISODES || []).find(x => x.n === n); return !window.EPISODES || (e && e.status !== 'planned'); };
const preview = new URLSearchParams(location.search).has('all');
const epKeys = Object.keys(EPS).map(Number).filter(n => preview || released(n)).sort((a, b) => a - b);
if (!epKeys.length) epKeys.push(Math.min(...Object.keys(EPS).map(Number)));
const hashEp = () => { const m = /^#ep0*(\d+)[a-z]?$/.exec(location.hash); return m && epKeys.includes(+m[1]) ? +m[1] : null; };
const S = {ep: hashEp() ?? store.get('atlas.ep', epKeys[epKeys.length - 1]), view: store.get('atlas.view', 'where'), sel: null,
  clock: (CLOCKS.find(c => c.d) || CLOCKS[0] || {}).id, field: 0, route: null, step: 0, q: 0, answers: store.get('atlas.answers', {}), justLit: true,
  zoom: null, guess: store.get('atlas.guess', true), gmsg: null, gtries: 0, gstats: {}, picks: [], maxStep: 0, trips: store.get('atlas.trips', {})};
if (!epKeys.includes(S.ep)) S.ep = epKeys[epKeys.length - 1];
if (!VIEWS.some(v => v.id === S.view)) S.view = 'where';
// arriving from an episode (atlas.html#epNN): open on its trip, the video's twin, until the learner has walked it
if (hashEp() != null && VIEWS.some(v => v.id === 'route') && (EPS[S.ep]?.routes || []).some(r => !S.trips[r])) S.view = 'route';

// what the learner has been taught by episode ep: only released episodes count (episodes ship out of order, so a planned
// episode with a smaller number has taught nothing yet); ?all counts every episode
const counts = e => preview || released(e);
const level = (n, ep) => n.eps.reduce((m, [e, l]) => e <= ep && counts(e) ? Math.max(m, l === 's' ? 1 : 2) : m, 0);
const isNew = (n, ep) => n.eps.some(([e]) => e === ep);
// zoom follows the course too: the file view opens once a block has been seen, the code view only from the episode that reads it closely
const firstRead = n => (n.eps.find(([, l]) => l !== 's') || [])[0];        // for “comes with episode N” hints, released or not
const canZoom = id => !!ZOOM[id] && level(BY[id], S.ep) >= 1;
const codeEp = (F, n) => F.ep ?? (n.eps.find(([e, l]) => l !== 's' && counts(e)) || [])[0] ?? firstRead(n);
const canCode = (F, n) => { const e = codeEp(F, n); return !!F.src && (preview || (e != null && S.ep >= e && counts(e))); };
// calls, clock notes and board fields can carry an episode, or a list of the episodes that teach them:
// a learner sees an item from the first released one, so only what the episodes so far have taught
const shown = e => [].concat(e ?? 1).some(x => x <= S.ep && counts(x));
const callsOf = c => c.calls.filter(x => shown(x[2]));
const noteOf = c => c.note + (c.more && shown(c.more[0]) ? ' ' + c.more[1] : '');
const fieldsNow = () => FIELDS.filter(f => shown(f.ep));
const layerName = n => n.board ? L('共享数据', 'Shared state') : L(`第 ${LK[n.k].n} 层 · ${LK[n.k].t}`, `Layer ${LK[n.k].n} · ${LK[n.k].t}`);
function saveProgress(){
  store.set('atlas.answers', S.answers);
  const ok = Object.entries(S.answers[S.ep] || {}).filter(([, a]) => a.ok).map(([i]) => +i);
  store.set(`course.${epInfo(S.ep).id}.map.answered`, ok);
}

/* ---------- geometry ---------- */
const ctr = n => [n.x + n.w / 2, n.y + n.h / 2];
function rim(n, tx_, ty_){
  const [cx, cy] = ctr(n), dx = tx_ - cx, dy = ty_ - cy;
  const s = Math.min(Math.abs((n.w / 2 + 4) / (dx || 1e-6)), Math.abs((n.h / 2 + 4) / (dy || 1e-6)));
  return [cx + dx * s, cy + dy * s];
}
function link(a, b, bend = .18){
  const [ax0, ay0] = ctr(a), [bx0, by0] = ctr(b);
  const [ax, ay] = rim(a, bx0, by0), [bx, by] = rim(b, ax0, ay0);
  const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay;
  return {d: `M${ax},${ay} Q${mx - dy * bend},${my + dx * bend} ${bx},${by}`, mid: [mx - dy * bend / 2, my + dx * bend / 2]};
}

/* ---------- map ---------- */
let svg;
function drawMap(){
  const box = $('#mapbox'); box.innerHTML = '';
  const [W, H] = M.vb || [1200, 812];
  svg = sv('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': M.mapLabel || L('项目地图', 'Project map')}, box);
  const defs = sv('defs', {}, svg);
  const hp = sv('pattern', {id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'}, defs);
  sv('rect', {width: 7, height: 7, style: 'fill:var(--sheet)'}, hp); sv('line', {x1: 0, y1: 0, x2: 0, y2: 7, style: 'stroke:var(--line);stroke-width:1.4'}, hp);
  const gp = sv('pattern', {id: 'grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse'}, defs);
  sv('path', {d: 'M24,0 L0,0 0,24', style: 'fill:none;stroke:var(--grid);stroke-width:1'}, gp);
  for (const [id, c] of [['aw', 'var(--signal)'], ['ar', 'var(--ink-2)']]){
    const m = sv('marker', {id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'}, defs);
    sv('path', {d: 'M0,0 L10,5 L0,10 z', style: `fill:${c}`}, m);
  }
  sv('rect', {width: W, height: H, style: 'fill:url(#grid)'}, svg);
  for (const Ly of LAYERS){
    const g = sv('g', {}, svg); g.style.setProperty('--k', kv(Ly.k));
    sv('rect', {x: 8, y: Ly.y, width: W - 16, height: Ly.h, rx: 6, style: `fill:color-mix(in srgb, var(--L-${Ly.k}) 6%, transparent)`}, g);
    sv('line', {x1: 8, y1: Ly.y, x2: W - 8, y2: Ly.y, style: `stroke:color-mix(in srgb, var(--L-${Ly.k}) 45%, transparent);stroke-width:1.5`}, g);
    tx(g, 22, Ly.y + 42, Ly.n, 'band-n');
    tx(g, 50, Ly.y + 36, Ly.t, 'band-t');
    if (Ly.a) tx(g, 22, Ly.y + 64, Ly.a, 'band-a');
    (Ly.d || []).forEach((d, i) => tx(g, 22, Ly.y + 84 + i * 15, d, 'band-d'));
  }
  sv('g', {id: 'ov'}, svg);
  const ng = sv('g', {id: 'nodes'}, svg);
  for (const n of N){
    const g = sv('g', {class: 'node', 'data-id': n.id, tabindex: 0, role: 'button'}, ng);
    g.style.setProperty('--k', kv(n.k));
    g.addEventListener('click', () => onNode(n.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNode(n.id); } });
    if (ZOOM[n.id]) g.addEventListener('dblclick', () => { if (canZoom(n.id)) openZoom(n.id); });
    sv('rect', {x: n.x - 5, y: n.y - 5, width: n.w + 10, height: n.h + 10, rx: 7, class: 'beacon', style: 'display:none'}, g);
    sv('rect', {x: n.x - 4, y: n.y - 4, width: n.w + 8, height: n.h + 8, rx: 7, class: 'pulse', style: 'display:none'}, g);
    sv('rect', {x: n.x, y: n.y, width: n.w, height: n.h, rx: 4, class: 'b'}, g);
    if (n.board){
      g.classList.add('kax');
      tx(g, n.x + 16, n.y + 36, n.t, 'big');
      if (n.sub) tx(g, n.x + 16, n.y + 58, n.sub, 'sub');
      (n.rows || []).forEach((r, i) => tx(g, n.x + 16, n.y + 88 + i * 17, r, 'rows'));
      sv('text', {x: n.x + 16, y: n.y + n.h - 34, class: 'field', id: 'kxField'}, g);
      sv('text', {x: n.x + 16, y: n.y + n.h - 18, class: 'field', id: 'kxField2'}, g);
    } else {
      tx(g, n.x + 12, n.y + (n.h > 64 ? 32 : 26), n.t, 't');
      tx(g, n.x + 12, n.y + (n.h > 64 ? 54 : 45), n.f, 'f');
    }
    sv('circle', {cx: n.x + n.w - 10, cy: n.y + 10, r: 4, class: 'mk'}, g);
    if (ZOOM[n.id]) tx(g, n.x + n.w - 10, n.y + n.h - 10, L('可放大 ›', 'zoom in ›'), 'zoomtag', 'end').classList.add('zt');
  }
}

function paintNodes(){
  if (S.zoom) { renderZoom(); return; }
  if (!svg || !svg.isConnected) drawMap();
  const hl = highlightSet(), qm = quizMarks(), fresh = N.filter(m => isNew(m, S.ep));
  for (const n of N){
    const g = svg.querySelector(`[data-id="${n.id}"]`), lv = level(n, S.ep), nw = isNew(n, S.ep);
    g.setAttribute('class', `node st${lv}` + (n.board ? ' kax' : '') + (S.sel === n.id ? ' sel' : '') + (hl && !hl.has(n.id) ? ' dim' : '') + (hl && hl.strong.has(n.id) ? ' hl' : '') + (nw && S.justLit && S.view === 'where' ? ' lit' : '') + (qm[n.id] ? ' ' + qm[n.id] : ''));
    g.setAttribute('aria-label', `${n.t}，${n.f || ''}，${LV[lv]}${nw ? L('，本集新点亮', ', new this episode') : ''}`);
    const bc = g.querySelector('.beacon'); bc.style.display = nw && S.view === 'where' ? '' : 'none';
    if (nw) bc.style.animationDelay = `${fresh.indexOf(n) * 90}ms`;
    const zt = g.querySelector('.zt'); if (zt) zt.style.display = canZoom(n.id) ? '' : 'none';
    const mk = g.querySelector('.mk'); mk.style.display = lv ? '' : 'none'; mk.setAttribute('class', 'mk' + (lv === 1 ? ' hollow' : ''));
    const pu = g.querySelector('.pulse'), clk = S.view === 'when' ? CLOCKS.find(c => c.id === S.clock) : null;
    if (clk && clk.d && callsOf(clk).some(([id]) => id === n.id)){ pu.style.display = ''; pu.style.setProperty('--d', clk.d + 's'); } else pu.style.display = 'none';
  }
  S.justLit = false;
  if (BOARD){
    const f = S.view === 'board' && fieldsNow()[S.field] ? fieldsNow()[S.field].f : '', cut = f.indexOf('.') + 1;
    const [p1, p2] = f.length > 22 && cut > 0 ? [f.slice(0, cut), f.slice(cut)] : [f, ''];
    $('#kxField').textContent = p1; $('#kxField2').textContent = p2;
  }
  drawOverlay();
}
function highlightSet(){
  let s = null, strong = new Set();
  if (S.view === 'when'){ const c = CLOCKS.find(c => c.id === S.clock); s = new Set(callsOf(c).map(x => x[0])); }
  if (S.view === 'board' && fieldsNow()[S.field]){ const F = fieldsNow()[S.field]; s = new Set([...F.w, ...F.r, BOARD.id]); }
  if (S.view === 'route' && S.route){ const R = ROUTES[S.route]; s = new Set(R.steps.slice(0, S.step + 1).flatMap(x => x.n)); strong = new Set(R.steps[S.step].n); }
  if (s) s.strong = strong;
  return s;
}
function quizMarks(){
  const m = {};
  if (S.view !== 'quiz' || S.sel) return m;
  const q = EPS[S.ep].qs?.[S.q]; if (!q || !q.multi) return m;
  const a = (S.answers[S.ep] || {})[S.q];
  if (!a){ S.picks.forEach(id => m[id] = 'pick'); return m; }
  new Set([...q.a, ...a.picks]).forEach(id => m[id] = q.a.includes(id) ? (a.picks.includes(id) ? 'q-hit' : 'q-miss') : 'q-extra');
  return m;
}

let runnerRaf = null;
function drawOverlay(){
  const ov = svg.querySelector('#ov'); ov.innerHTML = ''; cancelAnimationFrame(runnerRaf);
  if (S.view === 'board' && fieldsNow()[S.field]){
    const F = fieldsNow()[S.field];
    F.w.forEach((id, i) => { const Lk = link(BY[id], BOARD, .12); sv('path', {d: Lk.d, class: 'ov w', 'marker-end': 'url(#aw)'}, ov); if (i === 0) tx(ov, Lk.mid[0], Lk.mid[1] - 6, L('写', 'writes'), 'ov-l w', 'middle'); });
    F.r.forEach((id, i) => { const Lk = link(BOARD, BY[id], .12); sv('path', {d: Lk.d, class: 'ov r', 'marker-end': 'url(#ar)'}, ov); if (i === 0) tx(ov, Lk.mid[0], Lk.mid[1] - 6, L('读', 'reads'), 'ov-l r', 'middle'); });
  }
  if (S.view === 'route' && S.route){
    const R = ROUTES[S.route]; let lastPath = null;
    for (let i = 1; i <= S.step; i++){
      const a = BY[R.steps[i - 1].n[0]], b = BY[R.steps[i].n[0]];
      if (a === b) continue;
      const Lk = link(a, b, .14), cur = i === S.step;
      const p = sv('path', {d: Lk.d, class: 'ov ' + (cur ? 'w' : 'past'), 'marker-end': cur ? 'url(#aw)' : 'url(#ar)'}, ov);
      if (cur) lastPath = p;
    }
    if (R.loopTo != null && S.step === R.steps.length - 1){
      const Lk = link(BY[R.steps[S.step].n[0]], BY[R.steps[R.loopTo].n[0]], -.35);
      sv('path', {d: Lk.d, class: 'ov r', 'marker-end': 'url(#ar)'}, ov);
      tx(ov, Lk.mid[0], Lk.mid[1], L(`回到第 ${R.loopTo + 1} 步`, `back to step ${R.loopTo + 1}`), 'ov-l r', 'middle');
    }
    if (lastPath && !matchMedia('(prefers-reduced-motion: reduce)').matches){
      const len = lastPath.getTotalLength(), dot = sv('circle', {r: 7, class: 'runner'}, ov), t0 = performance.now();
      const f = now => { const k = Math.min(1, (now - t0) / 700), pt = lastPath.getPointAtLength(len * k); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); if (k < 1) runnerRaf = requestAnimationFrame(f); else dot.remove(); };
      runnerRaf = requestAnimationFrame(f);
    }
  }
}

/* ---------- side sheet ---------- */
const lvName = l => l === 's' ? LV[1] : LV[2];
function epChips(n){
  return `<div class="epl">${n.eps.map(([e, l]) => `<span class="${e === S.ep ? 'now' : e < S.ep && counts(e) ? 'done' : ''}">${L(`第 ${e} 集 · ${lvName(l)}`, `Ep ${e} · ${lvName(l)}`)}</span>`).join('')}</div>`;
}
function nodeDetail(n){
  const lv = level(n, S.ep), clocks = CLOCKS.filter(c => callsOf(c).some(([id]) => id === n.id));
  const fr = firstRead(n);
  return `<button class="back" type="button" data-act="back">← ${L('回到', 'Back to')}「${VIEWS.find(v => v.id === S.view).t}」</button>
   <div style="--k:${kv(n.k)}"><span class="chip">${esc(layerName(n))}</span></div>
   <h2>${esc(n.t)}</h2>
   <p class="path">${esc(n.path)}${n.group ? L('（一组文件）', ' (a family of files)') : ''}</p>
   <p>${esc(n.plain)}</p>
   ${n.fns?.length ? `<div><h3>${L('要认识的函数', 'Functions to know')}</h3><ul class="fns">${n.fns.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
   ${clocks.length ? `<div><h3>${L('什么时候跑', 'When it runs')}</h3><ul class="calls">${clocks.map(c => `<li><span>${esc(c.t)}${c.d ? ' · ' + esc(c.rate) : ''}</span><span>${callsOf(c).filter(([id]) => id === n.id).map(x => esc(x[1])).join(L('、', ', '))}</span></li>`).join('')}</ul></div>` : ''}
   <div><h3>${L(`哪一集讲（你现在：${LV[lv]}）`, `Which episodes (you: ${LV[lv]})`)}</h3>${epChips(n)}</div>
   ${canZoom(n.id) ? `<button class="zbtn" type="button" data-act="zoom">${L('放大到函数', 'Zoom into its functions')}</button>` : ZOOM[n.id] ? `<p class="hint">${L('学到这一块之后可以放大。', 'You can zoom in once an episode has covered this block.')}</p>` : fr ? `<p class="hint">${L(`函数级放大图会在第 ${fr} 集精读这一块时补上。`, `The function-level zoom for this block comes with episode ${fr}, where it is read closely.`)}</p>` : ''}
   ${M.gh && n.path ? `<a class="gh" href="${esc(M.gh + n.path)}" target="_blank" rel="noopener">${L('在 GitHub 上打开源码', 'Open the source on GitHub')}</a>` : ''}`;
}
function viewPanel(){
  const E = EPS[S.ep];
  if (S.view === 'where'){
    const lit = N.filter(n => isNew(n, S.ep));
    return `<h2>${L(`第 ${S.ep} 集点亮了 ${lit.length} 块`, `Episode ${S.ep} lights up ${lit.length} blocks`)}</h2>
     <p>${L('琥珀色框是这一集新学的地方。实心方块是读懂了的，空心的只是见过。点任何一个方块看细节；标着「可放大」的方块能一路放大到函数和代码。', 'Amber frames are new in this episode. Filled blocks are read closely; outlined ones are only seen. Click any block for details; blocks marked “zoom in” open down to functions and code.')}</p>
     <div class="list">${lit.map(n => `<button class="opt" type="button" data-node="${n.id}" style="--k:${kv(n.k)}"><span class="rate" style="color:var(--k)">${n.board ? L('共享', 'shared') : L(`${LK[n.k].n} 层`, `L${LK[n.k].n}`)}</span><b>${esc(n.t)}</b><small>${esc(n.f || '')} · ${LV[level(n, S.ep)]}</small></button>`).join('')}</div>`;
  }
  if (S.view === 'when'){
    const c = CLOCKS.find(c => c.id === S.clock), lanes = CLOCKS.filter(k => k.d);
    return `<h2>${esc(M.whenTitle || L('代码是被谁叫起来的', 'What wakes the code up'))}</h2>
     <p>${esc(M.whenLead || '')}</p>
     ${lanes.length ? `<div class="scope"><canvas id="scope" width="660" height="${lanes.length * 60 + 12}" aria-label="${L('节拍', 'beats')}"></canvas><small>${esc(M.scopeNote || '')}</small></div>` : ''}
     <div class="list">${CLOCKS.map(k => `<button class="opt" type="button" data-clock="${k.id}" aria-pressed="${k.id === S.clock}"><span class="rate">${esc(k.rate)}</span><b>${esc(k.t)}</b><small>${k.per ? esc(k.per) + ' · ' : ''}${L(`${callsOf(k).length} 处调用`, `${callsOf(k).length} calls`)}</small></button>`).join('')}</div>
     <div><h3>${esc(c.t)}${c.per ? ' · ' + esc(c.per) : ''}</h3><p style="font-size:13.5px">${esc(noteOf(c))}</p></div>
     <ul class="calls">${callsOf(c).map(([id, fn]) => `<li><span>${esc(BY[id].f || BY[id].t)}</span><span>${esc(fn)}</span></li>`).join('')}</ul>`;
  }
  if (S.view === 'board'){
    const FS = fieldsNow(), F = FS[S.field] || FS[0];
    if (!F) return `<h2>${esc(BOARD.t)}</h2><p>${esc(M.boardLead || '')}</p>`;
    return `<h2>${esc(BOARD.t)}</h2>
     <p>${esc(M.boardLead || '')}</p>
     <div class="list">${FS.map((x, i) => `<button class="opt" type="button" data-field="${i}" aria-pressed="${x === F}"><span class="rate">${esc(x.tag || '')}</span><b>${esc(x.t)}</b><small>${esc(x.f)}</small></button>`).join('')}</div>
     <div><h3>${esc(F.t)}</h3><p style="font-size:13.5px">${esc(F.how)}</p></div>
     <ul class="calls"><li><span>${L('谁写（琥珀实线）', 'Writers (amber)')}</span><span>${F.w.map(id => esc(BY[id].f)).join(L('、', ', '))} · ${esc(F.wc)}</span></li><li><span>${L('谁读（虚线）', 'Readers (dashed)')}</span><span>${F.r.map(id => esc(BY[id].f)).join(L('、', ', '))} · ${esc(F.rc)}</span></li></ul>`;
  }
  if (S.view === 'route'){
    const avail = E.routes || [];
    if (!avail.length) return `<h2>${L('这一集没有路线', 'No trips in this episode')}</h2>`;
    const R = ROUTES[S.route], st = R.steps[S.step], last = S.step === R.steps.length - 1, gs = S.gstats[S.route];
    return `${avail.length > 1 ? `<div class="list">${avail.map(id => `<button class="opt" type="button" data-route="${id}" aria-pressed="${id === S.route}"><span class="rate">${L(`第 ${ROUTES[id].ep} 集`, `Ep ${ROUTES[id].ep}`)}</span><b>${esc(ROUTES[id].t)}</b><small>${esc(ROUTES[id].sub)}</small></button>`).join('')}</div>`
       : `<div><h2>${esc(R.t)}</h2><p class="hint">${esc(R.sub)}</p></div>`}
     ${R.example ? `<div class="ex"><span>${L('一路跟着的例子', 'Running example')}</span><b>${esc(fv(R.example, R))}</b>${R.run && RUNS[R.run]?.cmd ? `<small>${L('数字来自', 'Numbers from')} <code>${esc(RUNS[R.run].cmd)}</code></small>` : ''}</div>` : ''}
     ${stopStrip(R)}
     <button class="toggle" type="button" data-act="guess" aria-pressed="${S.guess}"><i></i>${L('先猜再看：每一步先猜下一站', 'Guess first: predict each next stop before it is shown')}</button>
     <div class="ctrl"><button class="btn" type="button" data-act="prev" ${S.step === 0 ? 'disabled' : ''}>${L('上一步', 'Back')}</button><span class="count">${S.step + 1} / ${R.steps.length}</span>${S.guess ? '' : `<button class="btn go" type="button" data-act="next" ${last ? 'disabled' : ''}>${L('下一步', 'Next')}</button>`}<button class="btn" type="button" data-act="restart">${L('重来', 'Restart')}</button>${S.guess && gs ? `<span class="hint">${L(`猜对 ${gs.right} / ${gs.total}`, `${gs.right} / ${gs.total} guessed`)}</span>` : ''}</div>
     ${S.gmsg ? `<p class="msg ${S.gmsg.ok === true ? 'ok' : S.gmsg.ok === false ? 'bad' : 'neu'}">${esc(S.gmsg.t)}</p>` : ''}
     <div style="display:flex;gap:14px;align-items:flex-start"><span class="stepno">${S.step + 1}</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><h2 style="font-size:19px">${esc(fv(st.t, R))}</h2><p>${esc(fv(st.p, R))}</p></div></div>
     ${st.stack ? stackLine(st) : `<p class="hint">${L('经过：', 'Passes: ')}${st.n.map(id => esc(BY[id].f || BY[id].t)).join(L('、', ', '))}</p>`}
     ${filePos(st)}
     ${stopCode(st, R)}
     ${codeLink(st)}
     ${last ? tripDone(R) : guessBox(R, st)}`;
  }
  if (S.view === 'quiz'){
    const qs = E.qs || [], ans = S.answers[S.ep] || {}, done = Object.values(ans).filter(v => v.ok).length;
    return `<h2>${L('在地图上找', 'Find it on the map')}</h2>
     <p>${L('读懂一个项目，就是能在里面找到路。选一道题，然后直接点地图上的方块作答。', 'Knowing a project means finding your way around it. Pick a question, then answer by clicking blocks on the map.')}</p>
     <p class="hint">${L(`已答对 ${done} / ${qs.length}`, `${done} / ${qs.length} correct`)}</p>
     <div class="list">${qs.map((x, i) => x.multi ? multiCard(x, i, ans[i]) : singleCard(x, i, ans[i])).join('')}</div>
     <button class="btn" type="button" data-act="resetq" style="align-self:flex-start">${L('清空答案', 'Clear answers')}</button>`;
  }
  return '';
}
function singleCard(x, i, a){
  return `<button class="q ${i === S.q ? 'active' : ''}" type="button" data-q="${i}">
   <span class="qs">${L(`第 ${i + 1} 题`, `Question ${i + 1}`)}${i === S.q ? L(' · 现在点地图作答', ' · answer on the map') : ''}</span><span class="qt">${esc(x.q)}</span>
   ${a ? `<span class="res">${a.ok ? `<b class="ok">${L('答对了。', 'Right.')}</b> ${esc(x.why)}` : `<b class="bad">${L(`你点了 ${esc(BY[a.pick].f || BY[a.pick].t)}，不对。`, `You picked ${esc(BY[a.pick].f || BY[a.pick].t)}. Not that one.`)}</b> ${L('再试一次，或者换个视角找找线索。', 'Try again, or look for clues in another view.')}`}</span>` : ''}</button>`;
}
function multiCard(x, i, a){
  const on = i === S.q, chip = id => `<span class="zc" style="--k:${kv(BY[id].k)}">${esc(BY[id].f || BY[id].t)}</span>`;
  let body = '';
  if (on && !a) body = `<div class="picked">${L('已选：', 'Picked: ')}${S.picks.length ? S.picks.map(chip).join('') : L('还没选。在地图上点方块，再点一次取消。', 'Nothing yet. Click blocks on the map; click again to unpick.')}</div>
   <div class="ctrl"><span class="btn go" role="button" tabindex="0" data-act="submit">${L('提交', 'Submit')}</span><span class="btn" role="button" tabindex="0" data-act="clearpick">${L('清空选择', 'Clear picks')}</span></div>`;
  if (a){
    const all = [...new Set([...x.a, ...a.picks])];
    const row = id => { const hit = x.a.includes(id) && a.picks.includes(id), miss = x.a.includes(id) && !a.picks.includes(id);
      return `<li style="--c:${hit ? 'var(--ok)' : miss ? 'var(--signal)' : 'var(--bad)'}"><b>${hit ? L('选对', 'Right') : miss ? L('漏了', 'Missed') : L('多选', 'Extra')}</b> ${esc(BY[id].f || BY[id].t)}：${esc((x.per || {})[id] || (miss || hit ? '' : L('这一块不受影响。', 'This block is not affected.')))}</li>`; };
    body = `<span class="res">${a.ok ? `<b class="ok">${L('全对。', 'All right.')}</b>` : `<b class="bad">${L('还差一点。', 'Not quite.')}</b>`} ${esc(x.why)}</span><ul class="verdict">${all.map(row).join('')}</ul>
     ${on ? `<span class="linkbtn" role="button" tabindex="0" data-act="redo">${L('再做一次', 'Try again')}</span>` : ''}`;
  }
  return `<div class="q ${on ? 'active' : ''}" role="button" tabindex="0" data-q="${i}"><span class="qs">${L(`第 ${i + 1} 题 · 改动影响 · 可多选`, `Question ${i + 1} · change impact · pick several`)}${on && !a ? L(' · 现在在地图上选', ' · pick on the map') : ''}</span><span class="qt">${esc(x.q)}</span>${body}</div>`;
}
/* ---------- one trip, stop by stop: the video's stop strip, its code (verbatim, located, in call order) and its numbers ---------- */
const stepNode = st => st.n[0];
const stepFn = st => st.fn && ZOOM[stepNode(st)]?.fns.find(f => f.id === st.fn);
const fileOf = p => p.split('/').pop();
function stopStrip(R){
  return `<ol class="stops" aria-label="${L('站点', 'Stops')}">${R.steps.map((x, i) => `<li><button type="button" data-stop="${i}" class="${i === S.step ? 'now' : i < S.step ? 'done' : ''}" ${S.guess && i > S.maxStep ? 'disabled' : ''} title="${esc(fv(x.t, R))}"><b>${i + 1}</b>${x.s ? `<span>${esc(x.s)}</span>` : ''}</button></li>`).join('')}</ol>`;
}
// call stack as in the videos: board.c:229 EncoderDataRead() › drv_encoder.c:202 .read › :615 TAMAGAWA_Encoder_Data_Read()
function stackLine(st){
  let prev = null;
  return `<p class="stack" aria-label="${L('调用栈', 'Call stack')}">${st.stack.map(([f, no, label]) => { const same = f === prev; prev = f; return `<span>${same ? '' : esc(fileOf(f))}:${no} <b>${esc(label)}</b></span>`; }).join('<i>›</i>')}</p>`;
}
// where this stop sits in its file: the file strip from the zoom, the function lit, the stop's lines marked
function filePos(st){
  const F = stepFn(st), Z = ZOOM[stepNode(st)]; if (!F || !st.src) return '';
  const lo = st.start, hi = st.start + st.src.length - 1;
  return `<div class="fpos"><div class="bar">${Z.map.map(([a, b, c]) => `<i class="${b >= F.span[0] && a <= F.span[1] ? 'on' : ''}" style="flex:${b - a + 1};--c:${spanColor(c)}"></i>`).join('')}<u style="left:${(lo - 1) / Z.lines * 100}%;width:${(hi - lo + 1) / Z.lines * 100}%"></u></div>
    <small>${esc(BY[stepNode(st)].f)} · ${esc(F.name)} · ${L(`第 ${lo}–${hi} 行（共 ${Z.lines} 行）`, `lines ${lo}–${hi} of ${Z.lines}`)}</small></div>`;
}
// the stop's code: real line numbers, cut ranges as one "… L640–646: what they do" row, the run's value under a line
function stopCode(st, R){
  if (!st.src) return st.code ? `<pre>${esc(st.code)}</pre>` : '';
  const end = st.start + st.src.length - 1, rows = [], fn = st.stack ? st.stack[st.stack.length - 1][2] : (stepFn(st)?.name || '');
  for (let no = st.start; no <= end; no++){
    const c = (st.cut || []).find(([a, b]) => no >= a && no <= b);
    if (c){ if (no === c[0]) rows.push(`<div class="sr cut"><span class="no">⋮</span><span>L${c[0]}–${c[1]} · ${esc(c[2])}</span></div>`); continue; }
    const mk = st.mark?.[no], on = mk != null || (st.hi || []).includes(no);
    rows.push(`<div class="sr ${on ? 'on' : ''}"><span class="no">${no}</span><code>${hlLine(st.src[no - st.start])}</code></div>`);
    if (mk != null) rows.push(`<div class="sr val"><span class="no"></span><span>↳ ${esc(fv(mk, R))}</span></div>`);
  }
  return `<div class="scode"><div class="sh">${esc(st.file)} · L${st.start}–${end}${fn ? ' · ' + esc(fn) : ''}</div><div class="sb">${rows.join('')}</div></div>`;
}
function codeLink(st){
  const F = stepFn(st); if (!F) return '';
  return canZoom(stepNode(st)) && canCode(F, BY[stepNode(st)]) ? `<button class="zbtn" type="button" data-act="opencode">${L(`在代码视图里打开 ${F.name}`, `Open ${F.name} in the code view`)}</button>` : '';
}
// the next stop in the same file is guessed by function, not by block (five of episode 11's nine stops sit in one file)
function guessBox(R, st){
  const nx = R.steps[S.step + 1];
  if (!S.guess || !nx) return '';
  if (stepNode(nx) === stepNode(st) && nx.fn){
    if (nx.fn === st.fn) return `<div class="guess"><b>${L('下一站还在同一个函数里。', 'The next stop is in the same function.')}</b><button class="btn go" type="button" data-act="next" style="align-self:flex-start">${L('下一站', 'Next stop')}</button></div>`;
    const Z = ZOOM[stepNode(st)], opts = [...Z.fns.filter(f => f.id !== nx.fn && f.id !== st.fn && !f.minor).slice(0, 3), Z.fns.find(f => f.id === nx.fn)].sort((a, b) => a.span[0] - b.span[0]);
    return `<div class="guess"><b>${L(`下一站还在 ${BY[stepNode(st)].f} 里：是哪个函数？`, `The next stop is still in ${BY[stepNode(st)].f}. Which function?`)}</b>
      <div class="fopts">${opts.map(f => `<button class="btn" type="button" data-fguess="${f.id}">${esc(f.name)}</button>`).join('')}</div>
      <button class="linkbtn" type="button" data-act="reveal">${L('直接看答案', 'Show me')}</button></div>`;
  }
  return `<div class="guess"><b>${L('下一步会走到哪？', 'Where does it go next?')}</b><span class="hint">${L('在地图上点一块。猜对了才往下走，第一次就猜对才计分。', 'Click a block on the map. You move on when you are right; only first tries score.')}</span><button class="linkbtn" type="button" data-act="reveal">${L('直接看答案', 'Show me')}</button></div>`;
}
function tripDone(R){
  const files = new Set(R.steps.flatMap(x => [x.file, ...(x.stack || []).map(c => c[0])]).filter(Boolean)), gs = S.gstats[S.route];
  return `<div class="tripdone"><b>${L('走完了', 'Trip complete')}</b>${R.done ? `<p>${esc(fv(R.done, R))}</p>` : ''}
    <ul><li>${L(`${R.steps.length} 站`, `${R.steps.length} stops`)}</li><li>${L(`${files.size} 个文件`, `${files.size} files`)}</li>${S.guess && gs ? `<li>${L(`第一次就猜对 ${gs.right} / ${gs.total}`, `${gs.right} / ${gs.total} right first time`)}</li>` : ''}</ul>
    <div class="ctrl"><button class="btn" type="button" data-act="restart">${L('再走一遍', 'Walk it again')}</button>${EPS[S.ep].qs?.length ? `<button class="btn go" type="button" data-act="toquiz">${L('去答地图题', 'On to the map quiz')}</button>` : ''}</div></div>`;
}
function goStep(i){
  const R = ROUTES[S.route]; S.step = Math.max(0, Math.min(R.steps.length - 1, i)); S.maxStep = Math.max(S.maxStep, S.step);
  if (S.step === R.steps.length - 1 && !S.trips[S.route]){ S.trips[S.route] = true; store.set('atlas.trips', S.trips); }
}
function renderSide(){
  $('#side').innerHTML = S.zoom ? zoomPanel() : S.sel ? nodeDetail(BY[S.sel]) : viewPanel();
  $('.main')?.classList.toggle('trip', S.view === 'route' && !S.zoom && !S.sel);   // a trip widens the side sheet to carry the code
  if (!S.zoom && !S.sel && S.view === 'when') startScope(); else stopScope();
}

/* ---------- zoom: file → functions → code ---------- */
const FCOL = {head: 'var(--line)', data: 'var(--ink)', test: 'var(--line)'};
const spanColor = c => FCOL[c] || (CLOCKS.find(k => k.id === c)?.color) || 'var(--ink-2)';
function openZoom(id, fn = null, hl = null, back = null){ S.zoom = {node: id, fn, seg: null, hl, back}; S.sel = null; paintNodes(); renderSide();
  if (hl) requestAnimationFrame(() => $('#mapbox .lr.hl')?.scrollIntoView({block: 'center', behavior: 'smooth'})); }
function closeZoom(sel){ S.zoom = null; S.sel = sel || null; $('#mapbox').innerHTML = ''; svg = null; paintNodes(); renderSide(); }
const zchip = (id, label) => `<button class="zc" type="button" data-go="${id}" style="--k:${kv(BY[id].k)}" title="${esc(BY[id].f || BY[id].t)}">${esc(label || BY[id].f || BY[id].t)}</button>`;
function hlLine(line, at){
  const t = line.trim(), cmt = M.comment || '//';
  if (t.startsWith(cmt)) return `<span class="cm">${esc(line)}</span>`;
  if (t.startsWith('#')) return `<span class="pp">${esc(line)}</span>`;
  const ci = line.indexOf(cmt);
  let code = esc(ci >= 0 ? line.slice(0, ci) : line);
  const tail = ci >= 0 ? `<span class="cm">${esc(line.slice(ci))}</span>` : '';
  for (const [id, fn] of at || []) code = code.replace(fn, `<span class="fr" style="--k:${kv(BY[id].k)}">${fn}</span>`);
  return code + tail;
}
function renderZoom(){
  const Z = ZOOM[S.zoom.node], n = BY[S.zoom.node], box = $('#mapbox'); svg = null;
  const crumb = [`<button type="button" data-z="map">${L('项目地图', 'Project map')}</button>`, `<span>›</span><span>${esc(layerName(n))}</span><span>›</span>`];
  if (!S.zoom.fn){
    crumb.push(`<b>${esc(n.f)}</b>`);
    box.innerHTML = `<div class="crumb">${crumb.join('')}</div><div class="zoom">
      <h2>${esc(n.f)}<small>${L(`${Z.lines} 行`, `${Z.lines} lines`)} · ${esc(n.path)}</small></h2><p>${esc(Z.intro)}</p>
      <div class="fmap">${Z.map.map(([a, b, c, t]) => `<button type="button" class="${c === 'test' ? 'test' : ''}" style="flex:${b - a + 1};--c:${spanColor(c)}" title="${esc(t)}: ${a}–${b}" data-fnspan="${a}"></button>`).join('')}</div>
      <div class="fkey">${Z.map.filter(m => m[2] !== 'head').map(([a, b, c, t]) => `<span><i class="${c === 'test' ? 'test' : ''}" style="--c:${spanColor(c)}"></i>${esc(t)} · ${L(`${b - a + 1} 行`, `${b - a + 1} lines`)}</span>`).join('')}</div>
      <div class="fcards">${Z.fns.map(f => { const ck = CLOCKS.find(c => c.id === f.clock);
        return `<div class="fcard ${f.minor ? 'minor' : 'core'}"><span class="nm">${esc(f.name)}</span>
          <div class="meta"><span>${L(`第 ${f.span[0]}–${f.span[1]} 行 · ${f.span[1] - f.span[0] + 1} 行`, `lines ${f.span[0]}–${f.span[1]} · ${f.span[1] - f.span[0] + 1} lines`)}</span>${ck ? `<b>${esc(ck.t)}${ck.d ? ' · ' + esc(ck.rate) : ''}</b>` : ''}</div>
          <p>${esc(f.does)}</p>
          ${f.by ? `<div class="rel"><span>${L('谁叫它', 'Called by')}</span><span>${zchip(f.by[0], (BY[f.by[0]].f || BY[f.by[0]].t) + ' · ' + f.by[1])}</span>${f.calls?.length ? `<span>${L('它叫谁', 'Calls')}</span><span>${f.calls.map(([id, fn]) => zchip(id, fn)).join('')}</span>` : ''}</div>` : ''}
          ${canCode(f, n) ? `<button class="zbtn" type="button" data-fn="${f.id}">${L('放大到代码', 'Zoom into code')}</button>` : f.src ? `<span class="lock">${L(`逐段读代码：第 ${codeEp(f, n)} 集解锁`, `Line-by-line reading unlocks in episode ${codeEp(f, n)}`)}</span>` : ''}</div>`; }).join('')}</div></div>`;
    return;
  }
  const F = Z.fns.find(f => f.id === S.zoom.fn), ck = CLOCKS.find(c => c.id === F.clock);
  crumb.push(`<button type="button" data-z="file">${esc(n.f)}</button><span>›</span><b>${esc(F.name)}</b>`);
  const rows = F.src.map((line, i) => {
    const no = F.start + i, si = F.segs.findIndex(s => no >= s.a && no <= s.b), at = F.at[no], hl = S.zoom.hl && no >= S.zoom.hl[0] && no <= S.zoom.hl[1];
    // a call through a function pointer (.read / .process) names its possible targets in this file: one click follows it
    const ptr = (F.ptr?.[no] || []).map(id => Z.fns.find(f => f.id === id)).filter(f => f && canCode(f, n)).map(f => `<button class="zc zp" type="button" data-fn="${f.id}" title="${esc(f.name)}">→ ${esc(f.name)}</button>`).join('');
    return `<div class="lr ${si >= 0 ? 'inseg' : ''} ${si >= 0 && si === S.zoom.seg ? 'on' : ''} ${hl ? 'hl' : ''}" ${si >= 0 ? `data-seg="${si}"` : ''}><span class="sg">${si >= 0 && no === F.segs[si].a ? si + 1 : ''}</span><span class="no">${no}</span><code>${hlLine(line, at)}</code><span class="cl">${(at || []).map(([id]) => zchip(id)).join('')}${ptr}</span></div>`;
  }).join('');
  box.innerHTML = `<div class="crumb">${crumb.join('')}</div><div class="zoom">
    <h2>${esc(F.name)}<small>${ck ? esc(ck.t) + (ck.per ? ' · ' + esc(ck.per) : '') + ' · ' : ''}${F.by ? L(`被 ${esc(F.by[1])} 调用`, `called by ${esc(F.by[1])}`) : ''}</small></h2>
    <p>${esc(F.does)} ${L('点左边的编号或任意一行，右边会解释这一段。右栏的标签是这一行调用去了哪一块，点它回到地图。', 'Click a number on the left or any line to have that part explained. The tags on the right show which block each call goes to; click one to return to the map.')}</p>
    <div class="code"><div class="in">${rows}</div></div></div>`;
}
function zoomPanel(){ const b = S.zoom.back; return (b ? `<button class="back" type="button" data-z="trip">← ${L(`回到路线第 ${b.step + 1} 站`, `Back to stop ${b.step + 1} of the trip`)}</button>` : '') + zoomPanelBody(); }
function zoomPanelBody(){
  const Z = ZOOM[S.zoom.node];
  if (!S.zoom.fn){
    const zn = BY[S.zoom.node], open = Z.fns.some(f => canCode(f, zn)), next = Math.min(...Z.fns.filter(f => f.src).map(f => codeEp(f, zn) ?? Infinity));
    return `<button class="back" type="button" data-z="map">← ${L('回到项目地图', 'Back to the map')}</button><h2>${open ? L('怎么读这个文件', 'How to read this file') : L('这一集先认识它', 'For now, just get to know it')}</h2>
      <p>${open ? L('先别从第 1 行往下读。按下面的顺序，从最短的入口函数读起；每个函数先看“谁叫它、它叫谁”，再进代码。', 'Do not start at line 1. Go in this order, shortest entry point first; for each function, look at who calls it and what it calls before reading the code.')
        : L(`这一集只要认识下面几个入口函数：每个是被谁叫起来的、它又叫了谁，看左边的卡片就够了。逐段读代码在第 ${next} 集。`, `In this episode, just get to know the entry functions below: what calls each one and what it calls. The cards on the left are enough. Reading the code line by line comes in episode ${next}.`)}</p>
      <div class="list">${(Z.order || Z.fns.map(f => f.id)).map((id, i) => { const f = Z.fns.find(x => x.id === id); return canCode(f, BY[S.zoom.node])
        ? `<button class="opt" type="button" data-fn="${id}"><span class="rate">${i + 1}</span><b>${esc(f.name)}</b><small>${L(`${f.span[1] - f.span[0] + 1} 行 · 可放大到代码`, `${f.span[1] - f.span[0] + 1} lines · zoom into code`)}</small></button>`
        : `<div class="opt" style="cursor:default"><span class="rate">${i + 1}</span><b>${esc(f.name)}</b><small>${f.src ? L(`${f.span[1] - f.span[0] + 1} 行 · 第 ${codeEp(f, BY[S.zoom.node])} 集逐段读`, `${f.span[1] - f.span[0] + 1} lines · read line by line in episode ${codeEp(f, BY[S.zoom.node])}`) : L(`${f.span[1] - f.span[0] + 1} 行 · 还没放大`, `${f.span[1] - f.span[0] + 1} lines · no code view yet`)}</small></div>`; }).join('')}</div>
      ${Z.after && open ? `<p class="hint">${esc(Z.after)}</p>` : ''}`;
  }
  const F = Z.fns.find(f => f.id === S.zoom.fn), si = S.zoom.seg;
  if (si == null){
    return `<button class="back" type="button" data-z="file">← ${esc(BY[S.zoom.node].f)}</button><h2>${L(`${esc(F.name)} 分 ${F.segs.length} 段`, `${esc(F.name)} in ${F.segs.length} parts`)}</h2>
      <p>${L('按“做一件事”分段。点一段，看它读写了哪些共享数据、调用了谁。', 'Split by “one job each”. Click a part to see what shared state it reads and writes and what it calls.')}</p>
      <div class="list">${F.segs.map((g, i) => `<button class="opt" type="button" data-seg="${i}"><span class="rate">${i + 1}</span><b>${esc(g.t)}</b><small>${L(`第 ${g.a}–${g.b} 行`, `lines ${g.a}–${g.b}`)}</small></button>`).join('')}</div>`;
  }
  const g = F.segs[si], calls = Object.entries(F.at).filter(([no]) => no >= g.a && no <= g.b).flatMap(([, v]) => v);
  const uniq = [...new Map(calls.map(c => [c[1], c])).values()];
  return `<button class="back" type="button" data-z="segs">← ${L(`${esc(F.name)} 的 ${F.segs.length} 段`, `${esc(F.name)}: all ${F.segs.length} parts`)}</button>
    <div style="display:flex;gap:14px;align-items:flex-start"><span class="stepno">${si + 1}</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><h2 style="font-size:19px">${esc(g.t)}</h2><span class="hint">${L(`第 ${g.a}–${g.b} 行`, `lines ${g.a}–${g.b}`)}</span></div></div>
    <p>${esc(g.p)}</p>
    ${g.w.length || g.r.length ? `<div><h3>${esc(BOARD ? BOARD.t : L('共享数据', 'Shared state'))}</h3><ul class="kv">${g.w.map(f => `<li><b class="w">${L('写', 'write')}</b>${esc(f)}</li>`).join('')}${g.r.map(f => `<li><b class="r">${L('读', 'read')}</b>${esc(f)}</li>`).join('')}</ul></div>` : ''}
    ${uniq.length ? `<div><h3>${L('这一段调用了', 'Calls in this part')}</h3><div>${uniq.map(([id, fn]) => zchip(id, fn + '()')).join('')}</div></div>` : ''}
    <div class="ctrl"><button class="btn" type="button" data-seg="${si - 1}" ${si === 0 ? 'disabled' : ''}>${L('上一段', 'Previous')}</button><span class="count">${si + 1} / ${F.segs.length}</span><button class="btn go" type="button" data-seg="${si + 1}" ${si === F.segs.length - 1 ? 'disabled' : ''}>${L('下一段', 'Next')}</button></div>`;
}

/* ---------- clock lanes, drawn like a scope trace ---------- */
let scopeRaf = null;
function stopScope(){ cancelAnimationFrame(scopeRaf); scopeRaf = null; }
function startScope(){
  stopScope();
  const cv = $('#scope'); if (!cv) return;
  const cx = cv.getContext('2d'), W = cv.width, H = cv.height, css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
  const lanes = CLOCKS.filter(k => k.d), span = 4, still = matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now();
  const draw = now => {
    const t = still ? 2.2 : (now - t0) / 1000;
    cx.clearRect(0, 0, W, H);
    lanes.forEach((k, i) => {
      const y = 30 + i * 60, on = S.clock === k.id, per = k.d;
      cx.strokeStyle = col('--line'); cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, y + 18); cx.lineTo(W, y + 18); cx.stroke();
      cx.font = `${on ? 700 : 500} 22px ${col('--f-body')}`; cx.fillStyle = on ? col('--ink') : col('--mute'); cx.fillText(`${k.t} ${k.rate}`, 4, y - 6);
      cx.strokeStyle = on ? col('--signal') : col('--ink-2'); cx.lineWidth = on ? 4 : 2.5; cx.beginPath();
      for (let b = Math.ceil((t - span) / per) * per; b <= t; b += per){ const x = W - (t - b) / span * W; cx.moveTo(x, y + 18); cx.lineTo(x, y + 2); }
      cx.stroke();
      if (on && t - Math.floor(t / per) * per < .18){ cx.fillStyle = col('--signal'); cx.beginPath(); cx.arc(W - 10, y + 6, 7, 0, Math.PI * 2); cx.fill(); }
    });
    if (!still) scopeRaf = requestAnimationFrame(draw);
  };
  scopeRaf = requestAnimationFrame(draw);
}

/* ---------- chrome ---------- */
function renderEps(){
  $('#eps').innerHTML = epKeys.map(n => { const e = epInfo(n); return `<button class="ep" type="button" data-ep="${n}" aria-pressed="${n === S.ep}"><b>${String(n).padStart(2, '0')}</b><span>${esc(e.title)}</span><small>${L(`第 ${n} 集`, `Episode ${n}`)}</small></button>`; }).join('');
  const home = $('#home'); if (home) home.href = `index.html#${epInfo(S.ep).id}`;
}
function renderLedger(){
  const map = N.map(n => [level(n, S.ep), isNew(n, S.ep)]), seen = map.filter(x => x[0] === 1).length, read = map.filter(x => x[0] === 2).length;
  $('#ledgerText').innerHTML = L(`第 ${S.ep} 集学完：读懂 <b>${read}</b> 块，见过 <b>${seen}</b> 块，地图共 <b>${N.length}</b> 块`, `After episode ${S.ep}: <b>${read}</b> read, <b>${seen}</b> seen, of <b>${N.length}</b> blocks`);
  $('#ledgerBar').innerHTML = map.slice().sort((a, b) => b[0] - a[0] || b[1] - a[1]).map(([l, nw]) => `<i class="${nw ? 'n' : l === 2 ? 'r' : l === 1 ? 's' : ''}"></i>`).join('');
}
function renderViews(){
  $('#views').innerHTML = VIEWS.map(v => `<button type="button" role="tab" data-view="${v.id}" aria-selected="${v.id === S.view}">${esc(v.t)}<small>${esc(v.s)}</small></button>`).join('');
}
function ensureRoute(){ const a = EPS[S.ep].routes || []; if (!a.includes(S.route)) { S.route = a[a.length - 1] || null; S.step = 0; S.maxStep = 0; } }
function renderAll(){ ensureRoute(); renderEps(); renderLedger(); renderViews(); paintNodes(); renderSide(); }

/* ---------- events ---------- */
function flash(id, ok){
  const r = svg?.querySelector(`[data-id="${id}"] rect.b`); if (!r) return;
  r.style.stroke = ok ? 'var(--ok)' : 'var(--bad)'; r.style.strokeWidth = 4; setTimeout(() => { r.style.stroke = ''; r.style.strokeWidth = ''; }, 900);
}
function onNode(id){
  if (S.view === 'route' && !S.sel && S.guess && S.route){
    const R = ROUTES[S.route]; if (S.step >= R.steps.length - 1) return;
    const nx = R.steps[S.step + 1], st = S.gstats[S.route] = S.gstats[S.route] || {right: 0, total: 0};
    if (stepNode(nx) === stepNode(R.steps[S.step]) && nx.fn){ S.gmsg = {ok: null, t: L('下一站还在这个文件里：在右边选函数。', 'The next stop is in the same file: pick the function on the right.')}; paintNodes(); renderSide(); return; }
    if (nx.n.includes(id)){ if (S.gtries === 0) st.right++; st.total++; S.gtries = 0; goStep(S.step + 1); S.gmsg = {ok: true, t: L(`猜对了：${BY[id].t}。`, `Right: ${BY[id].t}.`)}; flash(id, true); }
    else { S.gtries++; const k = BY[nx.n[0]]; S.gmsg = {ok: false, t: L(`不是「${BY[id].t}」。提示：下一站在${k.board ? '共享数据' : `第 ${LK[k.k].n} 层（${LK[k.k].t}）`}。`, `Not “${BY[id].t}”. Hint: the next stop is in ${k.board ? 'the shared state' : `layer ${LK[k.k].n} (${LK[k.k].t})`}.`)}; flash(id, false); }
    paintNodes(); renderSide(); return;
  }
  const q = EPS[S.ep].qs?.[S.q];
  if (S.view === 'quiz' && !S.sel && q){
    if (q.multi){
      if ((S.answers[S.ep] || {})[S.q]) return;
      S.picks = S.picks.includes(id) ? S.picks.filter(x => x !== id) : [...S.picks, id]; paintNodes(); renderSide(); return;
    }
    const ok = q.a === id;
    S.answers[S.ep] = S.answers[S.ep] || {}; S.answers[S.ep][S.q] = {ok, pick: id}; saveProgress();
    if (ok){ const qi = S.q, nx = EPS[S.ep].qs.findIndex((_, i) => !(S.answers[S.ep][i]?.ok)); if (nx >= 0 && nx !== qi) setTimeout(() => { if (S.q === qi) { S.q = nx; S.picks = []; paintNodes(); renderSide(); } }, 2600); }
    flash(id, ok); renderSide(); return;
  }
  S.sel = S.sel === id ? null : id; paintNodes(); renderSide();
}
function zoomNav(b){
  const d = b.dataset;
  if (d.go){ closeZoom(d.go); return true; }
  if (d.z === 'map'){ closeZoom(); return true; }
  if (d.z === 'trip'){ const b = S.zoom.back; S.zoom = null; svg = null; $('#mapbox').innerHTML = ''; S.view = 'route'; S.route = b.route; S.step = b.step; renderViews(); paintNodes(); renderSide(); return true; }
  if (d.z === 'file'){ S.zoom.fn = null; S.zoom.seg = null; S.zoom.hl = null; }
  else if (d.z === 'segs'){ S.zoom.seg = null; }
  else if (d.fn){ const f = ZOOM[S.zoom.node].fns.find(x => x.id === d.fn); if (!canCode(f, BY[S.zoom.node])) return false; S.zoom.fn = d.fn; S.zoom.seg = null; S.zoom.hl = null; }
  else if (d.seg != null && S.zoom.fn){ S.zoom.seg = +d.seg; }
  else if (d.fnspan){ const f = ZOOM[S.zoom.node].fns.find(f => f.span[0] === +d.fnspan && canCode(f, BY[S.zoom.node])); if (!f) return false; S.zoom.fn = f.id; S.zoom.seg = null; }
  else return false;
  renderZoom(); renderSide(); return true;
}
function setEp(n){
  S.ep = n; store.set('atlas.ep', n); S.sel = null; S.field = 0; S.maxStep = 0;
  if (S.zoom && (!canZoom(S.zoom.node) || (S.zoom.fn && !canCode(ZOOM[S.zoom.node].fns.find(f => f.id === S.zoom.fn), BY[S.zoom.node])))){ S.zoom = null; svg = null; $('#mapbox').innerHTML = ''; } S.q = 0; S.step = 0; S.picks = []; S.gmsg = null; S.justLit = true;
  history.replaceState(null, '', '#' + epInfo(n).id); renderAll();
}
$('#eps').addEventListener('click', e => { const b = e.target.closest('[data-ep]'); if (b) setEp(+b.dataset.ep); });
window.addEventListener('hashchange', () => { const n = hashEp(); if (n && n !== S.ep) setEp(n); });
$('#views').addEventListener('click', e => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  S.view = b.dataset.view; store.set('atlas.view', S.view); S.sel = null; S.gmsg = null;
  if (S.zoom){ S.zoom = null; svg = null; $('#mapbox').innerHTML = ''; }
  renderViews(); paintNodes(); renderSide();
});
$('#mapbox').addEventListener('click', e => { if (!S.zoom) return; const b = e.target.closest('[data-go],[data-z],[data-fn],[data-seg],[data-fnspan]'); if (b) zoomNav(b); });
$('#side').addEventListener('click', e => {
  const b = e.target.closest('button,[role="button"]'); if (!b) return; const d = b.dataset;
  if (S.zoom){ zoomNav(b); return; }
  if (d.act === 'zoom'){ openZoom(S.sel); return; }
  if (d.act === 'guess'){ S.guess = !S.guess; store.set('atlas.guess', S.guess); S.gmsg = null; S.gtries = 0; }
  else if (d.act === 'reveal'){ const st = S.gstats[S.route] = S.gstats[S.route] || {right: 0, total: 0}; st.total++; S.gtries = 0; goStep(S.step + 1); S.gmsg = {ok: null, t: L('看了答案，这一步不计分。', 'Answer shown; this step does not score.')}; }
  else if (d.fguess){
    const R = ROUTES[S.route], nx = R.steps[S.step + 1], F = ZOOM[stepNode(nx)].fns.find(f => f.id === d.fguess), st = S.gstats[S.route] = S.gstats[S.route] || {right: 0, total: 0};
    if (d.fguess === nx.fn){ if (S.gtries === 0) st.right++; st.total++; S.gtries = 0; goStep(S.step + 1); S.gmsg = {ok: true, t: L(`猜对了：${F.name}。`, `Right: ${F.name}.`)}; }
    else { S.gtries++; S.gmsg = {ok: false, t: L(`不是 ${F.name}。提示：看上一站的代码最后调用了谁，或者它返回到了哪里。`, `Not ${F.name}. Hint: look at what the last stop’s code calls, or where it returns to.`)}; }
  }
  else if (d.stop != null){ if (!S.guess || +d.stop <= S.maxStep){ goStep(+d.stop); S.gmsg = null; S.gtries = 0; } }
  else if (d.act === 'opencode'){ const st = ROUTES[S.route].steps[S.step]; openZoom(stepNode(st), st.fn, [st.start, st.start + st.src.length - 1], {route: S.route, step: S.step}); return; }
  else if (d.act === 'toquiz'){ S.view = 'quiz'; store.set('atlas.view', S.view); S.gmsg = null; renderViews(); }
  else if (d.act === 'submit'){ const q = EPS[S.ep].qs[S.q], ok = q.a.length === S.picks.length && q.a.every(x => S.picks.includes(x)); S.answers[S.ep] = S.answers[S.ep] || {}; S.answers[S.ep][S.q] = {ok, picks: S.picks.slice()}; saveProgress(); }
  else if (d.act === 'clearpick'){ S.picks = []; }
  else if (d.act === 'redo'){ delete S.answers[S.ep][S.q]; saveProgress(); S.picks = []; }
  else if (d.act === 'back'){ S.sel = null; }
  else if (d.node){ S.sel = d.node; }
  else if (d.clock){ S.clock = d.clock; }
  else if (d.field){ S.field = +d.field; }
  else if (d.route){ S.route = d.route; S.step = 0; S.maxStep = 0; S.gmsg = null; S.gtries = 0; }
  else if (d.act === 'next'){ goStep(S.step + 1); }
  else if (d.act === 'prev'){ S.step = Math.max(0, S.step - 1); S.gmsg = null; S.gtries = 0; }
  else if (d.act === 'restart'){ S.step = 0; S.maxStep = 0; S.gmsg = null; S.gtries = 0; delete S.gstats[S.route]; }
  else if (d.q != null){ if (+d.q !== S.q) S.picks = []; S.q = +d.q; }
  else if (d.act === 'resetq'){ S.answers[S.ep] = {}; saveProgress(); S.q = 0; S.picks = []; }
  else return;
  paintNodes(); renderSide();
});
$('#side').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('keydown', e => {
  if (S.view !== 'route' || S.sel || S.zoom || S.guess || !S.route) return;
  if (e.key === 'ArrowRight'){ goStep(S.step + 1); paintNodes(); renderSide(); }
  if (e.key === 'ArrowLeft'){ S.step = Math.max(0, S.step - 1); paintNodes(); renderSide(); }
});

/* ---------- static text ---------- */
document.title = M.title + (window.COURSE_META ? ' · ' + window.COURSE_META.title : '');
$('#course').textContent = window.COURSE_META ? window.COURSE_META.title : '';
$('#title').textContent = M.title;
$('#lead').textContent = M.lead;
$('#foot').textContent = M.footer || '';
if (window.langToggle) langToggle($('#tools'));
history.replaceState(null, '', '#' + epInfo(S.ep).id);
renderAll();
})();
