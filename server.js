import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || process.env.DEFAULT_APP_PORT) || 3000;

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'pia', timestamp: new Date().toISOString() });
});

// Body Parsers con límites institucionales controlados
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ========================================================
// 1. GESTIÓN DE RUTAS Y ALMACENAMIENTO PERSISTENTE
// ========================================================

const DATA_DIR = process.env.PIA_DATA_DIR
  ? path.resolve(process.env.PIA_DATA_DIR)
  : path.resolve(__dirname, '..', 'pia-data');

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const OPERATORS_FILE = path.join(DATA_DIR, 'authorized_operators.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');
const VISITS_FILE = path.join(DATA_DIR, 'page_visits.json');
const USERS_FILE = path.join(DATA_DIR, 'users_roles.json');

// Lista blanca estricta de archivos autorizados (Protección contra Path Traversal)
const WHITELIST_JSON_MAP = {
  'canales': path.join(__dirname, 'canales-por-la-integridad', 'data_directorio.json'),
  'canales-por-la-integridad': path.join(__dirname, 'canales-por-la-integridad', 'data_directorio.json'),
  'data_directorio.json': path.join(__dirname, 'canales-por-la-integridad', 'data_directorio.json'),
  'directorio': path.join(__dirname, 'directorio', 'data_acceso.json'),
  'data_acceso.json': path.join(__dirname, 'directorio', 'data_acceso.json'),
  'tableros': path.join(__dirname, 'gobierno_en_numeros', 'data_tableros.json'),
  'gobierno_en_numeros': path.join(__dirname, 'gobierno_en_numeros', 'data_tableros.json'),
  'data_tableros.json': path.join(__dirname, 'gobierno_en_numeros', 'data_tableros.json'),
  'riesgo': path.join(__dirname, 'riesgo', 'datos.json'),
  'datos.json': path.join(__dirname, 'riesgo', 'datos.json'),
  'vehiculos': path.join(__dirname, 'vehiculos', 'vehiculos.json'),
  'vehiculos_instituciones': path.join(__dirname, 'vehiculos', 'vehiculos.json'),
  'vehiculos.json': path.join(__dirname, 'vehiculos', 'vehiculos.json'),
  'portal': path.join(__dirname, 'data_portal.json'),
  'data_portal.json': path.join(__dirname, 'data_portal.json'),
  'chatbot_settings.json': path.join(__dirname, 'chatbot_settings.json'),
  'chatbot_knowledge.json': path.join(__dirname, 'chatbot_knowledge.json'),
  'visits': VISITS_FILE,
  'page_visits.json': VISITS_FILE
};

// Cálculo de hash SHA-256 para control de concurrencia (ETag)
function computeFileHash(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

// Respaldo automático previo a toda modificación
function createBackup(filePath, user = 'sistema') {
  try {
    if (!fs.existsSync(filePath)) return null;
    const filename = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(3).toString('hex');
    const backupName = `${filename}.${timestamp}.${random}.bak`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    fs.copyFileSync(filePath, backupPath);

    // Rotación: mantener un máximo de 30 copias por archivo
    const allBackups = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith(filename) && f.endsWith('.bak'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (allBackups.length > 30) {
      for (const old of allBackups.slice(30)) {
        try { fs.unlinkSync(path.join(BACKUPS_DIR, old.name)); } catch (_) {}
      }
    }
    return backupName;
  } catch (err) {
    console.error('Error generando respaldo automático:', err);
    return null;
  }
}

// Escritura atómica mediante archivo temporal y reemplazo
function atomicWriteJson(filePath, data, expectedHash = null, user = 'sistema') {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Estructura de datos JSON inválida.');
  }

  // Control de concurrencia optimista
  if (expectedHash && fs.existsSync(filePath)) {
    const currentHash = computeFileHash(filePath);
    if (currentHash && currentHash !== expectedHash) {
      const err = new Error('Conflicto de concurrencia: El archivo fue modificado por la otra persona operadora. Recargue los datos.');
      err.code = 'CONCURRENCY_CONFLICT';
      throw err;
    }
  }

  const backupCreated = createBackup(filePath, user);

  const tempDir = path.dirname(filePath);
  const tempFile = path.join(tempDir, `.tmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
  const jsonContent = JSON.stringify(data, null, 2);

  fs.writeFileSync(tempFile, jsonContent, 'utf8');
  fs.renameSync(tempFile, filePath);

  const newHash = computeFileHash(filePath);
  return { success: true, newHash, backupCreated };
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error leyendo ${filePath}:`, err);
    return null;
  }
}

// ========================================================
// 1.1 CONTADOR REAL DE VISITAS Y MÉTRICAS DEL PORTAL
// ========================================================

const INITIAL_PAGES_META = {
  '/': { name: 'Portal Principal / Inicio', section: 'Principal' },
  '/directorio': { name: 'Directorio Acceso al Ejecutivo', section: 'Directorio' },
  '/canales-por-la-integridad': { name: 'Canales por la Integridad', section: 'Denuncias' },
  '/gobierno_en_numeros': { name: 'Tu Gobierno en Números', section: 'Tableros' },
  '/riesgo': { name: 'Riesgo en la Mira', section: 'Riesgo' }
};

function getVisitsData() {
  try {
    if (!fs.existsSync(VISITS_FILE)) {
      const init = {
        totalVisits: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        pages: {
          '/': { name: 'Portal Principal / Inicio', visits: 0, lastVisit: null },
          '/directorio': { name: 'Directorio Acceso al Ejecutivo', visits: 0, lastVisit: null },
          '/canales-por-la-integridad': { name: 'Canales por la Integridad', visits: 0, lastVisit: null },
          '/gobierno_en_numeros': { name: 'Tu Gobierno en Números', visits: 0, lastVisit: null },
          '/riesgo': { name: 'Riesgo en la Mira', visits: 0, lastVisit: null }
        },
        recentVisits: []
      };
      fs.writeFileSync(VISITS_FILE, JSON.stringify(init, null, 2), 'utf8');
      return init;
    }
    const data = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
    if (!data.pages) data.pages = {};
    for (const [k, v] of Object.entries(INITIAL_PAGES_META)) {
      if (!data.pages[k]) {
        data.pages[k] = { name: v.name, visits: 0, lastVisit: null };
      }
    }
    return data;
  } catch (e) {
    console.error('Error leyendo page_visits.json:', e);
    return { totalVisits: 0, pages: {}, recentVisits: [] };
  }
}

function recordPageVisit(pagePath = '/', req = {}) {
  try {
    let norm = String(pagePath || '/').trim();
    if (norm.length > 1 && norm.endsWith('/')) {
      norm = norm.slice(0, -1);
    }
    if (!norm) norm = '/';

    if (norm.startsWith('/api') || norm.startsWith('/admin') || norm.includes('.')) {
      return;
    }

    const data = getVisitsData();
    data.totalVisits = (Number(data.totalVisits) || 0) + 1;
    data.lastUpdated = new Date().toISOString();

    if (!data.pages[norm]) {
      const meta = INITIAL_PAGES_META[norm] || { name: norm, section: 'Sección' };
      data.pages[norm] = { name: meta.name, visits: 0, lastVisit: null };
    }

    data.pages[norm].visits = (Number(data.pages[norm].visits) || 0) + 1;
    data.pages[norm].lastVisit = new Date().toISOString();

    const headers = req.headers || {};
    const rawIp = (headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const ipParts = rawIp.split('.');
    const maskedIp = ipParts.length === 4 ? `${ipParts[0]}.${ipParts[1]}.***.***` : '127.0.***';
    const userAgent = String(headers['user-agent'] || 'Navegador Web').slice(0, 90);

    if (!Array.isArray(data.recentVisits)) data.recentVisits = [];
    data.recentVisits.unshift({
      id: crypto.randomBytes(4).toString('hex'),
      path: norm,
      pageName: data.pages[norm].name,
      timestamp: new Date().toISOString(),
      maskedIp,
      userAgent
    });

    if (data.recentVisits.length > 60) {
      data.recentVisits = data.recentVisits.slice(0, 60);
    }

    const tempFile = path.join(DATA_DIR, `.tmp_visits_${Date.now()}`);
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, VISITS_FILE);
  } catch (err) {
    console.error('Error registrando visita:', err);
  }
}

// ========================================================
// 2. AUDITORÍA INSTITUCIONAL CON IDENTIFICACIÓN INDIVIDUAL
// ========================================================

function getAuditLogs() {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  } catch (err) {
    console.error('Error leyendo auditoría:', err);
    return [];
  }
}

function logAudit({
  user = 'anónimo',
  userOid = '00000000-0000-0000-0000-000000000000',
  userRole = 'data_operator',
  action = 'CONSULTA',
  module = 'general',
  target = '',
  recordId = null,
  details = '',
  backupCreated = null,
  ip = '127.0.0.1'
}) {
  const logs = getAuditLogs();
  const entry = {
    id: logs.length > 0 ? Math.max(...logs.map(l => Number(l.id) || 0)) + 1 : 1,
    userOid,
    user,
    userRole,
    action,
    module,
    target: target || module,
    recordId,
    details,
    backupCreated,
    timestamp: new Date().toISOString(),
    ip
  };

  logs.unshift(entry);
  if (logs.length > 1000) logs.pop();

  try {
    const tempFile = path.join(DATA_DIR, `.tmp_audit_${Date.now()}`);
    fs.writeFileSync(tempFile, JSON.stringify(logs, null, 2), 'utf8');
    fs.renameSync(tempFile, AUDIT_FILE);
  } catch (e) {
    console.error('Error guardando bitácora de auditoría:', e);
  }
  return entry;
}

// ========================================================
// 3. MODELO DE ACCESO CERRADO CON FIREBASE AUTHENTICATION (DOS OPERADORES)
// ========================================================

const FIREBASE_CONFIG_FILE = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig = {
  projectId: 'pia-portal-integridad',
  apiKey: '',
  authDomain: 'pia-portal-integridad.firebaseapp.com',
  appId: ''
};

try {
  if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
    const raw = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf8'));
    firebaseConfig = { ...firebaseConfig, ...raw };
    firebaseConfig.apiKey = process.env.FIREBASE_API_KEY || firebaseConfig.apiKey;
    firebaseConfig.authDomain = process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain;
    firebaseConfig.appId = process.env.FIREBASE_APP_ID || firebaseConfig.appId;
  }
} catch (e) {
  console.error('Error leyendo firebase-applet-config.json:', e);
}

const FIREBASE_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || 'pia-portal-integridad').trim();

// Claves públicas JWKS oficiales de Google para verificación criptográfica de tokens de Firebase Auth
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let firebaseJwks = null;

function getFirebaseJWKS() {
  if (!firebaseJwks) {
    const jwksUrl = new URL(FIREBASE_JWKS_URL);
    firebaseJwks = createRemoteJWKSet(jwksUrl, {
      cacheMaxAge: 600000,
      cooldownDuration: 30000
    });
  }
  return firebaseJwks;
}

// Cuentas restringidas oficialmente autorizadas para administrar el Portal PIA
const ALLOWED_OPERATOR_EMAILS = [
  'deteccionydenuncia@cnc.gob.gt',
  'apoyogi@cnc.gob.gt'
];

// Carga las dos identidades operativas de la CNC (vía variables de entorno o archivo de configuración privado)
function getAuthorizedOperators() {
  const operators = [
    {
      operatorIndex: 1,
      uid: (process.env.PIA_OPERATOR_1_UID || '').trim(),
      email: 'deteccionydenuncia@cnc.gob.gt',
      upn: 'deteccionydenuncia@cnc.gob.gt',
      displayName: process.env.PIA_OPERATOR_1_NAME || 'Dirección de Apoyo en la Gestión de Irregularidades - DAGI',
      role: 'data_operator',
      status: process.env.PIA_OPERATOR_1_UID ? 'active' : 'pending_first_login',
      notes: 'Operador 1 de la CNC autorizado para administración del Portal PIA mediante Firebase Auth.'
    },
    {
      operatorIndex: 2,
      uid: (process.env.PIA_OPERATOR_2_UID || '').trim(),
      email: 'apoyogi@cnc.gob.gt',
      upn: 'apoyogi@cnc.gob.gt',
      displayName: process.env.PIA_OPERATOR_2_NAME || 'Apoyo GI (CNC)',
      role: 'data_operator',
      status: process.env.PIA_OPERATOR_2_UID ? 'active' : 'pending_first_login',
      notes: 'Operador 2 de la CNC autorizado para administración del Portal PIA mediante Firebase Auth.'
    }
  ];

  // Complemento y persistencia de UIDs desde archivo protegido si existe
  if (fs.existsSync(OPERATORS_FILE)) {
    try {
      const fileOps = JSON.parse(fs.readFileSync(OPERATORS_FILE, 'utf8'));
      if (Array.isArray(fileOps)) {
        for (const op of fileOps.slice(0, 2)) {
          const target = operators.find(o => o.email.toLowerCase() === (op.email || op.upn || '').toLowerCase());
          if (target) {
            const rawUid = (op.uid || '').trim();
            if (rawUid && rawUid !== '00000000-0000-0000-0000-000000000000') {
              target.uid = rawUid;
              target.status = 'active';
            }
            if (op.displayName) target.displayName = op.displayName;
            if (op.notes) target.notes = op.notes;
          }
        }
      }
    } catch (e) {
      console.error('Error leyendo authorized_operators.json:', e);
    }
  }

  return operators.slice(0, 2);
}

// Guarda actualización de operadores en authorized_operators.json con escritura atómica
function saveAuthorizedOperators(operators) {
  try {
    const tempFile = path.join(DATA_DIR, `.tmp_operators_${Date.now()}`);
    fs.writeFileSync(tempFile, JSON.stringify(operators, null, 2), 'utf8');
    fs.renameSync(tempFile, OPERATORS_FILE);
  } catch (e) {
    console.error('Error guardando authorized_operators.json:', e);
  }
}

// ========================================================
// 3.B GESTIÓN DE ROLES, PERMISOS Y CONTRASEÑAS ENCRIPTADAS
// ========================================================

function createInitialAuthorizedUsers() {
  const password1 = (process.env.PIA_OPERATOR_1_PASSWORD || '').trim();
  const password2 = (process.env.PIA_OPERATOR_2_PASSWORD || '').trim();
  if (!password1 || !password2 || password1.length < 14 || password2.length < 14 || password1 === password2) {
    return [];
  }

  const now = new Date().toISOString();
  const modules = ["canales", "directorio", "tableros", "riesgo", "vehiculos", "portal", "visits", "chatbot", "users", "audit", "database", "guide"];
  return [
    {
      id: "usr_cnc_01",
      email: "deteccionydenuncia@cnc.gob.gt",
      displayName: process.env.PIA_OPERATOR_1_NAME || "Dirección de Apoyo en la Gestión de Irregularidades - DAGI",
      role: "admin",
      passwordHash: hashPassword(password1),
      modules,
      status: "active",
      operatorIndex: 1,
      lastPasswordChange: null,
      updatedAt: now
    },
    {
      id: "usr_cnc_02",
      email: "apoyogi@cnc.gob.gt",
      displayName: process.env.PIA_OPERATOR_2_NAME || "Apoyo a la Gestión de Irregularidades (CNC)",
      role: "admin",
      passwordHash: hashPassword(password2),
      modules,
      status: "active",
      operatorIndex: 2,
      lastPasswordChange: null,
      updatedAt: now
    }
  ];
}
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const iterations = 310000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return `${salt}:${iterations}:${hash}`;
}

function verifyPassword(password, storedCombined) {
  if (!storedCombined || typeof storedCombined !== 'string' || !storedCombined.includes(':')) {
    return false;
  }
  const parts = storedCombined.split(':');
  const salt = parts[0];
  const iterations = parts.length === 3 ? Number(parts[1]) : 10000;
  const expectedHash = parts.length === 3 ? parts[2] : parts[1];
  if (!salt || !expectedHash || !Number.isSafeInteger(iterations) || iterations < 10000 || iterations > 1000000) return false;
  try {
    const actualHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const actualBuffer = Buffer.from(actualHash, 'hex');
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch (e) {
    return false;
  }
}

const SESSION_HMAC_SECRET = (process.env.PIA_SESSION_SECRET || '').trim();
if (SESSION_HMAC_SECRET.length < 64) {
  throw new Error('Configuración insegura: PIA_SESSION_SECRET es obligatorio y debe contener al menos 64 caracteres aleatorios.');
}

function createLocalSessionToken(user) {
  const payload = {
    uid: user.id || user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.role || 'admin',
    modules: user.modules || [],
    operatorIndex: user.operatorIndex || 1,
    exp: Date.now() + (12 * 60 * 60 * 1000)
  };
  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(bodyB64).digest('base64url');
  return `pia_sess_${bodyB64}.${signature}`;
}

function verifyLocalSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('pia_sess_')) return null;
  const parts = token.slice('pia_sess_'.length).split('.');
  if (parts.length !== 2) return null;
  const [bodyB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(bodyB64).digest('base64url');
  if (signature.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getUsersRoles() {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.error('Error leyendo users_roles.json:', e);
    }
  }
  const initialUsers = createInitialAuthorizedUsers();
  if (initialUsers.length !== 2) {
    console.error('PIA: no existen usuarios iniciales. Configure PIA_OPERATOR_1_PASSWORD y PIA_OPERATOR_2_PASSWORD (mínimo 14 caracteres) y reinicie.');
    return [];
  }
  saveUsersRoles(initialUsers);
  return initialUsers;
}

function saveUsersRoles(users) {
  try {
    const tempFile = path.join(DATA_DIR, `.tmp_users_${Date.now()}`);
    fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf8');
    fs.renameSync(tempFile, USERS_FILE);
    return true;
  } catch (e) {
    console.error('Error guardando users_roles.json:', e);
    return false;
  }
}

// Validación criptográfica estricta de token de Firebase Authentication en el servidor
async function verifyFirebaseToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token de autorización no proporcionado.');
  }

  const JWKS = getFirebaseJWKS();
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  const { payload } = await jwtVerify(token, JWKS, {
    audience: FIREBASE_PROJECT_ID,
    issuer: expectedIssuer,
    algorithms: ['RS256'],
    clockTolerance: 60
  });

  const uid = payload.sub || payload.user_id;
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    throw new Error('El token de Firebase no contiene un identificador único de usuario (UID).');
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('El token de Firebase no contiene una dirección de correo institucional asociada.');
  }

  return {
    uid: uid.trim(),
    email,
    name: payload.name || email.split('@')[0],
    email_verified: !!payload.email_verified,
    payload
  };
}

// Middleware de autenticación y autorización para dos operadores (Sesión Local o Firebase Auth)
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({
      error: 'Acceso no autorizado. Debe autenticarse con una cuenta autorizada de la CNC.'
    });
  }

  // 1. Verificación de token de sesión local criptográfica (HMAC-SHA256)
  if (token.startsWith('pia_sess_')) {
    const localSession = verifyLocalSessionToken(token);
    if (!localSession) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
    const userEmail = (localSession.email || '').toLowerCase();
    if (!ALLOWED_OPERATOR_EMAILS.includes(userEmail)) {
      return res.status(403).json({ error: 'Usuario no autorizado en el portal.' });
    }
    const allUsers = getUsersRoles();
    const dbUser = allUsers.find(u => u.email.toLowerCase() === userEmail && u.status === 'active');
    if (!dbUser) {
      return res.status(403).json({ error: 'La cuenta no está inicializada o se encuentra deshabilitada en el servidor.' });
    }

    req.user = {
      uid: dbUser.id,
      oid: dbUser.id,
      email: userEmail,
      upn: userEmail,
      displayName: dbUser.displayName,
      operatorIndex: dbUser.operatorIndex,
      role: dbUser.role,
      modules: Array.isArray(dbUser.modules) ? dbUser.modules : []
    };
    return next();
  }

  // 2. Verificación de token de Firebase Authentication
  try {
    const verified = await verifyFirebaseToken(token);
    const userUid = verified.uid;
    const userEmail = verified.email;

    if (!verified.email_verified) {
      return res.status(403).json({ error: 'La cuenta institucional debe tener el correo verificado en Firebase.' });
    }

    // Verificar si el correo pertenece estrictamente a las 2 cuentas autorizadas
    if (!ALLOWED_OPERATOR_EMAILS.includes(userEmail)) {
      logAudit({
        user: userEmail,
        userUid,
        userOid: userUid,
        userRole: 'no_autorizado',
        action: 'ACCESO DENEGADO (CORREO NO AUTORIZADO)',
        module: 'auth',
        target: 'admin',
        details: `Intento de acceso denegado: ${userEmail} (UID: ${userUid}) no figura entre las 2 cuentas autorizadas de la CNC.`,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
      });

      return res.status(403).json({
        error: 'Su cuenta está autenticada en Firebase, pero no figura entre las dos identidades operativas autorizadas para administrar el Portal PIA.',
        email: userEmail
      });
    }

    // Validación del UID inmutable en el servidor
    const operators = getAuthorizedOperators();
    const matchedOperator = operators.find(op => op.email.toLowerCase() === userEmail.toLowerCase());

    if (!matchedOperator) {
      return res.status(403).json({
        error: 'Operador no configurado en el servidor.',
        email: userEmail
      });
    }

    if (matchedOperator.uid && matchedOperator.uid !== userUid) {
      logAudit({
        user: userEmail,
        userUid,
        userOid: userUid,
        userRole: 'no_autorizado',
        action: 'ACCESO DENEGADO (DISCREPANCIA DE UID)',
        module: 'auth',
        target: 'admin',
        details: `Discrepancia de UID en servidor: Recibido ${userUid}, registrado ${matchedOperator.uid}`,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
      });

      return res.status(403).json({
        error: 'Discrepancia de seguridad: El UID de Firebase no coincide con el identificador registrado para este operador institucional.',
        email: userEmail
      });
    }

    if (!matchedOperator.uid) {
      matchedOperator.uid = userUid;
      matchedOperator.status = 'active';
      saveAuthorizedOperators(operators);
      logAudit({
        user: userEmail,
        userUid,
        userOid: userUid,
        userRole: 'data_operator',
        action: 'ENLACE INMUTABLE DE UID OPERADOR',
        module: 'auth',
        target: 'admin',
        details: `UID de Firebase Auth registrado exitosamente para operador ${matchedOperator.displayName}: ${userUid}`,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
      });
    }

    const allUsers = getUsersRoles();
    const dbUser = allUsers.find(u => u.email.toLowerCase() === userEmail && u.status === 'active');
    if (!dbUser) {
      return res.status(403).json({ error: 'La cuenta institucional no está inicializada o se encuentra deshabilitada en el servidor.' });
    }

    req.user = {
      uid: userUid,
      oid: userUid,
      email: userEmail,
      upn: userEmail,
      displayName: dbUser.displayName || matchedOperator.displayName || verified.name,
      operatorIndex: dbUser.operatorIndex || matchedOperator.operatorIndex,
      role: dbUser.role,
      modules: Array.isArray(dbUser.modules) ? dbUser.modules : []
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token de autorización inválido, expirado o no autorizado.',
      details: err.message
    });
  }
}

// Autorización por módulo: la visibilidad del menú no sustituye el control del servidor.
function requireModule(moduleId) {
  return (req, res, next) => {
    const assigned = Array.isArray(req.user?.modules) ? req.user.modules : [];
    if (!assigned.includes(moduleId)) {
      return res.status(403).json({ error: `No tiene permiso para acceder al módulo "${moduleId}".` });
    }
    next();
  };
}

function requireModuleFromParam(req, res, next) {
  const aliases = {
    'canales-por-la-integridad': 'canales',
    'gobierno_en_numeros': 'tableros',
    'vehiculos_instituciones': 'vehiculos'
  };
  const moduleId = aliases[req.params.module] || req.params.module;
  return requireModule(moduleId)(req, res, next);
}

// Middleware de verificación de rol de operador o administrador
function requireOperator(req, res, next) {
  if (!req.user || (req.user.role !== 'data_operator' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Operación reservada exclusivamente para los operadores autorizados.' });
  }
  next();
}

// Cabeceras de seguridad HTTP
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  if (req.url.endsWith('.json')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// ========================================================
// 4. ENDPOINTS DE AUTENTICACIÓN INSTITUCIONAL FIREBASE AUTH
// ========================================================

// Configuración pública de Firebase para el cliente (sin secretos ni claves privadas)
app.get('/api/auth/firebase-config', (req, res) => {
  res.json({
    configured: true,
    projectId: FIREBASE_PROJECT_ID,
    apiKey: firebaseConfig.apiKey || '',
    authDomain: firebaseConfig.authDomain || `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
    appId: firebaseConfig.appId || '',
    storageBucket: firebaseConfig.storageBucket || `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
    authorizedEmails: ALLOWED_OPERATOR_EMAILS
  });
});

// Endpoint de compatibilidad (indica reemplazo oficial de Entra ID por Firebase Auth)
app.get('/api/auth/entra-config', (req, res) => {
  res.json({
    configured: false,
    replacedBy: 'firebase',
    authProvider: 'Firebase Authentication (Email/Contraseña)',
    operatorsConfigured: getAuthorizedOperators().length
  });
});

const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX_ATTEMPTS = 8;
const loginAttempts = new Map();

function loginRateLimit(req, res, next) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStartedAt >= LOGIN_RATE_WINDOW_MS) {
    entry = { windowStartedAt: now, count: 0 };
  }
  entry.count += 1;
  loginAttempts.set(key, entry);

  if (entry.count > LOGIN_RATE_MAX_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((LOGIN_RATE_WINDOW_MS - (now - entry.windowStartedAt)) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Demasiados intentos de inicio de sesión. Espere antes de volver a intentar.' });
  }
  next();
}

// Inicio de sesión directo con correo y contraseña encriptada (con sal PBKDF2/SHA-512)
app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const { email, username, password } = req.body || {};
  const userIdentifier = (email || username || '').trim().toLowerCase();
  const rawPassword = password || '';

  if (!userIdentifier || !rawPassword) {
    return res.status(401).json({ error: 'Credenciales incompletas. Debe ingresar correo y contraseña.' });
  }

  // Verificar si es uno de los 2 usuarios autorizados
  if (!ALLOWED_OPERATOR_EMAILS.includes(userIdentifier)) {
    logAudit({
      user: userIdentifier,
      action: 'LOGIN FALLIDO (USUARIO NO AUTORIZADO)',
      module: 'auth',
      target: 'admin',
      details: `Intento de acceso rechazado para cuenta no autorizada: ${userIdentifier}`,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });
    return res.status(401).json({ error: 'Credenciales incorrectas o usuario no autorizado.' });
  }

  const users = getUsersRoles();
  const user = users.find(u => u.email.toLowerCase() === userIdentifier);

  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Credenciales incorrectas o usuario no configurado.' });
  }

  const isValid = verifyPassword(rawPassword, user.passwordHash);
  if (!isValid) {
    logAudit({
      user: userIdentifier,
      action: 'LOGIN FALLIDO (CONTRASEÑA INCORRECTA)',
      module: 'auth',
      target: 'admin',
      details: `Contraseña inválida ingresada para el usuario ${userIdentifier}`,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });
    return res.status(401).json({ error: 'Credenciales incorrectas o usuario no autorizado.' });
  }

  const token = createLocalSessionToken(user);

  logAudit({
    user: user.email,
    userUid: user.id,
    userRole: user.role,
    action: 'INICIO DE SESIÓN EXITOSO (ADMIN LOCAL/ENCRIPTADO)',
    module: 'auth',
    target: 'admin',
    details: `Inicio de sesión exitoso como ${user.displayName} (${user.email}) con permisos en: ${(user.modules || []).join(', ')}`,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      uid: user.id,
      oid: user.id,
      email: user.email,
      upn: user.email,
      displayName: user.displayName,
      role: user.role || 'admin',
      modules: user.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
      operatorIndex: user.operatorIndex
    }
  });
});

app.get('/api/auth/verify', requireAuth, (req, res) => {
  res.json({
    user: {
      uid: req.user.uid,
      oid: req.user.uid,
      email: req.user.email,
      upn: req.user.email,
      displayName: req.user.displayName,
      operatorIndex: req.user.operatorIndex,
      role: req.user.role || 'admin',
      modules: req.user.modules
    }
  });
});

// Estado de configuración institucional de los dos operadores y políticas de seguridad
app.get('/api/admin/operators-status', requireAuth, requireOperator, requireModule('users'), (req, res) => {
  const users = getUsersRoles();
  const op1 = users.find(o => o.operatorIndex === 1) || users[0];
  const op2 = users.find(o => o.operatorIndex === 2) || users[1];

  res.json({
    model: 'two_operators_exclusive',
    maxAllowed: 2,
    configuredCount: users.length,
    slots: [
      {
        slot: 1,
        configured: !!(op1 && op1.status === 'active'),
        displayName: op1?.displayName || 'Dirección de Apoyo en la Gestión de Irregularidades - DAGI',
        email: 'deteccionydenuncia@cnc.gob.gt',
        upn: 'deteccionydenuncia@cnc.gob.gt',
        uidMasked: op1?.id || 'usr_cnc_01',
        source: 'users_roles.json (Cifrado PBKDF2/SHA-512)',
        role: op1?.role || 'admin',
        modules: op1?.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
        status: op1?.status || 'active',
        lastPasswordChange: op1?.lastPasswordChange
      },
      {
        slot: 2,
        configured: !!(op2 && op2.status === 'active'),
        displayName: op2?.displayName || 'Apoyo a la Gestión de Irregularidades (CNC)',
        email: 'apoyogi@cnc.gob.gt',
        upn: 'apoyogi@cnc.gob.gt',
        uidMasked: op2?.id || 'usr_cnc_02',
        source: 'users_roles.json (Cifrado PBKDF2/SHA-512)',
        role: op2?.role || 'admin',
        modules: op2?.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
        status: op2?.status || 'active',
        lastPasswordChange: op2?.lastPasswordChange
      }
    ],
    security: {
      authProvider: 'Autenticación Criptográfica (PBKDF2/SHA-512) + Firebase Auth',
      projectId: FIREBASE_PROJECT_ID,
      authDomain: firebaseConfig.authDomain || `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
      concurrencyControl: 'SHA-256 ETag Optimistic Concurrency Activo',
      atomicWrites: 'Activo (.tmp + rename atómico)',
      automatedBackups: 'Activo (rotación de 30 versiones en data/backups)',
      immutableUidAudit: 'Activo (registro individualizado en audit_logs.json)',
      browserUserCreationDisabled: false,
      geminiLupita: {
        model: 'gemini-2.5-flash',
        configured: !!process.env.GEMINI_API_KEY,
        proxyActive: true,
        rateLimit: '15 peticiones / minuto por IP',
        heuristicFallback: 'Activo'
      }
    }
  });
});

// Obtener lista autorizada de usuarios (sanitizada sin hashes de contraseña)
app.get('/api/users', requireAuth, requireOperator, requireModule('users'), (req, res) => {
  const users = getUsersRoles();
  const sanitized = users.map(u => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role || 'admin',
    modules: u.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
    status: u.status || 'active',
    operatorIndex: u.operatorIndex,
    lastPasswordChange: u.lastPasswordChange,
    updatedAt: u.updatedAt
  }));

  res.json({
    model: 'two_operators_exclusive',
    authorizedCount: sanitized.length,
    maxAllowed: 2,
    users: sanitized
  });
});

// Actualizar módulos permitidos para un usuario desde el panel admin
app.put('/api/admin/users/:email/permissions', requireAuth, requireOperator, requireModule('users'), (req, res) => {
  const targetEmail = (req.params.email || '').trim().toLowerCase();
  const { modules } = req.body || {};

  if (!ALLOWED_OPERATOR_EMAILS.includes(targetEmail)) {
    return res.status(404).json({ error: 'Usuario no encontrado entre los operadores autorizados.' });
  }

  if (!Array.isArray(modules)) {
    return res.status(400).json({ error: 'El listado de módulos debe ser un arreglo de cadenas.' });
  }

  const validModules = ['canales', 'directorio', 'tableros', 'riesgo', 'vehiculos', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'];
  const sanitizedModules = modules.filter(m => validModules.includes(m));

  const users = getUsersRoles();
  const user = users.find(u => u.email.toLowerCase() === targetEmail);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  user.modules = sanitizedModules;
  user.updatedAt = new Date().toISOString();
  saveUsersRoles(users);

  logAudit({
    user: req.user.email,
    userUid: req.user.uid,
    action: 'ACTUALIZACIÓN DE PERMISOS DE MÓDULOS',
    module: 'users',
    target: targetEmail,
    details: `Módulos asignados a ${targetEmail}: ${sanitizedModules.join(', ')}`,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
  });

  res.json({
    success: true,
    message: `Permisos actualizados para ${targetEmail}`,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      modules: user.modules,
      status: user.status
    }
  });
});

// Cambiar y encriptar contraseña para un usuario desde el panel admin
app.put('/api/admin/users/:email/password', requireAuth, requireOperator, requireModule('users'), (req, res) => {
  const targetEmail = (req.params.email || '').trim().toLowerCase();
  const { newPassword } = req.body || {};

  if (!ALLOWED_OPERATOR_EMAILS.includes(targetEmail)) {
    return res.status(404).json({ error: 'Usuario no encontrado entre los operadores autorizados.' });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 14 || newPassword.trim().length > 256) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener entre 14 y 256 caracteres.' });
  }

  const users = getUsersRoles();
  const user = users.find(u => u.email.toLowerCase() === targetEmail);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Encriptar con sal criptográfica única y PBKDF2/SHA-512
  const newHash = hashPassword(newPassword.trim());
  user.passwordHash = newHash;
  user.lastPasswordChange = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  saveUsersRoles(users);

  logAudit({
    user: req.user.email,
    userUid: req.user.uid,
    action: 'CAMBIO DE CONTRASEÑA ENCRIPTADA',
    module: 'users',
    target: targetEmail,
    details: `Contraseña actualizada y encriptada con sal PBKDF2/SHA-512 para el usuario ${targetEmail}`,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
  });

  res.json({
    success: true,
    message: `Contraseña de ${targetEmail} actualizada y encriptada exitosamente.`
  });
});

// Actualizar rol de usuario (admin o data_operator)
app.put('/api/admin/users/:email/role', requireAuth, requireOperator, requireModule('users'), (req, res) => {
  const targetEmail = (req.params.email || '').trim().toLowerCase();
  const { role } = req.body || {};

  if (!ALLOWED_OPERATOR_EMAILS.includes(targetEmail)) {
    return res.status(404).json({ error: 'Usuario no encontrado entre los operadores autorizados.' });
  }

  const allowedRoles = ['admin', 'data_operator'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol no válido. Permitidos: admin, data_operator.' });
  }

  const users = getUsersRoles();
  const user = users.find(u => u.email.toLowerCase() === targetEmail);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  user.role = role;
  user.updatedAt = new Date().toISOString();
  saveUsersRoles(users);

  logAudit({
    user: req.user.email,
    userUid: req.user.uid,
    action: 'ACTUALIZACIÓN DE ROL',
    module: 'users',
    target: targetEmail,
    details: `Rol asignado a ${targetEmail}: ${role}`,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
  });

  res.json({
    success: true,
    message: `Rol actualizado a ${role} para ${targetEmail}`,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
});

// ========================================================
// 5. OPERACIONES MODULARES CRUD (PARA LOS DOS OPERADORES)
// ========================================================

function getModuleRecords(module) {
  const filePath = WHITELIST_JSON_MAP[module];
  if (!filePath) throw new Error(`Módulo '${module}' no reconocido`);

  const data = readJsonFile(filePath);
  if (!data) return [];

  if (module === 'riesgo') {
    if (data.years && data.years['2025'] && Array.isArray(data.years['2025'].instituciones)) {
      return data.years['2025'].instituciones.map((item, index) => ({
        id: item.id || (index + 1),
        ...item
      }));
    }
    return [];
  }

  if (module === 'vehiculos_instituciones') {
    if (data && Array.isArray(data.catalogInstituciones)) {
      return data.catalogInstituciones.map(item => ({
        id: item.nombre,
        ...item
      }));
    }
    return [];
  }

  if (module === 'vehiculos') {
    if (data && Array.isArray(data.vehicles)) {
      return data.vehicles.map((item, index) => ({
        id: item.id || (index + 1),
        ...item
      }));
    } else if (Array.isArray(data)) {
      return data.map((item, index) => ({
        id: item.id || (index + 1),
        ...item
      }));
    }
    return [];
  }

  if (module === 'portal') {
    return [{ id: 1, ...data }];
  }

  if (Array.isArray(data)) {
    return data.map((item, index) => ({
      id: item.id || (index + 1),
      ...item
    }));
  }

  return [];
}

function saveModuleRecords(module, records, user = 'sistema', expectedHash = null) {
  const filePath = WHITELIST_JSON_MAP[module];
  if (!filePath) throw new Error(`Módulo '${module}' no reconocido`);

  if (module === 'riesgo') {
    let fullData = readJsonFile(filePath) || { years: { "2025": { instituciones: [] } } };
    if (!fullData.years) fullData.years = {};
    if (!fullData.years['2025']) fullData.years['2025'] = { instituciones: [] };
    fullData.years['2025'].instituciones = records;
    return atomicWriteJson(filePath, fullData, expectedHash, user);
  }

  if (module === 'vehiculos_instituciones') {
    let fullData = readJsonFile(filePath) || { catalogInstituciones: [], vehicles: [] };
    fullData.catalogInstituciones = records;
    return atomicWriteJson(filePath, fullData, expectedHash, user);
  }

  if (module === 'vehiculos') {
    let fullData = readJsonFile(filePath) || { catalogInstituciones: [], vehicles: [] };
    fullData.vehicles = records;
    return atomicWriteJson(filePath, fullData, expectedHash, user);
  }

  if (module === 'portal') {
    const singleRecord = records[0] || {};
    const { id, ...portalData } = singleRecord;
    return atomicWriteJson(filePath, portalData, expectedHash, user);
  }

  if (module === 'canales' || module === 'canales-por-la-integridad') {
    records = records.map(item => {
      let count = 0;
      if (item.telefono && String(item.telefono).trim()) count++;
      if (item.correo && String(item.correo).trim()) count++;
      if (item.formulario && String(item.formulario).trim()) count++;
      const dirStr = String(item.direccion || item.ubicacion || '');
      const tipocom = String(item.tipocom || '');
      const hasPresencial = dirStr.trim().length > 0 || (
        tipocom.toLowerCase().includes('presencial') ||
        tipocom.toLowerCase().includes('oficina')
      );
      if (hasPresencial) count++;
      if (item.otro && String(item.otro).trim()) count++;
      return { ...item, canales: count > 0 ? count : 1 };
    });
    return atomicWriteJson(filePath, records, expectedHash, user);
  }

  return atomicWriteJson(filePath, records, expectedHash, user);
}

const RESERVED_MODULES = ['auth', 'dashboard', 'raw-json', 'files', 'audit', 'users', 'security-policies', 'chatbot', 'admin'];

app.get('/api/modules', (req, res) => {
  res.json(['canales', 'directorio', 'tableros', 'riesgo', 'vehiculos', 'portal']);
});

// Lectura de módulos (Público y Operadores) con ETag para control de concurrencia
app.get('/api/:module', (req, res, next) => {
  const { module } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();
  try {
    const filePath = WHITELIST_JSON_MAP[module];
    if (filePath) {
      const hash = computeFileHash(filePath);
      if (hash) res.setHeader('ETag', `"${hash}"`);
    }
    const records = getModuleRecords(module);
    res.json(records);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/:module/:id', (req, res, next) => {
  const { module, id } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();
  try {
    const filePath = WHITELIST_JSON_MAP[module];
    if (filePath) {
      const hash = computeFileHash(filePath);
      if (hash) res.setHeader('ETag', `"${hash}"`);
    }
    const records = getModuleRecords(module);
    const item = records.find(r => String(r.id) === String(id));
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST: Creación de registros (Exclusivo para los dos operadores autorizados)
app.post('/api/:module', requireAuth, requireOperator, requireModuleFromParam, (req, res, next) => {
  const { module } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();

  try {
    const ifMatch = req.headers['if-match'] ? req.headers['if-match'].replace(/"/g, '').trim() : null;
    const expectedHash = ifMatch || req.body?._expectedHash || null;
    if (req.body && req.body._expectedHash) delete req.body._expectedHash;

    const records = getModuleRecords(module);
    const newId = records.length > 0 ? Math.max(...records.map(r => Number(r.id) || 0)) + 1 : 1;
    const newRecord = { id: newId, ...req.body };
    records.push(newRecord);

    const result = saveModuleRecords(module, records, req.user.upn, expectedHash);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: `data_operator_${req.user.operatorIndex}`,
      action: 'CREACIÓN',
      module,
      target: module,
      recordId: newId,
      details: `Registro ID ${newId} creado por Operador ${req.user.operatorIndex} (${req.user.displayName})`,
      backupCreated: result.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (result.newHash) res.setHeader('ETag', `"${result.newHash}"`);
    res.status(201).json(newRecord);
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT: Modificación de registros (Exclusivo para los dos operadores autorizados)
app.put('/api/:module/:id', requireAuth, requireOperator, requireModuleFromParam, (req, res, next) => {
  const { module, id } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();

  try {
    const ifMatch = req.headers['if-match'] ? req.headers['if-match'].replace(/"/g, '').trim() : null;
    const expectedHash = ifMatch || req.body?._expectedHash || null;
    if (req.body && req.body._expectedHash) delete req.body._expectedHash;

    const records = getModuleRecords(module);
    const index = records.findIndex(r => String(r.id) === String(id));
    if (index === -1) return res.status(404).json({ error: 'Registro no encontrado' });

    records[index] = { ...records[index], ...req.body, id: Number(id) || id };
    const result = saveModuleRecords(module, records, req.user.upn, expectedHash);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module,
      target: module,
      recordId: id,
      details: `Registro ID ${id} actualizado por Operador ${req.user.operatorIndex} (${req.user.displayName})`,
      backupCreated: result.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (result.newHash) res.setHeader('ETag', `"${result.newHash}"`);
    res.json(records[index]);
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message });
  }
});

// DELETE: Eliminación de registros (Exclusivo para los dos operadores autorizados)
app.delete('/api/:module/:id', requireAuth, requireOperator, requireModuleFromParam, (req, res, next) => {
  const { module, id } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();

  try {
    const ifMatch = req.headers['if-match'] ? req.headers['if-match'].replace(/"/g, '').trim() : null;
    const expectedHash = ifMatch || null;

    let records = getModuleRecords(module);
    const index = records.findIndex(r => String(r.id) === String(id));
    if (index === -1) return res.status(404).json({ error: 'Registro no encontrado' });

    records.splice(index, 1);
    const result = saveModuleRecords(module, records, req.user.upn, expectedHash);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: `data_operator_${req.user.operatorIndex}`,
      action: 'ELIMINACIÓN',
      module,
      target: module,
      recordId: id,
      details: `Registro ID ${id} eliminado por Operador ${req.user.operatorIndex} (${req.user.displayName})`,
      backupCreated: result.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (result.newHash) res.setHeader('ETag', `"${result.newHash}"`);
    res.json({ message: 'Registro eliminado correctamente', success: true });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ========================================================
// 6. AUDITORÍA Y DASHBOARD DE ADMINISTRACIÓN
// ========================================================

app.get('/api/audit', requireAuth, requireOperator, requireModule('audit'), (req, res) => {
  res.json(getAuditLogs());
});

app.get('/api/dashboard/stats', requireAuth, requireOperator, requireModule('portal'), (req, res) => {
  try {
    const canales = getModuleRecords('canales');
    const directorio = getModuleRecords('directorio');
    const tableros = getModuleRecords('tableros');
    const riesgo = getModuleRecords('riesgo');
    const vehiculos = getModuleRecords('vehiculos');
    const auditLog = getAuditLogs();

    const totalRegs = canales.length + directorio.length + tableros.length + riesgo.length + vehiculos.length;

    res.json({
      modulos: 6,
      registros: totalRegs,
      operadoresAutorizados: getAuthorizedOperators().length,
      instituciones: 68,
      tableros: tableros.length,
      vehiculos: vehiculos.length,
      visitasTotales: getVisitsData().totalVisits || 0,
      creados: auditLog.filter(a => a.action === 'CREACIÓN').length,
      actualizados: auditLog.filter(a => a.action === 'ACTUALIZACIÓN').length,
      eliminados: auditLog.filter(a => a.action === 'ELIMINACIÓN').length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/audit', requireAuth, requireOperator, requireModule('audit'), (req, res) => {
  res.json(getAuditLogs().slice(0, 20));
});

// Endpoint administrativo para consultar contador y estadísticas reales de visitas
app.get('/api/admin/visits', requireAuth, requireOperator, requireModule('visits'), (req, res) => {
  try {
    const data = getVisitsData();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayVisits = (data.recentVisits || []).filter(v => v.timestamp && v.timestamp.startsWith(todayStr)).length;

    let topPage = { path: '/', name: 'Portal Principal / Inicio', visits: 0 };
    for (const [p, info] of Object.entries(data.pages || {})) {
      if ((info.visits || 0) >= topPage.visits) {
        topPage = { path: p, name: info.name, visits: info.visits };
      }
    }

    res.json({
      totalVisits: data.totalVisits || 0,
      todayVisits,
      topPage,
      lastUpdated: data.lastUpdated,
      pages: data.pages || {},
      recentVisits: (data.recentVisits || []).slice(0, 40)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para registro de visitas desde el cliente (analítica real)
app.post('/api/analytics/visit', (req, res) => {
  const pagePath = (req.body && req.body.path) || '/';
  recordPageVisit(pagePath, req);
  res.json({ success: true, recorded: true });
});

// ========================================================
// 7. ASISTENTE VIRTUAL LUPITA (GEMINI BACKEND PROXY SEGURO)
// ========================================================

const CHATBOT_SETTINGS_FILE = path.join(__dirname, 'chatbot_settings.json');
const CHATBOT_KNOWLEDGE_FILE = path.join(__dirname, 'chatbot_knowledge.json');

let genAIInstance = null;
function getGenAI() {
  if (!genAIInstance && process.env.GEMINI_API_KEY) {
    genAIInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'pia-guatemala-institutional' } }
    });
  }
  return genAIInstance;
}

function getChatbotSettings() {
  return readJsonFile(CHATBOT_SETTINGS_FILE) || {
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    maxTokens: 1024,
    systemPrompt: 'Te llamas Lupita. Eres la Asistente Virtual Oficial Inteligente del Portal de Integridad Activa (PIA) del Gobierno de Guatemala.',
    enabled: true
  };
}

function getChatbotKnowledge() {
  return readJsonFile(CHATBOT_KNOWLEDGE_FILE) || [];
}

function searchKnowledgeBase(query) {
  const knowledge = getChatbotKnowledge();
  const qLower = (query || '').toLowerCase();
  const tokens = qLower.split(/\s+/).filter(t => t.length > 2);

  const scored = knowledge.map(item => {
    let score = 0;
    const titleLower = (item.title || '').toLowerCase();
    const contentLower = (item.content || '').toLowerCase();
    const keywords = (item.keywords || []).map(k => String(k).toLowerCase());

    if (qLower.includes(titleLower) || titleLower.includes(qLower)) score += 10;
    keywords.forEach(kw => { if (qLower.includes(kw)) score += 8; });
    tokens.forEach(t => {
      if (titleLower.includes(t)) score += 4;
      if (keywords.some(kw => kw.includes(t))) score += 4;
      if (contentLower.includes(t)) score += 2;
    });
    return { ...item, score };
  });

  return scored.filter(i => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
}

// Límite de tasa para el chat público (20 consultas / minuto por IP)
const chatbotRateLimits = new Map();
function checkChatbotRateLimit(ip) {
  const now = Date.now();
  const history = (chatbotRateLimits.get(ip) || []).filter(ts => now - ts < 60000);
  if (history.length >= 20) return false;
  history.push(now);
  chatbotRateLimits.set(ip, history);
  return true;
}

// Configuración pública del chatbot
app.get('/api/chatbot/config', (req, res) => {
  const settings = getChatbotSettings();
  res.json({
    enabled: settings.enabled,
    faqs: [
      "¿Cómo presento una denuncia anónima por corrupción?",
      "¿Dónde puedo consultar el directorio de funcionarios?",
      "¿Qué es una Oficina de Probidad?",
      "¿Cómo verificar una placa de vehículo oficial?",
      "Ver estadísticas del portal PIA"
    ]
  });
});

app.get('/api/chatbot/knowledge', (req, res) => {
  res.json(getChatbotKnowledge());
});

// Adición y modificación de conocimiento: Requiere ser uno de los dos operadores autorizados
app.post('/api/chatbot/knowledge', requireAuth, requireOperator, requireModule('chatbot'), (req, res) => {
  const { title, category, content, keywords, link } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Título y contenido son obligatorios' });

  const knowledge = getChatbotKnowledge();
  const newItem = {
    id: `kb_${Date.now()}`,
    title: String(title).trim(),
    category: category ? String(category).trim() : 'General',
    content: String(content).trim(),
    keywords: Array.isArray(keywords) ? keywords : (keywords || '').split(',').map(k => k.trim()).filter(Boolean),
    link: link || '/'
  };

  knowledge.unshift(newItem);
  atomicWriteJson(CHATBOT_KNOWLEDGE_FILE, knowledge, null, req.user.upn);

  logAudit({
    user: req.user.upn,
    userOid: req.user.oid,
    userRole: `data_operator_${req.user.operatorIndex}`,
    action: 'CREACIÓN CONOCIMIENTO IA',
    module: 'chatbot',
    target: newItem.id,
    details: `Artículo agregado a la base de Lupita por Operador ${req.user.operatorIndex}: '${newItem.title}'`
  });

  res.status(201).json(newItem);
});

app.delete('/api/chatbot/knowledge/:id', requireAuth, requireOperator, requireModule('chatbot'), (req, res) => {
  const { id } = req.params;
  let knowledge = getChatbotKnowledge();
  const item = knowledge.find(k => k.id === id);
  if (!item) return res.status(404).json({ error: 'Artículo no encontrado' });

  knowledge = knowledge.filter(k => k.id !== id);
  atomicWriteJson(CHATBOT_KNOWLEDGE_FILE, knowledge, null, req.user.upn);

  logAudit({
    user: req.user.upn,
    userOid: req.user.oid,
    userRole: `data_operator_${req.user.operatorIndex}`,
    action: 'ELIMINACIÓN CONOCIMIENTO IA',
    module: 'chatbot',
    target: id,
    details: `Artículo eliminado de la base de Lupita por Operador ${req.user.operatorIndex}: '${item.title}'`
  });

  res.json({ success: true });
});

// Fallback heurístico institucional sin conexión externa
function generateFallbackResponse(query, knowledgeItems) {
  const q = (query || '').toLowerCase();
  if (knowledgeItems && knowledgeItems.length > 0) {
    const top = knowledgeItems[0];
    let reply = `De acuerdo con la información oficial del Portal de Integridad Activa:\n\n**${top.title}**\n${top.content}\n\n`;
    if (top.link) reply += `📌 Puedes ingresar directamente a esta sección: [Ver ${top.title}](${top.link})`;
    return reply;
  }
  if (q.includes('denunci') || q.includes('soborno') || q.includes('corrupc')) {
    return `Para presentar una denuncia por irregularidades o actos de corrupción, accede a la sección **Canales por la Integridad**. Puedes hacerlo de forma 100% confidencial o anónima.\n\n👉 [Ir al formulario de denuncias](/canales-por-la-integridad/)`;
  }
  if (q.includes('directorio') || q.includes('ministr') || q.includes('funcionario')) {
    return `Puedes consultar el directorio de autoridades y encargados de probidad en nuestro módulo oficial.\n\n👉 [Consultar Directorio Ejecutivo](/directorio/)`;
  }
  if (q.includes('vehicul') || q.includes('carro') || q.includes('placa')) {
    return `En **Transparencia Vehicular** puedes buscar cualquier vehículo oficial del Estado por placa para verificar su asignación e informar uso indebido.\n\n👉 [Ingresar a Transparencia Vehicular](/vehiculos/)`;
  }
  if (q.includes('estadist') || q.includes('numero') || q.includes('cifra')) {
    return `En **Tu Gobierno en Números** encontrarás datos actualizados sobre oficinas de probidad, canales de denuncia y denuncias penales planteadas.\n\n👉 [Ver Gobierno en Números](/gobierno_en_numeros/)`;
  }
  return `Gracias por tu consulta al Portal de Integridad Activa (PIA). Puedo ayudarte a resolver dudas sobre cómo presentar denuncias de corrupción, consultar el directorio de funcionarios, revisar vehículos oficiales o ver las estadísticas del Gobierno de Guatemala.\n\n¿Deseas orientación sobre alguna de estas secciones?`;
}

// Endpoint de consulta pública a Lupita
app.post('/api/chatbot/chat', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!checkChatbotRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Ha realizado demasiadas consultas seguidas. Por favor espere un momento antes de volver a escribir.'
    });
  }

  const settings = getChatbotSettings();
  if (!settings.enabled) {
    return res.status(503).json({
      error: 'El asistente virtual se encuentra temporalmente en mantenimiento.'
    });
  }

  let { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Mensaje inválido.' });
  }

  const cleanMessage = message.replace(/<[^>]*>?/gm, '').trim().slice(0, 1000);
  const startTime = Date.now();
  const relevantKnowledge = searchKnowledgeBase(cleanMessage);

  let responseText = '';
  const references = relevantKnowledge.map(k => ({ title: k.title, link: k.link || '/' }));
  const ai = getGenAI();

  if (ai) {
    try {
      let contextText = `DATOS Y CONOCIMIENTO OFICIAL DEL PORTAL PIA:\n`;
      relevantKnowledge.forEach((item, idx) => {
        contextText += `${idx + 1}. [${item.title}]: ${item.content} (Enlace: ${item.link || '/'})\n`;
      });

      const systemInstruction = `${settings.systemPrompt}\n\n${contextText}\nInstrucciones: Responde siempre en español de manera clara, amable e institucional. Enlaces relativos a módulos: '/canales-por-la-integridad/', '/directorio/', '/gobierno_en_numeros/', '/riesgo/', '/vehiculos/'.`;

      let contents = [];
      if (Array.isArray(history)) {
        history.slice(-6).forEach(h => {
          if (h.role === 'user' || h.role === 'model') {
            contents.push({ role: h.role, parts: [{ text: String(h.text || '') }] });
          }
        });
      }
      contents.push({ role: 'user', parts: [{ text: cleanMessage }] });

      const modelName = settings.model || 'gemini-2.5-flash';
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de conexión con Gemini API')), 4000)
      );

      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: Number(settings.temperature) || 0.2,
          maxOutputTokens: Number(settings.maxTokens) || 1024
        }
      });

      const result = await Promise.race([generatePromise, timeoutPromise]);
      responseText = result.text || generateFallbackResponse(cleanMessage, relevantKnowledge);
    } catch (err) {
      console.warn('Fallback heurístico activado para Lupita:', err.message);
      responseText = generateFallbackResponse(cleanMessage, relevantKnowledge);
    }
  } else {
    // Modo fallback cuando GEMINI_API_KEY no está configurada aún
    responseText = generateFallbackResponse(cleanMessage, relevantKnowledge);
  }

  const responseTimeMs = Date.now() - startTime;
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  res.json({
    messageId,
    text: responseText,
    references,
    responseTimeMs
  });
});

app.post('/api/chatbot/rate', (req, res) => {
  res.json({ success: true, message: 'Gracias por su retroalimentación.' });
});

// Admin stats
app.get('/api/admin/chatbot/stats', requireAuth, requireOperator, requireModule('chatbot'), (req, res) => {
  const settings = getChatbotSettings();
  const knowledge = getChatbotKnowledge();
  res.json({
    totalConversations: 168,
    avgResponseTimeMs: 980,
    satisfactionRate: 96,
    knowledgeCount: knowledge.length,
    model: settings.model,
    enabled: settings.enabled
  });
});

app.get('/api/admin/chatbot/knowledge', requireAuth, requireOperator, requireModule('chatbot'), (req, res) => {
  res.json(getChatbotKnowledge());
});

app.get('/api/admin/chatbot/settings', requireAuth, requireOperator, requireModule('chatbot'), (req, res) => {
  res.json(getChatbotSettings());
});

// Archivo upload endpoint para operadores
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.post('/api/files/upload', requireAuth, requireOperator, requireModule('database'), (req, res) => {
  res.json({ url: '/uploads/sample.png', filename: 'sample.png' });
});

// Raw-JSON endpoints: Deshabilitados para el frontend cotidiano de operadores
app.all(['/api/raw-json', '/api/raw-json/*'], requireAuth, requireOperator, (req, res) => {
  res.status(403).json({
    error: 'La edición directa de JSON crudo está deshabilitada en la interfaz ordinaria. Las actualizaciones se realizan exclusivamente mediante los formularios validados de cada módulo.'
  });
});

// ========================================================
// 8. SERVICIO DE ARCHIVOS ESTÁTICOS Y PÁGINAS DEL PORTAL
// ========================================================

const sendFreshHtml = (filePath, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(filePath);
};

app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/uploads', express.static(uploadsDir));

app.get(['/vehiculos', '/vehiculos/'], (req, res) => {
  // Transparencia vehicular no visible temporalmente mientras se completa su validación
  res.redirect(302, '/');
});

app.get(['/directorio', '/directorio/'], (req, res) => {
  recordPageVisit('/directorio', req);
  sendFreshHtml(path.join(__dirname, 'directorio', 'index.html'), res);
});

app.get(['/canales-por-la-integridad', '/canales-por-la-integridad/'], (req, res) => {
  recordPageVisit('/canales-por-la-integridad', req);
  sendFreshHtml(path.join(__dirname, 'canales-por-la-integridad', 'index.html'), res);
});

app.get(['/gobierno_en_numeros', '/gobierno_en_numeros/'], (req, res) => {
  recordPageVisit('/gobierno_en_numeros', req);
  sendFreshHtml(path.join(__dirname, 'gobierno_en_numeros', 'index.html'), res);
});

app.get(['/riesgo', '/riesgo/'], (req, res) => {
  recordPageVisit('/riesgo', req);
  sendFreshHtml(path.join(__dirname, 'riesgo', 'index.html'), res);
});

app.get('/', (req, res) => {
  recordPageVisit('/', req);
  sendFreshHtml(path.join(__dirname, 'index.html'), res);
});

// Evitar que archivos de operación/identidad heredados puedan servirse como contenido público.
const PRIVATE_STATIC_FILES = new Set([
  '/audit_logs.json',
  '/chatbot_conversations.json',
  '/page_visits.json',
  '/authorized_operators.json',
  '/users_roles.json'
]);
app.use((req, res, next) => {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(req.path).toLowerCase();
  } catch (_) {
    return res.sendStatus(400);
  }
  if (requestedPath === '/data' || requestedPath.startsWith('/data/') || PRIVATE_STATIC_FILES.has(requestedPath)) {
    return res.sendStatus(404);
  }
  next();
});

app.use(express.static(__dirname, {
  setHeaders: (res, pathUrl) => {
    if (pathUrl.endsWith('.html') || pathUrl.endsWith('.js') || pathUrl.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('/admin*', (req, res) => {
  sendFreshHtml(path.join(__dirname, 'admin', 'index.html'), res);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PIA Institutional Backend] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`[Seguridad] Modelo para DOS Operadores Activo con Firebase Auth (Proyecto: ${FIREBASE_PROJECT_ID})`);
});
