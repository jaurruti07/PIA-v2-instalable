// db/schemaInit.js - Inicialización controlada y verificación de estructura SQL
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getSqlEnvConfig,
  isSqlConfigured,
  createServerLevelConnection,
  getSqlPool,
  testSqlConnection
} from './sqlClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMA_SQL_PATH = path.join(ROOT_DIR, 'sql', '01_schema_mysql.sql');

export const PIA_SQL_TABLES = [
  { table: 'pia_canales_integridad', module: 'canales', label: 'Canales por la Integridad' },
  { table: 'pia_directorio_acceso', module: 'directorio', label: 'Directorio Acceso al Ejecutivo' },
  { table: 'pia_directorio_enlaces', module: 'directorio', label: 'Directorio (Enlaces Solicitud / Oficio)', isChild: true },
  { table: 'pia_tableros_gobierno', module: 'tableros', label: 'Tu Gobierno en Números' },
  { table: 'pia_riesgo_ciclos', module: 'riesgo', label: 'Riesgo en la Mira (Ciclos Anuales)' },
  { table: 'pia_riesgo_instituciones', module: 'riesgo', label: 'Riesgo en la Mira (Instituciones)' },
  { table: 'pia_riesgo_frecuentes', module: 'riesgo', label: 'Riesgo en la Mira (Riesgos Frecuentes)', isChild: true },
  { table: 'pia_vehiculos_instituciones', module: 'vehiculos', label: 'Transparencia Vehicular (Instituciones)' },
  { table: 'pia_vehiculos_institucion_criterios', module: 'vehiculos', label: 'Transparencia Vehicular (Criterios)', isChild: true },
  { table: 'pia_vehiculos_institucion_documentos', module: 'vehiculos', label: 'Transparencia Vehicular (Documentos)', isChild: true },
  { table: 'pia_vehiculos', module: 'vehiculos', label: 'Transparencia Vehicular (Flotilla)' },
  { table: 'pia_vehiculos_historial', module: 'vehiculos', label: 'Transparencia Vehicular (Historial)', isChild: true },
  { table: 'pia_portal_metricas', module: 'portal', label: 'Métricas Generales del Portal' },
  { table: 'pia_storage_migrations', module: 'sistema', label: 'Bitácora de Migraciones JSON/SQL', isChild: true }
];

const ALLOWLISTED_TABLES = new Set(PIA_SQL_TABLES.map(t => t.table));

export const REQUIRED_TABLES_BY_MODULE = {
  canales: ['pia_canales_integridad'],
  directorio: ['pia_directorio_acceso', 'pia_directorio_enlaces'],
  tableros: ['pia_tableros_gobierno'],
  riesgo: ['pia_riesgo_ciclos', 'pia_riesgo_instituciones', 'pia_riesgo_frecuentes'],
  vehiculos: [
    'pia_vehiculos_instituciones',
    'pia_vehiculos_institucion_criterios',
    'pia_vehiculos_institucion_documentos',
    'pia_vehiculos',
    'pia_vehiculos_historial'
  ],
  portal: ['pia_portal_metricas']
};

function sanitizeDbName(name) {
  const clean = String(name || 'pia_db').trim();
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    throw new Error('Nombre de base de datos inválido.');
  }
  return clean;
}

export function parseSchemaStatements(sqlRaw) {
  const cleanedLines = sqlRaw
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'));
  const statements = cleanedLines
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  return statements.filter(stmt => {
    const upper = stmt.toUpperCase();
    return upper.startsWith('CREATE TABLE');
  });
}

export async function initializeDatabaseSchema() {
  if (!isSqlConfigured()) {
    return {
      success: false,
      error: 'La conexión SQL no está configurada en las variables de entorno del servidor (.env).'
    };
  }

  if (!fs.existsSync(SCHEMA_SQL_PATH)) {
    throw new Error('No se encontró el script de instalación SQL en sql/01_schema_mysql.sql.');
  }

  const cfg = getSqlEnvConfig();
  const safeDb = sanitizeDbName(cfg.database);
  const rawSql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
  const createTableStatements = parseSchemaStatements(rawSql);

  let serverConn = null;
  try {
    serverConn = await createServerLevelConnection();
    await serverConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${safeDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await serverConn.query(`USE \`${safeDb}\``);

    let executedCount = 0;
    for (const stmt of createTableStatements) {
      await serverConn.query(stmt);
      executedCount++;
    }

    const status = await inspectSchemaStatus();
    return {
      success: true,
      database: safeDb,
      statementsExecuted: executedCount,
      ...status
    };
  } finally {
    if (serverConn) {
      try { await serverConn.end(); } catch (_) {}
    }
  }
}

export async function inspectSchemaStatus() {
  const connection = await testSqlConnection();
  const cfg = getSqlEnvConfig();
  const safeDb = sanitizeDbName(cfg.database);

  if (!connection.configured || !connection.connected || !connection.databaseExists) {
    return {
      connection,
      ready: false,
      tablesFound: 0,
      totalTables: PIA_SQL_TABLES.length,
      missingTables: PIA_SQL_TABLES.map(t => t.table),
      tables: PIA_SQL_TABLES.map(t => ({
        ...t,
        exists: false,
        rowCount: 0
      }))
    };
  }

  const pool = getSqlPool();
  const [existingRows] = await pool.execute(
    'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
    [safeDb]
  );
  const existingSet = new Set((existingRows || []).map(r => r.TABLE_NAME));

  const tables = [];
  for (const meta of PIA_SQL_TABLES) {
    const exists = existingSet.has(meta.table);
    let rowCount = 0;
    if (exists && ALLOWLISTED_TABLES.has(meta.table)) {
      const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${meta.table}\``);
      rowCount = Number(countRows?.[0]?.total) || 0;
    }
    tables.push({
      ...meta,
      exists,
      rowCount
    });
  }

  const missingTables = tables.filter(t => !t.exists).map(t => t.table);
  return {
    connection,
    ready: missingTables.length === 0,
    tablesFound: tables.length - missingTables.length,
    totalTables: tables.length,
    missingTables,
    tables
  };
}

export function isModuleSqlReady(schemaStatus, moduleKey) {
  if (!schemaStatus || !schemaStatus.connection?.connected) return false;
  const required = REQUIRED_TABLES_BY_MODULE[moduleKey];
  if (!required) return false;
  const existing = new Set((schemaStatus.tables || []).filter(t => t.exists).map(t => t.table));
  return required.every(tbl => existing.has(tbl));
}
