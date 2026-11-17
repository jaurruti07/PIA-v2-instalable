// db/sqlClient.js - Cliente MySQL/MariaDB configurable por variables de entorno
import mysql from 'mysql2/promise';

let pool = null;
let poolSignature = null;

function sanitizeIdentifier(name, fallback = 'pia_db') {
  const clean = String(name || fallback).trim();
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    throw new Error('Nombre de base de datos SQL inválido. Solo se permiten caracteres alfanuméricos y guión bajo.');
  }
  return clean;
}

export function getSqlEnvConfig() {
  const host = (process.env.MYSQL_HOST || '').trim();
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = (process.env.MYSQL_USER || '').trim();
  const password = process.env.MYSQL_PASSWORD !== undefined ? String(process.env.MYSQL_PASSWORD) : '';
  const database = (process.env.MYSQL_DATABASE || 'pia_db').trim();
  const sslEnabled = String(process.env.MYSQL_SSL || 'false').toLowerCase() === 'true';
  const connectionLimit = Math.min(Math.max(Number(process.env.MYSQL_CONNECTION_LIMIT) || 10, 1), 50);

  return {
    host,
    port,
    user,
    password,
    database,
    sslEnabled,
    connectionLimit
  };
}

export function isSqlConfigured() {
  const cfg = getSqlEnvConfig();
  return Boolean(cfg.host && cfg.user && cfg.database);
}

function getPoolSignature(cfg) {
  return `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.database}:${cfg.sslEnabled}:${cfg.connectionLimit}`;
}

export function getSqlPool() {
  if (!isSqlConfigured()) {
    const err = new Error('La conexión SQL (MySQL/MariaDB) no está configurada en las variables de entorno del servidor.');
    err.code = 'SQL_NOT_CONFIGURED';
    throw err;
  }

  const cfg = getSqlEnvConfig();
  const safeDb = sanitizeIdentifier(cfg.database);
  const sig = getPoolSignature(cfg);

  if (!pool || poolSignature !== sig) {
    if (pool) {
      try { pool.end().catch(() => {}); } catch (_) {}
    }
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: safeDb,
      waitForConnections: true,
      connectionLimit: cfg.connectionLimit,
      queueLimit: 0,
      connectTimeout: 5000,
      charset: 'utf8mb4',
      multipleStatements: false,
      ...(cfg.sslEnabled ? { ssl: { rejectUnauthorized: false } } : {})
    });
    poolSignature = sig;
  }

  return pool;
}

export async function createServerLevelConnection() {
  if (!isSqlConfigured()) {
    const err = new Error('La conexión SQL (MySQL/MariaDB) no está configurada en las variables de entorno del servidor.');
    err.code = 'SQL_NOT_CONFIGURED';
    throw err;
  }
  const cfg = getSqlEnvConfig();
  return mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    connectTimeout: 5000,
    charset: 'utf8mb4',
    multipleStatements: false,
    ...(cfg.sslEnabled ? { ssl: { rejectUnauthorized: false } } : {})
  });
}

export async function sqlQuery(sql, params = []) {
  const activePool = getSqlPool();
  const [rows] = await activePool.execute(sql, params);
  return rows;
}

export async function withTransaction(workFn) {
  const activePool = getSqlPool();
  const conn = await activePool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await workFn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rbErr) {
      console.error('[SQL] Error en rollback transaccional:', rbErr.message);
    }
    throw err;
  } finally {
    conn.release();
  }
}

function sanitizeSqlError(err) {
  if (!err) return 'Error desconocido de base de datos.';
  if (err.code === 'SQL_NOT_CONFIGURED') return err.message;
  if (err.code === 'ECONNREFUSED') return 'No se pudo establecer conexión con el servidor MySQL/MariaDB (conexión rechazada).';
  if (err.code === 'ER_ACCESS_DENIED_ERROR') return 'Autenticación SQL rechazada por el motor MySQL/MariaDB.';
  if (err.code === 'ER_BAD_DB_ERROR') return 'La base de datos destino aún no existe en el servidor MySQL/MariaDB.';
  if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return 'No se logró alcanzar el servidor MySQL/MariaDB configurado.';
  return err.message || 'Error al comunicarse con MySQL/MariaDB.';
}

export async function testSqlConnection() {
  const cfg = getSqlEnvConfig();
  const configured = isSqlConfigured();

  // Nunca exponer contraseña ni credenciales al frontend
  const hostMasked = cfg.host
    ? (cfg.host === '127.0.0.1' || cfg.host === 'localhost' ? cfg.host : `${cfg.host.slice(0, 3)}***`)
    : 'No configurado';

  if (!configured) {
    return {
      configured: false,
      connected: false,
      engine: 'MySQL / MariaDB',
      hostMasked,
      port: cfg.port,
      database: cfg.database,
      ssl: cfg.sslEnabled,
      serverVersion: null,
      error: 'Variables MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE no configuradas en el servidor.'
    };
  }

  let conn = null;
  try {
    conn = await createServerLevelConnection();
    const [versionRows] = await conn.query('SELECT VERSION() AS version');
    const serverVersion = versionRows?.[0]?.version || 'MySQL/MariaDB';

    const safeDb = sanitizeIdentifier(cfg.database);
    const [dbRows] = await conn.execute(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [safeDb]
    );
    const databaseExists = Array.isArray(dbRows) && dbRows.length > 0;

    return {
      configured: true,
      connected: true,
      databaseExists,
      engine: serverVersion.toLowerCase().includes('mariadb') ? 'MariaDB' : 'MySQL',
      hostMasked,
      port: cfg.port,
      database: safeDb,
      ssl: cfg.sslEnabled,
      serverVersion,
      error: null
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      databaseExists: false,
      engine: 'MySQL / MariaDB',
      hostMasked,
      port: cfg.port,
      database: cfg.database,
      ssl: cfg.sslEnabled,
      serverVersion: null,
      error: sanitizeSqlError(err)
    };
  } finally {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
  }
}

export async function closeSqlPool() {
  if (pool) {
    const closing = pool;
    pool = null;
    poolSignature = null;
    await closing.end();
  }
}
