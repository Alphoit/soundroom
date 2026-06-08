const router = require('express').Router();
const axios = require('axios');
const logger = require('../utils/logger');

// GET /api/search?q=texto&source=youtube
router.get('/', async (req, res) => {
  const { q, source = 'youtube' } = req.query;
  if (!q || q.trim().length < 2)
    return res.status(400).json({ error: 'Consulta demasiado corta' });

  if (source === 'youtube') {
    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: q.trim(),
          type: 'video',
          videoCategoryId: '10',
          maxResults: 5,
          key: process.env.YOUTUBE_API_KEY
        },
        timeout: 8000
      });

      const ids = data.items.map(i => i.id.videoId).join(',');
      const { data: details } = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: { part: 'contentDetails,statistics', id: ids, key: process.env.YOUTUBE_API_KEY },
        timeout: 8000
      });

      const durMap = {};
      details.items.forEach(v => { durMap[v.id] = parseDuration(v.contentDetails.duration); });

      const results = data.items.map(item => ({
        videoId:  item.id.videoId,
        title:    item.snippet.title,
        channel:  item.snippet.channelTitle,
        duration: durMap[item.id.videoId] || '?:??',
        thumb:    item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url
      }));

      res.json({ results, source: 'youtube' });
    } catch (err) {
      logger.error('Error YouTube API:', err.response?.data || err.message);
      const status = err.response?.status === 403 ? 403 : 502;
      res.status(status).json({ error: 'Error al buscar en YouTube. Verifica tu API Key.' });
    }
  } else {
    res.status(400).json({ error: 'Fuente no soportada' });
  }
});

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), sec = parseInt(m[3] || 0);
  if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${min}:${String(sec).padStart(2,'0')}`;
}

module.exports = router;
