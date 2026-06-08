const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code:         { type: DataTypes.STRING(8), allowNull: false, unique: true },
  name:         { type: DataTypes.STRING(100), allowNull: false },
  is_active:    { type: DataTypes.BOOLEAN, defaultValue: true },
  current_song: { type: DataTypes.JSON, defaultValue: null },
  is_playing:   { type: DataTypes.BOOLEAN, defaultValue: false },
  progress_pct: { type: DataTypes.FLOAT, defaultValue: 0 },
  songs_per_user:   { type: DataTypes.INTEGER, defaultValue: 3 },
  antispam_seconds: { type: DataTypes.INTEGER, defaultValue: 30 },
  blacklist_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  blacklist_songs:   { type: DataTypes.JSON, defaultValue: [] },
  blacklist_artists: { type: DataTypes.JSON, defaultValue: [] }
}, { tableName: 'rooms' });

module.exports = Room;
