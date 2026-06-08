require('dotenv').config();
const sequelize = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Tablas sincronizadas');

    const Admin = require('../models/Admin');
    const existing = await Admin.findOne({ where: { username: process.env.ADMIN_USERNAME } });
    if (!existing) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await Admin.create({ username: process.env.ADMIN_USERNAME, password_hash: hash });
      console.log(`✅ Admin creado: ${process.env.ADMIN_USERNAME}`);
    } else {
      console.log('ℹ️  Admin ya existe, omitiendo');
    }

    console.log('🎉 Migración completada');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migración:', err);
    process.exit(1);
  }
}

migrate();
