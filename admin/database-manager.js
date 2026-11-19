// admin/database-manager.js - Módulo servidor de gestión y configuración de conexión MySQL/MariaDB vía .env
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getSqlEnvConfig,
  isSqlConfigured,
  getSqlPool,
  createServerLevelConnection,
  sqlQuery,
  withTransaction,
  testSqlConnection,
  closeSqlPool
} from '../db/sqlClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const ENV_MYSQL_CONFIG_KEYS = Object.freeze([
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_DATABASE',
  'MYSQL_SSL',
  'MYSQL_CONNECTION_LIMIT'
]);

const PASSWORD_ENV_KEY = ['MYSQL', 'PASSWORD'].join('_');

function maskIdentifier(value, fallback = 'No configurado') {
  const clean = String(value || '').trim();
  if (!clean) return fallback;
  if (clean === '127.0.0.1' || clean === 'localhost') return clean;
  if (clean.length <= 3) return `${clean[0]}***`;
  return `${clean.slice(0, 3)}***`;
}

export function resolveEnvFilePath(customPath = null) {
  if (customPath) {
    return path.resolve(String(customPath));
  }
  return path.join(ROOT_DIR, '.env');
}

export function readEnvFilePresence(envFilePath = null) {
  const targetPath = resolveEnvFilePath(envFilePath);
  const examplePath = path.join(ROOT_DIR, '.env.example');
  const envFileExists = fs.existsSync(targetPath);
  const envExampleExists = fs.existsSync(examplePath);

  let parsedKeys = [];
  let hasPasswordInFile = false;

  if (envFileExists) {
    try {
      const raw = fs.readFileSync(targetPath, 'utf8');
      const parsed = dotenv.parse(raw);
      parsedKeys = Object.keys(parsed).filter((key) => {
        if (key === PASSWORD_ENV_KEY) {
          hasPasswordInFile = Boolean(parsed[key]);
          return false;
        }
        return ENV_MYSQL_CONFIG_KEYS.includes(key) || key.startsWith('PIA_');
      });
    } catch (_) {
      parsedKeys = [];
    }
  }

  return {
    envFileName: path.basename(targetPath),
    envFileExists,
    envExampleExists,
    definedConfigKeys: parsedKeys,
    hasPasswordInFile
  };
}

export function getMysqlConnectionConfig({ includeSecret = false } = {}) {
  const envCfg = getSqlEnvConfig();
  const baseConfig = {
    host: envCfg.host,
    port: envCfg.port,
    user: envCfg.user,
    database: envCfg.database,
    sslEnabled: envCfg.sslEnabled,
    connectionLimit: envCfg.connectionLimit,
    storageMode: (process.env.PIA_STORAGE_MODE || 'json').trim().toLowerCase() || 'json',
    sqlModules: (process.env.PIA_SQL_MODULES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  };

  if (includeSecret) {
    return {
      ...baseConfig,
      password: envCfg.password
    };
  }

  return baseConfig;
}

export function validateMysqlEnvConfig(inputConfig = null) {
  const cfg = inputConfig || getMysqlConnectionConfig({ includeSecret: true });
  const errors = [];
  const warnings = [];

  const host = String(cfg.host || '').trim();
  const rawPort = cfg.port;
  const port = Number(rawPort);
  const user = String(cfg.user || '').trim();
  const database = String(cfg.database || '').trim();
  const sslEnabled = Boolean(cfg.sslEnabled);
  const rawLimit = cfg.connectionLimit;
  const connectionLimit = Number(rawLimit || 10);
  const hasCredentials = Boolean(cfg.password !== undefined ? String(cfg.password).length > 0 : process.env[PASSWORD_ENV_KEY]);

  if (!host) {
    errors.push('Falta definir MYSQL_HOST en las variables de entorno (.env).');
  } else if (/[\s\r\n;'"`\\]/.test(host) || host.length > 255) {
    errors.push('MYSQL_HOST contiene caracteres inválidos o excede la longitud permitida.');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('MYSQL_PORT debe ser un número entero entre 1 y 65535.');
  }

  if (!user) {
    errors.push('Falta definir MYSQL_USER en las variables de entorno (.env).');
  } else if (/[\r\n\0]/.test(user) || user.length > 128) {
    errors.push('MYSQL_USER contiene caracteres inválidos.');
  }

  if (!database) {
    errors.push('Falta definir MYSQL_DATABASE en las variables de entorno (.env).');
  } else if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    errors.push('MYSQL_DATABASE solo permite caracteres alfanuméricos y guión bajo (_).');
  }

  if (!Number.isInteger(connectionLimit) || connectionLimit < 1 || connectionLimit > 50) {
    errors.push('MYSQL_CONNECTION_LIMIT debe estar entre 1 y 50 conexiones.');
  }

  if (host && !hasCredentials) {
    warnings.push('No hay credencial/contraseña SQL definida en el entorno del servidor; verifique si su motor MySQL/MariaDB la requiere.');
  }

  if (host && host !== '127.0.0.1' && host !== 'localhost' && !sslEnabled) {
    warnings.push('Conexión a host remoto sin TLS/SSL activo (MYSQL_SSL=false). Se recomienda cifrado TLS en producción.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized: {
      host,
      port: Number.isInteger(port) ? port : 3306,
      user,
      database: database || 'pia_db',
      sslEnabled,
      connectionLimit: Number.isInteger(connectionLimit) ? Math.min(Math.max(connectionLimit, 1), 50) : 10,
      hasCredentials
    }
  };
}

export function getSanitizedConnectionConfig(envFilePath = null) {
  const cfg = getMysqlConnectionConfig({ includeSecret: false });
  const envCfgInternal = getSqlEnvConfig();
  const validation = validateMysqlEnvConfig(envCfgInternal);
  const fileInfo = readEnvFilePresence(envFilePath);
  const configured = isSqlConfigured();
  const credentialsConfigured = Boolean(envCfgInternal.password && String(envCfgInternal.password).length > 0);

  return {
    configured,
    valid: validation.valid,
    envFileExists: fileInfo.envFileExists,
    envExampleExists: fileInfo.envExampleExists,
    envFileName: fileInfo.envFileName,
    storageMode: cfg.storageMode,
    sqlModules: cfg.sqlModules,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    connection: {
      engine: 'MySQL / MariaDB',
      hostMasked: maskIdentifier(cfg.host),
      port: cfg.port,
      userMasked: maskIdentifier(cfg.user),
      database: cfg.database,
      sslEnabled: cfg.sslEnabled,
      connectionLimit: cfg.connectionLimit,
      credentialsConfigured
    },
    envParameters: {
      hostConfigured: Boolean(cfg.host),
      portConfigured: Boolean(process.env.MYSQL_PORT || cfg.port),
      userConfigured: Boolean(cfg.user),
      credentialsConfigured,
      databaseConfigured: Boolean(cfg.database),
      sslConfigured: process.env.MYSQL_SSL !== undefined,
      connectionLimitConfigured: process.env.MYSQL_CONNECTION_LIMIT !== undefined
    }
  };
}

export async function reloadEnvConnectionConfig({ envFilePath = null, resetPool = true } = {}) {
  const targetPath = resolveEnvFilePath(envFilePath);
  const envFileExists = fs.existsSync(targetPath);
  let reloaded = false;

  if (envFileExists) {
    const res = dotenv.config({ path: targetPath, override: true });
    if (res.error) {
      throw new Error(`No fue posible analizar el archivo .env: ${res.error.message}`);
    }
    reloaded = true;
  }

  if (resetPool) {
    try {
      await closeSqlPool();
    } catch (_) {
      // Ignorar si no existía pool previo o ya estaba cerrado
    }
  }

  return {
    reloaded,
    envFileExists,
    config: getSanitizedConnectionConfig(targetPath)
  };
}

export async function testDatabaseConnection({ envFilePath = null, reloadEnv = false } = {}) {
  let reloadInfo = null;
  if (reloadEnv) {
    reloadInfo = await reloadEnvConnectionConfig({ envFilePath, resetPool: true });
  }

  const envConfig = getSanitizedConnectionConfig(envFilePath);
  const connection = await testSqlConnection();

  return {
    success: Boolean(connection.connected),
    reloaded: Boolean(reloadInfo?.reloaded),
    connection,
    envConfig
  };
}

export function getDatabasePool() {
  return getSqlPool();
}

export async function executeDatabaseQuery(sql, params = []) {
  return sqlQuery(sql, params);
}

export async function runDatabaseTransaction(workFn) {
  return withTransaction(workFn);
}

export function createDatabaseManager({ envFilePath = null } = {}) {
  const targetEnvPath = resolveEnvFilePath(envFilePath);
  return {
    envFilePath: targetEnvPath,
    getConfig: (opts) => getMysqlConnectionConfig(opts),
    getSanitizedConfig: () => getSanitizedConnectionConfig(targetEnvPath),
    validateConfig: (cfg) => validateMysqlEnvConfig(cfg),
    reloadEnv: (opts = {}) => reloadEnvConnectionConfig({ envFilePath: targetEnvPath, ...opts }),
    testConnection: (opts = {}) => testDatabaseConnection({ envFilePath: targetEnvPath, ...opts }),
    createConnection: () => createServerLevelConnection(),
    getPool: () => getDatabasePool(),
    query: (sql, params = []) => executeDatabaseQuery(sql, params),
    withTransaction: (workFn) => runDatabaseTransaction(workFn),
    closePool: () => closeSqlPool()
  };
}

export default createDatabaseManager;
