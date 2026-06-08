// utils.js — Utilidades compartidas del frontend

export function showToast(msg, type = 'normal') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'error' ? 'error show' : 'show';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show', 'error'), 2500);
}

export function formatDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = +m[1]||0, min = +m[2]||0, sec = +m[3]||0;
  return h ? `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
           : `${min}:${String(sec).padStart(2,'0')}`;
}

export function timeFromPct(pct, duration) {
  const parts = duration.split(':');
  const total = parts.length === 3
    ? +parts[0]*3600 + +parts[1]*60 + +parts[2]
    : +parts[0]*60 + +parts[1];
  const elapsed = Math.round(total * pct / 100);
  const m = Math.floor(elapsed/60), s = elapsed%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.forEach(c => c && el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}
