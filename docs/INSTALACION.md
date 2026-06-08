# 🎵 SoundRoom — Guía de Instalación Completa

---

## ESTRUCTURA DEL PROYECTO

```
soundroom/
├── backend/
│   ├── config/
│   │   ├── database.js       ← Conexión MySQL
│   │   └── migrate.js        ← Crea tablas y admin inicial
│   ├── middleware/
│   │   └── auth.js           ← Verificación JWT
│   ├── models/
│   │   ├── Admin.js
│   │   ├── Room.js
│   │   └── Queue.js
│   ├── routes/
│   │   ├── auth.js           ← Login / verificar token
│   │   ├── rooms.js          ← CRUD de salas
│   │   ├── queue.js          ← Cola de canciones
│   │   └── search.js         ← Búsqueda YouTube
│   ├── utils/
│   │   ├── logger.js         ← Logs con Winston
│   │   └── socketHandler.js  ← Socket.IO tiempo real
│   ├── server.js             ← Punto de entrada
│   ├── package.json
│   └── .env.example          ← Copiar a .env y configurar
└── frontend/
    ├── css/
    │   ├── main.css
    │   ├── room.css
    │   └── admin.css
    ├── js/
    │   ├── api.js            ← Comunicación con backend
    │   ├── utils.js          ← Funciones compartidas
    │   ├── room.js           ← Lógica sala usuario
    │   └── admin.js          ← Lógica panel admin
    ├── pages/
    │   ├── room.html         ← Vista usuario
    │   └── admin.html        ← Panel administrador
    └── index.html            ← Página de entrada (código QR)
```

---

## REQUISITOS PREVIOS

Antes de empezar necesitas tener instalado:

| Herramienta | Versión mínima | Descarga |
|-------------|----------------|----------|
| Node.js     | 18 o superior  | https://nodejs.org |
| MySQL       | 8.0 o superior | https://dev.mysql.com/downloads/ |
| Git         | cualquiera     | https://git-scm.com |

Para verificar que los tienes instalados, abre una terminal y escribe:
```bash
node --version
npm --version
mysql --version
```

---

## PASO 1 — COPIAR LOS ARCHIVOS

Copia la carpeta `soundroom/` completa en tu computadora.
Puedes ponerla en cualquier lugar, por ejemplo:

- Windows: `C:\proyectos\soundroom\`
- Mac/Linux: `~/proyectos/soundroom/`

---

## PASO 2 — CREAR LA BASE DE DATOS MySQL

Abre MySQL Workbench o la terminal de MySQL y ejecuta:

```sql
CREATE DATABASE soundroom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'soundroom_user'@'localhost' IDENTIFIED BY 'TuPasswordSeguro123!';
GRANT ALL PRIVILEGES ON soundroom.* TO 'soundroom_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## PASO 3 — CONFIGURAR EL ARCHIVO .env

Entra a la carpeta `backend/` y copia el archivo de ejemplo:

```bash
cd soundroom/backend
cp .env.example .env
```

Luego abre el archivo `.env` con cualquier editor de texto y rellena:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=soundroom
DB_USER=soundroom_user
DB_PASSWORD=TuPasswordSeguro123!

JWT_SECRET=EscribeAquiUnaClaveMuyLargaYSegura_AlMenos32Caracteres!
JWT_EXPIRES_IN=8h

ADMIN_USERNAME=admin
ADMIN_PASSWORD=TuPasswordAdmin123!

YOUTUBE_API_KEY=AIzaSy...TuKeyReal...

CORS_ORIGIN=http://localhost:3000
SONGS_PER_USER_PER_ROOM=3
ANTISPAM_SECONDS=30
```

> ⚠️  IMPORTANTE: El YOUTUBE_API_KEY es obligatorio para que la búsqueda funcione.
>    Ver PASO 4 para obtenerla gratis.

---

## PASO 4 — OBTENER YOUTUBE API KEY (gratis)

1. Ve a https://console.cloud.google.com
2. Crea un proyecto nuevo → ponle cualquier nombre (ej: "soundroom")
3. En el menú lateral: "APIs y servicios" → "Biblioteca"
4. Busca "YouTube Data API v3" → clic en "Habilitar"
5. Ve a "APIs y servicios" → "Credenciales"
6. Clic en "Crear credenciales" → "Clave de API"
7. Copia la clave y pégala en el `.env` donde dice `YOUTUBE_API_KEY=`

La API tiene cuota gratuita de 10,000 unidades/día (suficiente para uso normal).

---

## PASO 5 — INSTALAR DEPENDENCIAS

En la terminal, dentro de la carpeta `backend/`:

```bash
cd soundroom/backend
npm install
```

Espera a que termine. Verás que se descarga node_modules (puede tardar 1-2 minutos).

---

## PASO 6 — CREAR TABLAS Y USUARIO ADMIN

Ejecuta el script de migración. Esto crea todas las tablas en MySQL
y el usuario administrador definido en tu `.env`:

```bash
npm run migrate
```

Deberías ver:
```
✅ Conexión a base de datos exitosa
✅ Tablas sincronizadas
✅ Admin creado: admin
🎉 Migración completada
```

---

## PASO 7 — INICIAR EL SERVIDOR

```bash
npm start
```

O para desarrollo con reinicio automático:
```bash
npm run dev
```

Deberías ver:
```
✅ Base de datos sincronizada
🚀 SoundRoom corriendo en http://localhost:3000
```

---

## PASO 8 — ABRIR LA APLICACIÓN

Abre tu navegador y ve a:

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Página principal (usuarios entran con código) |
| http://localhost:3000/admin | Panel de administrador |

**Credenciales admin por defecto** (las que pusiste en .env):
- Usuario: `admin`
- Contraseña: `TuPasswordAdmin123!`

---

## PASO 9 — CREAR TU PRIMERA SALA

1. Entra al panel admin → http://localhost:3000/admin
2. Inicia sesión con tu usuario y contraseña
3. Ve a la sección "Salas" en el menú lateral
4. Haz clic en "Nueva sala" → escribe un nombre (ej: "Fiesta 2024")
5. Aparecerá la sala con su código único (ej: `A3B8C2D1`)
6. Haz clic en el ícono QR para ver el código QR
7. Los usuarios escanean ese QR o van a `http://localhost:3000` y escriben el código

---

## PASO 10 — ACCESO DESDE OTROS DISPOSITIVOS (red local)

Para que tus amigos en la misma red WiFi puedan entrar:

1. Averigua tu IP local:
   - Windows: `ipconfig` en CMD → busca "Dirección IPv4"
   - Mac/Linux: `ifconfig` o `ip addr`

2. En el `.env` cambia:
   ```env
   CORS_ORIGIN=http://192.168.1.X:3000
   ```
   (reemplaza con tu IP real)

3. Reinicia el servidor

4. Los usuarios entran desde su teléfono a: `http://192.168.1.X:3000`

---

## DESPLIEGUE EN INTERNET (VPS / Servidor)

Si quieres que sea accesible desde cualquier lugar del mundo:

### Opción A — Railway (fácil, gratis para empezar)
1. Ve a https://railway.app
2. Conecta tu cuenta de GitHub
3. Sube el proyecto a un repositorio en GitHub
4. En Railway: "New Project" → "Deploy from GitHub repo"
5. Agrega las variables de entorno (.env) en el panel de Railway
6. Railway te da una URL pública automáticamente

### Opción B — VPS (DigitalOcean, Linode, etc.)
```bash
# En el servidor
git clone tu-repositorio
cd soundroom/backend
npm install
cp .env.example .env
nano .env           # editar con tus datos reales
npm run migrate
npm start

# Para que corra siempre (instalar PM2)
npm install -g pm2
pm2 start server.js --name soundroom
pm2 startup
pm2 save
```

### HTTPS (obligatorio en producción)
```bash
# Instalar Nginx y Certbot
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com
```

---

## SOLUCIÓN DE PROBLEMAS COMUNES

**Error: "Cannot connect to MySQL"**
→ Verifica que MySQL esté corriendo: `sudo service mysql start`
→ Confirma usuario/contraseña en `.env`

**Error: "YouTube API key not valid"**
→ Verifica que copiaste la key completa sin espacios
→ Confirma que habilitaste "YouTube Data API v3" en Google Cloud

**La página no carga en otro dispositivo**
→ Verifica que el firewall permite el puerto 3000:
  `sudo ufw allow 3000` (Linux)

**Error: "Module not found"**
→ Ejecuta `npm install` de nuevo dentro de `backend/`

**Socket.IO no conecta**
→ Verifica que `CORS_ORIGIN` en `.env` coincide exactamente con la URL del navegador

---

## RESUMEN RÁPIDO (comandos en orden)

```bash
# 1. Crear base de datos MySQL (una sola vez)
mysql -u root -p -e "CREATE DATABASE soundroom;"

# 2. Entrar a la carpeta backend
cd soundroom/backend

# 3. Copiar y editar configuración
cp .env.example .env
# editar .env con tus datos...

# 4. Instalar dependencias
npm install

# 5. Crear tablas
npm run migrate

# 6. Iniciar servidor
npm start

# Listo → abrir http://localhost:3000
```
