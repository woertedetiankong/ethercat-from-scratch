/* Dojo workbench: lesson + hints, editor, results + timeline. Level content comes from js/dojos/<id>.js (window.COURSE). */
(() => {
const C = window.COURSE;
const D = encodeURIComponent(C.id);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = {
  get(k, d){ try { const v = localStorage.getItem('dojo.' + C.id + '.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('dojo.' + C.id + '.' + k, JSON.stringify(v)); } catch {} },
};

/* ---------------- token ---------------- */
let token = new URLSearchParams(location.search).get('t');
try { if (token) sessionStorage.setItem('dojo.token', token); else token = sessionStorage.getItem('dojo.token'); } catch {}
if (token && location.search) history.replaceState(null, '', location.pathname + '?d=' + D);
document.title = C.title + ' · ' + (C.subtitle || '');
$('#dojoTitle').textContent = C.title; $('#dojoSub').textContent = C.subtitle || '';
$('#runner').after(langToggle($('.top')));
const msgOf = t => L(t.msg, t.msg_en || t.msg);

async function api(path, opts = {}){
  const r = await fetch(path, {...opts, headers: {...(opts.headers || {}), 'X-Dojo-Token': token || ''}});
  if (r.status === 401){ $('#gate').hidden = false; throw new Error('unauthorized'); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ---------------- state ---------------- */
let level = store.get('level', 1);
let passed = new Set(store.get('passed', []));
let hintsShown = store.get('hints', {});
let results = {};                 // level -> run result
let files = {};                   // name -> {doc, mtime, saved (content on disk), dirty}
let current = null, editor, running = false, tlTest = null, errMarks = [];

/* ---------------- editor + files ---------------- */
function setSaved(text){ $('#saved').textContent = text; }
async function loadFiles(initial){
  const list = await api('/api/files?dojo=' + D);
  for (const f of list){
    const have = files[f.name];
    if (!have){
      files[f.name] = {doc: CodeMirror.Doc(f.content, modeOf()), mtime: f.mtime, saved: f.content, dirty: false};
      files[f.name].doc.on('change', () => onEdit(f.name));
    } else if (f.mtime > have.mtime && f.content !== have.saved){
      if (!have.dirty){
        const cur = have.doc.getCursor(); have.doc.setValue(f.content); have.doc.setCursor(cur);
        have.saved = f.content; have.mtime = f.mtime; have.dirty = false;
        setSaved(L(`${f.name} 在别的编辑器里改过，已经同步。`, `${f.name} was changed in another editor; synced.`));
      } else setSaved(L(`注意：${f.name} 在别的编辑器里也改过。这里的修改保存时会覆盖它。`, `Note: ${f.name} was also changed in another editor. Saving here will overwrite it.`));
    }
  }
  if (initial) renderTabs();
}
const saveTimers = {};
function onEdit(name){
  const f = files[name];
  f.dirty = f.doc.getValue() !== f.saved;
  renderTabs();
  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(() => save(name), 600);
}
async function save(name){
  const f = files[name]; if (!f || !f.dirty) return;
  const content = f.doc.getValue();
  try {
    const r = await api('/api/file?dojo=' + D + '&name=' + encodeURIComponent(name), {method: 'PUT', body: content});
    f.saved = content; f.mtime = r.mtime; f.dirty = f.doc.getValue() !== content;
    setSaved(L('已保存', 'Saved') + ` · ${C.id}/${name}`);
  } catch (e){ setSaved(L(`保存 ${name} 失败：${e.message}`, `Could not save ${name}: ${e.message}`)); }
  renderTabs();
}
async function saveAll(){ await Promise.all(Object.keys(files).map(n => { clearTimeout(saveTimers[n]); return save(n); })); }
function open(name, line){
  if (!files[name]) return;
  clearMarks(); current = name; editor.swapDoc(files[name].doc); renderTabs(); markErrors();
  if (line){ editor.setCursor({line: line - 1, ch: 0}); editor.scrollIntoView({line: line - 1, ch: 0}, 120); editor.focus(); }
}
const ORDER = C.fileOrder || [];
function renderTabs(){
  const lv = C.levels.find(l => l.n === level);
  const names = Object.keys(files).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  $('#tabs').innerHTML = names.map(n => `<button class="tab ${n === current ? 'on' : ''} ${n === lv.file ? 'focus-file' : ''}" type="button" role="tab" aria-selected="${n === current}" data-f="${esc(n)}">${esc(n)}${files[n].dirty ? '<span class="dirty"> *</span>' : ''}</button>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => open(b.dataset.f)));
}

/* ---------------- run ---------------- */
async function run(){
  if (running) return;
  running = true; $('#run').disabled = true;
  $('#results').innerHTML = `<div class="running"><span class="pencil"></span>${L('正在运行', 'Running')} ${esc(meta().label || 'tests')}…</div>`;
  try {
    await saveAll();
    const r = await api('/api/run?dojo=' + D, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({level})});
    results[r.level] = r;
    const ok = r.ok && r.tests.length && r.tests.every(t => t.ok);
    if (ok && !passed.has(r.level)){ passed.add(r.level); store.set('passed', [...passed]); }
    tlTest = r.tests.find(t => !t.ok && t.events) || r.tests.find(t => t.events) || null;
  } catch (e){
    results[level] = {level, ok: false, tests: [], fatal: {code: 'internal', msg: L('没能运行测试：' + e.message + '。本地运行器还在运行吗？', 'Could not run the tests: ' + e.message + '. Is the local runner still running?')}};
  }
  running = false; $('#run').disabled = false;
  renderLevels(); renderResults(); renderHints(); renderTimeline(); markErrors();
}

/* ---------------- error marks in the editor ---------------- */
function clearMarks(){
  errMarks.forEach(l => { editor.removeLineClass(l, 'wrap', 'err-line'); editor.setGutterMarker(l, 'errs', null); });
  errMarks = [];
}
function markErrors(){
  clearMarks();
  const r = results[level], note = $('#penNote');
  note.hidden = true;
  if (!r || !current) return;
  const marks = [];
  (r.build_errors || []).forEach(b => b.file === current && marks.push([b.line, b.msg]));
  const texts = [r.fatal?.detail, r.fatal?.output, ...r.tests.flatMap(t => [t.detail, t.output])].filter(Boolean).join('\n');
  const re = new RegExp('(?:^|[\\s/])' + current.replace('.', '\\.') + ':(\\d+)', 'gm');
  for (const m of texts.matchAll(re)) if (!marks.some(x => x[0] === +m[1])) marks.push([+m[1], null]);
  marks.slice(0, 8).forEach(([n]) => {
    if (n < 1 || n > editor.lineCount()) return;
    const h = editor.addLineClass(n - 1, 'wrap', 'err-line');
    const g = document.createElement('span'); g.className = 'err-gutter'; g.textContent = '✗';
    editor.setGutterMarker(n - 1, 'errs', g); errMarks.push(h);
  });
  const first = marks.find(m => m[1]) || marks[0];
  if (first){ note.hidden = false; note.textContent = L(`↑ 第 ${first[0]} 行${first[1] ? '：' + first[1] : '：测试报告里提到了这一行'}`, `↑ Line ${first[0]}${first[1] ? ': ' + first[1] : ': the test report mentions this line'}`); }
}

/* ---------------- results ---------------- */
function renderResults(){
  const box = $('#results'), r = results[level], lv = C.levels.find(l => l.n === level);
  if (!r){
    const cmd = `<code>${esc(meta().label || 'tests')}</code>`;
    box.innerHTML = L(`<div class="empty"><span class="big">还没跑过第 ${level} 关</span><p>写好代码后点「运行测试」，或者按 ⌘/Ctrl + Enter。代码会先保存到你电脑上的文件，然后运行真正的 ${cmd}。</p></div>`,
      `<div class="empty"><span class="big">Level ${level} hasn't been run yet</span><p>When your code is ready, press Run tests or ⌘/Ctrl + Enter. Your code is saved to the files on your computer first, then the real ${cmd} runs.</p></div>`);
    return;
  }
  let h = '';
  if (r.build_errors?.length){
    h += `<div class="score"><span class="ring">!</span><span class="say">${L('没能编译', 'Build failed')}<small>${L('点击错误跳到对应的行', 'Click an error to jump to its line')}</small></span></div><div class="berr">${r.build_errors.map((b, i) => `<button type="button" data-be="${i}">${esc(b.file)}:${b.line}:${b.col}  ${esc(b.msg)}</button>`).join('')}</div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-be]').forEach(b => b.addEventListener('click', () => { const e = r.build_errors[+b.dataset.be]; open(e.file, e.line); }));
    return;
  }
  const n = r.tests.length, k = r.tests.filter(t => t.ok).length, all = n && k === n;
  if (n) h += `<div class="score ${all ? 'all' : ''}"><span class="ring">${k}/${n}</span><span class="say">${all ? L('全部通过！', 'All passed!') : n > 1 && k === n - 1 ? L('还差一个！', 'One to go!') : L('继续加油', 'Keep going')}<small>${L(`用时 ${r.seconds.toFixed(1)} 秒`, `${r.seconds.toFixed(1)} s`)}${r.race && /race/.test(meta().label || '') ? L(' · 开着 -race', ' · with -race') : ''}</small></span></div>`;
  if (all){
    const next = C.levels.find(l => l.n === level + 1);
    h += `<div class="pass"><b>${L(`第 ${level} 关通过`, `Level ${level} passed`)}</b><span>${next ? L('下一关：', 'Next: ') + esc(next.title) : esc(C.finalNote || L('全部完成！', 'All done!'))}</span>${next ? `<button class="btn next" type="button" id="next">${L(`去第 ${next.n} 关`, `On to level ${next.n}`)} →</button>` : ''}</div>`;
  }
  if (r.fatal){
    h += `<div class="test bad"><div class="body" style="padding-left:0"><p class="msg">${esc(msgOf(r.fatal) || C.common[r.fatal.code] || L('运行出错', 'Run failed'))}</p>${r.fatal.detail ? `<pre class="box">${esc(r.fatal.detail)}</pre>` : ''}${r.fatal.output ? `<pre class="box">${esc(r.fatal.output)}</pre>` : ''}</div></div>`;
  }
  const firstBad = r.tests.findIndex(t => !t.ok);
  h += r.tests.map((t, i) => `<details class="test ${t.ok ? 'ok' : 'bad'}" ${i === firstBad ? 'open' : ''}>
    <summary><span class="m">${t.ok ? '✓' : '×'}</span><span class="nm">${esc(lv.tests[t.name] || t.name)}</span><span class="el">${t.elapsed.toFixed(1)}s</span></summary>
    <div class="body">
      ${t.ok ? '' : `<p class="msg">${esc(msgOf(t) || C.common[t.code] || L('测试失败', 'Test failed'))}</p>`}
      ${t.detail ? `<pre class="box">${esc(t.detail)}</pre>` : ''}
      ${t.diff ? `<div class="diff"><div class="m"><b>${L('应该有', 'Missing')}</b><pre class="box">${esc((t.diff.missing || []).join('\n') || '—')}</pre></div><div class="x"><b>${L('实际多出', 'Unexpected')}</b><pre class="box">${esc((t.diff.extra || []).join('\n') || '—')}</pre></div></div>` : ''}
      ${t.output && !t.ok ? `<details><summary class="linkish">${L('程序输出', 'Program output')}</summary><pre class="box">${esc(t.output)}</pre></details>` : ''}
      ${t.events ? `<button class="linkish" type="button" data-tl="${i}">${L('在时间线里看看', 'See it on the timeline')} →</button>` : ''}
    </div></details>`).join('');
  box.innerHTML = h;
  $('#next')?.addEventListener('click', () => go(level + 1));
  box.querySelectorAll('[data-tl]').forEach(b => b.addEventListener('click', () => { tlTest = r.tests[+b.dataset.tl]; renderTimeline(); $('#timeline').scrollIntoView({behavior: 'smooth', block: 'nearest'}); }));
}

/* ---------------- timeline ----------------
   Tests can save a trace (shared/dojo Trace): events {t, lane, k: begin|end|mark, id, label, bad}.
   The default view draws one row per lane, a bar from each begin to its matching end, and marks as ticks
   (red crosses when bad). A dojo can draw its own view by defining C.renderTimeline(test) → HTML string. */
function renderTimeline(){
  const box = $('#timeline'), r = results[level];
  const withEv = r ? r.tests.filter(t => t.events && t.events.length) : [];
  if (!withEv.length){
    box.innerHTML = `<h2>${L('时间线', 'Timeline')}</h2><p class="muted" style="color:var(--mute);font-size:13.5px">${esc(C.timelineIntro || L('测试运行时记录下来的事件会画在这里。', 'Events recorded while the tests run are drawn here.'))}</p>`;
    return;
  }
  if (!withEv.includes(tlTest)) tlTest = withEv[0];
  const lv = C.levels.find(l => l.n === level);
  const pick = `<select id="tlSel" aria-label="${L('选择测试', 'Pick a test')}">${withEv.map((t, i) => `<option value="${i}" ${t === tlTest ? 'selected' : ''}>${t.ok ? '✓' : '✗'} ${esc(lv.tests[t.name] || t.name)}</option>`).join('')}</select>`;
  box.innerHTML = `<h2>${L('时间线', 'Timeline')}</h2>${pick}${C.renderTimeline ? C.renderTimeline(tlTest, {esc, width: Math.max(300, box.clientWidth - 44)}) : lanesView(tlTest, Math.max(300, box.clientWidth - 44))}`;
  $('#tlSel').addEventListener('change', e => { tlTest = withEv[+e.target.value]; renderTimeline(); });
}
const lbl = e => L(e.label, e.label_en) || '';
function lanesView(test, W){
  const ev = test.events, lanes = [...new Set(ev.map(e => e.lane))];
  const tEnd = Math.max(test.t_end || 0, ...ev.map(e => e.t), 0.05);
  const L = 64, Rm = 10, top = 12, lane = 34, H = top + lanes.length * lane + 22;
  const X = t => L + (t / tEnd) * (W - L - Rm), Y = l => top + lanes.indexOf(l) * lane + lane / 2;
  const pal = ['var(--l0)', 'var(--l1)', 'var(--l2)', 'var(--l3)'];
  let s = '';
  const step = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10].find(x => tEnd / x <= 6) || 20;
  for (let t = 0; t <= tEnd + 1e-9; t += step) s += `<text x="${X(t)}" y="${H - 4}" font-size="10.5" fill="var(--faint)" text-anchor="middle">${+t.toFixed(3)}s</text>`;
  lanes.forEach(l => { const y = Y(l); s += `<text x="4" y="${y + 4}" font-size="11.5" font-weight="600" fill="var(--ink)">${esc(l)}</text><path d="M${L},${y} L${X(tEnd)},${y}" stroke="var(--edge-2)" stroke-width="1.5" stroke-dasharray="2 5"/>`; });
  ev.forEach((e, i) => {
    if (e.k !== 'begin') return;
    const f = ev.slice(i + 1).find(x => x.k === 'end' && x.lane === e.lane && x.id === e.id);
    const end = f ? f.t : tEnd, x = X(e.t), w = Math.max(4, X(end) - x), y = Y(e.lane), c = e.bad || (f && f.bad) ? 'var(--bad)' : pal[i % 4];
    s += `<g><title>${esc(lbl(e) || e.id || '')} · ${e.t.toFixed(3)}s → ${end.toFixed(3)}s${f ? '' : L('（没有结束）', ' (never ended)')}</title><rect x="${x}" y="${y - 10}" width="${w}" height="20" rx="6" fill="${c}" fill-opacity="${f ? .18 : .06}" stroke="${c}" stroke-width="1.5" ${f ? '' : 'stroke-dasharray="5 4"'}/>${w > 24 && e.label ? `<text x="${x + 5}" y="${y + 4}" font-size="11" font-weight="600" fill="${c}">${esc(lbl(e))}</text>` : ''}</g>`;
  });
  ev.forEach(e => {
    if (e.k !== 'mark') return;
    const x = X(e.t), y = Y(e.lane);
    s += e.bad ? `<g stroke="var(--bad)" stroke-width="2.5" stroke-linecap="round"><title>${esc(lbl(e))} @ ${e.t.toFixed(3)}s</title><path d="M${x - 7},${y - 8} L${x + 7},${y + 8} M${x + 7},${y - 8} L${x - 7},${y + 8}"/></g>`
               : `<path d="M${x},${y - 10} L${x},${y + 10}" stroke="var(--ink-2)" stroke-width="2.5" stroke-linecap="round"><title>${esc(lbl(e))} @ ${e.t.toFixed(3)}s</title></path>`;
  });
  const list = ev.filter(e => e.k !== 'end').slice(0, 300);
  return `<svg class="tl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('时间线', 'Timeline')}">${s}</svg>
    <ol class="evlist">${list.map(e => `<li class="${e.bad ? 'crash' : ''}"><span class="t">${e.t.toFixed(3)}s</span><span class="w">${esc(e.lane)}</span><span>${esc(lbl(e) || e.k)}</span></li>`).join('')}</ol>`;
}

/* ---------------- lesson, hints, levels ---------------- */
function renderLesson(){
  const lv = C.levels.find(l => l.n === level);
  $('#lesson').innerHTML = `<span class="lvn">Level ${lv.n}</span><h1>${esc(lv.title)}</h1><div class="concept">${lv.concept}</div>
    <p class="task-h">${L('要做的事', 'Your task')}</p><ol class="task">${lv.task.map(t => `<li>${t}</li>`).join('')}</ol>
    <button class="file-link" type="button" id="openFile">${L('打开', 'Open')} ${esc(lv.file)} →</button>`;
  $('#openFile').addEventListener('click', () => open(lv.file));
}
function renderHints(){
  const lv = C.levels.find(l => l.n === level), r = results[level];
  const codes = r ? [...new Set([r.fatal?.code, ...(r.build_errors?.length ? ['build'] : []), ...r.tests.filter(t => !t.ok).map(t => t.code)].filter(Boolean))] : [];
  const targeted = codes.map(c => lv.byCode[c] || C.common[c]).filter(Boolean).slice(0, 2);
  const shown = hintsShown[level] || 0;
  let h = `<h2>${L('提示', 'Hints')}</h2>`;
  h += targeted.map(t => `<div class="hint targeted"><span class="k">${L('针对刚才的失败', 'About this failure')}</span><span>${t}</span></div>`).join('');
  h += lv.tiers.slice(0, shown).map((t, i) => `<div class="hint"><span class="k">${L('提示', 'Hint')} ${i + 1}${i === 2 ? L(' · 思路', ' · the approach') : ''}</span><span>${esc(t)}</span></div>`).join('');
  if (!targeted.length && !shown) h += `<p class="muted">${L('先自己试试。跑一下测试，失败了这里会告诉你原因。', 'Try it yourself first. Run the tests; if they fail, this panel tells you why.')}</p>`;
  if (shown < lv.tiers.length) h += `<button class="btn" type="button" id="moreHint">${shown ? L('翻到下一条', 'Next hint') : L('我卡住了', "I'm stuck")} → (${shown + 1}/${lv.tiers.length})</button>`;
  else h += `<p class="muted">${L('提示都翻完了。还卡着的话，打开时间线看看到底发生了什么。', "That's every hint. Still stuck? Open the timeline and see what actually happened.")}</p>`;
  $('#hints').innerHTML = h;
  $('#moreHint')?.addEventListener('click', () => { hintsShown[level] = shown + 1; store.set('hints', hintsShown); renderHints(); });
}
function renderLevels(){
  $('#levels').innerHTML = C.levels.map(l => `<button class="lv ${passed.has(l.n) ? 'done' : ''} ${l.n === level ? 'cur' : ''}" type="button" data-lv="${l.n}" title="${L(`第 ${l.n} 关：`, `Level ${l.n}: `)}${esc(l.title)}"><span class="n">${passed.has(l.n) && l.n !== level ? '✓' : l.n}</span>${esc(l.short)}</button>`).join('');
  $('#levels').querySelectorAll('.lv').forEach(b => b.addEventListener('click', () => go(+b.dataset.lv)));
}
function go(n){
  level = n; store.set('level', n);
  renderLevels(); renderLesson(); renderHints(); renderResults(); renderTimeline();
  const lv = C.levels.find(l => l.n === n);
  if (files[lv.file]) open(lv.file); else renderTabs();
}

/* ---------------- boot ---------------- */
let info = {};
// per-dojo facts from the runner: {lang, editor (CodeMirror mode), label (test command), toolchain, missing}
const meta = () => (info.meta && info.meta[C.id]) || {};
const modeOf = () => C.mode || meta().editor || 'text/plain';
async function boot(){
  if (!token){ $('#gate').hidden = false; return; }
  editor = CodeMirror.fromTextArea($('#code'), {
    mode: modeOf(), lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: true, matchBrackets: true, autoCloseBrackets: true,
    styleActiveLine: true, gutters: ['errs', 'CodeMirror-linenumbers'],
    extraKeys: {'Cmd-Enter': run, 'Ctrl-Enter': run, 'Cmd-S': () => saveAll(), 'Ctrl-S': () => saveAll()},
  });
  try {
    info = await api('/api/info');
    $('#runner').className = 'runner ok';
    editor.setOption('mode', modeOf());
    const m = meta();
    if (m.missing){ $('#runner').className = 'runner bad'; $('#runnerText').textContent = L('缺少工具链：', 'Toolchain missing: ') + L(m.missing.split(' / ')[0], m.missing.split(' / ')[1] || m.missing); }
    else $('#runnerText').textContent = L('本地运行器已连接', 'Local runner connected') + ` · ${m.toolchain || info.runtime}`;
    await loadFiles(true);
  } catch (e){
    if (e.message === 'unauthorized') return;
    $('#runner').className = 'runner bad'; $('#runnerText').textContent = L('连不上本地运行器，请在终端运行 npm start', 'Cannot reach the local runner; run npm start in a terminal');
  }
  $('#run').addEventListener('click', run);
  go(level);
  setSaved(info.workspace ? L(`代码就在你电脑上的 ${C.id} 文件夹里，也可以用 VS Code 打开编辑。`, `Your code is in the ${C.id} folder on your computer; you can also edit it in VS Code.`) : '');
  if (info.workspace) $('#saved').title = info.workspace + '/' + C.id;
  const sync = () => loadFiles(false).catch(() => {});
  addEventListener('focus', sync);
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 4000);
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderTimeline, 150); });
}
boot();
})();
