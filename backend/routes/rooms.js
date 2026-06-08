const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const { QueueItem, SongHistory } = require('../models/Queue');
const logger = require('../utils/logger');

// GET /api/rooms — listar salas (admin)
router.get('/', auth, async (req, res) => {
  const rooms = await Room.findAll({ order: [['created_at', 'DESC']] });
  res.json(rooms);
});

// POST /api/rooms — crear sala (admin)
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const code = generateCode();
    const room = await Room.create({ code, name });
    logger.info(`Sala creada: ${name} (${code})`);
    res.status(201).json(room);
  } catch (err) {
    logger.error('Error creando sala:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/rooms/:code — info pública de sala (usuarios)
router.get('/:code', async (req, res) => {
  const room = await Room.findOne({ where: { code: req.params.code, is_active: true } });
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  const queue = await QueueItem.findAll({ where: { room_id: room.id }, order: [['position','ASC']] });
  res.json({ room: sanitizeRoom(room), queue });
});

// GET /api/rooms/:code/qr — QR de sala
router.get('/:code/qr', async (req, res) => {
  const room = await Room.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  const url = `${process.env.CORS_ORIGIN}/room/${room.code}`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qr, url });
});

// PUT /api/rooms/:code/blacklist — actualizar lista negra (admin)
router.put('/:code/blacklist', auth, async (req, res) => {
  const room = await Room.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  const { enabled, songs, artists } = req.body;
  await room.update({
    blacklist_enabled: enabled ?? room.blacklist_enabled,
    blacklist_songs:   songs   ?? room.blacklist_songs,
    blacklist_artists: artists ?? room.blacklist_artists
  });
  res.json({ ok: true });
});

// PUT /api/rooms/:code/settings — configuración de sala (admin)
router.put('/:code/settings', auth, async (req, res) => {
  const room = await Room.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  const { songs_per_user, antispam_seconds, is_active } = req.body;
  await room.update({
    songs_per_user:   songs_per_user   ?? room.songs_per_user,
    antispam_seconds: antispam_seconds ?? room.antispam_seconds,
    is_active:        is_active        ?? room.is_active
  });
  res.json({ ok: true });
});

// DELETE /api/rooms/:code — eliminar sala (admin)
router.delete('/:code', auth, async (req, res) => {
  const room = await Room.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  await room.destroy();
  logger.info(`Sala eliminada: ${room.code}`);
  res.json({ ok: true });
});

// GET /api/rooms/:code/history — historial (admin)
router.get('/:code/history', auth, async (req, res) => {
  const room = await Room.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  const history = await SongHistory.findAll({
    where: { room_id: room.id },
    order: [['played_at', 'DESC']],
    limit: 50
  });
  res.json(history);
});

function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function sanitizeRoom(room) {
  return {
    id: room.id, code: room.code, name: room.name,
    current_song: room.current_song, is_playing: room.is_playing,
    songs_per_user: room.songs_per_user, antispam_seconds: room.antispam_seconds,
    blacklist_enabled: room.blacklist_enabled
  };
}

module.exports = router;
