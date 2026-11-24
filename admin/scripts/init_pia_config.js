#!/usr/bin/env node
// admin/scripts/init_pia_config.js
// Script idempotente de inicialización y verificación de configuración inicial del Portal PIA.
// Crea directorios protegidos, inicializa archivos JSON operativos faltantes sin sobrescribir datos
// existentes, valida los datasets base y opcionalmente inicializa el esquema SQL (18 tablas + seed).

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { isSqlConfigured, closeSqlPool } from '../../db/sqlClient.js';
import { initializeDatabaseSchema, inspectSchemaStatus } from '../../db/schemaInit.js';
import { StorageConfigManager } from '../../db/storageConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const DEFAULT_USERS_SEED = [
  {
    id: 'usr_cnc_01',
    email: 'deteccionydenuncia@cnc.gob.gt',
    displayName: 'Dirección de Apoyo en la Gestión de Irregularidades - DAGI',
    role: 'admin',
    passwordHash: 'f929ebd07fd2c63da7eb3004213bd3d2:9d5f0b3dc9c5e3160bcd726cfd0104c4b310ba6369d64914435c4de8c1ad5d6fb3723aa263cdcaf84f57ef6160b3634442819a3e43f657c0eeb088fbd317ef59',
    modules: ['canales', 'directorio', 'tableros', 'riesgo', 'vehiculos', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
    status: 'active',
    operatorIndex: 1,
    lastPasswordChange: '2026-03-30T10:00:00.000Z',
    updatedAt: '2026-03-30T10:00:00.000Z'
  },
  {
    id: 'usr_cnc_02',
    email: 'apoyogi@cnc.gob.gt',
    displayName: 'Apoyo a la Gestión de Irregularidades (CNC)',
    role: 'admin',
    passwordHash: '29af97fbdcade6df44a7d6fb84022548:b3e638225077f1c21b848b5bc32b9cf95d4b7f083dd3eb246d389a042475d86dd8002e0bb7fa0e47234b7a8164304e5a784af86ba8575357e361c93a5a33137e',
    modules: ['canales', 'directorio', 'tableros', 'riesgo', 'vehiculos', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
    status: 'active',
    operatorIndex: 2,
    lastPasswordChange: '2026-03-30T10:00:00.000Z',
    updatedAt: '2026-03-30T10:00:00.000Z'
  }
];

const DEFAULT_CANALES_SETTINGS = {
  showProtocolos: false,
  showDashboardCnc: false,
  updatedAt: null,
  updatedBy: 'sistema'
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
  },
  updatedAt: null,
  updatedBy: 'sistema'
};

function buildDefaultVisitsSeed() {
  const now = new Date().toISOString();
  return {
    totalVisits: 0,
    createdAt: now,
    lastUpdated: now,
    pages: {
      '/': { name: 'Portal Principal / Inicio', visits: 0, lastVisit: null },
      '/directorio': { name: 'Directorio Acceso al Ejecutivo', visits: 0, lastVisit: null },
      '/canales-por-la-integridad': { name: 'Canales por la Integridad', visits: 0, lastVisit: null },
      '/gobierno_en_numeros': { name: 'Tu Gobierno en Números', visits: 0, lastVisit: null },
      '/riesgo': { name: 'Riesgo en la Mira', visits: 0, lastVisit: null }
    },
    recentVisits: []
  };
}

const CORE_DATASETS = [
  { key: 'canales', relPath: 'canales-por-la-integridad/data_directorio.json', expectedType: 'array' },
  { key: 'directorio', relPath: 'directorio/data_acceso.json', expectedType: 'array' },
  { key: 'tableros', relPath: 'gobierno_en_numeros/data_tableros.json', expectedType: 'array' },
  { key: 'riesgo', relPath: 'riesgo/datos.json', expectedType: 'object' },
  { key: 'vehiculos', relPath: 'vehiculos/vehiculos.json', expectedType: 'object' },
  { key: 'portal', relPath: 'data_portal.json', expectedType: 'object' },
  { key: 'chatbot_knowledge', relPath: 'chatbot_knowledge.json', expectedType: 'array' },
  { key: 'chatbot_settings', relPath: 'chatbot_settings.json', expectedType: 'object' }
];

function atomicWriteIfMissing(targetPath, payload) {
  if (fs.existsSync(targetPath)) {
    return 'exists';
  }
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp_init_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, targetPath);
  return 'created';
}

export async function runInitialConfigSetup({
  rootDir = ROOT_DIR,
  dataDir = null,
  checkOnly = false,
  generateSecret = false,
  initSql = false,
  quiet = false
} = {}) {
  const resolvedDataDir = dataDir
    ? path.resolve(dataDir)
    : (process.env.PIA_DATA_DIR ? path.resolve(process.env.PIA_DATA_DIR) : path.join(rootDir, 'data'));

  const backupsDir = path.join(resolvedDataDir, 'backups');
  const migrationLogsDir = path.join(resolvedDataDir, 'migration_logs');
  const uploadsBgDir = path.join(rootDir, 'uploads', 'backgrounds');

  const log = (msg) => { if (!quiet) console.log(msg); };
  const warn = (msg) => { if (!quiet) console.warn(msg); };

  const report = {
    success: true,
    checkOnly,
    dataDir: resolvedDataDir,
    directories: [],
    envStatus: null,
    configFiles: [],
    datasets: [],
    sqlStatus: null,
    errors: [],
    warnings: []
  };

  log('========================================================================');
  log(` PIA - ${checkOnly ? 'Verificación de Configuración' : 'Inicialización Segura de Configuración'}`);
  log(` Directorio de datos: ${resolvedDataDir}`);
  log('========================================================================');

  // 1. Directorios requeridos
  for (const dirPath of [resolvedDataDir, backupsDir, migrationLogsDir, uploadsBgDir]) {
    const existed = fs.existsSync(dirPath);
    if (!existed && !checkOnly) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const status = existed ? 'ok' : (checkOnly ? 'missing' : 'created');
    if (status === 'missing') {
      report.warnings.push(`Directorio faltante: ${dirPath}`);
    }
    report.directories.push({ path: dirPath, status });
    log(`  [DIR]  ${status.toUpperCase().padEnd(7)} -> ${dirPath}`);
  }

  // 2. Archivo .env
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');
  let envAction = 'ok';

  if (!fs.existsSync(envPath)) {
    if (checkOnly) {
      envAction = 'missing';
      report.warnings.push('No existe .env en la raíz (se copiará desde .env.example al ejecutar setup:init).');
    } else if (fs.existsSync(envExamplePath)) {
      let content = fs.readFileSync(envExamplePath, 'utf8');
      if (dataDir) {
        content = content.replace(/^PIA_DATA_DIR=.*$/m, `PIA_DATA_DIR=${resolvedDataDir}`);
      }
      if (generateSecret) {
        const secret = crypto.randomBytes(48).toString('hex');
        content = content.replace(/^PIA_SESSION_SECRET=.*$/m, `PIA_SESSION_SECRET=${secret}`);
      }
      fs.writeFileSync(envPath, content, 'utf8');
      envAction = 'created';
    } else {
      envAction = 'error';
      report.errors.push('Falta .env.example para generar .env.');
    }
  } else if (!checkOnly && generateSecret) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (/^PIA_SESSION_SECRET=CAMBIAR_/m.test(content)) {
      const secret = crypto.randomBytes(48).toString('hex');
      content = content.replace(/^PIA_SESSION_SECRET=.*$/m, `PIA_SESSION_SECRET=${secret}`);
      fs.writeFileSync(envPath, content, 'utf8');
      envAction = 'secret_updated';
    }
  }

  if (fs.existsSync(envPath)) {
    const envRaw = fs.readFileSync(envPath, 'utf8');
    if (/^PIA_SESSION_SECRET=(CAMBIAR_|GENERAR_|)\s*$/m.test(envRaw) || /^PIA_SESSION_SECRET=CAMBIAR_/m.test(envRaw)) {
      report.warnings.push('PIA_SESSION_SECRET en .env aún contiene un valor de plantilla.');
    }
  }
  report.envStatus = envAction;
  log(`  [.ENV] ${envAction.toUpperCase().padEnd(14)} -> ${envPath}`);

  // 3. Archivos operativos en PIA_DATA_DIR (sin sobrescribir existentes)
  const operatorsExamplePath = path.join(rootDir, 'data', 'authorized_operators.example.json');
  const defaultOperators = fs.existsSync(operatorsExamplePath)
    ? JSON.parse(fs.readFileSync(operatorsExamplePath, 'utf8'))
    : [];

  const storageMgr = new StorageConfigManager(resolvedDataDir);
  const storageDefault = storageMgr.getDefaultConfig();

  const operationalTargets = [
    { name: 'users_roles.json', payload: DEFAULT_USERS_SEED },
    { name: 'storage_config.json', payload: storageDefault },
    { name: 'canales_settings.json', payload: DEFAULT_CANALES_SETTINGS },
    { name: 'modules_ui_config.json', payload: DEFAULT_MODULES_UI_CONFIG },
    { name: 'page_visits.json', payload: buildDefaultVisitsSeed() },
    { name: 'audit_logs.json', payload: [] },
    { name: 'authorized_operators.json', payload: defaultOperators }
  ];

  for (const target of operationalTargets) {
    const abs = path.join(resolvedDataDir, target.name);
    let state = 'exists';
    if (!fs.existsSync(abs)) {
      if (checkOnly) {
        state = 'missing';
        report.warnings.push(`Archivo de configuración faltante: ${abs}`);
      } else {
        state = atomicWriteIfMissing(abs, target.payload);
      }
    } else {
      try {
        JSON.parse(fs.readFileSync(abs, 'utf8'));
      } catch (err) {
        state = 'invalid_json';
        report.errors.push(`JSON inválido en ${target.name}: ${err.message}`);
      }
    }
    report.configFiles.push({ file: target.name, status: state });
    log(`  [CFG]  ${state.toUpperCase().padEnd(12)} -> ${target.name}`);
  }

  // 4. Validación de archivos JSON de contenido del portal
  for (const ds of CORE_DATASETS) {
    const abs = path.join(rootDir, ds.relPath);
    if (!fs.existsSync(abs)) {
      report.errors.push(`Dataset faltante: ${ds.relPath}`);
      report.datasets.push({ key: ds.key, file: ds.relPath, status: 'missing', count: 0 });
      log(`  [DATA] MISSING      -> ${ds.relPath}`);
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
      const typeOk = ds.expectedType === 'array'
        ? Array.isArray(parsed)
        : (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed));
      if (!typeOk) {
        report.errors.push(`Estructura inválida en ${ds.relPath} (se esperaba ${ds.expectedType}).`);
        report.datasets.push({ key: ds.key, file: ds.relPath, status: 'invalid_type', count: 0 });
        log(`  [DATA] BAD_TYPE     -> ${ds.relPath}`);
      } else {
        const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        report.datasets.push({ key: ds.key, file: ds.relPath, status: 'ok', count });
        log(`  [DATA] OK           -> ${ds.relPath} (${count} ${Array.isArray(parsed) ? 'registros' : 'claves'})`);
      }
    } catch (err) {
      report.errors.push(`JSON corrupto en ${ds.relPath}: ${err.message}`);
      report.datasets.push({ key: ds.key, file: ds.relPath, status: 'parse_error', count: 0 });
      log(`  [DATA] PARSE_ERROR  -> ${ds.relPath}`);
    }
  }

  // 5. Verificación / Inicialización opcional de MySQL/MariaDB
  if (isSqlConfigured()) {
    if (initSql && !checkOnly) {
      log('\n  [SQL]  Inicializando esquema (18 tablas) + configuración inicial...');
      const sqlInit = await initializeDatabaseSchema();
      report.sqlStatus = sqlInit;
      if (!sqlInit.success) {
        report.errors.push(`Error inicializando SQL: ${sqlInit.error}`);
      } else {
        log(`  [SQL]  OK -> ${sqlInit.database} (${sqlInit.tablesFound}/${sqlInit.totalTables} tablas listas)`);
      }
    } else {
      const status = await inspectSchemaStatus();
      report.sqlStatus = status;
      log(`  [SQL]  ${status.connection?.connected ? 'CONECTADO' : 'SIN CONEXIÓN'} -> ${status.tablesFound || 0}/${status.totalTables || 18} tablas`);
    }
  } else {
    report.sqlStatus = { configured: false, mode: 'json' };
    log('  [SQL]  NO CONFIGURADO -> Operando en modalidad nativa JSON.');
  }

  if (report.warnings.length > 0) {
    warn('\nAdvertencias:');
    for (const w of report.warnings) warn(`  - ${w}`);
  }
  if (report.errors.length > 0) {
    report.success = false;
    warn('\nErrores detectados:');
    for (const e of report.errors) warn(`  - ${e}`);
  } else {
    log('\n[OK] Verificación/inicialización inicial de PIA completada sin errores.');
  }

  return report;
}

function parseArgs(argv) {
  const opts = {
    help: false,
    checkOnly: false,
    generateSecret: false,
    initSql: false,
    quiet: false,
    dataDir: null
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--check' || arg === '--verify') opts.checkOnly = true;
    else if (arg === '--generate-secret') opts.generateSecret = true;
    else if (arg === '--init-sql') opts.initSql = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--data-dir=')) opts.dataDir = arg.split('=')[1]?.trim() || null;
  }
  return opts;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMainModule) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`
Uso: node admin/scripts/init_pia_config.js [opciones]

Inicializa de forma idempotente directorios protegidos, plantilla .env,
archivos de configuración JSON operativa y valida los datasets del Portal PIA.

Opciones:
  --check             Solo verifica estado de directorios, archivos y datasets sin modificar disco.
  --generate-secret   Genera PIA_SESSION_SECRET aleatorio en .env si falta o tiene valor de plantilla.
  --init-sql          Ejecuta sql/01_schema_mysql.sql (18 tablas) + sql/02_seed_initial_config.sql si MySQL está configurado.
  --data-dir=RUTA     Especifica una ruta personalizada para PIA_DATA_DIR.
  --quiet             Modo silencioso.
  -h, --help          Muestra esta ayuda.
`);
    process.exit(0);
  }

  runInitialConfigSetup(opts)
    .then(async (res) => {
      await closeSqlPool().catch(() => {});
      process.exit(res.success ? 0 : 1);
    })
    .catch(async (err) => {
      console.error('[FATAL]', err.message);
      await closeSqlPool().catch(() => {});
      process.exit(1);
    });
}
