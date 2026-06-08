const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Room = require('./Room');

const QueueItem = sequelize.define('QueueItem', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  room_id:    { type: DataTypes.INTEGER, allowNull: false },
  video_id:   { type: DataTypes.STRING(20), allowNull: false },
  title:      { type: DataTypes.STRING(200), allowNull: false },
  channel:    { type: DataTypes.STRING(100) },
  duration:   { type: DataTypes.STRING(10) },
  thumb_url:  { type: DataTypes.STRING(255) },
  source:     { type: DataTypes.ENUM('youtube','spotify'), defaultValue: 'youtube' },
  added_by_ip:{ type: DataTypes.STRING(45) },
  position:   { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'queue_items' });

const SongHistory = sequelize.define('SongHistory', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  room_id:   { type: DataTypes.INTEGER, allowNull: false },
  video_id:  { type: DataTypes.STRING(20), allowNull: false },
  title:     { type: DataTypes.STRING(200), allowNull: false },
  channel:   { type: DataTypes.STRING(100) },
  duration:  { type: DataTypes.STRING(10) },
  thumb_url: { type: DataTypes.STRING(255) },
  source:    { type: DataTypes.ENUM('youtube','spotify'), defaultValue: 'youtube' },
  played_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'song_history' });

Room.hasMany(QueueItem,   { foreignKey: 'room_id', onDelete: 'CASCADE' });
Room.hasMany(SongHistory, { foreignKey: 'room_id', onDelete: 'CASCADE' });
QueueItem.belongsTo(Room,   { foreignKey: 'room_id' });
SongHistory.belongsTo(Room, { foreignKey: 'room_id' });

module.exports = { QueueItem, SongHistory };
