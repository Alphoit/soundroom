const Room = require('../models/Room');
const { QueueItem, SongHistory } = require('../models/Queue');
const logger = require('../utils/logger');

module.exports = (io) => {
  // Rastrear admins conectados por sala
  const roomAdmins = new Map();

  io.on('connection', (socket) => {
    logger.debug(`Socket conectado: ${socket.id}`);

    // ── Unirse a sala ────────────────────────────────────
    socket.on('join_room', async ({ roomCode, isAdmin }) => {
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.isAdmin = isAdmin;

      if (isAdmin) {
        if (!roomAdmins.has(roomCode)) roomAdmins.set(roomCode, new Set());
        roomAdmins.get(roomCode).add(socket.id);
      }

      try {
        const room = await Room.findOne({ where: { code: roomCode } });
        if (!room) return socket.emit('error', { message: 'Sala no encontrada' });

        const queue = await QueueItem.findAll({
          where: { room_id: room.id }, order: [['position','ASC']]
        });

        socket.emit('room_state', {
          currentSong: room.current_song,
          isPlaying:   room.is_playing,
          progressPct: room.progress_pct,
          queue:       queue
        });

        const count = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
        io.to(roomCode).emit('user_count', count);
        logger.info(`Usuario unido a sala ${roomCode} (admin: ${isAdmin})`);
      } catch (err) {
        logger.error('Error join_room:', err);
      }
    });

    // ── Admin: play/pause ────────────────────────────────
    socket.on('admin_play_pause', async ({ roomCode, isPlaying }) => {
      if (!socket.isAdmin) return;
      try {
        await Room.update({ is_playing: isPlaying }, { where: { code: roomCode } });
        io.to(roomCode).emit('playback_state', { isPlaying });
      } catch (err) { logger.error('Error play_pause:', err); }
    });

    // ── Admin: siguiente canción ─────────────────────────
    socket.on('admin_next', async ({ roomCode }) => {
      if (!socket.isAdmin) return;
      try {
        const room = await Room.findOne({ where: { code: roomCode } });
        if (!room) return;

        // Guardar en historial
        if (room.current_song) {
          await SongHistory.create({
            room_id:  room.id,
            video_id: room.current_song.videoId,
            title:    room.current_song.title,
            channel:  room.current_song.channel,
            duration: room.current_song.duration,
            thumb_url:room.current_song.thumb,
            source:   room.current_song.source || 'youtube'
          });
        }

        // Quitar canción actual de la cola
        if (room.current_song) {
          await QueueItem.destroy({ where: { room_id: room.id, video_id: room.current_song.videoId } });
        }

        // Siguiente en cola
        const next = await QueueItem.findOne({
          where: { room_id: room.id }, order: [['position','ASC']]
        });

        const newCurrent = next ? {
          videoId: next.video_id, title: next.title, channel: next.channel,
          duration: next.duration, thumb: next.thumb_url, source: next.source
        } : null;

        await room.update({ current_song: newCurrent, is_playing: !!newCurrent, progress_pct: 0 });

        const queue = await QueueItem.findAll({
          where: { room_id: room.id }, order: [['position','ASC']]
        });

        io.to(roomCode).emit('song_changed', { currentSong: newCurrent, isPlaying: !!newCurrent, queue });
      } catch (err) { logger.error('Error admin_next:', err); }
    });

    // ── Admin: eliminar de cola ──────────────────────────
    socket.on('admin_remove', async ({ roomCode, itemId }) => {
      if (!socket.isAdmin) return;
      try {
        const room = await Room.findOne({ where: { code: roomCode } });
        if (!room) return;
        await QueueItem.destroy({ where: { id: itemId, room_id: room.id } });
        const queue = await QueueItem.findAll({
          where: { room_id: room.id }, order: [['position','ASC']]
        });
        io.to(roomCode).emit('queue_updated', queue);
      } catch (err) { logger.error('Error admin_remove:', err); }
    });

    // ── Usuario: agrega canción ──────────────────────────
    socket.on('song_added', async ({ roomCode }) => {
      try {
        const room = await Room.findOne({ where: { code: roomCode } });
        if (!room) return;
        const queue = await QueueItem.findAll({
          where: { room_id: room.id }, order: [['position','ASC']]
        });
        io.to(roomCode).emit('queue_updated', queue);

        // Si no hay canción activa, cargar la primera
        if (!room.current_song && queue.length > 0) {
          const first = queue[0];
          const newCurrent = {
            videoId: first.video_id, title: first.title, channel: first.channel,
            duration: first.duration, thumb: first.thumb_url, source: first.source
          };
          await room.update({ current_song: newCurrent, is_playing: true, progress_pct: 0 });
          io.to(roomCode).emit('song_changed', { currentSong: newCurrent, isPlaying: true, queue });
        }
      } catch (err) { logger.error('Error song_added:', err); }
    });

    // ── Admin: actualizar progreso ───────────────────────
    socket.on('progress_update', async ({ roomCode, progressPct }) => {
      if (!socket.isAdmin) return;
      try {
        await Room.update({ progress_pct: progressPct }, { where: { code: roomCode } });
        socket.to(roomCode).emit('progress_sync', { progressPct });
      } catch (err) { logger.error('Error progress_update:', err); }
    });

    // ── Desconexión ──────────────────────────────────────
    socket.on('disconnect', () => {
      const code = socket.roomCode;
      if (code) {
        if (socket.isAdmin && roomAdmins.has(code)) {
          roomAdmins.get(code).delete(socket.id);
        }
        const count = io.sockets.adapter.rooms.get(code)?.size || 0;
        io.to(code).emit('user_count', count);
      }
      logger.debug(`Socket desconectado: ${socket.id}`);
    });
  });
};
