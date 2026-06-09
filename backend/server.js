require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const sequelize  = require('./config/database');
const logger     = require('./utils/logger');

// ── Modelos (necesarios para sync) ──────────────────────
require('./models/Admin');
require('./models/Room');
require('./models/Queue');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST'] }
});

// ── Seguridad ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── Rate limiting global ──────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  message:  { error: 'Demasiadas solicitudes, intenta más tarde.' }
}));

// ── Rate limiting estricto para login ────────────────────
app.use('/api/auth/login', rateLimit({ windowMs: 60000, max: 10,
  message: { error: 'Demasiados intentos de login.' }
}));

// ── Rutas API ────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/rooms',  require('./routes/rooms'));
app.use('/api/queue',  require('./routes/queue'));
app.use('/api/search', require('./routes/search'));

// ── Frontend estático ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/room/:code', (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/pages/room.html')));
app.get('/admin',      (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/pages/admin.html')));
app.get('*',           (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/index.html')));

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString()
}));

// ── Socket.IO ─────────────────────────────────────────────
require('./utils/socketHandler')(io);

// ── Arranque ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: process.env.NODE_ENV === 'development' })
  .then(() => {
    logger.info('✅ Base de datos sincronizada');
    server.listen(PORT, '0.0.0.0', () => logger.info(`🚀 SoundRoom corriendo en puerto ${PORT}`));
  })
  .catch(err => {
    logger.error('❌ Error al conectar base de datos:', err);
    process.exit(1);
  });

// ── Manejo de errores no capturados ──────────────────────
process.on('unhandledRejection', err => logger.error('UnhandledRejection:', err));
process.on('uncaughtException',  err => { logger.error('UncaughtException:', err); process.exit(1); });
