// room.js — Lógica de la sala de usuario
import { search, addToQueue } from '/js/api.js';
import { showToast, timeFromPct, createElement } from '/js/utils.js';

const roomCode = location.pathname.split('/').pop();
let socket, ytPlayer, ytReady = false;
let currentSong = null, isPlaying = false;
let activeSource = 'youtube';

// ── Socket.IO ──────────────────────────────────────────
function connectSocket() {
  socket = io({ transports: ['websocket'] });

  socket.on('connect', () => {
    socket.emit('join_room', { roomCode, isAdmin: false });
  });

  socket.on('room_state', ({ currentSong: song, isPlaying: playing, progressPct, queue }) => {
    currentSong = song;
    isPlaying = playing;
    updateNowPlaying(song);
    renderQueue(queue);
    updateProgress(progressPct, song?.duration);
    if (song && ytReady && playing) loadYT(song.videoId);
  });

  socket.on('song_changed', ({ currentSong: song, isPlaying: playing, queue }) => {
    currentSong = song;
    isPlaying = playing;
    updateNowPlaying(song);
    renderQueue(queue);
    if (song && ytReady) loadYT(song.videoId);
    showToast(song ? `▶ ${song.title}` : 'Cola vacía');
  });

  socket.on('queue_updated', queue => renderQueue(queue));

  socket.on('playback_state', ({ isPlaying: p }) => {
    isPlaying = p;
    updatePlayIcon(p);
    if (ytPlayer && ytReady) p ? ytPlayer.playVideo() : ytPlayer.pauseVideo();
  });

  socket.on('progress_sync', ({ progressPct }) => {
    updateProgress(progressPct, currentSong?.duration);
  });

  socket.on('user_count', n => {
    const el = document.getElementById('user-count');
    if (el) el.textContent = n;
  });

  socket.on('error', ({ message }) => showToast(message, 'error'));
}

// ── YouTube IFrame API ────────────────────────────────
window.onYouTubeIframeAPIReady = () => {
  ytPlayer = new YT.Player('yt-player', {
    height: '100%', width: '100%',
    playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1 },
    events: {
      onReady: () => { ytReady = true; if (currentSong && isPlaying) loadYT(currentSong.videoId); },
      onStateChange: e => {
        if (e.data === YT.PlayerState.ENDED) socket?.emit('admin_next', { roomCode });
      }
    }
  });
  document.getElementById('yt-player').style.display = 'block';
  document.getElementById('art-ph').style.display = 'none';
};

function loadYT(videoId) {
  if (!ytPlayer || !ytReady) return;
  ytPlayer.loadVideoById(videoId);
}

// ── UI: Canción actual ─────────────────────────────────
function updateNowPlaying(song) {
  document.getElementById('np-title').textContent   = song?.title   || 'Sin canción activa';
  document.getElementById('np-channel').textContent = song?.channel || '—';
  updatePlayIcon(isPlaying);
  if (!song) {
    document.getElementById('art-ph').style.display = 'flex';
  }
}

function updatePlayIcon(playing) {
  const icon = document.getElementById('u-pp-icon');
  if (icon) icon.className = playing ? 'ti ti-player-pause' : 'ti ti-player-play';
}

function updateProgress(pct, duration) {
  const fill = document.getElementById('u-prog');
  const elapsed = document.getElementById('u-elapsed');
  const total = document.getElementById('u-total');
  if (fill) fill.style.width = Math.round(pct || 0) + '%';
  if (duration) {
    if (total) total.textContent = duration;
    if (elapsed) elapsed.textContent = timeFromPct(pct || 0, duration);
  }
}

// ── UI: Cola ──────────────────────────────────────────
function renderQueue(queue) {
  const list = document.getElementById('queue-list');
  const count = document.getElementById('qp-count');
  const active = queue.filter(s => !currentSong || s.video_id !== currentSong.videoId);
  if (count) count.textContent = `(${active.length})`;
  if (!list) return;
  list.innerHTML = '';
  if (!active.length) {
    list.appendChild(createElement('div', { className: 'empty-msg', textContent: 'Cola vacía' }));
    return;
  }
  active.forEach((song, i) => {
    const item = createElement('div', { className: 'qp-item' }, [
      createElement('span', { className: 'q-pos', textContent: String(i+1) }),
      song.thumb_url
        ? createElement('img', { className: 'q-thumb', src: song.thumb_url, alt: '' })
        : createElement('div', { className: 'q-thumb-ph' }, [createElement('i', { className: 'ti ti-music' })]),
      createElement('div', { className: 'q-info' }, [
        createElement('div', { className: 'q-title', textContent: song.title }),
        createElement('div', { className: 'q-artist', textContent: song.channel })
      ]),
      createElement('span', { className: 'q-dur', textContent: song.duration || '' })
    ]);
    list.appendChild(item);
  });
}

// ── Búsqueda ──────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  const area = document.getElementById('search-results');
  area.innerHTML = '<div class="searching">Buscando...</div>';
  try {
    const { results } = await search(q, activeSource);
    renderResults(results);
  } catch (err) {
    area.innerHTML = '';
    showToast(err.message, 'error');
  }
}

function renderResults(results) {
  const area = document.getElementById('search-results');
  area.innerHTML = '';
  if (!results.length) {
    area.appendChild(createElement('div', { className: 'empty-msg', textContent: 'Sin resultados' }));
    return;
  }
  results.forEach(r => {
    const addBtn = createElement('button', { className: 'add-btn', 'aria-label': `Agregar ${r.title}` },
      [createElement('i', { className: 'ti ti-plus' })]);
    const row = createElement('div', { className: 'result-row' }, [
      r.thumb
        ? createElement('img', { className: 'r-thumb', src: r.thumb, alt: '' })
        : createElement('div', { className: 'r-thumb-ph' }, [createElement('i', { className: 'ti ti-music' })]),
      createElement('div', { className: 'r-info' }, [
        createElement('div', { className: 'r-title', textContent: r.title }),
        createElement('div', { className: 'r-ch', textContent: `${r.channel} · ${r.duration}` })
      ]),
      addBtn
    ]);
    addBtn.addEventListener('click', () => handleAdd(r, addBtn));
    area.appendChild(row);
  });
}

async function handleAdd(song, btn) {
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader"></i>';
  try {
    await addToQueue(roomCode, {
      videoId: song.videoId, title: song.title,
      channel: song.channel, duration: song.duration,
      thumb: song.thumb, source: activeSource
    });
    btn.innerHTML = '<i class="ti ti-check"></i>';
    btn.classList.add('added');
    socket?.emit('song_added', { roomCode });
    showToast(`"${song.title}" agregada`);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-plus"></i>';
    showToast(err.message, 'error');
  }
}

// ── Eventos UI ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  connectSocket();

  // Reloj
  function updateClock() {
    const now = new Date();
    const el = document.getElementById('ph-time');
    if (el) el.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  }
  updateClock(); setInterval(updateClock, 30000);

  // Búsqueda
  document.getElementById('btn-search')?.addEventListener('click', doSearch);
  document.getElementById('search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Fuente
  document.getElementById('src-yt')?.addEventListener('click', () => setSource('youtube'));
  document.getElementById('src-sp')?.addEventListener('click', () => setSource('spotify'));

  function setSource(src) {
    activeSource = src;
    document.getElementById('src-yt')?.classList.toggle('active', src === 'youtube');
    document.getElementById('src-sp')?.classList.toggle('active', src === 'spotify');
    document.getElementById('search-results').innerHTML = '';
  }

  // Cola
  const toggleQueue = () => document.getElementById('queue-panel')?.classList.toggle('hidden');
  document.getElementById('btn-queue')?.addEventListener('click', toggleQueue);
  document.getElementById('btn-queue2')?.addEventListener('click', toggleQueue);
  document.getElementById('btn-close-queue')?.addEventListener('click', toggleQueue);

  // Play/pause — solo visual en vista usuario, el admin controla
  document.getElementById('btn-play')?.addEventListener('click', () => {
    showToast('El admin controla la reproducción');
  });
});
