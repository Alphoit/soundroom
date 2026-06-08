// admin.js — Lógica del panel de administrador
import * as api from '/js/api.js';
import { showToast, timeFromPct, createElement } from '/js/utils.js';

let socket, ytPlayer, ytReady = false;
let currentRoomCode = null;
let isPlaying = false, currentSong = null, progressPct = 0;
let progressInterval = null;
let playedCount = 0;
let blacklistData = { enabled: false, songs: [], artists: [] };

// ── Auth ──────────────────────────────────────────────
document.getElementById('btn-login')?.addEventListener('click', doLogin);
document.getElementById('login-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  try {
    const { token } = await api.login(username, password);
    api.setToken(token);
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
    initAdmin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

document.getElementById('btn-logout')?.addEventListener('click', () => {
  api.clearToken();
  location.reload();
});

async function checkAuth() {
  if (!api.getToken()) return;
  try {
    await api.verify();
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
    initAdmin();
  } catch { api.clearToken(); }
}

// ── Init ──────────────────────────────────────────────
async function initAdmin() {
  await loadRooms();
  setupNav();
  setupBlacklist();
  setupSettings();
}

// ── Salas ─────────────────────────────────────────────
async function loadRooms() {
  try {
    const rooms = await api.getRooms();
    const sel = document.getElementById('room-selector');
    sel.innerHTML = rooms.length
      ? rooms.map(r => `<option value="${r.code}">${r.name}</option>`).join('')
      : '<option value="">Sin salas</option>';
    if (rooms.length) selectRoom(rooms[0].code);
    renderRoomsList(rooms);
  } catch (err) { showToast(err.message, 'error'); }
}

function renderRoomsList(rooms) {
  const list = document.getElementById('rooms-list');
  list.innerHTML = '';
  if (!rooms.length) {
    list.appendChild(createElement('div', { className: 'empty-msg', textContent: 'No hay salas. Crea una.' }));
    return;
  }
  rooms.forEach(room => {
    const row = createElement('div', { className: 'room-row card' }, [
      createElement('div', { className: 'room-info' }, [
        createElement('div', { className: 'room-name', textContent: room.name }),
        createElement('div', { className: 'room-code', textContent: `Código: ${room.code}` })
      ]),
      createElement('div', { className: 'room-actions' }, [
        (() => {
          const b = createElement('button', { className: 'btn', 'aria-label': 'Ver QR' },
            [createElement('i', { className: 'ti ti-qrcode' })]);
          b.addEventListener('click', () => loadQR(room.code));
          return b;
        })(),
        (() => {
          const b = createElement('button', { className: 'btn', 'aria-label': 'Seleccionar sala' },
            [createElement('i', { className: 'ti ti-door-enter' })]);
          b.addEventListener('click', () => { selectRoom(room.code); showSection('dashboard'); });
          return b;
        })(),
        (() => {
          const b = createElement('button', { className: 'btn danger', 'aria-label': 'Eliminar sala' },
            [createElement('i', { className: 'ti ti-trash' })]);
          b.addEventListener('click', async () => {
            if (!confirm(`¿Eliminar "${room.name}"?`)) return;
            try { await api.deleteRoom(room.code); await loadRooms(); showToast('Sala eliminada'); }
            catch (err) { showToast(err.message, 'error'); }
          });
          return b;
        })()
      ])
    ]);
    list.appendChild(row);
  });
}

document.getElementById('btn-create-room')?.addEventListener('click', async () => {
  const name = prompt('Nombre de la nueva sala:');
  if (!name?.trim()) return;
  try {
    await api.createRoom(name.trim());
    await loadRooms();
    showToast(`Sala "${name}" creada`);
  } catch (err) { showToast(err.message, 'error'); }
});

async function loadQR(code) {
  try {
    const { qr, url } = await api.getRoomQR(code);
    const area = document.getElementById('qr-area');
    const imgWrap = document.getElementById('qr-img-wrap');
    const urlEl = document.getElementById('qr-url');
    imgWrap.innerHTML = `<img src="${qr}" alt="QR code" style="width:140px;height:140px;border-radius:10px;"/>`;
    urlEl.textContent = url;
    document.getElementById('btn-copy-url').onclick = () => {
      navigator.clipboard.writeText(url).then(() => showToast('Enlace copiado'));
    };
    area.classList.remove('hidden');
    showSection('rooms');
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Seleccionar sala activa ───────────────────────────
function selectRoom(code) {
  if (currentRoomCode === code) return;
  if (socket) socket.disconnect();
  currentRoomCode = code;
  document.getElementById('room-selector').value = code;
  const name = document.getElementById('room-selector').selectedOptions[0]?.text || code;
  document.getElementById('active-room-name').textContent = name;
  connectSocket(code);
  loadQueueAdmin(code);
  loadHistoryAdmin(code);
}

document.getElementById('room-selector')?.addEventListener('change', e => selectRoom(e.target.value));

// ── Socket ────────────────────────────────────────────
function connectSocket(roomCode) {
  socket = io({ transports: ['websocket'] });
  socket.on('connect', () => socket.emit('join_room', { roomCode, isAdmin: true }));

  socket.on('room_state', ({ currentSong: song, isPlaying: playing, progressPct: pct, queue }) => {
    currentSong = song; isPlaying = playing; progressPct = pct;
    updateNowPlaying(song); renderAdminQueue(queue);
    updateStats();
    if (song && ytReady && playing) loadYTAdmin(song.videoId);
  });

  socket.on('song_changed', ({ currentSong: song, isPlaying: playing, queue }) => {
    currentSong = song; isPlaying = playing; progressPct = 0;
    playedCount++;
    updateNowPlaying(song); renderAdminQueue(queue);
    updateStats();
    if (song && ytReady) loadYTAdmin(song.videoId);
  });

  socket.on('queue_updated', queue => { renderAdminQueue(queue); updateStats(); });
  socket.on('playback_state', ({ isPlaying: p }) => { isPlaying = p; updatePlayIcon(p); });
  socket.on('progress_sync', ({ progressPct: p }) => { progressPct = p; syncProgressBar(p); });
  socket.on('user_count', n => {
    document.getElementById('s-users').textContent = n;
    document.getElementById('tb-users').textContent = n;
  });
}

// ── YouTube Admin ─────────────────────────────────────
window.onYouTubeIframeAPIReady = () => {
  ytPlayer = new YT.Player('a-yt-player', {
    height: '200', width: '100%',
    playerVars: { autoplay: 0, controls: 1, rel: 0 },
    events: {
      onReady: () => { ytReady = true; document.getElementById('a-yt-player').style.display = 'block'; },
      onStateChange: e => {
        if (e.data === YT.PlayerState.PLAYING) { isPlaying = true; updatePlayIcon(true); startProgressTrack(); }
        if (e.data === YT.PlayerState.PAUSED)  { isPlaying = false; updatePlayIcon(false); stopProgressTrack(); }
        if (e.data === YT.PlayerState.ENDED)   { socket?.emit('admin_next', { roomCode: currentRoomCode }); }
      }
    }
  });
};

function loadYTAdmin(videoId) {
  if (!ytPlayer || !ytReady) return;
  ytPlayer.loadVideoById(videoId);
}

function startProgressTrack() {
  stopProgressTrack();
  progressInterval = setInterval(() => {
    if (!ytPlayer || !ytReady || !isPlaying) return;
    const dur = ytPlayer.getDuration();
    const cur = ytPlayer.getCurrentTime();
    if (!dur) return;
    const pct = Math.round((cur / dur) * 100);
    syncProgressBar(pct);
    socket?.emit('progress_update', { roomCode: currentRoomCode, progressPct: pct });
  }, 1500);
}

function stopProgressTrack() { clearInterval(progressInterval); }

function syncProgressBar(pct) {
  document.getElementById('a-prog').style.width = pct + '%';
  if (currentSong?.duration) {
    document.getElementById('a-elapsed').textContent = timeFromPct(pct, currentSong.duration);
    document.getElementById('a-total').textContent   = currentSong.duration;
  }
}

// ── Controles admin ───────────────────────────────────
document.getElementById('btn-pp')?.addEventListener('click', () => {
  if (!currentRoomCode) return;
  const newState = !isPlaying;
  socket?.emit('admin_play_pause', { roomCode: currentRoomCode, isPlaying: newState });
  if (ytPlayer && ytReady) newState ? ytPlayer.playVideo() : ytPlayer.pauseVideo();
});

document.getElementById('btn-next')?.addEventListener('click', () => {
  if (!currentRoomCode) return;
  socket?.emit('admin_next', { roomCode: currentRoomCode });
});

document.getElementById('btn-prev')?.addEventListener('click', () => showToast('No hay canción anterior'));

// ── UI helpers ────────────────────────────────────────
function updateNowPlaying(song) {
  document.getElementById('a-np-title').textContent = song?.title   || 'Sin canción activa';
  document.getElementById('a-np-ch').textContent    = song?.channel || '—';
  const ph  = document.getElementById('a-thumb-ph');
  const img = document.getElementById('a-thumb-img');
  if (song?.thumb) { ph.style.display='none'; img.style.display='block'; img.src = song.thumb; }
  else { ph.style.display='flex'; img.style.display='none'; }
  updatePlayIcon(isPlaying);
}

function updatePlayIcon(p) {
  const ic = document.getElementById('a-pp-icon');
  if (ic) ic.className = p ? 'ti ti-player-pause' : 'ti ti-player-play';
}

function updateStats() {
  document.getElementById('s-played').textContent = playedCount;
}

async function loadQueueAdmin(code) {
  try {
    const { queue } = await api.getRoom(code);
    renderAdminQueue(queue);
  } catch {}
}

function renderAdminQueue(queue) {
  const list = document.getElementById('admin-queue-list');
  if (!list) return;
  const items = queue.filter(s => !currentSong || s.video_id !== currentSong.videoId);
  document.getElementById('s-queue').textContent = items.length;
  list.innerHTML = '';
  if (!items.length) { list.appendChild(createElement('div', { className: 'empty-msg', textContent: 'Cola vacía' })); return; }
  items.forEach((s, i) => {
    const del = createElement('button', { className: 'a-del', 'aria-label': `Eliminar ${s.title}` },
      [createElement('i', { className: 'ti ti-trash' })]);
    del.addEventListener('click', () => socket?.emit('admin_remove', { roomCode: currentRoomCode, itemId: s.id }));
    const row = createElement('div', { className: 'a-q-item card' }, [
      createElement('span', { className: 'a-q-pos', textContent: String(i+1) }),
      s.thumb_url
        ? createElement('img', { className: 'a-q-thumb', src: s.thumb_url, alt: '' })
        : createElement('div', { className: 'a-q-thumb-ph' }, [createElement('i', { className: 'ti ti-music' })]),
      createElement('div', { className: 'a-q-info' }, [
        createElement('div', { className: 'a-q-title', textContent: s.title }),
        createElement('div', { className: 'a-q-meta', textContent: `${s.channel} · ${s.duration}` })
      ]),
      del
    ]);
    list.appendChild(row);
  });
}

async function loadHistoryAdmin(code) {
  try {
    const history = await api.getHistory(code);
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    if (!history.length) { list.appendChild(createElement('div', { className: 'empty-msg', textContent: 'Sin historial aún' })); return; }
    history.forEach((s, i) => {
      const row = createElement('div', { className: 'a-q-item card' }, [
        createElement('span', { className: 'a-q-pos', textContent: String(i+1) }),
        s.thumb_url
          ? createElement('img', { className: 'a-q-thumb', src: s.thumb_url, alt: '' })
          : createElement('div', { className: 'a-q-thumb-ph' }, [createElement('i', { className: 'ti ti-music' })]),
        createElement('div', { className: 'a-q-info' }, [
          createElement('div', { className: 'a-q-title', textContent: s.title }),
          createElement('div', { className: 'a-q-meta', textContent: `${s.channel} · ${new Date(s.played_at).toLocaleTimeString()}` })
        ])
      ]);
      list.appendChild(row);
    });
  } catch {}
}

// ── Blacklist ─────────────────────────────────────────
function setupBlacklist() {
  // Tabs
  document.querySelectorAll('.bl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bl-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.bl-panel').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`bl-${tab.dataset.type}`).classList.remove('hidden');
    });
  });

  document.getElementById('bl-toggle')?.addEventListener('change', async e => {
    blacklistData.enabled = e.target.checked;
    document.getElementById('bl-status-lbl').textContent = blacklistData.enabled ? 'Activa' : 'Desactivada';
    await saveBlacklist();
  });

  document.getElementById('btn-add-song')?.addEventListener('click', () => addBlacklistEntry('songs'));
  document.getElementById('btn-add-artist')?.addEventListener('click', () => addBlacklistEntry('artists'));
  document.getElementById('bl-song-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addBlacklistEntry('songs'); });
  document.getElementById('bl-artist-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addBlacklistEntry('artists'); });

  document.getElementById('btn-bl-test')?.addEventListener('click', testBlacklist);
  document.getElementById('bl-test-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') testBlacklist(); });
}

async function loadBlacklist(code) {
  try {
    const { room } = await api.getRoom(code);
    blacklistData = {
      enabled: room.blacklist_enabled,
      songs: [],   // la API retorna solo el flag; los arrays se gestionan localmente
      artists: []
    };
    document.getElementById('bl-toggle').checked = blacklistData.enabled;
    document.getElementById('bl-status-lbl').textContent = blacklistData.enabled ? 'Activa' : 'Desactivada';
    document.getElementById('s-blocked').textContent = (blacklistData.songs.length + blacklistData.artists.length);
    renderBlacklistItems('songs'); renderBlacklistItems('artists');
  } catch {}
}

function addBlacklistEntry(type) {
  const inputId = type === 'songs' ? 'bl-song-input' : 'bl-artist-input';
  const val = document.getElementById(inputId).value.trim();
  if (!val) return;
  const list = blacklistData[type];
  if (list.some(e => e.toLowerCase() === val.toLowerCase())) { showToast('"' + val + '" ya está bloqueado'); return; }
  list.push(val);
  document.getElementById(inputId).value = '';
  renderBlacklistItems(type);
  saveBlacklist();
  document.getElementById('s-blocked').textContent = blacklistData.songs.length + blacklistData.artists.length;
  showToast('"' + val + '" bloqueado');
}

function removeBlacklistEntry(type, index) {
  const name = blacklistData[type][index];
  blacklistData[type].splice(index, 1);
  renderBlacklistItems(type);
  saveBlacklist();
  document.getElementById('s-blocked').textContent = blacklistData.songs.length + blacklistData.artists.length;
  showToast('"' + name + '" desbloqueado');
}

function renderBlacklistItems(type) {
  const listEl = document.getElementById(`bl-${type}-list`);
  const items = blacklistData[type];
  const icon = type === 'songs' ? 'ti-music' : 'ti-microphone';
  const label = type === 'songs' ? 'canción' : 'artista';
  listEl.innerHTML = '';
  if (!items.length) {
    listEl.appendChild(createElement('div', { className: 'empty-msg', textContent: `No hay ${label}s bloqueados` }));
    return;
  }
  items.forEach((name, i) => {
    const del = createElement('button', { className: 'a-del', 'aria-label': `Desbloquear ${name}` },
      [createElement('i', { className: 'ti ti-x' })]);
    del.addEventListener('click', () => removeBlacklistEntry(type, i));
    const row = createElement('div', { className: 'bl-item' }, [
      createElement('div', { className: 'bl-icon' }, [createElement('i', { className: `ti ${icon}` })]),
      createElement('span', { className: 'bl-name', textContent: name }),
      createElement('span', { className: 'bl-type-badge', textContent: label }),
      del
    ]);
    listEl.appendChild(row);
  });
}

async function saveBlacklist() {
  if (!currentRoomCode) return;
  try {
    await api.updateBlacklist(currentRoomCode, {
      enabled: blacklistData.enabled,
      songs:   blacklistData.songs,
      artists: blacklistData.artists
    });
  } catch (err) { showToast(err.message, 'error'); }
}

function testBlacklist() {
  const q = document.getElementById('bl-test-input').value.trim().toLowerCase();
  const result = document.getElementById('bl-test-result');
  result.innerHTML = '';
  if (!q) return;
  if (!blacklistData.enabled) {
    result.innerHTML = '<div class="test-allowed"><i class="ti ti-circle-check"></i> Lista negra desactivada — todo pasa.</div>';
    return;
  }
  const sm = blacklistData.songs.find(s => s.toLowerCase() === q || q.includes(s.toLowerCase()));
  const am = blacklistData.artists.find(a => a.toLowerCase() === q || q.includes(a.toLowerCase()));
  if (sm || am) {
    result.innerHTML = `<div class="test-blocked"><i class="ti ti-ban"></i> Bloqueado — "${sm || am}" está en la lista negra.</div>`;
  } else {
    result.innerHTML = '<div class="test-allowed"><i class="ti ti-circle-check"></i> Permitido — no está en ninguna lista negra.</div>';
  }
}

// ── Settings ──────────────────────────────────────────
function setupSettings() {
  document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    if (!currentRoomCode) return showToast('Selecciona una sala', 'error');
    try {
      await api.updateSettings(currentRoomCode, {
        songs_per_user:   parseInt(document.getElementById('setting-songs-per-user').value),
        antispam_seconds: parseInt(document.getElementById('setting-antispam').value)
      });
      showToast('Ajustes guardados');
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ── Navegación ────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const section = btn.dataset.section;
      document.getElementById('page-title').textContent = btn.textContent.trim();
      showSection(section);
      if (section === 'history' && currentRoomCode) loadHistoryAdmin(currentRoomCode);
      if (section === 'blacklist' && currentRoomCode) loadBlacklist(currentRoomCode);
    });
  });
}

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${name}`)?.classList.remove('hidden');
}

// ── Arranque ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', checkAuth);
