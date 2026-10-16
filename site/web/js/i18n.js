/* Interface language: 中文 or English.
   The choice lives in localStorage 'course.lang' (shared with the lab pages under /content/); the default follows the browser.
   - L(zh, en)            pick a string for the current language
   - overlay(base, en)    deep-merge an English overlay into Chinese data; arrays of objects match by id, then n, then index
   - [data-en]            static HTML: replace the element's text in English mode (data-en-label / data-en-title for attributes);
                          load this file at the end of <body>, before the page's other scripts
   - langToggle(parent)   add the 中 / EN switch; switching reloads the page */
(() => {
  let lang = null;
  try { lang = localStorage.getItem('course.lang'); } catch {}
  if (lang !== 'zh' && lang !== 'en') lang = /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
  const EN = lang === 'en';
  window.LANG = lang;
  document.documentElement.lang = EN ? 'en' : 'zh-CN';
  window.L = (zh, en) => EN && en != null ? en : zh;

  const plain = v => v && typeof v === 'object' && !Array.isArray(v);
  function overlay(base, over){
    if (over === undefined) return base;
    if (Array.isArray(base) && plain(over)){
      base.forEach((x, i) => {
        const k = plain(x) ? (x.id ?? x.n ?? i) : i;
        if (k in over) base[i] = overlay(x, over[k]);
      });
      return base;
    }
    if (plain(base) && plain(over)){
      for (const k of Object.keys(over)) base[k] = overlay(base[k], over[k]);
      return base;
    }
    return over;
  }
  window.overlay = overlay;
  // English data files call this; in Chinese mode they change nothing.
  window.enOverlay = (base, en) => EN ? overlay(base, en) : base;

  function setLang(l){ try { localStorage.setItem('course.lang', l); } catch {} location.reload(); }
  window.langToggle = parent => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lang';
    b.innerHTML = `<span class="${EN ? '' : 'on'}">中</span><span class="${EN ? 'on' : ''}">EN</span>`;
    b.title = EN ? '切换到中文' : 'Switch to English';
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', () => setLang(EN ? 'zh' : 'en'));
    parent.append(b);
    return b;
  };

  function applyStatic(){
    if (!EN) return;
    document.querySelectorAll('[data-en]').forEach(e => { e.textContent = e.dataset.en; });
    document.querySelectorAll('[data-en-label]').forEach(e => e.setAttribute('aria-label', e.dataset.enLabel));
    document.querySelectorAll('[data-en-title]').forEach(e => e.setAttribute('title', e.dataset.enTitle));
  }
  // loaded at the end of <body>, before the page's own scripts, so the static markup is already there
  applyStatic();
})();
