// api.js — Módulo de comunicación con el backend
const API_BASE = '/api';

let _token = localStorage.getItem('sr_token') || null;

export function setToken(t) { _token = t; localStorage.setItem('sr_token', t); }
export function clearToken() { _token = null; localStorage.removeItem('sr_token'); }
export function getToken() { return _token; }

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : null
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

// ── Auth ───────────────────────────────────────────────
export const login    = (username, password) => request('POST', '/auth/login', { username, password });
export const verify   = ()                   => request('POST', '/auth/verify');

// ── Rooms ──────────────────────────────────────────────
export const getRooms  = ()       => request('GET',    '/rooms');
export const createRoom= (name)   => request('POST',   '/rooms', { name });
export const getRoom   = (code)   => request('GET',    `/rooms/${code}`);
export const getRoomQR = (code)   => request('GET',    `/rooms/${code}/qr`);
export const deleteRoom= (code)   => request('DELETE', `/rooms/${code}`);
export const updateBlacklist = (code, payload) => request('PUT', `/rooms/${code}/blacklist`, payload);
export const updateSettings  = (code, payload) => request('PUT', `/rooms/${code}/settings`,  payload);
export const getHistory      = (code)           => request('GET', `/rooms/${code}/history`);

// ── Queue ──────────────────────────────────────────────
export const addToQueue = (code, song) => request('POST', `/queue/${code}`, song);

// ── Search ─────────────────────────────────────────────
export const search = (q, source = 'youtube') =>
  request('GET', `/search?q=${encodeURIComponent(q)}&source=${source}`);
