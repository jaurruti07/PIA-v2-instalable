import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { testSqlConnection, isSqlConfigured, getSqlPool } from './db/sqlClient.js';
import { initializeDatabaseSchema, inspectSchemaStatus, isModuleSqlReady } from './db/schemaInit.js';
import { StorageConfigManager, CONFIGURABLE_MODULES, VALID_STORAGE_MODES, VALID_SOURCES, normalizeModuleKey } from './db/storageConfig.js';
import { createHybridStorage } from './db/hybridStorage.js';
import { importJsonToSql, exportSqlToJson } from './db/migrationService.js';
import { createDatabaseManager } from './admin/database-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbManager = createDatabaseManager();

const app = express();
const PORT = Number(process.env.PORT || process.env.DEFAULT_APP_PORT) || 3000;

// Body Parsers con límites institucionales controlados
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ========================================================
// 1. GESTIÓN DE RUTAS Y ALMACENAMIENTO PERSISTENTE
// ========================================================

const DATA_DIR = process.env.PIA_DATA_DIR
  ? path.resolve(process.env.PIA_DATA_DIR)
  : path.join(__dirname, 'data');

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const OPERATORS_FILE = path.join(DATA_DIR, 'authorized_operators.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');
const VISITS_FILE = path.join(DATA_DIR, 'page_visits.json');
const USERS_FILE = path.join(DATA_DIR, 'users_roles.json');
const CANALES_SETTINGS_FILE = path.join(DATA_DIR, 'canales_settings.json');
const MODULES_UI_CONFIG_FILE = path.join(DATA_DIR, 'modules_ui_config.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const UPLOADS_BG_DIR = path.join(UPLOADS_DIR, 'backgrounds');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_BG_DIR)) fs.mkdirSync(UPLOADS_BG_DIR, { recursive: true });

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

// Normalización estricta de ETag (remueve prefijos W/, comillas y espacios)
function cleanEtag(etag) {
  if (!etag) return null;
  return String(etag).replace(/^W\//i, '').replace(/["']/g, '').trim();
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
    const cleanExpected = cleanEtag(expectedHash);
    // Solo verificar si es un hash SHA-256 legítimo (64 caracteres hexadecimales) y no un wildcard
    if (cleanExpected && cleanExpected !== '*' && /^[a-f0-9]{64}$/i.test(cleanExpected)) {
      const currentHash = computeFileHash(filePath);
      if (currentHash && currentHash !== cleanExpected) {
        const err = new Error('Conflicto de concurrencia: El archivo fue modificado por la otra persona operadora. Recargue los datos.');
        err.code = 'CONCURRENCY_CONFLICT';
        throw err;
      }
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
const SEED_OPERATOR_EMAILS = [
  'deteccionydenuncia@cnc.gob.gt',
  'apoyogi@cnc.gob.gt'
];

function getAllowedOperatorEmails() {
  try {
    const users = getUsersRoles();
    const emails = users.filter(u => u.status !== 'inactive').map(u => (u.email || '').toLowerCase().trim()).filter(Boolean);
    SEED_OPERATOR_EMAILS.forEach(em => {
      if (!emails.includes(em)) emails.push(em);
    });
    return emails;
  } catch (e) {
    return SEED_OPERATOR_EMAILS;
  }
}

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

  return operators;
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

const DEFAULT_AUTHORIZED_USERS = [
  {
    id: "usr_cnc_01",
    email: "deteccionydenuncia@cnc.gob.gt",
    displayName: "Dirección de Apoyo en la Gestión de Irregularidades - DAGI",
    role: "admin",
    // Contraseña inicial 12345 encriptada con PBKDF2/SHA-512 y sal criptográfica
    passwordHash: "f929ebd07fd2c63da7eb3004213bd3d2:9d5f0b3dc9c5e3160bcd726cfd0104c4b310ba6369d64914435c4de8c1ad5d6fb3723aa263cdcaf84f57ef6160b3634442819a3e43f657c0eeb088fbd317ef59",
    modules: ["canales", "directorio", "tableros", "riesgo", "portal", "visits", "chatbot", "users", "audit", "database", "guide"],
    status: "active",
    operatorIndex: 1,
    lastPasswordChange: "2026-03-30T10:00:00.000Z",
    updatedAt: "2026-03-30T10:00:00.000Z"
  },
  {
    id: "usr_cnc_02",
    email: "apoyogi@cnc.gob.gt",
    displayName: "Apoyo a la Gestión de Irregularidades (CNC)",
    role: "admin",
    // Contraseña inicial 12345 encriptada con PBKDF2/SHA-512 y sal criptográfica
    passwordHash: "29af97fbdcade6df44a7d6fb84022548:b3e638225077f1c21b848b5bc32b9cf95d4b7f083dd3eb246d389a042475d86dd8002e0bb7fa0e47234b7a8164304e5a784af86ba8575357e361c93a5a33137e",
    modules: ["canales", "directorio", "tableros", "riesgo", "portal", "visits", "chatbot", "users", "audit", "database", "guide"],
    status: "active",
    operatorIndex: 2,
    lastPasswordChange: "2026-03-30T10:00:00.000Z",
    updatedAt: "2026-03-30T10:00:00.000Z"
  }
];

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedCombined) {
  if (!storedCombined || typeof storedCombined !== 'string' || !storedCombined.includes(':')) {
    return false;
  }
  const [salt, expectedHash] = storedCombined.split(':');
  if (!salt || !expectedHash) return false;
  try {
    const actualHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

const SESSION_HMAC_SECRET = process.env.PIA_SESSION_SECRET || crypto.createHash('sha256').update('PIA_CNC_GUATEMALA_SECRET_KEY_2026').digest('hex');

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
  saveUsersRoles(DEFAULT_AUTHORIZED_USERS);
  return DEFAULT_AUTHORIZED_USERS;
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
    if (!getAllowedOperatorEmails().includes(userEmail)) {
      return res.status(403).json({ error: 'Usuario no autorizado en el portal.' });
    }
    const allUsers = getUsersRoles();
    const dbUser = allUsers.find(u => u.email.toLowerCase() === userEmail);

    req.user = {
      uid: localSession.uid || dbUser?.id || 'usr_cnc_01',
      oid: localSession.uid || dbUser?.id || 'usr_cnc_01',
      email: userEmail,
      upn: userEmail,
      displayName: dbUser?.displayName || localSession.displayName,
      operatorIndex: dbUser?.operatorIndex || localSession.operatorIndex || 1,
      role: dbUser?.role || 'admin',
      modules: dbUser?.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide']
    };
    return next();
  }

  // 2. Verificación de token de Firebase Authentication
  try {
    const verified = await verifyFirebaseToken(token);
    const userUid = verified.uid;
    const userEmail = verified.email;

    // Verificar si el correo pertenece a las cuentas autorizadas
    if (!getAllowedOperatorEmails().includes(userEmail)) {
      logAudit({
        user: userEmail,
        userUid,
        userOid: userUid,
        userRole: 'no_autorizado',
        action: 'ACCESO DENEGADO (CORREO NO AUTORIZADO)',
        module: 'auth',
        target: 'admin',
        details: `Intento de acceso denegado: ${userEmail} (UID: ${userUid}) no figura entre las cuentas autorizadas de la CNC.`,
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
    const dbUser = allUsers.find(u => u.email.toLowerCase() === userEmail);

    req.user = {
      uid: userUid,
      oid: userUid,
      email: userEmail,
      upn: userEmail,
      displayName: dbUser?.displayName || matchedOperator.displayName || verified.name,
      operatorIndex: matchedOperator.operatorIndex,
      role: dbUser?.role || 'admin',
      modules: dbUser?.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide']
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token de autorización inválido, expirado o no autorizado.',
      details: err.message
    });
  }
}

// Middleware de verificación de rol de operador o administrador
function requireOperator(req, res, next) {
  if (!req.user || (req.user.role !== 'data_operator' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Operación reservada exclusivamente para los operadores autorizados.' });
  }
  next();
}

// Middleware de verificación de permiso al módulo de almacenamiento y base de datos
function requireDatabaseAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Acceso no autorizado.' });
  }
  const modules = Array.isArray(req.user.modules) ? req.user.modules : [];
  if (req.user.role !== 'admin' && !modules.includes('database')) {
    return res.status(403).json({ error: 'No posee permisos asignados para gestionar almacenamiento y bases de datos.' });
  }
  next();
}

// Middleware genérico de verificación de permiso por módulo
function requireModuleAccess(moduleKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Acceso no autorizado.' });
    }
    const modules = Array.isArray(req.user.modules) ? req.user.modules : [];
    if (req.user.role !== 'admin' && !modules.includes(moduleKey)) {
      return res.status(403).json({ error: `No posee permisos asignados para gestionar el módulo "${moduleKey}".` });
    }
    next();
  };
}

// Cabeceras de seguridad HTTP
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('Access-Control-Expose-Headers', 'ETag');
  if (req.url.endsWith('.json') || req.url.startsWith('/api/')) {
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
    authorizedEmails: getAllowedOperatorEmails()
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

// Inicio de sesión directo con correo y contraseña encriptada (con sal PBKDF2/SHA-512)
app.post('/api/auth/login', (req, res) => {
  const { email, username, password } = req.body || {};
  const userIdentifier = (email || username || '').trim().toLowerCase();
  const rawPassword = password || '';

  if (!userIdentifier || !rawPassword) {
    return res.status(401).json({ error: 'Credenciales incompletas. Debe ingresar correo y contraseña.' });
  }

  // Verificar si es uno de los usuarios autorizados
  if (!getAllowedOperatorEmails().includes(userIdentifier)) {
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

// Estado de configuración institucional de usuarios y políticas de seguridad
app.get('/api/admin/operators-status', requireAuth, requireOperator, (req, res) => {
  const users = getUsersRoles();
  const slots = users.map((u, i) => ({
    slot: i + 1,
    configured: u.status === 'active',
    displayName: u.displayName || `Operador ${i + 1}`,
    email: u.email,
    upn: u.email,
    uidMasked: u.id,
    source: 'users_roles.json (Cifrado PBKDF2/SHA-512)',
    role: u.role || 'admin',
    modules: u.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
    status: u.status || 'active',
    lastPasswordChange: u.lastPasswordChange
  }));

  res.json({
    model: 'multi_operators_role_based',
    configuredCount: users.length,
    slots,
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
app.get('/api/users', requireAuth, requireOperator, (req, res) => {
  const users = getUsersRoles();
  const sanitized = users.map((u, i) => ({
    id: u.id || `usr_cnc_${i + 1}`,
    email: u.email,
    displayName: u.displayName,
    role: u.role || 'admin',
    modules: u.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
    status: u.status || 'active',
    operatorIndex: u.operatorIndex || (i + 1),
    lastPasswordChange: u.lastPasswordChange,
    updatedAt: u.updatedAt
  }));

  res.json({
    model: 'multi_operators_role_based',
    authorizedCount: sanitized.length,
    users: sanitized
  });
});

// Crear nuevo usuario institucional con contraseña encriptada (PBKDF2/SHA-512) y permisos personalizados
app.post('/api/admin/users', requireAuth, requireOperator, (req, res) => {
  const { email, displayName, password, role, modules, permissions, status } = req.body || {};

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Debe ingresar un correo electrónico institucional válido.' });
  }

  const cleanName = (displayName || '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'Debe ingresar el nombre del usuario o cargo oficial.' });
  }

  if (!password || typeof password !== 'string' || password.trim().length < 4) {
    return res.status(400).json({ error: 'La contraseña inicial debe contener al menos 4 caracteres.' });
  }

  const validRoles = ['admin', 'data_operator'];
  const assignedRole = validRoles.includes(role) ? role : 'admin';

  const validModules = ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'];
  const requestedModules = Array.isArray(modules) ? modules : permissions;
  const assignedModules = Array.isArray(requestedModules) && requestedModules.length > 0
    ? requestedModules.filter(m => validModules.includes(m))
    : validModules;

  const users = getUsersRoles();
  if (users.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: `El usuario '${cleanEmail}' ya se encuentra registrado en el sistema.` });
  }

  const nowIso = new Date().toISOString();
  const newUser = {
    id: `usr_cnc_${Date.now()}`,
    email: cleanEmail,
    displayName: cleanName,
    role: assignedRole,
    passwordHash: hashPassword(password.trim()),
    modules: assignedModules,
    status: status || 'active',
    operatorIndex: users.length + 1,
    lastPasswordChange: nowIso,
    updatedAt: nowIso,
    createdAt: nowIso
  };

  users.push(newUser);
  saveUsersRoles(users);

  // Sincronizar authorized_operators.json
  try {
    const ops = getAuthorizedOperators();
    ops.push({
      slot: users.length,
      configured: true,
      displayName: cleanName,
      email: cleanEmail,
      upn: cleanEmail,
      source: 'users_roles.json (Cifrado PBKDF2/SHA-512)',
      role: assignedRole,
      modules: assignedModules,
      status: 'active'
    });
    saveAuthorizedOperators(ops);
  } catch (e) {}

  logAudit({
    user: req.user.email,
    userUid: req.user.uid,
    action: 'CREACIÓN DE NUEVO USUARIO',
    module: 'users',
    target: cleanEmail,
    details: `Nuevo usuario creado con rol '${assignedRole}' y ${assignedModules.length} módulos asignados.`,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
  });

  res.status(201).json({
    success: true,
    message: `Usuario ${cleanEmail} creado y encriptado exitosamente`,
    user: {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
      modules: newUser.modules,
      status: newUser.status,
      operatorIndex: newUser.operatorIndex
    }
  });
});

// Eliminar un usuario creado (protege cuentas base y usuario en sesión)
app.delete('/api/admin/users/:email', requireAuth, requireOperator, (req, res) => {
  const targetEmail = (req.params.email || '').trim().toLowerCase();

  if (SEED_OPERATOR_EMAILS.includes(targetEmail)) {
    return res.status(403).json({ error: 'No está permitido eliminar las cuentas maestras institucionales de la CNC.' });
  }

  if (req.user && req.user.email && req.user.email.toLowerCase() === targetEmail) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario mientras mantienes la sesión activa.' });
  }

  const users = getUsersRoles();
  const idx = users.findIndex(u => (u.email || '').toLowerCase() === targetEmail);
  if (idx === -1) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  const removedUser = users.splice(idx, 1)[0];
  saveUsersRoles(users);

  try {
    const ops = getAuthorizedOperators().filter(o => (o.email || '').toLowerCase() !== targetEmail);
    saveAuthorizedOperators(ops);
  } catch (e) {}

  logAudit({
    user: req.user.email,
    userUid: req.user.uid,
    action: 'ELIMINACIÓN DE USUARIO',
    module: 'users',
    target: targetEmail,
    details: `Usuario institucional ${targetEmail} eliminado del sistema.`,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
  });

  res.json({
    success: true,
    message: `Usuario ${targetEmail} eliminado exitosamente`
  });
});

// Actualizar módulos permitidos para un usuario desde el panel admin
app.put('/api/admin/users/:email/permissions', requireAuth, requireOperator, (req, res) => {
  const targetEmail = (req.params.email || '').trim().toLowerCase();
  const { modules } = req.body || {};

  if (!getAllowedOperatorEmails().includes(targetEmail)) {
    return res.status(404).json({ error: 'Usuario no encontrado entre los operadores autorizados.' });
  }

  if (!Array.isArray(modules)) {
    return res.status(400).json({ error: 'El listado de módulos debe ser un arreglo de cadenas.' });
  }

  const validModules = ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'];
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
app.put('/api/admin/users/:email/password', requireAuth, requireOperator, (req, res) => {
  const targetEmail = (req.params.email || '').trim().toLowerCase();
  const { newPassword } = req.body || {};

  if (!getAllowedOperatorEmails().includes(targetEmail)) {
    return res.status(404).json({ error: 'Usuario no encontrado entre los operadores autorizados.' });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
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
app.put('/api/admin/users/:email/role', requireAuth, requireOperator, (req, res) => {
  const targetEmail = (req.params.email || '').trim().toLowerCase();
  const { role } = req.body || {};

  if (!getAllowedOperatorEmails().includes(targetEmail)) {
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
    return [{ id: 1, ...normalizePortalDocument(data) }];
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
    const normalized = normalizePortalDocument(portalData);
    return atomicWriteJson(filePath, normalized, expectedHash, user);
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

const storageConfig = new StorageConfigManager(DATA_DIR);

const hybridStorage = createHybridStorage({
  storageConfig,
  whitelistJsonMap: WHITELIST_JSON_MAP,
  readJsonFile,
  computeFileHash,
  getJsonModuleRecords: getModuleRecords,
  saveJsonModuleRecords: saveModuleRecords
});

const RESERVED_MODULES = ['auth', 'dashboard', 'raw-json', 'files', 'audit', 'users', 'security-policies', 'chatbot', 'admin', 'ui', 'portal'];

app.get('/api/modules', (req, res) => {
  res.json(['canales', 'directorio', 'tableros', 'riesgo', 'portal']);
});

// ========================================================
// 5.B GESTIÓN DE ALMACENAMIENTO HÍBRIDO (JSON + SQL MYSQL/MARIADB)
// ========================================================

async function buildStorageStatusPayload() {
  const config = storageConfig.getConfig();
  const schemaStatus = await inspectSchemaStatus();
  const sqlCountsByTable = {};
  for (const t of schemaStatus.tables || []) {
    sqlCountsByTable[t.table] = t;
  }

  const modules = CONFIGURABLE_MODULES.map(mod => {
    const activeSource = storageConfig.resolveModuleSource(mod.key);
    const jsonCount = hybridStorage.countJsonRecords(mod.key);
    const sqlReady = isModuleSqlReady(schemaStatus, mod.key);

    let sqlCount = 0;
    if (mod.key === 'riesgo') {
      sqlCount = sqlCountsByTable['pia_riesgo_instituciones']?.rowCount || 0;
    } else if (mod.key === 'vehiculos') {
      sqlCount = sqlCountsByTable['pia_vehiculos']?.rowCount || 0;
    } else {
      const primaryTable = mod.sqlTables[0];
      sqlCount = sqlCountsByTable[primaryTable]?.rowCount || 0;
    }

    return {
      key: mod.key,
      label: mod.label,
      jsonFile: `/${mod.jsonFile}`,
      sqlTables: mod.sqlTables,
      activeSource,
      configuredSource: config.modules[mod.key] || 'json',
      jsonCount,
      sqlCount,
      sqlReady
    };
  });

  return {
    config,
    sqlConfigured: isSqlConfigured(),
    envConfig: dbManager.getSanitizedConfig(),
    schema: schemaStatus,
    modules
  };
}

app.get('/api/admin/storage/status', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const payload = await buildStorageStatusPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error consultando el estado de almacenamiento.' });
  }
});

app.get('/api/admin/storage/connection', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const diagnostics = await dbManager.testConnection({ reloadEnv: false });
    res.json({
      success: true,
      configured: diagnostics.envConfig.configured,
      connected: diagnostics.success,
      connection: diagnostics.connection,
      envConfig: diagnostics.envConfig
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Error consultando configuración de conexión SQL.' });
  }
});

app.post('/api/admin/storage/sql/reload-env', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const diagnostics = await dbManager.testConnection({ reloadEnv: true });
    const fullStatus = await buildStorageStatusPayload();

    logAudit({
      user: req.user.email,
      userOid: req.user.uid,
      userRole: req.user.role,
      action: 'RECARGA CONFIGURACIÓN SQL (.ENV)',
      module: 'database',
      target: diagnostics.envConfig.envFileName || '.env',
      details: `Variables .env recargadas. Configurada: ${diagnostics.envConfig.configured ? 'Sí' : 'No'} | Conexión activa: ${diagnostics.success ? 'Sí' : 'No'}`,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    res.json({
      success: true,
      reloaded: diagnostics.reloaded,
      connected: diagnostics.success,
      connection: diagnostics.connection,
      envConfig: diagnostics.envConfig,
      ...fullStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Error recargando variables .env de conexión SQL.' });
  }
});

app.post('/api/admin/storage/sql/test', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const reloadEnv = Boolean(req.body?.reloadEnv);
    const diagnostics = await dbManager.testConnection({ reloadEnv });
    const schema = await inspectSchemaStatus();
    res.json({
      success: diagnostics.connection.connected,
      reloaded: diagnostics.reloaded,
      connection: diagnostics.connection,
      envConfig: diagnostics.envConfig,
      schema
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Error al probar conexión SQL.' });
  }
});

app.post('/api/admin/storage/sql/init', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const result = await initializeDatabaseSchema();
    if (!result.success) {
      return res.status(400).json(result);
    }

    logAudit({
      user: req.user.email,
      userOid: req.user.uid,
      userRole: req.user.role,
      action: 'INICIALIZACIÓN DE BASE DE DATOS SQL',
      module: 'database',
      target: result.database || 'pia_db',
      details: `Estructura SQL inicializada/verificada (${result.tablesFound}/${result.totalTables} tablas listas).`,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    const fullStatus = await buildStorageStatusPayload();
    res.json({
      success: true,
      message: `Base de datos '${result.database}' verificada e inicializada (${result.tablesFound}/${result.totalTables} tablas listas).`,
      ...fullStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Error inicializando estructura SQL.' });
  }
});

app.put('/api/admin/storage/config', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const { mode, modules } = req.body || {};
    if (!VALID_STORAGE_MODES.includes(mode)) {
      return res.status(400).json({ error: 'Modalidad inválida. Valores permitidos: json, sql, hybrid.' });
    }

    const currentConfig = storageConfig.getConfig();
    const targetModules = {};
    for (const mod of CONFIGURABLE_MODULES) {
      if (mode === 'json') {
        targetModules[mod.key] = 'json';
      } else if (mode === 'sql') {
        targetModules[mod.key] = 'sql';
      } else {
        const candidate = modules && modules[mod.key] ? String(modules[mod.key]).toLowerCase() : (currentConfig.modules[mod.key] || 'json');
        if (!VALID_SOURCES.includes(candidate)) {
          return res.status(400).json({ error: `Fuente inválida para '${mod.key}'. Permitido: json o sql.` });
        }
        targetModules[mod.key] = candidate;
      }
    }

    const sqlModulesRequested = Object.entries(targetModules)
      .filter(([, src]) => src === 'sql')
      .map(([k]) => k);

    if (sqlModulesRequested.length > 0) {
      const schemaStatus = await inspectSchemaStatus();
      if (!schemaStatus.connection?.connected) {
        return res.status(400).json({
          error: schemaStatus.connection?.error || 'No se puede activar almacenamiento SQL sin conexión activa a MySQL/MariaDB.'
        });
      }
      const missingForModules = sqlModulesRequested.filter(m => !isModuleSqlReady(schemaStatus, m));
      if (missingForModules.length > 0) {
        return res.status(400).json({
          error: `Debe inicializar primero las tablas SQL antes de activar SQL en: ${missingForModules.join(', ')}.`
        });
      }
    }

    const saved = storageConfig.saveConfig({ mode, modules: targetModules }, req.user.email);

    logAudit({
      user: req.user.email,
      userOid: req.user.uid,
      userRole: req.user.role,
      action: 'CAMBIO MODALIDAD DE ALMACENAMIENTO',
      module: 'database',
      target: 'storage_config.json',
      details: `Modalidad: ${saved.mode.toUpperCase()} | Módulos SQL: ${sqlModulesRequested.length > 0 ? sqlModulesRequested.join(', ') : 'ninguno'}`,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    const fullStatus = await buildStorageStatusPayload();
    res.json({
      success: true,
      message: `Modalidad de almacenamiento actualizada a '${saved.mode.toUpperCase()}'.`,
      ...fullStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error actualizando la configuración de almacenamiento.' });
  }
});

app.post('/api/admin/storage/migrate/json-to-sql', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const { modules, conflictMode, confirmOverwrite } = req.body || {};
    const report = await importJsonToSql({
      modules,
      conflictMode,
      confirmOverwrite: confirmOverwrite === true,
      executedBy: req.user.email,
      backupsDir: BACKUPS_DIR,
      whitelistJsonMap: WHITELIST_JSON_MAP,
      readJsonFile
    });

    logAudit({
      user: req.user.email,
      userOid: req.user.uid,
      userRole: req.user.role,
      action: 'IMPORTACIÓN JSON A SQL',
      module: 'database',
      target: (report.modules || []).map(m => m.module).join(','),
      details: `Insertados: ${report.summary.inserted}, Actualizados: ${report.summary.updated}, Omitidos: ${report.summary.skipped}, Errores: ${report.summary.errors}`,
      backupCreated: report.backupFolder,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    res.json(report);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/storage/migrate/sql-to-json', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    const { modules, exportMode, confirmOverwrite } = req.body || {};
    const report = await exportSqlToJson({
      modules,
      exportMode,
      confirmOverwrite: confirmOverwrite === true,
      executedBy: req.user.email,
      backupsDir: BACKUPS_DIR,
      whitelistJsonMap: WHITELIST_JSON_MAP,
      atomicWriteJson
    });

    logAudit({
      user: req.user.email,
      userOid: req.user.uid,
      userRole: req.user.role,
      action: 'EXPORTACIÓN SQL A JSON',
      module: 'database',
      target: (report.modules || []).map(m => m.module).join(','),
      details: `Modo: ${report.exportMode}, Registros exportados: ${report.summary.exportedRecords}, Archivos escritos: ${report.summary.writtenFiles}`,
      backupCreated: report.backupFolder,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    res.json(report);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/storage/migrations', requireAuth, requireOperator, requireDatabaseAccess, async (req, res) => {
  try {
    if (!isSqlConfigured()) return res.json([]);
    const pool = getSqlPool();
    const [rows] = await pool.execute(
      'SELECT id, direction, module_name, conflict_mode, inserted_count, updated_count, skipped_count, error_count, backup_ref, executed_by, details, executed_at FROM pia_storage_migrations ORDER BY id DESC LIMIT 30'
    );
    res.json(rows || []);
  } catch (_) {
    res.json([]);
  }
});

app.get('/api/admin/storage/install-assets', requireAuth, requireOperator, requireDatabaseAccess, (req, res) => {
  try {
    const sqlPath = path.join(__dirname, 'sql', '01_schema_mysql.sql');
    const sqlSeedPath = path.join(__dirname, 'sql', '02_seed_initial_config.sql');
    const envExamplePath = path.join(__dirname, '.env.example');
    const guidePath = path.join(__dirname, 'docs', 'GUIA_INSTALACION_WINDOWS_SQL.md');
    const readmePath = path.join(__dirname, 'README.md');
    const deployPs1Path = path.join(__dirname, 'deploy-iis.ps1');
    const deployLinuxPath = path.join(__dirname, 'deploy-linux.sh');
    const webConfigPath = path.join(__dirname, 'web.config');
    const migrateScriptPath = path.join(__dirname, 'admin', 'scripts', 'migrate_json_to_sql.js');
    const initConfigScriptPath = path.join(__dirname, 'admin', 'scripts', 'init_pia_config.js');

    const sqlScript = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : '';
    const sqlSeedScript = fs.existsSync(sqlSeedPath) ? fs.readFileSync(sqlSeedPath, 'utf8') : '';
    const envTemplate = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, 'utf8') : '';
    const guideMarkdown = fs.existsSync(guidePath) ? fs.readFileSync(guidePath, 'utf8') : '';
    const readmeMarkdown = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
    const deployPs1 = fs.existsSync(deployPs1Path) ? fs.readFileSync(deployPs1Path, 'utf8') : '';
    const deployLinuxSh = fs.existsSync(deployLinuxPath) ? fs.readFileSync(deployLinuxPath, 'utf8') : '';
    const webConfig = fs.existsSync(webConfigPath) ? fs.readFileSync(webConfigPath, 'utf8') : '';
    const migrateScript = fs.existsSync(migrateScriptPath) ? fs.readFileSync(migrateScriptPath, 'utf8') : '';
    const initConfigScript = fs.existsSync(initConfigScriptPath) ? fs.readFileSync(initConfigScriptPath, 'utf8') : '';

    res.json({
      success: true,
      tableCount: 18,
      sqlScript,
      sqlSeedScript,
      envTemplate,
      guideMarkdown,
      readmeMarkdown,
      deployPs1,
      deployLinuxSh,
      webConfig,
      migrateScript,
      initConfigScript,
      fileNames: {
        sql: '01_schema_mysql.sql',
        sqlSeed: '02_seed_initial_config.sql',
        env: '.env.example',
        guide: 'GUIA_INSTALACION_WINDOWS_SQL.md',
        readme: 'README.md',
        deployPs1: 'deploy-iis.ps1',
        deployLinuxSh: 'deploy-linux.sh',
        webConfig: 'web.config',
        migrateScript: 'migrate_json_to_sql.js',
        initConfigScript: 'init_pia_config.js'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'No fue posible cargar los artefactos de instalación del servidor.' });
  }
});

// ========================================================
// 5.C CONFIGURACIÓN DE VISIBILIDAD: CANALES POR LA INTEGRIDAD
// ========================================================

function getCanalesSettings() {
  const raw = readJsonFile(CANALES_SETTINGS_FILE);
  if (!raw || typeof raw !== 'object') {
    return {
      showProtocolos: false,
      showDashboardCnc: false,
      updatedAt: null,
      updatedBy: null
    };
  }
  return {
    showProtocolos: Boolean(raw.showProtocolos),
    showDashboardCnc: Boolean(raw.showDashboardCnc),
    updatedAt: raw.updatedAt || null,
    updatedBy: raw.updatedBy || null
  };
}

// Configuración pública de banderas visuales (sin exponer metadatos internos)
app.get('/api/canales/config', (req, res) => {
  const settings = getCanalesSettings();
  res.json({
    showProtocolos: settings.showProtocolos,
    showDashboardCnc: settings.showDashboardCnc
  });
});

// Lectura administrativa de configuración de Canales
app.get('/api/admin/canales/config', requireAuth, requireOperator, requireModuleAccess('canales'), (req, res) => {
  res.json({
    success: true,
    config: getCanalesSettings()
  });
});

// Actualización administrativa de banderas de visibilidad de Canales
app.put('/api/admin/canales/config', requireAuth, requireOperator, requireModuleAccess('canales'), (req, res) => {
  const body = req.body || {};
  const hasShowProt = Object.prototype.hasOwnProperty.call(body, 'showProtocolos');
  const hasShowDash = Object.prototype.hasOwnProperty.call(body, 'showDashboardCnc');

  if (!hasShowProt && !hasShowDash) {
    return res.status(400).json({ error: 'Debe indicar al menos una opción de configuración (showProtocolos o showDashboardCnc).' });
  }
  if (hasShowProt && typeof body.showProtocolos !== 'boolean') {
    return res.status(400).json({ error: 'El parámetro "showProtocolos" debe ser un valor booleano.' });
  }
  if (hasShowDash && typeof body.showDashboardCnc !== 'boolean') {
    return res.status(400).json({ error: 'El parámetro "showDashboardCnc" debe ser un valor booleano.' });
  }

  const prevConfig = getCanalesSettings();
  const nextConfig = {
    showProtocolos: hasShowProt ? body.showProtocolos : prevConfig.showProtocolos,
    showDashboardCnc: hasShowDash ? body.showDashboardCnc : prevConfig.showDashboardCnc,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.upn || req.user.email || 'sistema'
  };

  try {
    atomicWriteJson(CANALES_SETTINGS_FILE, nextConfig, null, nextConfig.updatedBy);
    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: 'canales',
      target: 'canales_settings.json',
      recordId: 'config',
      details: `Configuración de visibilidad pública de Canales actualizada (Protocolos: ${nextConfig.showProtocolos ? 'Visible' : 'Oculto'}, Dashboard CNC: ${nextConfig.showDashboardCnc ? 'Visible' : 'Oculto'})`,
      previousValue: { showProtocolos: prevConfig.showProtocolos, showDashboardCnc: prevConfig.showDashboardCnc },
      newValue: { showProtocolos: nextConfig.showProtocolos, showDashboardCnc: nextConfig.showDashboardCnc },
      backupCreated: true,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });
    res.json({ success: true, config: nextConfig });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar la configuración de visibilidad de Canales.' });
  }
});

// ========================================================
// 5.D GESTIÓN DINÁMICA DE MÉTRICAS DEL PORTAL PRINCIPAL
// ========================================================

const DEFAULT_PORTAL_METRICS = [
  {
    id: 1,
    clave: 'oficinasProbidad',
    valor: 65,
    sufijo: '+',
    titulo: 'Instancias de Asuntos de Probidad',
    descripcion: 'Instituciones especializadas con Oficinas de Asuntos de Probidad',
    icono: 'fas fa-building',
    activo: true,
    orden: 1
  },
  {
    id: 2,
    clave: 'canalesDenuncia',
    valor: 200,
    sufijo: '+',
    titulo: 'Canales de denuncia',
    descripcion: 'Correos, teléfonos, formularios',
    icono: 'fas fa-envelope-open-text',
    activo: true,
    orden: 2
  },
  {
    id: 3,
    clave: 'denunciasPenales',
    valor: 446,
    sufijo: '+',
    titulo: 'Denuncias penales',
    descripcion: 'En proceso y resueltas',
    icono: 'fas fa-gavel',
    activo: true,
    orden: 3
  },
  {
    id: 4,
    clave: 'plataformasActivas',
    valor: 9,
    sufijo: '',
    titulo: 'Plataformas activas',
    descripcion: 'Integradas para la transparencia',
    icono: 'fas fa-layer-group',
    activo: true,
    orden: 4
  }
];

const PORTAL_ICON_REGEX = /^fa(?:s|r|b|l|d|ss|sr)?\s+fa-[a-z0-9-]+$/i;

function normalizePortalIconClass(rawIcon, fallback = 'fas fa-chart-line') {
  const cleaned = String(rawIcon || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return fallback;
  if (PORTAL_ICON_REGEX.test(cleaned)) return cleaned.toLowerCase();
  if (/^fa-[a-z0-9-]+$/i.test(cleaned)) return `fas ${cleaned.toLowerCase()}`;
  return fallback;
}

function isValidPortalIconInput(rawIcon) {
  const cleaned = String(rawIcon || '').trim().replace(/\s+/g, ' ');
  return PORTAL_ICON_REGEX.test(cleaned) || /^fa-[a-z0-9-]+$/i.test(cleaned);
}

function normalizePortalDocument(rawDoc) {
  const src = (rawDoc && typeof rawDoc === 'object' && !Array.isArray(rawDoc)) ? rawDoc : {};
  const legacyValues = {
    oficinasProbidad: Number.isFinite(Number(src.oficinasProbidad)) ? Math.max(0, Math.round(Number(src.oficinasProbidad))) : 65,
    canalesDenuncia: Number.isFinite(Number(src.canalesDenuncia)) ? Math.max(0, Math.round(Number(src.canalesDenuncia))) : 200,
    denunciasPenales: Number.isFinite(Number(src.denunciasPenales)) ? Math.max(0, Math.round(Number(src.denunciasPenales))) : 446,
    plataformasActivas: Number.isFinite(Number(src.plataformasActivas)) ? Math.max(0, Math.round(Number(src.plataformasActivas))) : 9
  };

  let metricas = [];
  if (Array.isArray(src.metricas) && src.metricas.length > 0) {
    metricas = src.metricas.map((item, idx) => {
      const m = (item && typeof item === 'object') ? item : {};
      const numId = Number(m.id);
      const valorNum = Number(m.valor);
      return {
        id: Number.isFinite(numId) && numId > 0 ? Math.round(numId) : (idx + 1),
        clave: String(m.clave || `metric_${idx + 1}`).trim().slice(0, 60),
        valor: Number.isFinite(valorNum) && valorNum >= 0 ? valorNum : 0,
        sufijo: String(m.sufijo !== undefined && m.sufijo !== null ? m.sufijo : '').trim().slice(0, 12),
        titulo: String(m.titulo || `Métrica ${idx + 1}`).trim().slice(0, 120),
        descripcion: String(m.descripcion !== undefined && m.descripcion !== null ? m.descripcion : '').trim().slice(0, 240),
        icono: normalizePortalIconClass(m.icono, 'fas fa-chart-line'),
        activo: m.activo !== false,
        orden: Number.isFinite(Number(m.orden)) ? Number(m.orden) : (idx + 1)
      };
    });
  } else {
    const descMap = (src.descripciones && typeof src.descripciones === 'object') ? src.descripciones : {};
    metricas = DEFAULT_PORTAL_METRICS.map(def => ({
      ...def,
      valor: legacyValues[def.clave] !== undefined ? legacyValues[def.clave] : def.valor,
      descripcion: descMap[def.clave] ? String(descMap[def.clave]).trim().slice(0, 240) : def.descripcion
    }));
  }

  // Deduplicar IDs en caso de inconsistencia previa y ordenar por 'orden'
  const seenIds = new Set();
  let maxId = metricas.reduce((acc, m) => Math.max(acc, Number(m.id) || 0), 0);
  metricas = metricas
    .map(m => {
      let id = m.id;
      if (seenIds.has(id)) {
        maxId += 1;
        id = maxId;
      }
      seenIds.add(id);
      return { ...m, id };
    })
    .sort((a, b) => (a.orden - b.orden) || (a.id - b.id))
    .map((m, idx) => ({ ...m, orden: idx + 1 }));

  // Sincronizar campos heredados para compatibilidad con SQL / validadores
  const syncedLegacy = { ...legacyValues };
  for (const key of Object.keys(syncedLegacy)) {
    const match = metricas.find(m => m.clave === key);
    if (match) {
      syncedLegacy[key] = Number.isFinite(Number(match.valor)) ? Math.max(0, Math.round(Number(match.valor))) : syncedLegacy[key];
    }
  }

  return {
    ...syncedLegacy,
    metricas
  };
}

function validateMetricPayload(body = {}, isPartial = false) {
  const errors = [];
  if (!isPartial || Object.prototype.hasOwnProperty.call(body, 'titulo')) {
    const titulo = String(body.titulo || '').trim();
    if (titulo.length < 2 || titulo.length > 120) {
      errors.push('El título de la métrica es obligatorio (entre 2 y 120 caracteres).');
    }
  }
  if (!isPartial || Object.prototype.hasOwnProperty.call(body, 'valor')) {
    const val = Number(body.valor);
    if (body.valor === '' || body.valor === null || body.valor === undefined || !Number.isFinite(val) || val < 0 || val > 999999999) {
      errors.push('El valor de la métrica debe ser un número mayor o igual a 0.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'descripcion')) {
    const desc = String(body.descripcion || '').trim();
    if (desc.length > 240) {
      errors.push('El texto debajo de la métrica no puede exceder los 240 caracteres.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'sufijo')) {
    const suf = String(body.sufijo || '').trim();
    if (suf.length > 12) {
      errors.push('El sufijo no puede exceder los 12 caracteres.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'icono')) {
    if (!isValidPortalIconInput(body.icono)) {
      errors.push('El ícono debe ser una clase FontAwesome válida (ejemplo: "fas fa-shield-alt").');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'activo') && typeof body.activo !== 'boolean') {
    errors.push('El estado "activo" debe ser booleano.');
  }
  return errors;
}

async function readPortalState() {
  const { source, records, etag } = await hybridStorage.readModule('portal');
  const first = (Array.isArray(records) && records[0]) ? records[0] : {};
  const { id, ...rawPortal } = first;
  return {
    source,
    etag,
    portal: normalizePortalDocument(rawPortal)
  };
}

async function writePortalState(nextPortalDoc, userUpn, expectedHash = null) {
  const normalized = normalizePortalDocument(nextPortalDoc);
  const source = hybridStorage.getModuleSource('portal');
  if (source === 'sql') {
    const result = await hybridStorage.updateRecord('portal', 1, normalized, userUpn, expectedHash);
    return {
      source: 'sql',
      newHash: result?.newHash || null,
      backupCreated: result?.backupCreated || 'Transacción SQL ACID',
      portal: normalized
    };
  }
  const filePath = WHITELIST_JSON_MAP['portal'];
  const writeRes = atomicWriteJson(filePath, normalized, expectedHash, userUpn);
  return {
    source: 'json',
    newHash: writeRes.newHash,
    backupCreated: writeRes.backupCreated,
    portal: normalized
  };
}

// Endpoint público de métricas dinámicas del portal principal
app.get('/api/portal/metricas', async (req, res) => {
  try {
    const { portal, etag } = await readPortalState();
    if (etag) res.setHeader('ETag', `"${etag}"`);
    const activeMetrics = portal.metricas.filter(m => m.activo !== false);
    res.json({
      oficinasProbidad: portal.oficinasProbidad,
      canalesDenuncia: portal.canalesDenuncia,
      denunciasPenales: portal.denunciasPenales,
      plataformasActivas: portal.plataformasActivas,
      metricas: activeMetrics,
      totalActivas: activeMetrics.length,
      carouselActive: activeMetrics.length > 4
    });
  } catch (err) {
    res.status(500).json({ error: 'No fue posible cargar las métricas del portal.' });
  }
});

// Lectura administrativa completa de métricas del portal
app.get('/api/admin/portal/metricas', requireAuth, requireOperator, requireModuleAccess('portal'), async (req, res) => {
  try {
    const { source, etag, portal } = await readPortalState();
    if (etag) res.setHeader('ETag', `"${etag}"`);
    res.setHeader('X-PIA-Storage-Source', source);
    res.json({
      success: true,
      portal,
      metricas: portal.metricas
    });
  } catch (err) {
    res.status(500).json({ error: 'No fue posible obtener las métricas del portal.' });
  }
});

// Crear una nueva métrica del portal principal
app.post('/api/admin/portal/metricas', requireAuth, requireOperator, requireModuleAccess('portal'), async (req, res) => {
  const body = req.body || {};
  const errors = validateMetricPayload(body, false);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const { portal } = await readPortalState();
    const nextId = portal.metricas.reduce((max, m) => Math.max(max, Number(m.id) || 0), 0) + 1;
    const requestedOrder = Number(body.orden);
    const nextOrder = Number.isFinite(requestedOrder) && requestedOrder > 0
      ? requestedOrder
      : (portal.metricas.length + 1);

    const newMetric = {
      id: nextId,
      clave: `custom_${nextId}`,
      valor: Number(body.valor),
      sufijo: String(body.sufijo !== undefined && body.sufijo !== null ? body.sufijo : '').trim().slice(0, 12),
      titulo: String(body.titulo).trim().slice(0, 120),
      descripcion: String(body.descripcion !== undefined && body.descripcion !== null ? body.descripcion : '').trim().slice(0, 240),
      icono: normalizePortalIconClass(body.icono, 'fas fa-chart-line'),
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
      orden: nextOrder
    };

    const nextPortal = {
      ...portal,
      metricas: [...portal.metricas, newMetric]
    };

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = await writePortalState(nextPortal, req.user.upn || req.user.email || 'sistema', ifMatch || null);
    const savedMetric = writeRes.portal.metricas.find(m => m.id === nextId) || newMetric;

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'CREACIÓN',
      module: 'portal',
      target: `data_portal.json (${writeRes.source.toUpperCase()})`,
      recordId: savedMetric.id,
      details: `Nueva métrica creada en el Portal Principal: '${savedMetric.titulo}' (${savedMetric.valor}${savedMetric.sufijo})`,
      previousValue: null,
      newValue: savedMetric,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.status(201).json({
      success: true,
      metric: savedMetric,
      metricas: writeRes.portal.metricas,
      portal: writeRes.portal
    });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'Error al crear la métrica del portal.' });
  }
});

// Reordenar métricas del portal principal
app.put('/api/admin/portal/metricas/reorder', requireAuth, requireOperator, requireModuleAccess('portal'), async (req, res) => {
  const orderedIds = req.body?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'Debe enviar el arreglo "orderedIds" para reordenar las métricas.' });
  }

  try {
    const { portal } = await readPortalState();
    const byId = new Map(portal.metricas.map(m => [String(m.id), m]));
    const reordered = [];
    const used = new Set();

    orderedIds.forEach(rawId => {
      const key = String(rawId);
      if (byId.has(key) && !used.has(key)) {
        used.add(key);
        reordered.push({ ...byId.get(key), orden: reordered.length + 1 });
      }
    });
    portal.metricas.forEach(m => {
      const key = String(m.id);
      if (!used.has(key)) {
        reordered.push({ ...m, orden: reordered.length + 1 });
      }
    });

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = await writePortalState({ ...portal, metricas: reordered }, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: 'portal',
      target: 'data_portal.json',
      recordId: 'reorder',
      details: `Orden de métricas del Portal Principal actualizado (${orderedIds.join(', ')})`,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, metricas: writeRes.portal.metricas, portal: writeRes.portal });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'Error al reordenar las métricas.' });
  }
});

// Actualizar una métrica existente del portal principal (valor, sufijo, título, texto inferior, ícono, estado)
app.put('/api/admin/portal/metricas/:id', requireAuth, requireOperator, requireModuleAccess('portal'), async (req, res) => {
  const metricId = Number(req.params.id);
  if (!Number.isFinite(metricId) || metricId <= 0) {
    return res.status(400).json({ error: 'ID de métrica inválido.' });
  }

  const body = req.body || {};
  const errors = validateMetricPayload(body, true);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const { portal } = await readPortalState();
    const idx = portal.metricas.findIndex(m => Number(m.id) === metricId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Métrica no encontrada.' });
    }

    const prevMetric = { ...portal.metricas[idx] };
    const updatedMetric = {
      ...prevMetric,
      valor: Object.prototype.hasOwnProperty.call(body, 'valor') ? Number(body.valor) : prevMetric.valor,
      sufijo: Object.prototype.hasOwnProperty.call(body, 'sufijo') ? String(body.sufijo || '').trim().slice(0, 12) : prevMetric.sufijo,
      titulo: Object.prototype.hasOwnProperty.call(body, 'titulo') ? String(body.titulo).trim().slice(0, 120) : prevMetric.titulo,
      descripcion: Object.prototype.hasOwnProperty.call(body, 'descripcion') ? String(body.descripcion || '').trim().slice(0, 240) : prevMetric.descripcion,
      icono: Object.prototype.hasOwnProperty.call(body, 'icono') ? normalizePortalIconClass(body.icono, prevMetric.icono) : prevMetric.icono,
      activo: Object.prototype.hasOwnProperty.call(body, 'activo') ? Boolean(body.activo) : prevMetric.activo,
      orden: Object.prototype.hasOwnProperty.call(body, 'orden') && Number.isFinite(Number(body.orden))
        ? Number(body.orden)
        : prevMetric.orden
    };

    const nextMetricas = [...portal.metricas];
    nextMetricas[idx] = updatedMetric;

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = await writePortalState({ ...portal, metricas: nextMetricas }, req.user.upn || req.user.email || 'sistema', ifMatch || null);
    const savedMetric = writeRes.portal.metricas.find(m => Number(m.id) === metricId) || updatedMetric;

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: 'portal',
      target: `data_portal.json (${writeRes.source.toUpperCase()})`,
      recordId: metricId,
      details: `Métrica #${metricId} ('${savedMetric.titulo}') actualizada en el Portal Principal`,
      previousValue: prevMetric,
      newValue: savedMetric,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({
      success: true,
      metric: savedMetric,
      metricas: writeRes.portal.metricas,
      portal: writeRes.portal
    });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'Error al actualizar la métrica del portal.' });
  }
});

// Eliminar una métrica del portal principal
app.delete('/api/admin/portal/metricas/:id', requireAuth, requireOperator, requireModuleAccess('portal'), async (req, res) => {
  const metricId = Number(req.params.id);
  if (!Number.isFinite(metricId) || metricId <= 0) {
    return res.status(400).json({ error: 'ID de métrica inválido.' });
  }

  try {
    const { portal } = await readPortalState();
    const target = portal.metricas.find(m => Number(m.id) === metricId);
    if (!target) {
      return res.status(404).json({ error: 'Métrica no encontrada.' });
    }
    if (portal.metricas.length <= 1) {
      return res.status(400).json({ error: 'Debe permanecer al menos una métrica registrada en el portal.' });
    }

    const remaining = portal.metricas.filter(m => Number(m.id) !== metricId);
    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = await writePortalState({ ...portal, metricas: remaining }, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ELIMINACIÓN',
      module: 'portal',
      target: `data_portal.json (${writeRes.source.toUpperCase()})`,
      recordId: metricId,
      details: `Métrica #${metricId} ('${target.titulo}') eliminada del Portal Principal`,
      previousValue: target,
      newValue: null,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({
      success: true,
      metricas: writeRes.portal.metricas,
      portal: writeRes.portal
    });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'Error al eliminar la métrica.' });
  }
});

// ========================================================
// 5.E GESTIÓN DINÁMICA DE KPIs E IMÁGENES DE FONDO POR MÓDULO
// ========================================================

const VALID_UI_MODULES = ['portal', 'canales', 'directorio', 'tableros', 'riesgo', 'vehiculos'];

const MODULE_KPI_AUTO_CATALOG = {
  portal: [],
  canales: [
    { key: 'totalCanales', label: 'Total de canales habilitados (dinámico)' },
    { key: 'totalInstituciones', label: 'Instituciones filtradas / registradas (dinámico)' },
    { key: 'totalProtocolos', label: 'Instituciones con protocolo de actuación (dinámico)' }
  ],
  directorio: [
    { key: 'totalInstituciones', label: 'Instituciones registradas / filtradas (dinámico)' },
    { key: 'totalCorreo', label: 'Con correo electrónico (dinámico)' },
    { key: 'totalTelefono', label: 'Con teléfono (dinámico)' },
    { key: 'totalSolicitud', label: 'Con solicitud en línea (dinámico)' },
    { key: 'totalOficio', label: 'Con información de oficio (dinámico)' }
  ],
  tableros: [
    { key: 'totalInstituciones', label: 'Instituciones registradas (dinámico)' },
    { key: 'totalTableros', label: 'Tableros disponibles (dinámico)' },
    { key: 'totalMinisterios', label: 'Ministerios (dinámico)' },
    { key: 'totalSecretarias', label: 'Secretarías (dinámico)' },
    { key: 'totalOtras', label: 'Otras dependencias (dinámico)' }
  ],
  riesgo: [
    { key: 'totalInstituciones', label: 'Instituciones evaluadas en el ciclo (dinámico)' },
    { key: 'pctCumplen', label: 'Porcentaje que cumplen (dinámico)' },
    { key: 'pctEnProceso', label: 'Porcentaje en proceso (dinámico)' },
    { key: 'pctBuenasPracticas', label: 'Buenas prácticas GRC % (dinámico)' },
    { key: 'cicloActivo', label: 'Ciclo / Año seleccionado (dinámico)' }
  ],
  vehiculos: [
    { key: 'kpiCumple', label: 'Cumple 7/7 criterios (dinámico)' },
    { key: 'kpiProceso', label: 'En proceso 1-6 criterios (dinámico)' },
    { key: 'kpiNoCumple', label: 'No cumple 0/7 criterios (dinámico)' }
  ]
};

const DEFAULT_MODULES_UI_CONFIG = {
  backgrounds: {
    portal: [
      { id: 1, url: '/img/wallpaper_directorio_acceso_ejecutivo.png', titulo: 'Acceso Ejecutivo', activo: true, orden: 1 },
      { id: 2, url: '/img/gobiernoNumerosWall.jpg', titulo: 'Gobierno en Números', activo: true, orden: 2 },
      { id: 3, url: '/img/wallpaperportal2.png', titulo: 'Portal Integridad 2', activo: true, orden: 3 },
      { id: 4, url: '/img/wallpaperportal3.jpg', titulo: 'Portal Integridad 3', activo: true, orden: 4 },
      { id: 5, url: '/img/numeros.png', titulo: 'Datos y Cifras', activo: true, orden: 5 }
    ],
    canales: [
      { id: 1, url: '/img/canalesfondobanner.png', titulo: 'Canales Banner Principal', activo: true, orden: 1 },
      { id: 2, url: '/img/wallpapercanales1.jpg', titulo: 'Canales Fondo 1', activo: true, orden: 2 },
      { id: 3, url: '/img/wallpapercanales4.jpg', titulo: 'Canales Fondo 4', activo: true, orden: 3 },
      { id: 4, url: '/img/wallpapercanales5.jpg', titulo: 'Canales Fondo 5', activo: true, orden: 4 },
      { id: 5, url: '/img/L2.png', titulo: 'Canales Institucional', activo: true, orden: 5 }
    ],
    directorio: [
      { id: 1, url: '/img/directoriov2.2.png', titulo: 'Directorio Principal', activo: true, orden: 1 },
      { id: 2, url: '/img/wallpaperdirectorio.jpg', titulo: 'Directorio Fondo 2', activo: true, orden: 2 },
      { id: 3, url: '/img/wallpaper_directorio_acceso_ejecutivo.png', titulo: 'Acceso Ejecutivo', activo: true, orden: 3 },
      { id: 4, url: '/img/wallpaperportal3.jpg', titulo: 'Portal 3', activo: true, orden: 4 },
      { id: 5, url: '/img/logodirectorio2.png', titulo: 'Directorio Institucional', activo: true, orden: 5 }
    ],
    tableros: [
      { id: 1, url: '/img/gobiernoNumerosWall2.jpg', titulo: 'Gobierno en Números 2', activo: true, orden: 1 },
      { id: 2, url: '/img/gobiernoNumerosWall.jpg', titulo: 'Gobierno en Números 1', activo: true, orden: 2 },
      { id: 3, url: '/img/gobiernoNumerosWall3.jpg', titulo: 'Gobierno en Números 3', activo: true, orden: 3 },
      { id: 4, url: '/img/numeros.png', titulo: 'Indicadores y Cifras', activo: true, orden: 4 }
    ],
    riesgo: [
      { id: 1, url: '/img/gestion-de-riesgo.png', titulo: 'Gestión de Riesgo Principal', activo: true, orden: 1 },
      { id: 2, url: '/img/riesgo.png', titulo: 'Riesgo en la Mira 1', activo: true, orden: 2 },
      { id: 3, url: '/img/riesgo2.png', titulo: 'Riesgo en la Mira 2', activo: true, orden: 3 },
      { id: 4, url: '/img/riesgo3.jpg', titulo: 'Riesgo en la Mira 3', activo: true, orden: 4 }
    ],
    vehiculos: [
      { id: 1, url: '/img/vehiculosOficiales.png', titulo: 'Vehículos Oficiales', activo: true, orden: 1 },
      { id: 2, url: '/img/vehiculo1.jpg', titulo: 'Vehículos Fondo 1', activo: true, orden: 2 },
      { id: 3, url: '/img/vehiculos2.jpg', titulo: 'Vehículos Fondo 2', activo: true, orden: 3 },
      { id: 4, url: '/img/vehiculos3.jpg', titulo: 'Vehículos Fondo 3', activo: true, orden: 4 },
      { id: 5, url: '/img/vehiculos4.png', titulo: 'Vehículos Fondo 4', activo: true, orden: 5 }
    ]
  },
  sectionImages: {
    portal: {
      porqueExiste: '/img/wallpaperdirectorio.jpg'
    }
  },
  kpis: {
    canales: [
      { id: 1, clave: 'totalCanales', modoValor: 'auto', autoKey: 'totalCanales', valor: '0', sufijo: '', titulo: 'Canales disponibles', descripcion: 'Total de canales habilitados por las instituciones del Organismo Ejecutivo para recepcionar denuncias administrativas.', icono: 'fas fa-phone-alt', activo: true, orden: 1 },
      { id: 2, clave: 'totalInstituciones', modoValor: 'auto', autoKey: 'totalInstituciones', valor: '0', sufijo: '', titulo: 'Instituciones', descripcion: 'Cantidad total de dependencias e instituciones del Organismo Ejecutivo registradas en este directorio.', icono: 'fas fa-building', activo: true, orden: 2 },
      { id: 3, clave: 'totalProtocolos', modoValor: 'auto', autoKey: 'totalProtocolos', valor: '0', sufijo: '', titulo: 'Instituciones con protocolo de actuación', descripcion: 'Instituciones del Organismo Ejecutivo que cuentan con un protocolo interno formalizado para tramitar denuncias administrativas.', icono: 'fas fa-file-contract', activo: true, orden: 3, requiresConfigFlag: 'showProtocolos' },
      { id: 4, clave: 'accesoContinuo', modoValor: 'manual', autoKey: null, valor: '24/7', sufijo: '', titulo: 'Acceso continuo', descripcion: 'Portal disponible en línea las 24 horas del día, los 7 días de la semana, para consultar los medios oficiales de denuncia.', icono: 'fas fa-clock', activo: true, orden: 4 },
      { id: 5, clave: 'segura', modoValor: 'manual', autoKey: null, valor: '100', sufijo: '%', titulo: 'Segura', descripcion: 'Consulta pública sin registro previo y acceso directo a los canales oficiales de cada entidad bajo resguardo confidencial.', icono: 'fas fa-shield-alt', activo: true, orden: 5 },
      { id: 6, clave: 'actualizada', modoValor: 'manual', autoKey: null, valor: '100', sufijo: '%', titulo: 'Actualizada', descripcion: 'Directorio en revisión continua conforme las instituciones reportan cambios en sus puntos y medios de atención.', icono: 'fas fa-sync-alt', activo: true, orden: 6 },
      { id: 7, clave: 'validada', modoValor: 'manual', autoKey: null, valor: 'Validada', sufijo: '', titulo: 'Datos validados por CNC', descripcion: 'Información verificada por la Comisión Nacional contra la Corrupción en coordinación con las Instancias de Asuntos de Probidad.', icono: 'fas fa-user-secret', activo: true, orden: 7 }
    ],
    directorio: [
      { id: 1, clave: 'totalInstituciones', modoValor: 'auto', autoKey: 'totalInstituciones', valor: '0', sufijo: '', titulo: 'Instituciones registradas', descripcion: 'Dependencias del Organismo Ejecutivo incluidas en el directorio', icono: 'fas fa-building', activo: true, orden: 1 },
      { id: 2, clave: 'totalCorreo', modoValor: 'auto', autoKey: 'totalCorreo', valor: '0', sufijo: '', titulo: 'Con correo electrónico', descripcion: 'Unidades con dirección electrónica oficial de contacto', icono: 'fas fa-envelope', activo: true, orden: 2 },
      { id: 3, clave: 'totalTelefono', modoValor: 'auto', autoKey: 'totalTelefono', valor: '0', sufijo: '', titulo: 'Con teléfono', descripcion: 'Instituciones con línea telefónica de atención ciudadana', icono: 'fas fa-phone-alt', activo: true, orden: 3 },
      { id: 4, clave: 'totalSolicitud', modoValor: 'auto', autoKey: 'totalSolicitud', valor: '0', sufijo: '', titulo: 'Con solicitud en línea', descripcion: 'Cuentan con portal o formulario digital de acceso', icono: 'fas fa-globe', activo: true, orden: 4 },
      { id: 5, clave: 'totalOficio', modoValor: 'auto', autoKey: 'totalOficio', valor: '0', sufijo: '', titulo: 'Con información de oficio', descripcion: 'Disponen de enlace directo a su sección de información pública', icono: 'fas fa-file-alt', activo: true, orden: 5 }
    ],
    tableros: [
      { id: 1, clave: 'totalInstituciones', modoValor: 'auto', autoKey: 'totalInstituciones', valor: '0', sufijo: '', titulo: 'Instituciones registradas', descripcion: 'Entidades públicas integradas en la plataforma', icono: 'fas fa-building', activo: true, orden: 1 },
      { id: 2, clave: 'totalTableros', modoValor: 'auto', autoKey: 'totalTableros', valor: '0', sufijo: '', titulo: 'Tableros disponibles', descripcion: 'Tableros interactivos de rendición de cuentas publicados', icono: 'fas fa-table', activo: true, orden: 2 },
      { id: 3, clave: 'totalMinisterios', modoValor: 'auto', autoKey: 'totalMinisterios', valor: '0', sufijo: '', titulo: 'Ministerios', descripcion: 'Ministerios del Organismo Ejecutivo con tablero activo', icono: 'fas fa-university', activo: true, orden: 3 },
      { id: 4, clave: 'totalSecretarias', modoValor: 'auto', autoKey: 'totalSecretarias', valor: '0', sufijo: '', titulo: 'Secretarías', descripcion: 'Secretarías de la Presidencia con publicación activa', icono: 'fas fa-file-signature', activo: true, orden: 4 },
      { id: 5, clave: 'totalOtras', modoValor: 'auto', autoKey: 'totalOtras', valor: '0', sufijo: '', titulo: 'Otras dependencias', descripcion: 'Gobernaciones y dependencias descentralizadas', icono: 'fas fa-sitemap', activo: true, orden: 5 }
    ],
    riesgo: [
      { id: 1, clave: 'totalInstituciones', modoValor: 'auto', autoKey: 'totalInstituciones', valor: '0', sufijo: '', titulo: 'Instituciones', descripcion: 'Instituciones evaluadas en el ciclo de gestión de riesgos', icono: 'fas fa-building', activo: true, orden: 1 },
      { id: 2, clave: 'pctCumplen', modoValor: 'auto', autoKey: 'pctCumplen', valor: '0', sufijo: '%', titulo: 'Cumplen', descripcion: 'Instituciones que cumplen el lineamiento completo', icono: 'fas fa-check-circle', activo: true, orden: 2 },
      { id: 3, clave: 'pctEnProceso', modoValor: 'auto', autoKey: 'pctEnProceso', valor: '0', sufijo: '%', titulo: 'En proceso', descripcion: 'Instituciones en fase de implementación o cumplimiento parcial', icono: 'fas fa-spinner', activo: true, orden: 3 },
      { id: 4, clave: 'pctBuenasPracticas', modoValor: 'auto', autoKey: 'pctBuenasPracticas', valor: '0', sufijo: '%', titulo: 'Buenas prácticas GRC', descripcion: 'Adopción voluntaria de buenas prácticas de gestión de riesgos', icono: 'fas fa-star', activo: true, orden: 4 },
      { id: 5, clave: 'cicloActivo', modoValor: 'auto', autoKey: 'cicloActivo', valor: '2025', sufijo: '', titulo: 'Ciclo activo', descripcion: 'Año de evaluación seleccionado en la consulta', icono: 'fas fa-clock', activo: true, orden: 5 }
    ],
    vehiculos: [
      { id: 1, clave: 'kpiCumple', modoValor: 'auto', autoKey: 'kpiCumple', valor: '0', sufijo: '', titulo: 'Cumple (7/7)', descripcion: 'Instituciones que cumplen los 7 criterios evaluados', icono: 'fas fa-check-circle', activo: true, orden: 1 },
      { id: 2, clave: 'kpiProceso', modoValor: 'auto', autoKey: 'kpiProceso', valor: '0', sufijo: '', titulo: 'En proceso (1-6)', descripcion: 'Instituciones con cumplimiento parcial de criterios', icono: 'fas fa-clock', activo: true, orden: 2 },
      { id: 3, clave: 'kpiNoCumple', modoValor: 'auto', autoKey: 'kpiNoCumple', valor: '0', sufijo: '', titulo: 'No cumple (0/7)', descripcion: 'Instituciones sin criterios cumplidos registrados', icono: 'fas fa-times-circle', activo: true, orden: 3 }
    ]
  }
};

function normalizeUiModuleKey(raw) {
  const normalized = normalizeModuleKey(raw);
  if (VALID_UI_MODULES.includes(normalized)) return normalized;
  return null;
}

function isValidBackgroundImageUrl(rawUrl) {
  const val = String(rawUrl || '').trim();
  if (!val || val.length > 500 || /[\s"'`<>()\\;]/.test(val) || val.includes('..')) {
    return false;
  }
  if (/^\/(?:img|uploads\/backgrounds)\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)$/i.test(val)) {
    return true;
  }
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function saveValidatedBase64Image(rawFilename, dataUrl) {
  const rawStr = String(dataUrl || '').trim();
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(rawStr);
  if (!match) {
    throw new Error('Formato de imagen no admitido. Solo se permiten archivos PNG, JPG/JPEG o WEBP.');
  }

  const declaredSubtype = match[1].toLowerCase();
  const base64Body = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64Body, 'base64');

  if (!buffer || buffer.length === 0) {
    throw new Error('El archivo de imagen está vacío o corrupto.');
  }
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('La imagen excede el tamaño máximo permitido de 5 MB.');
  }

  // Validación estricta de magic bytes reales (impide falsificación de extensión o SVG/HTML)
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  let finalExt = null;
  if (isPng && declaredSubtype === 'png') finalExt = 'png';
  else if (isJpeg && (declaredSubtype === 'jpeg' || declaredSubtype === 'jpg')) finalExt = 'jpg';
  else if (isWebp && declaredSubtype === 'webp') finalExt = 'webp';

  if (!finalExt) {
    throw new Error('El contenido binario de la imagen no coincide con un archivo PNG, JPEG o WEBP válido.');
  }

  const rawStem = path.basename(String(rawFilename || 'fondo'), path.extname(String(rawFilename || '')));
  const cleanStem = rawStem.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'fondo';
  const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const safeFilename = `${cleanStem}_${uniqueSuffix}.${finalExt}`;

  const targetPath = path.resolve(UPLOADS_BG_DIR, safeFilename);
  if (!targetPath.startsWith(UPLOADS_BG_DIR + path.sep)) {
    throw new Error('Ruta de destino inválida fuera del directorio de fondos.');
  }

  fs.writeFileSync(targetPath, buffer);
  return {
    url: `/uploads/backgrounds/${safeFilename}`,
    filename: safeFilename,
    sizeBytes: buffer.length
  };
}

function normalizeUiKpiList(moduleKey, rawList) {
  const defaults = DEFAULT_MODULES_UI_CONFIG.kpis[moduleKey] || [];
  const source = (Array.isArray(rawList) && rawList.length > 0) ? rawList : defaults;
  const allowedAuto = new Set((MODULE_KPI_AUTO_CATALOG[moduleKey] || []).map(a => a.key));
  const seenIds = new Set();
  let maxId = source.reduce((acc, item) => Math.max(acc, Number(item?.id) || 0), 0);

  return source
    .map((item, idx) => {
      const m = (item && typeof item === 'object') ? item : {};
      let id = Number.isFinite(Number(m.id)) && Number(m.id) > 0 ? Math.round(Number(m.id)) : (idx + 1);
      if (seenIds.has(id)) {
        maxId += 1;
        id = maxId;
      }
      seenIds.add(id);

      const requestedAutoKey = m.autoKey && allowedAuto.has(String(m.autoKey)) ? String(m.autoKey) : null;
      const modoValor = (m.modoValor === 'auto' && requestedAutoKey) ? 'auto' : 'manual';
      const valStr = m.valor !== undefined && m.valor !== null ? String(m.valor).trim().slice(0, 40) : '0';

      const normalized = {
        id,
        clave: String(m.clave || `kpi_${id}`).trim().slice(0, 60),
        modoValor,
        autoKey: modoValor === 'auto' ? requestedAutoKey : null,
        valor: valStr === '' ? '0' : valStr,
        sufijo: String(m.sufijo !== undefined && m.sufijo !== null ? m.sufijo : '').trim().slice(0, 12),
        titulo: String(m.titulo || `Indicador ${idx + 1}`).trim().slice(0, 120),
        descripcion: String(m.descripcion !== undefined && m.descripcion !== null ? m.descripcion : '').trim().slice(0, 240),
        icono: normalizePortalIconClass(m.icono, 'fas fa-chart-line'),
        activo: m.activo !== false,
        orden: Number.isFinite(Number(m.orden)) ? Number(m.orden) : (idx + 1)
      };
      if (m.requiresConfigFlag) {
        normalized.requiresConfigFlag = String(m.requiresConfigFlag).slice(0, 40);
      }
      return normalized;
    })
    .sort((a, b) => (a.orden - b.orden) || (a.id - b.id))
    .map((m, idx) => ({ ...m, orden: idx + 1 }));
}

function normalizeBackgroundList(moduleKey, rawList) {
  const defaults = DEFAULT_MODULES_UI_CONFIG.backgrounds[moduleKey] || [];
  const source = (Array.isArray(rawList) && rawList.length > 0) ? rawList : defaults;
  const seenIds = new Set();
  let maxId = source.reduce((acc, item) => Math.max(acc, Number(item?.id) || 0), 0);

  return source
    .map((item, idx) => {
      const b = (item && typeof item === 'object') ? item : {};
      let id = Number.isFinite(Number(b.id)) && Number(b.id) > 0 ? Math.round(Number(b.id)) : (idx + 1);
      if (seenIds.has(id)) {
        maxId += 1;
        id = maxId;
      }
      seenIds.add(id);

      const url = isValidBackgroundImageUrl(b.url) ? String(b.url).trim() : (defaults[0]?.url || '/img/wallpaperportal2.png');
      return {
        id,
        url,
        titulo: String(b.titulo || `Fondo ${idx + 1}`).trim().slice(0, 100),
        activo: b.activo !== false,
        orden: Number.isFinite(Number(b.orden)) ? Number(b.orden) : (idx + 1)
      };
    })
    .sort((a, b) => (a.orden - b.orden) || (a.id - b.id))
    .map((b, idx) => ({ ...b, orden: idx + 1 }));
}

function normalizeModulesUiConfig(rawDoc) {
  const src = (rawDoc && typeof rawDoc === 'object' && !Array.isArray(rawDoc)) ? rawDoc : {};
  const backgrounds = {};
  const kpis = {};

  for (const mod of VALID_UI_MODULES) {
    backgrounds[mod] = normalizeBackgroundList(mod, src.backgrounds?.[mod]);
    if (mod !== 'portal') {
      kpis[mod] = normalizeUiKpiList(mod, src.kpis?.[mod]);
    }
  }

  const rawPorqueExiste = src.sectionImages?.portal?.porqueExiste;
  const porqueExiste = isValidBackgroundImageUrl(rawPorqueExiste)
    ? String(rawPorqueExiste).trim()
    : DEFAULT_MODULES_UI_CONFIG.sectionImages.portal.porqueExiste;

  return {
    backgrounds,
    sectionImages: {
      portal: {
        porqueExiste
      }
    },
    kpis,
    updatedAt: src.updatedAt || null,
    updatedBy: src.updatedBy || null
  };
}

function readModulesUiConfig() {
  const raw = readJsonFile(MODULES_UI_CONFIG_FILE);
  const config = normalizeModulesUiConfig(raw);
  const etag = computeFileHash(MODULES_UI_CONFIG_FILE);
  return { config, etag };
}

function writeModulesUiConfig(nextConfig, userUpn, expectedHash = null) {
  const normalized = normalizeModulesUiConfig({
    ...nextConfig,
    updatedAt: new Date().toISOString(),
    updatedBy: userUpn || 'sistema'
  });
  const writeRes = atomicWriteJson(MODULES_UI_CONFIG_FILE, normalized, expectedHash, userUpn);
  return {
    config: normalized,
    newHash: writeRes.newHash,
    backupCreated: writeRes.backupCreated
  };
}

function validateModuleKpiPayload(moduleKey, body = {}, isPartial = false) {
  const errors = [];
  if (!isPartial || Object.prototype.hasOwnProperty.call(body, 'titulo')) {
    const titulo = String(body.titulo || '').trim();
    if (titulo.length < 2 || titulo.length > 120) {
      errors.push('El título del KPI es obligatorio (entre 2 y 120 caracteres).');
    }
  }

  const allowedAuto = new Set((MODULE_KPI_AUTO_CATALOG[moduleKey] || []).map(a => a.key));
  const modoValor = Object.prototype.hasOwnProperty.call(body, 'modoValor') ? body.modoValor : null;
  if (modoValor !== null && modoValor !== 'auto' && modoValor !== 'manual') {
    errors.push('El modo de valor debe ser "auto" o "manual".');
  }
  if (modoValor === 'auto') {
    const autoKey = String(body.autoKey || '').trim();
    if (!allowedAuto.has(autoKey)) {
      errors.push('La fuente dinámica (autoKey) seleccionada no pertenece a este módulo.');
    }
  } else if (!isPartial || Object.prototype.hasOwnProperty.call(body, 'valor')) {
    const valStr = String(body.valor !== undefined && body.valor !== null ? body.valor : '').trim();
    if (!valStr || valStr.length > 40) {
      errors.push('El valor del KPI es obligatorio (máximo 40 caracteres).');
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'descripcion')) {
    const desc = String(body.descripcion || '').trim();
    if (desc.length > 240) {
      errors.push('El texto debajo del KPI no puede exceder los 240 caracteres.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'sufijo')) {
    const suf = String(body.sufijo || '').trim();
    if (suf.length > 12) {
      errors.push('El sufijo no puede exceder los 12 caracteres.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'icono') && !isValidPortalIconInput(body.icono)) {
    errors.push('El ícono debe ser una clase FontAwesome válida (ejemplo: "fas fa-chart-line").');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'activo') && typeof body.activo !== 'boolean') {
    errors.push('El estado "activo" debe ser booleano.');
  }
  return errors;
}

function validateBackgroundSlidePayload(body = {}, isPartial = false) {
  const errors = [];
  if (!isPartial || Object.prototype.hasOwnProperty.call(body, 'url')) {
    if (!isValidBackgroundImageUrl(body.url)) {
      errors.push('La ruta o URL de la imagen de fondo no es válida. Debe ser una imagen institucional (/img/...), un archivo cargado (/uploads/backgrounds/...) o una URL https:// válida.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'titulo')) {
    const titulo = String(body.titulo || '').trim();
    if (titulo.length > 100) {
      errors.push('El título descriptivo del fondo no puede exceder los 100 caracteres.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'activo') && typeof body.activo !== 'boolean') {
    errors.push('El estado "activo" debe ser booleano.');
  }
  return errors;
}

function checkUiModuleAccess(req, res, next) {
  const modKey = normalizeUiModuleKey(req.params.module);
  if (!modKey) {
    return res.status(400).json({ error: 'Módulo de interfaz no reconocido.' });
  }
  req.uiModuleKey = modKey;
  const modules = Array.isArray(req.user?.modules) ? req.user.modules : [];
  if (req.user?.role !== 'admin' && !modules.includes(modKey)) {
    return res.status(403).json({ error: `No posee permisos asignados para configurar el módulo "${modKey}".` });
  }
  next();
}

// Endpoint público unificado por módulo (KPIs activos y Fondos activos)
app.get('/api/ui/:module', async (req, res) => {
  const modKey = normalizeUiModuleKey(req.params.module);
  if (!modKey) {
    return res.status(404).json({ error: 'Módulo no encontrado.' });
  }
  try {
    const { config, etag } = readModulesUiConfig();
    if (etag) res.setHeader('ETag', `"${etag}"`);

    let activeKpis = [];
    if (modKey === 'portal') {
      const { portal } = await readPortalState();
      activeKpis = portal.metricas.filter(m => m.activo !== false);
    } else {
      const canalesCfg = modKey === 'canales' ? getCanalesSettings() : null;
      activeKpis = (config.kpis[modKey] || []).filter(k => {
        if (k.activo === false) return false;
        if (modKey === 'canales' && k.requiresConfigFlag === 'showProtocolos' && !canalesCfg.showProtocolos) {
          return false;
        }
        return true;
      });
    }

    const activeBackgrounds = (config.backgrounds[modKey] || []).filter(b => b.activo !== false);
    res.json({
      module: modKey,
      kpis: activeKpis,
      totalKpisActivas: activeKpis.length,
      carouselActive: activeKpis.length > 4,
      backgrounds: activeBackgrounds,
      totalFondosActivos: activeBackgrounds.length,
      sectionImages: config.sectionImages?.[modKey] || {}
    });
  } catch (err) {
    res.status(500).json({ error: 'No fue posible obtener la configuración visual del módulo.' });
  }
});

// Galería institucional (/img) y fondos subidos (/uploads/backgrounds) para el administrador
app.get('/api/admin/ui/backgrounds/gallery', requireAuth, requireOperator, (req, res) => {
  try {
    const imgDir = path.join(__dirname, 'img');
    const items = [];
    const imageExtRe = /\.(png|jpe?g|webp)$/i;

    if (fs.existsSync(UPLOADS_BG_DIR)) {
      for (const fname of fs.readdirSync(UPLOADS_BG_DIR)) {
        if (!imageExtRe.test(fname)) continue;
        const full = path.join(UPLOADS_BG_DIR, fname);
        const stat = fs.statSync(full);
        if (stat.isFile()) {
          items.push({
            url: `/uploads/backgrounds/${fname}`,
            name: fname,
            source: 'upload',
            sizeBytes: stat.size,
            mtimeMs: stat.mtimeMs
          });
        }
      }
    }

    if (fs.existsSync(imgDir)) {
      for (const fname of fs.readdirSync(imgDir)) {
        if (!imageExtRe.test(fname)) continue;
        const full = path.join(imgDir, fname);
        const stat = fs.statSync(full);
        if (stat.isFile()) {
          items.push({
            url: `/img/${fname}`,
            name: fname,
            source: 'institutional',
            sizeBytes: stat.size,
            mtimeMs: stat.mtimeMs
          });
        }
      }
    }

    items.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'upload' ? -1 : 1;
      return b.mtimeMs - a.mtimeMs;
    });

    res.json({ success: true, images: items });
  } catch (err) {
    res.status(500).json({ error: 'No fue posible listar la galería de imágenes.' });
  }
});

// Subida segura de imagen de fondo desde el equipo del operador/admin
app.post('/api/admin/ui/backgrounds/upload', requireAuth, requireOperator, (req, res) => {
  const { filename, dataUrl, module: targetMod } = req.body || {};
  if (targetMod) {
    const norm = normalizeUiModuleKey(targetMod);
    if (!norm) return res.status(400).json({ error: 'Módulo destino inválido.' });
    const modules = Array.isArray(req.user.modules) ? req.user.modules : [];
    if (req.user.role !== 'admin' && !modules.includes(norm)) {
      return res.status(403).json({ error: `No posee permisos sobre el módulo "${norm}".` });
    }
  }

  try {
    const saved = saveValidatedBase64Image(filename, dataUrl);
    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'CARGA DE IMAGEN',
      module: targetMod ? normalizeUiModuleKey(targetMod) : 'portal',
      target: saved.filename,
      details: `Imagen de fondo cargada (${saved.url}, ${Math.round(saved.sizeBytes / 1024)} KB)`,
      backupCreated: null,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });
    res.status(201).json({ success: true, ...saved });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo procesar la imagen cargada.' });
  }
});

// Eliminación controlada de imagen cargada en /uploads/backgrounds
app.delete('/api/admin/ui/backgrounds/upload/:filename', requireAuth, requireOperator, (req, res) => {
  const rawName = String(req.params.filename || '').trim();
  if (!/^[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)$/i.test(rawName) || rawName.includes('..')) {
    return res.status(400).json({ error: 'Nombre de archivo inválido.' });
  }

  const resolvedPath = path.resolve(UPLOADS_BG_DIR, rawName);
  if (!resolvedPath.startsWith(UPLOADS_BG_DIR + path.sep)) {
    return res.status(403).json({ error: 'Acceso denegado fuera del directorio de fondos.' });
  }
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'Imagen cargada no encontrada.' });
  }

  try {
    fs.unlinkSync(resolvedPath);
    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ELIMINACIÓN',
      module: 'portal',
      target: rawName,
      details: `Archivo de imagen cargada '/uploads/backgrounds/${rawName}' eliminado`,
      backupCreated: null,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el archivo de imagen.' });
  }
});

// Lectura administrativa completa de UI (KPIs y Fondos) por módulo
app.get('/api/admin/ui/:module', requireAuth, requireOperator, checkUiModuleAccess, async (req, res) => {
  const modKey = req.uiModuleKey;
  try {
    const { config, etag } = readModulesUiConfig();
    if (etag) res.setHeader('ETag', `"${etag}"`);
    let kpis = [];
    if (modKey === 'portal') {
      const { portal } = await readPortalState();
      kpis = portal.metricas;
    } else {
      kpis = config.kpis[modKey] || [];
    }

    res.json({
      success: true,
      module: modKey,
      kpis,
      backgrounds: config.backgrounds[modKey] || [],
      sectionImages: config.sectionImages?.[modKey] || {},
      autoKeysCatalog: MODULE_KPI_AUTO_CATALOG[modKey] || [],
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo configuración de KPIs y fondos.' });
  }
});

// Crear KPI en módulo
app.post('/api/admin/ui/:module/kpis', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  if (modKey === 'portal') {
    return res.status(400).json({ error: 'Para el Portal Principal utilice /api/admin/portal/metricas.' });
  }
  const body = req.body || {};
  const errors = validateModuleKpiPayload(modKey, body, false);
  if (errors.length > 0) return res.status(400).json({ error: errors.join(' ') });

  try {
    const { config } = readModulesUiConfig();
    const list = config.kpis[modKey] || [];
    const nextId = list.reduce((max, k) => Math.max(max, Number(k.id) || 0), 0) + 1;
    const modoValor = body.modoValor === 'auto' ? 'auto' : 'manual';
    const newKpi = {
      id: nextId,
      clave: `custom_${nextId}`,
      modoValor,
      autoKey: modoValor === 'auto' ? String(body.autoKey).trim() : null,
      valor: modoValor === 'auto' ? '0' : String(body.valor).trim().slice(0, 40),
      sufijo: String(body.sufijo !== undefined && body.sufijo !== null ? body.sufijo : '').trim().slice(0, 12),
      titulo: String(body.titulo).trim().slice(0, 120),
      descripcion: String(body.descripcion !== undefined && body.descripcion !== null ? body.descripcion : '').trim().slice(0, 240),
      icono: normalizePortalIconClass(body.icono, 'fas fa-chart-line'),
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
      orden: Number.isFinite(Number(body.orden)) && Number(body.orden) > 0 ? Number(body.orden) : (list.length + 1)
    };

    const nextConfig = {
      ...config,
      kpis: {
        ...config.kpis,
        [modKey]: [...list, newKpi]
      }
    };

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig(nextConfig, req.user.upn || req.user.email || 'sistema', ifMatch || null);
    const savedKpi = writeRes.config.kpis[modKey].find(k => k.id === nextId) || newKpi;

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'CREACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: savedKpi.id,
      details: `Nuevo KPI creado en módulo '${modKey}': '${savedKpi.titulo}'`,
      previousValue: null,
      newValue: savedKpi,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.status(201).json({ success: true, kpi: savedKpi, kpis: writeRes.config.kpis[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo crear el KPI.' });
  }
});

// Reordenar KPIs de un módulo
app.put('/api/admin/ui/:module/kpis/reorder', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  if (modKey === 'portal') {
    return res.status(400).json({ error: 'Para el Portal Principal utilice /api/admin/portal/metricas/reorder.' });
  }
  const orderedIds = req.body?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'Debe enviar el arreglo "orderedIds".' });
  }

  try {
    const { config } = readModulesUiConfig();
    const list = config.kpis[modKey] || [];
    const byId = new Map(list.map(k => [String(k.id), k]));
    const reordered = [];
    const used = new Set();

    orderedIds.forEach(rawId => {
      const key = String(rawId);
      if (byId.has(key) && !used.has(key)) {
        used.add(key);
        reordered.push({ ...byId.get(key), orden: reordered.length + 1 });
      }
    });
    list.forEach(k => {
      const key = String(k.id);
      if (!used.has(key)) reordered.push({ ...k, orden: reordered.length + 1 });
    });

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      kpis: { ...config.kpis, [modKey]: reordered }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: 'kpis_reorder',
      details: `Orden de KPIs del módulo '${modKey}' actualizado`,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, kpis: writeRes.config.kpis[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo reordenar los KPIs.' });
  }
});

// Editar KPI de un módulo
app.put('/api/admin/ui/:module/kpis/:id', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  if (modKey === 'portal') {
    return res.status(400).json({ error: 'Para el Portal Principal utilice /api/admin/portal/metricas/:id.' });
  }
  const kpiId = Number(req.params.id);
  if (!Number.isFinite(kpiId) || kpiId <= 0) {
    return res.status(400).json({ error: 'ID de KPI inválido.' });
  }

  const body = req.body || {};
  const errors = validateModuleKpiPayload(modKey, body, true);
  if (errors.length > 0) return res.status(400).json({ error: errors.join(' ') });

  try {
    const { config } = readModulesUiConfig();
    const list = config.kpis[modKey] || [];
    const idx = list.findIndex(k => Number(k.id) === kpiId);
    if (idx === -1) return res.status(404).json({ error: 'KPI no encontrado.' });

    const prev = { ...list[idx] };
    const nextModo = Object.prototype.hasOwnProperty.call(body, 'modoValor') ? body.modoValor : prev.modoValor;
    const nextAutoKey = nextModo === 'auto'
      ? (Object.prototype.hasOwnProperty.call(body, 'autoKey') ? String(body.autoKey).trim() : prev.autoKey)
      : null;

    const updated = {
      ...prev,
      modoValor: nextModo,
      autoKey: nextAutoKey,
      valor: Object.prototype.hasOwnProperty.call(body, 'valor') ? String(body.valor).trim().slice(0, 40) : prev.valor,
      sufijo: Object.prototype.hasOwnProperty.call(body, 'sufijo') ? String(body.sufijo || '').trim().slice(0, 12) : prev.sufijo,
      titulo: Object.prototype.hasOwnProperty.call(body, 'titulo') ? String(body.titulo).trim().slice(0, 120) : prev.titulo,
      descripcion: Object.prototype.hasOwnProperty.call(body, 'descripcion') ? String(body.descripcion || '').trim().slice(0, 240) : prev.descripcion,
      icono: Object.prototype.hasOwnProperty.call(body, 'icono') ? normalizePortalIconClass(body.icono, prev.icono) : prev.icono,
      activo: Object.prototype.hasOwnProperty.call(body, 'activo') ? Boolean(body.activo) : prev.activo,
      orden: Object.prototype.hasOwnProperty.call(body, 'orden') && Number.isFinite(Number(body.orden)) ? Number(body.orden) : prev.orden
    };

    const nextList = [...list];
    nextList[idx] = updated;

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      kpis: { ...config.kpis, [modKey]: nextList }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);
    const savedKpi = writeRes.config.kpis[modKey].find(k => Number(k.id) === kpiId) || updated;

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: kpiId,
      details: `KPI #${kpiId} ('${savedKpi.titulo}') actualizado en módulo '${modKey}'`,
      previousValue: prev,
      newValue: savedKpi,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, kpi: savedKpi, kpis: writeRes.config.kpis[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo actualizar el KPI.' });
  }
});

// Eliminar KPI de un módulo
app.delete('/api/admin/ui/:module/kpis/:id', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  if (modKey === 'portal') {
    return res.status(400).json({ error: 'Para el Portal Principal utilice /api/admin/portal/metricas/:id.' });
  }
  const kpiId = Number(req.params.id);
  if (!Number.isFinite(kpiId) || kpiId <= 0) {
    return res.status(400).json({ error: 'ID de KPI inválido.' });
  }

  try {
    const { config } = readModulesUiConfig();
    const list = config.kpis[modKey] || [];
    const target = list.find(k => Number(k.id) === kpiId);
    if (!target) return res.status(404).json({ error: 'KPI no encontrado.' });
    if (list.length <= 1) {
      return res.status(400).json({ error: 'Debe permanecer al menos un KPI registrado en el módulo.' });
    }

    const remaining = list.filter(k => Number(k.id) !== kpiId);
    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      kpis: { ...config.kpis, [modKey]: remaining }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ELIMINACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: kpiId,
      details: `KPI #${kpiId} ('${target.titulo}') eliminado del módulo '${modKey}'`,
      previousValue: target,
      newValue: null,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, kpis: writeRes.config.kpis[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo eliminar el KPI.' });
  }
});

// Agregar imagen de fondo al slider de un módulo o del portal principal
app.post('/api/admin/ui/:module/backgrounds', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  const body = req.body || {};
  const errors = validateBackgroundSlidePayload(body, false);
  if (errors.length > 0) return res.status(400).json({ error: errors.join(' ') });

  try {
    const { config } = readModulesUiConfig();
    const list = config.backgrounds[modKey] || [];
    const nextId = list.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0) + 1;
    const newSlide = {
      id: nextId,
      url: String(body.url).trim(),
      titulo: String(body.titulo || `Fondo ${nextId}`).trim().slice(0, 100),
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
      orden: Number.isFinite(Number(body.orden)) && Number(body.orden) > 0 ? Number(body.orden) : (list.length + 1)
    };

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      backgrounds: { ...config.backgrounds, [modKey]: [...list, newSlide] }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);
    const savedSlide = writeRes.config.backgrounds[modKey].find(b => b.id === nextId) || newSlide;

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'CREACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: savedSlide.id,
      details: `Imagen de fondo agregada en '${modKey}': ${savedSlide.url}`,
      previousValue: null,
      newValue: savedSlide,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.status(201).json({ success: true, background: savedSlide, backgrounds: writeRes.config.backgrounds[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo agregar la imagen de fondo.' });
  }
});

// Reordenar imágenes de fondo de un módulo
app.put('/api/admin/ui/:module/backgrounds/reorder', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  const orderedIds = req.body?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'Debe enviar el arreglo "orderedIds".' });
  }

  try {
    const { config } = readModulesUiConfig();
    const list = config.backgrounds[modKey] || [];
    const byId = new Map(list.map(b => [String(b.id), b]));
    const reordered = [];
    const used = new Set();

    orderedIds.forEach(rawId => {
      const key = String(rawId);
      if (byId.has(key) && !used.has(key)) {
        used.add(key);
        reordered.push({ ...byId.get(key), orden: reordered.length + 1 });
      }
    });
    list.forEach(b => {
      const key = String(b.id);
      if (!used.has(key)) reordered.push({ ...b, orden: reordered.length + 1 });
    });

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      backgrounds: { ...config.backgrounds, [modKey]: reordered }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: 'backgrounds_reorder',
      details: `Orden de imágenes de fondo actualizado en '${modKey}'`,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, backgrounds: writeRes.config.backgrounds[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo reordenar los fondos.' });
  }
});

// Editar imagen de fondo existente
app.put('/api/admin/ui/:module/backgrounds/:id', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  const bgId = Number(req.params.id);
  if (!Number.isFinite(bgId) || bgId <= 0) {
    return res.status(400).json({ error: 'ID de fondo inválido.' });
  }

  const body = req.body || {};
  const errors = validateBackgroundSlidePayload(body, true);
  if (errors.length > 0) return res.status(400).json({ error: errors.join(' ') });

  try {
    const { config } = readModulesUiConfig();
    const list = config.backgrounds[modKey] || [];
    const idx = list.findIndex(b => Number(b.id) === bgId);
    if (idx === -1) return res.status(404).json({ error: 'Imagen de fondo no encontrada.' });

    const prev = { ...list[idx] };
    const updated = {
      ...prev,
      url: Object.prototype.hasOwnProperty.call(body, 'url') ? String(body.url).trim() : prev.url,
      titulo: Object.prototype.hasOwnProperty.call(body, 'titulo') ? String(body.titulo || '').trim().slice(0, 100) : prev.titulo,
      activo: Object.prototype.hasOwnProperty.call(body, 'activo') ? Boolean(body.activo) : prev.activo,
      orden: Object.prototype.hasOwnProperty.call(body, 'orden') && Number.isFinite(Number(body.orden)) ? Number(body.orden) : prev.orden
    };

    const nextList = [...list];
    nextList[idx] = updated;

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      backgrounds: { ...config.backgrounds, [modKey]: nextList }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);
    const saved = writeRes.config.backgrounds[modKey].find(b => Number(b.id) === bgId) || updated;

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: bgId,
      details: `Imagen de fondo #${bgId} actualizada en '${modKey}'`,
      previousValue: prev,
      newValue: saved,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, background: saved, backgrounds: writeRes.config.backgrounds[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo actualizar la imagen de fondo.' });
  }
});

// Eliminar imagen de fondo del slider
app.delete('/api/admin/ui/:module/backgrounds/:id', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  const bgId = Number(req.params.id);
  if (!Number.isFinite(bgId) || bgId <= 0) {
    return res.status(400).json({ error: 'ID de fondo inválido.' });
  }

  try {
    const { config } = readModulesUiConfig();
    const list = config.backgrounds[modKey] || [];
    const target = list.find(b => Number(b.id) === bgId);
    if (!target) return res.status(404).json({ error: 'Imagen de fondo no encontrada.' });
    if (list.length <= 1) {
      return res.status(400).json({ error: 'Debe permanecer al menos una imagen de fondo configurada.' });
    }

    const remaining = list.filter(b => Number(b.id) !== bgId);
    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      backgrounds: { ...config.backgrounds, [modKey]: remaining }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ELIMINACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey})`,
      recordId: bgId,
      details: `Imagen de fondo #${bgId} (${target.url}) eliminada de '${modKey}'`,
      previousValue: target,
      newValue: null,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, backgrounds: writeRes.config.backgrounds[modKey] });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo eliminar la imagen de fondo.' });
  }
});

// Actualizar imagen destacada de sección (Portal Principal: ¿Por qué existe?)
app.put('/api/admin/ui/:module/section-images', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  if (modKey !== 'portal') {
    return res.status(400).json({ error: 'Solo el Portal Principal dispone de imagen de sección configurable.' });
  }
  const { porqueExiste } = req.body || {};
  if (!isValidBackgroundImageUrl(porqueExiste)) {
    return res.status(400).json({ error: 'Ruta o URL de imagen inválida.' });
  }

  try {
    const { config } = readModulesUiConfig();
    const prevVal = config.sectionImages?.portal?.porqueExiste || null;
    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig({
      ...config,
      sectionImages: {
        ...config.sectionImages,
        portal: { porqueExiste: String(porqueExiste).trim() }
      }
    }, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module: 'portal',
      target: 'modules_ui_config.json (portal.porqueExiste)',
      recordId: 'porqueExiste',
      details: `Imagen de sección "¿Por qué existe?" actualizada a ${String(porqueExiste).trim()}`,
      previousValue: prevVal,
      newValue: String(porqueExiste).trim(),
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({ success: true, sectionImages: writeRes.config.sectionImages.portal });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo actualizar la imagen de sección.' });
  }
});

// Restaurar valores predeterminados de KPIs o Fondos para un módulo
app.post('/api/admin/ui/:module/reset-defaults', requireAuth, requireOperator, checkUiModuleAccess, (req, res) => {
  const modKey = req.uiModuleKey;
  const scope = req.body?.scope === 'kpis' ? 'kpis' : 'backgrounds';
  if (scope === 'kpis' && modKey === 'portal') {
    return res.status(400).json({ error: 'Los KPIs del Portal Principal se gestionan directamente desde Métricas Portal.' });
  }

  try {
    const { config } = readModulesUiConfig();
    const nextConfig = { ...config };
    if (scope === 'backgrounds') {
      nextConfig.backgrounds = {
        ...config.backgrounds,
        [modKey]: JSON.parse(JSON.stringify(DEFAULT_MODULES_UI_CONFIG.backgrounds[modKey] || []))
      };
      if (modKey === 'portal') {
        nextConfig.sectionImages = {
          ...config.sectionImages,
          portal: { ...DEFAULT_MODULES_UI_CONFIG.sectionImages.portal }
        };
      }
    } else {
      nextConfig.kpis = {
        ...config.kpis,
        [modKey]: JSON.parse(JSON.stringify(DEFAULT_MODULES_UI_CONFIG.kpis[modKey] || []))
      };
    }

    const ifMatch = cleanEtag(req.headers['if-match']);
    const writeRes = writeModulesUiConfig(nextConfig, req.user.upn || req.user.email || 'sistema', ifMatch || null);

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: req.user.role === 'admin' ? 'admin' : `data_operator_${req.user.operatorIndex}`,
      action: 'RESTAURACIÓN',
      module: modKey,
      target: `modules_ui_config.json (${modKey}.${scope})`,
      recordId: scope,
      details: `Valores predeterminados de ${scope === 'kpis' ? 'KPIs' : 'imágenes de fondo'} restaurados para '${modKey}'`,
      backupCreated: writeRes.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (writeRes.newHash) res.setHeader('ETag', `"${writeRes.newHash}"`);
    res.json({
      success: true,
      kpis: writeRes.config.kpis[modKey] || [],
      backgrounds: writeRes.config.backgrounds[modKey] || [],
      sectionImages: writeRes.config.sectionImages?.[modKey] || {}
    });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message || 'No se pudo restaurar la configuración.' });
  }
});

// Lectura de módulos (Público y Operadores) con ETag y soporte híbrido JSON / SQL
app.get('/api/:module', async (req, res, next) => {
  const { module } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();
  try {
    const { source, records, etag } = await hybridStorage.readModule(module);
    if (etag) res.setHeader('ETag', `"${etag}"`);
    res.setHeader('X-PIA-Storage-Source', source);
    res.json(records);
  } catch (err) {
    res.status(err.code === 'SQL_NOT_CONFIGURED' ? 503 : 400).json({ error: err.message });
  }
});

app.get('/api/:module/:id', async (req, res, next) => {
  const { module, id } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();
  try {
    const { source, item, etag } = await hybridStorage.readRecordById(module, id);
    if (etag) res.setHeader('ETag', `"${etag}"`);
    res.setHeader('X-PIA-Storage-Source', source);
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(item);
  } catch (err) {
    res.status(err.code === 'SQL_NOT_CONFIGURED' ? 503 : 400).json({ error: err.message });
  }
});

// POST: Creación de registros (Exclusivo para operadores autorizados)
app.post('/api/:module', requireAuth, requireOperator, async (req, res, next) => {
  const { module } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();

  try {
    const ifMatch = cleanEtag(req.headers['if-match']);
    const expectedHash = ifMatch || req.body?._expectedHash || null;
    if (req.body && req.body._expectedHash) delete req.body._expectedHash;

    const result = await hybridStorage.createRecord(module, req.body, req.user.upn, expectedHash);
    const createdId = result.record?.id;

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: `data_operator_${req.user.operatorIndex}`,
      action: 'CREACIÓN',
      module,
      target: `${module} (${result.source.toUpperCase()})`,
      recordId: createdId,
      details: `Registro ID ${createdId} creado en ${result.source.toUpperCase()} por Operador ${req.user.operatorIndex} (${req.user.displayName})`,
      backupCreated: result.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (result.newHash) res.setHeader('ETag', `"${result.newHash}"`);
    res.setHeader('X-PIA-Storage-Source', result.source);
    res.status(201).json(result.record);
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT: Modificación de registros (Exclusivo para operadores autorizados)
app.put('/api/:module/:id', requireAuth, requireOperator, async (req, res, next) => {
  const { module, id } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();

  try {
    const ifMatch = cleanEtag(req.headers['if-match']);
    const expectedHash = ifMatch || req.body?._expectedHash || null;
    if (req.body && req.body._expectedHash) delete req.body._expectedHash;

    const result = await hybridStorage.updateRecord(module, id, req.body, req.user.upn, expectedHash);
    if (!result) return res.status(404).json({ error: 'Registro no encontrado' });

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: `data_operator_${req.user.operatorIndex}`,
      action: 'ACTUALIZACIÓN',
      module,
      target: `${module} (${result.source.toUpperCase()})`,
      recordId: id,
      details: `Registro ID ${id} actualizado en ${result.source.toUpperCase()} por Operador ${req.user.operatorIndex} (${req.user.displayName})`,
      backupCreated: result.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (result.newHash) res.setHeader('ETag', `"${result.newHash}"`);
    res.setHeader('X-PIA-Storage-Source', result.source);
    res.json(result.record);
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message });
  }
});

// DELETE: Eliminación de registros (Exclusivo para operadores autorizados)
app.delete('/api/:module/:id', requireAuth, requireOperator, async (req, res, next) => {
  const { module, id } = req.params;
  if (RESERVED_MODULES.includes(module)) return next();

  try {
    const ifMatch = cleanEtag(req.headers['if-match']);
    const expectedHash = ifMatch || null;

    const result = await hybridStorage.deleteRecord(module, id, req.user.upn, expectedHash);
    if (!result) return res.status(404).json({ error: 'Registro no encontrado' });

    logAudit({
      user: req.user.upn,
      userOid: req.user.oid,
      userRole: `data_operator_${req.user.operatorIndex}`,
      action: 'ELIMINACIÓN',
      module,
      target: `${module} (${result.source.toUpperCase()})`,
      recordId: id,
      details: `Registro ID ${id} eliminado en ${result.source.toUpperCase()} por Operador ${req.user.operatorIndex} (${req.user.displayName})`,
      backupCreated: result.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });

    if (result.newHash) res.setHeader('ETag', `"${result.newHash}"`);
    res.setHeader('X-PIA-Storage-Source', result.source);
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

app.get('/api/audit', requireAuth, requireOperator, (req, res) => {
  res.json(getAuditLogs());
});

app.get('/api/dashboard/stats', requireAuth, requireOperator, async (req, res) => {
  try {
    const [canalesRes, directorioRes, tablerosRes, riesgoRes, vehiculosRes] = await Promise.all([
      hybridStorage.readModule('canales'),
      hybridStorage.readModule('directorio'),
      hybridStorage.readModule('tableros'),
      hybridStorage.readModule('riesgo'),
      hybridStorage.readModule('vehiculos')
    ]);
    const auditLog = getAuditLogs();

    const totalRegs =
      canalesRes.records.length +
      directorioRes.records.length +
      tablerosRes.records.length +
      riesgoRes.records.length +
      vehiculosRes.records.length;

    const currentStorage = storageConfig.getConfig();

    res.json({
      modulos: 6,
      registros: totalRegs,
      operadoresAutorizados: getAuthorizedOperators().length,
      instituciones: 68,
      tableros: tablerosRes.records.length,
      vehiculos: vehiculosRes.records.length,
      visitasTotales: getVisitsData().totalVisits || 0,
      creados: auditLog.filter(a => a.action === 'CREACIÓN').length,
      actualizados: auditLog.filter(a => a.action === 'ACTUALIZACIÓN').length,
      eliminados: auditLog.filter(a => a.action === 'ELIMINACIÓN').length,
      storageMode: currentStorage.mode,
      storageSources: {
        canales: canalesRes.source,
        directorio: directorioRes.source,
        tableros: tablerosRes.source,
        riesgo: riesgoRes.source,
        vehiculos: vehiculosRes.source
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/audit', requireAuth, requireOperator, (req, res) => {
  res.json(getAuditLogs().slice(0, 20));
});

// Endpoint administrativo para consultar contador y estadísticas reales de visitas
app.get('/api/admin/visits', requireAuth, requireOperator, (req, res) => {
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
app.post('/api/chatbot/knowledge', requireAuth, requireOperator, (req, res) => {
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

app.delete('/api/chatbot/knowledge/:id', requireAuth, requireOperator, (req, res) => {
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
app.get('/api/admin/chatbot/stats', requireAuth, requireOperator, (req, res) => {
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

app.get('/api/admin/chatbot/knowledge', requireAuth, requireOperator, (req, res) => {
  res.json(getChatbotKnowledge());
});

app.get('/api/admin/chatbot/settings', requireAuth, requireOperator, (req, res) => {
  res.json(getChatbotSettings());
});

// Archivo upload endpoint autenticado para operadores (con validación real de imagen)
app.post('/api/files/upload', requireAuth, requireOperator, (req, res) => {
  const { filename, dataUrl } = req.body || {};
  if (!dataUrl) {
    return res.status(400).json({ error: 'Debe enviar la imagen codificada en Base64 (dataUrl).' });
  }
  try {
    const saved = saveValidatedBase64Image(filename, dataUrl);
    res.status(201).json({ success: true, ...saved });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Archivo inválido.' });
  }
});

// Edición controlada de ficheros JSON institucionales (solo operadores autorizados en lista blanca)
const RAW_JSON_ALLOWLIST = {
  '/data_portal.json': WHITELIST_JSON_MAP['data_portal.json'],
  'data_portal.json': WHITELIST_JSON_MAP['data_portal.json'],
  'portal': WHITELIST_JSON_MAP['data_portal.json'],
  '/canales-por-la-integridad/data_directorio.json': WHITELIST_JSON_MAP['data_directorio.json'],
  'canales-por-la-integridad/data_directorio.json': WHITELIST_JSON_MAP['data_directorio.json'],
  'data_directorio.json': WHITELIST_JSON_MAP['data_directorio.json'],
  'canales': WHITELIST_JSON_MAP['data_directorio.json'],
  '/directorio/data_acceso.json': WHITELIST_JSON_MAP['data_acceso.json'],
  'directorio/data_acceso.json': WHITELIST_JSON_MAP['data_acceso.json'],
  'data_acceso.json': WHITELIST_JSON_MAP['data_acceso.json'],
  'directorio': WHITELIST_JSON_MAP['data_acceso.json'],
  '/gobierno_en_numeros/data_tableros.json': WHITELIST_JSON_MAP['data_tableros.json'],
  'gobierno_en_numeros/data_tableros.json': WHITELIST_JSON_MAP['data_tableros.json'],
  'data_tableros.json': WHITELIST_JSON_MAP['data_tableros.json'],
  'tableros': WHITELIST_JSON_MAP['data_tableros.json'],
  '/riesgo/datos.json': WHITELIST_JSON_MAP['datos.json'],
  'riesgo/datos.json': WHITELIST_JSON_MAP['datos.json'],
  'datos.json': WHITELIST_JSON_MAP['datos.json'],
  'riesgo': WHITELIST_JSON_MAP['datos.json'],
  '/vehiculos/vehiculos.json': WHITELIST_JSON_MAP['vehiculos.json'],
  'vehiculos/vehiculos.json': WHITELIST_JSON_MAP['vehiculos.json'],
  'vehiculos.json': WHITELIST_JSON_MAP['vehiculos.json'],
  'vehiculos': WHITELIST_JSON_MAP['vehiculos.json']
};

function resolveWhitelistedJsonPath(rawPath) {
  const candidate = String(rawPath || '').trim();
  if (!candidate || candidate.includes('..') || candidate.includes('\\')) return null;
  return RAW_JSON_ALLOWLIST[candidate] || null;
}

app.get('/api/raw-json', requireAuth, requireOperator, requireDatabaseAccess, (req, res) => {
  const targetFile = resolveWhitelistedJsonPath(req.query.path);
  if (!targetFile) {
    return res.status(403).json({ error: 'Ruta JSON no permitida o fuera de la lista blanca institucional.' });
  }
  const data = readJsonFile(targetFile);
  if (data === null) {
    return res.status(404).json({ error: 'Archivo JSON no encontrado.' });
  }
  const hash = computeFileHash(targetFile);
  if (hash) res.setHeader('ETag', `"${hash}"`);
  res.json(data);
});

app.post('/api/raw-json', requireAuth, requireOperator, requireDatabaseAccess, (req, res) => {
  const { path: reqPath, data } = req.body || {};
  const targetFile = resolveWhitelistedJsonPath(reqPath);
  if (!targetFile) {
    return res.status(403).json({ error: 'Ruta JSON no permitida o fuera de la lista blanca institucional.' });
  }
  if (typeof data !== 'object' || data === null) {
    return res.status(400).json({ error: 'El contenido JSON debe ser un objeto o arreglo válido.' });
  }
  try {
    const ifMatch = cleanEtag(req.headers['if-match']);
    const result = atomicWriteJson(targetFile, data, ifMatch || null, req.user.email);
    logAudit({
      user: req.user.email,
      userOid: req.user.uid,
      userRole: req.user.role,
      action: 'EDICIÓN DIRECTA JSON',
      module: 'database',
      target: path.basename(targetFile),
      details: `Archivo JSON '${path.basename(targetFile)}' actualizado desde el Editor Directo JSON.`,
      backupCreated: result.backupCreated,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
    });
    if (result.newHash) res.setHeader('ETag', `"${result.newHash}"`);
    res.json({ success: true, backupCreated: result.backupCreated, newHash: result.newHash });
  } catch (err) {
    if (err.code === 'CONCURRENCY_CONFLICT') {
      return res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ========================================================
// 8. SERVICIO DE ARCHIVOS ESTÁTICOS Y PÁGINAS DEL PORTAL
// ========================================================

// Interceptor transparente: si un módulo usa SQL o modo híbrido con SQL, sus rutas JSON públicas
// responden directamente desde MySQL/MariaDB conservando exactamente la estructura esperada.
const PUBLIC_JSON_ROUTE_MODULE_MAP = {
  '/data_portal.json': 'portal',
  '/canales-por-la-integridad/data_directorio.json': 'canales',
  '/directorio/data_acceso.json': 'directorio',
  '/gobierno_en_numeros/data_tableros.json': 'tableros',
  '/riesgo/datos.json': 'riesgo',
  '/vehiculos/vehiculos.json': 'vehiculos'
};

app.get(Object.keys(PUBLIC_JSON_ROUTE_MODULE_MAP), async (req, res, next) => {
  const moduleKey = PUBLIC_JSON_ROUTE_MODULE_MAP[req.path];
  if (!moduleKey) return next();
  try {
    const sqlDoc = await hybridStorage.getPublicDocumentIfSql(moduleKey);
    if (sqlDoc === null) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-PIA-Storage-Source', 'sql');
    return res.json(sqlDoc);
  } catch (err) {
    console.error(`[HybridStorage] Error sirviendo ${req.path} desde SQL:`, err.message);
    return res.status(503).json({ error: 'Error consultando base de datos SQL para este módulo.' });
  }
});

const sendFreshHtml = (filePath, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(filePath);
};

app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/uploads', express.static(UPLOADS_DIR));

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

// Bloquear acceso público HTTP directo a scripts CLI y módulos servidor internos de administración
app.use('/admin/scripts', (req, res) => {
  res.status(403).json({ error: 'Acceso denegado: los scripts administrativos CLI solo pueden ejecutarse desde consola del servidor.' });
});

app.use('/admin/database-manager.js', (req, res) => {
  res.status(403).json({ error: 'Acceso denegado: el módulo servidor database-manager.js solo puede ejecutarse en el backend.' });
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
