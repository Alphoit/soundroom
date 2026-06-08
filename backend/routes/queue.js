const router = require('express').Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const { QueueItem, SongHistory } = require('../models/Queue');
const logger = require('../utils/logger');

const recentAdds = new Map();

// POST /api/queue/:code — agregar canción (usuarios)
router.post('/:code', async (req, res) => {
  try {
    const room = await Room.findOne({ where: { code: req.params.code, is_active: true } });
    if (!room) return res.status(404).json({ error: 'Sala no encontrada' });

    const { videoId, title, channel, duration, thumb, source = 'youtube' } = req.body;
    if (!videoId || !title) return res.status(400).json({ error: 'Datos incompletos' });

    // Blacklist check
    if (room.blacklist_enabled) {
      const tl = title.toLowerCase(), cl = (channel||'').toLowerCase();
      const songBlocked   = (room.blacklist_songs||[]).some(s => tl.includes(s.toLowerCase()));
      const artistBlocked = (room.blacklist_artists||[]).some(a => cl.includes(a.toLowerCase()) || tl.includes(a.toLowerCase()));
      if (songBlocked || artistBlocked)
        return res.status(403).json({ error: 'Esta canción no está disponible en esta sala.' });
    }

    const userIp = req.ip;
    const key = `${room.id}:${userIp}`;

    // Anti-spam
    const lastAdd = recentAdds.get(key);
    const secs = room.antispam_seconds || 30;
    if (lastAdd && (Date.now() - lastAdd) < secs * 1000)
      return res.status(429).json({ error: `Espera ${secs} segundos antes de agregar otra canción.` });

    // Límite por usuario
    const userCount = await QueueItem.count({ where: { room_id: room.id, added_by_ip: userIp } });
    if (userCount >= (room.songs_per_user || 3))
      return res.status(429).json({ error: `Solo puedes tener ${room.songs_per_user} canciones en la cola a la vez.` });

    const maxPos = await QueueItem.max('position', { where: { room_id: room.id } }) || 0;
    const item = await QueueItem.create({
      room_id: room.id, video_id: videoId, title, channel, duration,
      thumb_url: thumb, source, added_by_ip: userIp, position: maxPos + 1
    });

    recentAdds.set(key, Date.now());
    logger.info(`Canción agregada: "${title}" en sala ${room.code}`);
    res.status(201).json(item);
  } catch (err) {
    logger.error('Error agregando canción:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/queue/:code/:itemId — eliminar canción (admin)
router.delete('/:code/:itemId', auth, async (req, res) => {
  const room = await Room.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  const item = await QueueItem.findOne({ where: { id: req.params.itemId, room_id: room.id } });
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });
  await item.destroy();
  res.json({ ok: true });
});

module.exports = router;
