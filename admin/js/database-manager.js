// database-manager.js - Gestión de almacenamiento y base de datos (Arquitectura Híbrida JSON + SQL)

import {
  getDbConfig, getAllDatabases, addDatabase,
  updateDatabase, deleteDatabase, assignDatabaseToPage,
  removePageAssignment, setDefaultDatabase, exportDbConfig,
  importDbConfig, DB_TYPES
} from './database-config.js';
import {
  validateJsonSyntax, validateJsonSchema, validateDbEngineConfig
} from './schema-validator.js';
import { syncModuleDataToCloud } from './texts-sync-ui.js';

const AVAILABLE_PAGES = [
  'canales-por-la-integridad',
  'directorio',
  'gobierno_en_numeros',
  'riesgo',
  'vehiculos',
  'index'
];

const PAGE_DETAILS = {
  'canales-por-la-integridad': { label: 'Canales por la Integridad', route: '/canales-por-la-integridad', file: '/canales-por-la-integridad/data_directorio.json', icon: 'fa-comments' },
  'directorio': { label: 'Directorio Ejecutivo de Acceso', route: '/directorio', file: '/directorio/data_acceso.json', icon: 'fa-address-book' },
  'gobierno_en_numeros': { label: 'Tu Gobierno en Números', route: '/gobierno_en_numeros', file: '/gobierno_en_numeros/data_tableros.json', icon: 'fa-chart-bar' },
  'riesgo': { label: 'Riesgo en la Mira', route: '/riesgo', file: '/riesgo/datos.json', icon: 'fa-bullseye' },
  'vehiculos': { label: 'Transparencia Vehicular', route: '/vehiculos', file: '/vehiculos/vehiculos.json', icon: 'fa-car' },
  'index': { label: 'Portal Principal PIA', route: '/', file: '/data_portal.json', icon: 'fa-globe' }
};

const AVAILABLE_JSON_FILES = [
  { path: '/data_portal.json', name: 'data_portal.json', label: 'Portal Principal PIA' },
  { path: '/canales-por-la-integridad/data_directorio.json', name: 'data_directorio.json', label: 'Canales por la Integridad' },
  { path: '/directorio/data_acceso.json', name: 'data_acceso.json', label: 'Directorio Ejecutivo' },
  { path: '/gobierno_en_numeros/data_tableros.json', name: 'data_tableros.json', label: 'Gobierno en Números' },
  { path: '/riesgo/datos.json', name: 'datos.json', label: 'Riesgo en la Mira' },
  { path: '/vehiculos/vehiculos.json', name: 'vehiculos.json', label: 'Placa Transparente' }
];

let currentDbId = null;
let currentJsonPath = null;
let currentTab = 'hybrid';
let storageStatus = null;
let migrationHistory = [];
let installAssets = null;
let draftMode = 'json';
let draftModules = {};
let lastOpReport = null;
let isBusy = false;

const FALLBACK_ENV_TEMPLATE = `PORT=3000
NODE_ENV=production
PIA_SESSION_SECRET=CAMBIAR_POR_LLAVE_SECRETA_ALEATORIA_SEGURA_64_CARACTERES
PIA_DATA_DIR=C:\\PIA_Data

# Modalidad inicial: json | sql | hybrid
PIA_STORAGE_MODE=json
PIA_SQL_MODULES=

# Parámetros MySQL 8.0+ / MariaDB 10.6+ (solo backend)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=pia_app_user
MYSQL_PASSWORD=
MYSQL_DATABASE=pia_db
MYSQL_SSL=false
MYSQL_CONNECTION_LIMIT=10`;

const FALLBACK_SQL_NOTICE = `-- Descarga o abre el archivo sql/01_schema_mysql.sql desde la raíz del proyecto
-- o ejecuta este panel con el servidor Node.js activo para cargar el script completo en vivo.`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAuthHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

async function copyTextToClipboard(text, label = 'Texto') {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast(`${label} copiado al portapapeles`, 'success');
  } catch (_) {
    showToast('No fue posible copiar automáticamente. Seleccione el texto y copie manualmente.', 'error');
  }
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Archivo '${filename}' descargado`, 'success');
}

async function fetchStorageStatus() {
  try {
    const res = await fetch('/api/admin/storage/status', {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      storageStatus = data;
      draftMode = data.config?.mode || 'json';
      draftModules = { ...(data.config?.modules || {}) };

      try {
        const [migRes, assetsRes] = await Promise.all([
          fetch('/api/admin/storage/migrations', {
            headers: getAuthHeaders(),
            cache: 'no-store'
          }),
          fetch('/api/admin/storage/install-assets', {
            headers: getAuthHeaders(),
            cache: 'no-store'
          })
        ]);
        migrationHistory = migRes.ok ? await migRes.json() : [];
        if (assetsRes.ok) {
          installAssets = await assetsRes.json();
        }
      } catch (_) {
        migrationHistory = [];
      }
      return true;
    }
    const errBody = await res.json().catch(() => ({}));
    storageStatus = { offline: false, error: errBody.error || `HTTP ${res.status}` };
    return false;
  } catch (_) {
    storageStatus = { offline: true, error: 'Servidor Node.js no disponible (Modo Local / Descargado).' };
    return false;
  }
}

let activeScriptTab = 'sql';

export async function initDatabaseManager(initialTab = null) {
  if (initialTab) {
    currentTab = initialTab;
  }
  await fetchStorageStatus();
  renderDatabaseManager();
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.dataset.tab === tabName) b.classList.add('active');
    else b.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.add('hidden');
  });
  const targetEl = document.getElementById(tabName + 'Tab');
  if (targetEl) targetEl.classList.remove('hidden');

  if (tabName === 'mockdata') {
    renderMockFiles();
  }
}

function renderOperationReportBox() {
  if (!lastOpReport) return '';
  const isOk = lastOpReport.success !== false;
  const cls = isOk ? 'ok' : 'err';
  const icon = isOk ? 'fa-check-circle' : 'fa-exclamation-triangle';
  const iconColor = isOk ? '#15803D' : '#b91c1c';

  let detailsHtml = '';
  if (Array.isArray(lastOpReport.modules) && lastOpReport.modules.length > 0) {
    detailsHtml = `
      <div class="storage-table-wrap" style="margin-top: 0.75rem; background: #fff;">
        <table class="storage-table">
          <thead>
            <tr>
              <th>Módulo</th>
              ${lastOpReport.direction === 'json_to_sql' ? '<th>Origen JSON</th><th>Insertados</th><th>Actualizados</th><th>Omitidos (Duplicados)</th>' : '<th>Exportados</th><th>Escrito en Disco</th><th>Respaldo</th>'}
              <th>Errores</th>
            </tr>
          </thead>
          <tbody>
            ${lastOpReport.modules.map(m => `
              <tr>
                <td><strong>${escapeHtml(m.module)}</strong></td>
                ${lastOpReport.direction === 'json_to_sql'
                  ? `<td>${Number(m.sourceCount) || 0}</td>
                     <td><span class="pill-source pill-source-sql">${Number(m.inserted) || 0}</span></td>
                     <td>${Number(m.updated) || 0}</td>
                     <td>${Number(m.skipped) || 0}</td>`
                  : `<td><strong>${Number(m.exportedCount) || 0}</strong></td>
                     <td>${m.writtenToDisk ? 'Sí' : 'Descarga'}</td>
                     <td style="font-family:monospace; font-size:0.78rem;">${escapeHtml(m.backupCreated || 'N/A')}</td>`}
                <td>${Array.isArray(m.errors) && m.errors.length > 0 ? `<span class="pill-source pill-source-err">${escapeHtml(m.errors.join('; '))}</span>` : '<span style="color:#15803D; font-weight:700;">0</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="storage-result-box ${cls}" id="storageOperationReport">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
        <div>
          <div style="font-weight:800; color:${iconColor}; display:flex; align-items:center; gap:8px; font-size:0.98rem;">
            <i class="fas ${icon}"></i> ${escapeHtml(lastOpReport.title || 'Resultado de operación')}
          </div>
          <p style="margin:0.35rem 0 0; font-size:0.88rem; color:var(--navy);">${escapeHtml(lastOpReport.message || '')}</p>
          ${lastOpReport.backupFolder ? `<p style="margin:0.35rem 0 0; font-size:0.8rem; color:var(--text-muted); font-family:monospace;"><i class="fas fa-shield-alt"></i> Respaldo previo guardado en: data/backups/${escapeHtml(lastOpReport.backupFolder)}</p>` : ''}
        </div>
        <button type="button" class="btn-icon" id="dismissOpReport" title="Cerrar aviso"><i class="fas fa-times"></i></button>
      </div>
      ${detailsHtml}
    </div>
  `;
}

function renderHybridSqlTab() {
  if (!storageStatus || storageStatus.offline) {
    return `
      <div class="storage-panel">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:0.75rem;">
          <i class="fas fa-laptop-house" style="font-size:1.5rem; color:var(--cyan);"></i>
          <div>
            <h3 style="margin:0; color:var(--navy);">Modo Local / Sin Servidor Node.js Activo</h3>
            <p class="text-muted" style="margin:0;">El portal está operando exclusivamente con archivos JSON locales. Para habilitar la gestión SQL MySQL/MariaDB, ejecute el servidor Express (<code>node server.js</code>).</p>
          </div>
        </div>
      </div>
    `;
  }

  if (storageStatus.error && !storageStatus.schema) {
    return `
      <div class="storage-result-box err">
        <strong><i class="fas fa-exclamation-circle"></i> No fue posible consultar el estado del almacenamiento:</strong> ${escapeHtml(storageStatus.error)}
      </div>
    `;
  }

  const schema = storageStatus.schema || {};
  const conn = schema.connection || {};
  const envConfig = storageStatus.envConfig || {};
  const envConn = envConfig.connection || {};
  const envParams = envConfig.envParameters || {};
  const modules = storageStatus.modules || [];
  const tables = schema.tables || [];
  const activeMode = storageStatus.config?.mode || 'json';

  const totalJsonRows = modules.reduce((acc, m) => acc + (Number(m.jsonCount) || 0), 0);
  const totalSqlRows = modules.reduce((acc, m) => acc + (Number(m.sqlCount) || 0), 0);

  let connBadgeHtml = '<span class="pill-source pill-source-warn"><i class="fas fa-plug"></i> No Configurada</span>';
  let connTitle = 'SQL Opcional (No Configurado)';
  let connSub = 'El sistema funciona 100% con JSON sin requerir servidor SQL.';
  if (conn.configured && conn.connected) {
    connBadgeHtml = '<span class="pill-source pill-source-sql"><i class="fas fa-check-circle"></i> Conectado</span>';
    connTitle = `${conn.engine || 'MySQL/MariaDB'} ${conn.serverVersion || ''}`;
    connSub = `Host: ${conn.hostMasked}:${conn.port} · BD: ${conn.database}`;
  } else if (conn.configured && !conn.connected) {
    connBadgeHtml = '<span class="pill-source pill-source-err"><i class="fas fa-times-circle"></i> Sin Conexión</span>';
    connTitle = 'Error de Conexión SQL';
    connSub = conn.error || 'Verifique servicio MySQL/MariaDB y variables de entorno.';
  }

  const modeLabels = {
    json: 'A. SOLO JSON (Archivo Local)',
    sql: 'B. SOLO SQL (MySQL / MariaDB)',
    hybrid: 'C. HÍBRIDO (Selección por Módulo)'
  };

  return `
    ${renderOperationReportBox()}

    <!-- KPIs de Estado -->
    <div class="storage-kpi-grid">
      <div class="storage-kpi-card">
        <div class="storage-kpi-label"><i class="fas fa-plug" style="color:var(--cyan);"></i> Estado Conexión SQL</div>
        <div class="storage-kpi-value" style="margin-bottom:0.35rem;">${connBadgeHtml}</div>
        <div style="font-weight:700; font-size:0.86rem; color:var(--navy);">${escapeHtml(connTitle)}</div>
        <div class="storage-kpi-sub">${escapeHtml(connSub)}</div>
      </div>

      <div class="storage-kpi-card">
        <div class="storage-kpi-label"><i class="fas fa-table" style="color:var(--cyan);"></i> Tablas SQL Verificadas</div>
        <div class="storage-kpi-value">${Number(schema.tablesFound) || 0} / ${Number(schema.totalTables) || 18}</div>
        <div class="storage-kpi-sub">${schema.ready ? 'Esquema relacional completo y verificado.' : 'Requiere ejecutar inicialización controlada de BD.'}</div>
      </div>

      <div class="storage-kpi-card">
        <div class="storage-kpi-label"><i class="fas fa-random" style="color:var(--cyan);"></i> Modalidad Activa</div>
        <div class="storage-kpi-value" style="font-size:1.05rem;">${escapeHtml(modeLabels[activeMode] || activeMode.toUpperCase())}</div>
        <div class="storage-kpi-sub">Fuente única de lectura y escritura por módulo.</div>
      </div>

      <div class="storage-kpi-card">
        <div class="storage-kpi-label"><i class="fas fa-layer-group" style="color:var(--cyan);"></i> Volumen de Registros</div>
        <div class="storage-kpi-value">${totalJsonRows} JSON · ${totalSqlRows} SQL</div>
        <div class="storage-kpi-sub">Conteo consolidado en los módulos del portal.</div>
      </div>
    </div>

    <!-- Barra de Acciones Controladas -->
    <div class="storage-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
        <div>
          <h3 style="margin:0; color:var(--navy);"><i class="fas fa-tools" style="color:var(--cyan);"></i> Operaciones Controladas de Base de Datos e Intercambio</h3>
          <p class="text-muted" style="margin:0.2rem 0 0;">Las operaciones SQL utilizan transacciones, consultas parametrizadas, validación previa y respaldo automático.</p>
        </div>
        <button type="button" class="btn btn-secondary" id="btnRefreshStorageStatus" ${isBusy ? 'disabled' : ''}>
          <i class="fas fa-sync-alt"></i> Actualizar Estado
        </button>
      </div>

      <div class="storage-btn-toolbar">
        <button type="button" class="btn btn-info-alt" id="btnTestSqlConn" ${isBusy ? 'disabled' : ''}>
          <i class="fas fa-stethoscope"></i> Probar Conexión SQL
        </button>
        <button type="button" class="btn btn-secondary" id="btnReloadSqlEnv" ${isBusy ? 'disabled' : ''} title="Recargar variables .env de MySQL/MariaDB en el servidor">
          <i class="fas fa-redo"></i> Recargar .env
        </button>
        <button type="button" class="btn btn-primary" id="btnOpenInitSqlModal" ${isBusy || !conn.connected ? 'disabled' : ''} title="${!conn.connected ? 'Requiere conexión activa a MySQL/MariaDB' : 'Crear base de datos y tablas si no existen'}">
          <i class="fas fa-database"></i> Inicializar / Verificar Tablas SQL
        </button>
        <button type="button" class="btn btn-success-alt" id="btnOpenImportModal" ${isBusy || !conn.connected || !schema.ready ? 'disabled' : ''}>
          <i class="fas fa-file-import"></i> Importar JSON → SQL
        </button>
        <button type="button" class="btn btn-warning-alt" id="btnOpenExportModal" ${isBusy || !conn.connected || !schema.ready ? 'disabled' : ''}>
          <i class="fas fa-file-export"></i> Exportar SQL → JSON
        </button>
        <button type="button" class="btn btn-secondary" id="btnGoToInstallGuide">
          <i class="fas fa-book-open"></i> Guía y Script de Instalación
        </button>
      </div>
      ${!conn.configured ? `<p style="margin:0.75rem 0 0; font-size:0.82rem; color:#b45309;"><i class="fas fa-info-circle"></i> Nota: Configure las variables <code>MYSQL_HOST</code>, <code>MYSQL_USER</code>, <code>MYSQL_PASSWORD</code> y <code>MYSQL_DATABASE</code> en el archivo <code>.env</code> del servidor para habilitar las operaciones SQL. Consulte la pestaña <strong>Guía de Instalación en Servidor</strong> para obtener el script y los pasos completos.</p>` : ''}
    </div>

    <!-- Configuración de Conexión MySQL / MariaDB (.env - Solo Lectura Segura) -->
    <div class="storage-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.85rem;">
        <div>
          <h3 style="margin:0; color:var(--navy);"><i class="fas fa-server" style="color:var(--cyan);"></i> Configuración de Conexión MySQL / MariaDB (Variables <code>.env</code>)</h3>
          <p class="text-muted" style="margin:0.2rem 0 0;">Parámetros cargados exclusivamente en el servidor mediante <code>admin/database-manager.js</code>. Las credenciales nunca se exponen al navegador.</p>
        </div>
        <span class="pill-source ${envConfig.envFileExists ? 'pill-source-sql' : 'pill-source-warn'}">
          <i class="fas ${envConfig.envFileExists ? 'fa-file-shield' : 'fa-file-circle-exclamation'}"></i>
          ${envConfig.envFileExists ? 'Archivo .env detectado' : 'Sin archivo .env (solo variables de entorno)'}
        </span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:0.75rem;">
          <div style="font-size:0.74rem; color:var(--text-muted); font-weight:700;">HOST (MYSQL_HOST)</div>
          <div style="font-family:monospace; font-weight:700; color:var(--navy); margin-top:0.2rem;">${escapeHtml(envConn.hostMasked || conn.hostMasked || 'No configurado')}</div>
        </div>
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:0.75rem;">
          <div style="font-size:0.74rem; color:var(--text-muted); font-weight:700;">PUERTO (MYSQL_PORT)</div>
          <div style="font-family:monospace; font-weight:700; color:var(--navy); margin-top:0.2rem;">${Number(envConn.port || conn.port || 3306)}</div>
        </div>
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:0.75rem;">
          <div style="font-size:0.74rem; color:var(--text-muted); font-weight:700;">BASE DE DATOS</div>
          <div style="font-family:monospace; font-weight:700; color:var(--navy); margin-top:0.2rem;">${escapeHtml(envConn.database || conn.database || 'pia_db')}</div>
        </div>
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:0.75rem;">
          <div style="font-size:0.74rem; color:var(--text-muted); font-weight:700;">USUARIO / CREDENCIAL</div>
          <div style="font-family:monospace; font-weight:700; color:var(--navy); margin-top:0.2rem;">${escapeHtml(envConn.userMasked || 'No configurado')} · ${envParams.credentialsConfigured ? '<span style="color:#15803D;">Clave en .env</span>' : '<span style="color:#b45309;">Sin clave</span>'}</div>
        </div>
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:0.75rem;">
          <div style="font-size:0.74rem; color:var(--text-muted); font-weight:700;">TLS/SSL · POOL LIMIT</div>
          <div style="font-family:monospace; font-weight:700; color:var(--navy); margin-top:0.2rem;">${envConn.sslEnabled ? 'SSL Activo' : 'SSL Inactivo'} · Máx ${Number(envConn.connectionLimit || 10)}</div>
        </div>
      </div>
      ${Array.isArray(envConfig.validationErrors) && envConfig.validationErrors.length > 0 ? `<div style="margin-top:0.75rem; font-size:0.82rem; color:#b91c1c;"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(envConfig.validationErrors.join(' '))}</div>` : ''}
    </div>

    <!-- Selector de Modalidad y Matriz por Módulo -->
    <div class="storage-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="margin:0; color:var(--navy);"><i class="fas fa-sliders-h" style="color:var(--cyan);"></i> Modalidad de Convivencia (JSON / SQL / HÍBRIDO)</h3>
          <p class="text-muted" style="margin:0.2rem 0 0;">Cada módulo mantiene una única fuente activa para evitar escrituras simultáneas inconsistentes.</p>
        </div>
        <button type="button" class="btn btn-primary" id="btnSaveStorageMode" ${isBusy ? 'disabled' : ''}>
          <i class="fas fa-save"></i> Aplicar Configuración
        </button>
      </div>

      <div class="storage-mode-grid">
        <button type="button" class="storage-mode-option ${draftMode === 'json' ? 'selected' : ''}" data-mode="json">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <strong style="color:var(--navy);"><i class="fas fa-file-code" style="color:var(--blue-bright);"></i> Modalidad A: Solo JSON</strong>
            ${draftMode === 'json' ? '<i class="fas fa-check-circle" style="color:var(--cyan);"></i>' : ''}
          </div>
          <span class="text-muted" style="font-size:0.8rem;">Todos los módulos operan con los archivos JSON originales en disco. Funcional sin servidor SQL.</span>
        </button>

        <button type="button" class="storage-mode-option ${draftMode === 'sql' ? 'selected' : ''}" data-mode="sql">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <strong style="color:var(--navy);"><i class="fas fa-database" style="color:#16a34a;"></i> Modalidad B: Solo SQL</strong>
            ${draftMode === 'sql' ? '<i class="fas fa-check-circle" style="color:var(--cyan);"></i>' : ''}
          </div>
          <span class="text-muted" style="font-size:0.8rem;">Todos los módulos leen y escriben en tablas relacionales MySQL/MariaDB.</span>
        </button>

        <button type="button" class="storage-mode-option ${draftMode === 'hybrid' ? 'selected' : ''}" data-mode="hybrid">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <strong style="color:var(--navy);"><i class="fas fa-code-branch" style="color:#d97706;"></i> Modalidad C: Híbrido</strong>
            ${draftMode === 'hybrid' ? '<i class="fas fa-check-circle" style="color:var(--cyan);"></i>' : ''}
          </div>
          <span class="text-muted" style="font-size:0.8rem;">Permite elegir individualmente qué módulos usan JSON y cuáles usan SQL.</span>
        </button>
      </div>

      <div class="storage-table-wrap">
        <table class="storage-table">
          <thead>
            <tr>
              <th>Módulo del Portal</th>
              <th>Archivo JSON</th>
              <th>Fuente Activa</th>
              <th>Registros JSON</th>
              <th>Registros SQL</th>
              <th>Tablas SQL</th>
              <th>Configuración por Módulo</th>
            </tr>
          </thead>
          <tbody>
            ${modules.map(m => {
              const selectedSrc = draftMode === 'json' ? 'json' : (draftMode === 'sql' ? 'sql' : (draftModules[m.key] || 'json'));
              const activeBadge = m.activeSource === 'sql'
                ? '<span class="pill-source pill-source-sql"><i class="fas fa-database"></i> SQL</span>'
                : '<span class="pill-source pill-source-json"><i class="fas fa-file-code"></i> JSON</span>';
              const sqlReadyBadge = m.sqlReady
                ? '<span class="pill-source pill-source-sql">Listas</span>'
                : '<span class="pill-source pill-source-warn">Pendientes</span>';
              return `
                <tr>
                  <td><strong>${escapeHtml(m.label)}</strong><div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${escapeHtml(m.key)}</div></td>
                  <td style="font-family:monospace; font-size:0.78rem;">${escapeHtml(m.jsonFile)}</td>
                  <td>${activeBadge}</td>
                  <td><strong>${Number(m.jsonCount) || 0}</strong></td>
                  <td><strong>${Number(m.sqlCount) || 0}</strong></td>
                  <td>${sqlReadyBadge}</td>
                  <td>
                    <select class="form-control module-source-select" data-module-key="${escapeHtml(m.key)}" ${draftMode !== 'hybrid' ? 'disabled' : ''} style="padding:0.45rem 0.65rem; font-size:0.84rem; min-width:130px;">
                      <option value="json" ${selectedSrc === 'json' ? 'selected' : ''}>JSON (Archivo)</option>
                      <option value="sql" ${selectedSrc === 'sql' ? 'selected' : ''} ${!m.sqlReady ? 'disabled' : ''}>SQL (MySQL/MariaDB)</option>
                    </select>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Verificación de Tablas y Conteo de Registros SQL -->
    <div class="storage-panel">
      <h3 style="margin:0 0 0.35rem; color:var(--navy);"><i class="fas fa-list-check" style="color:var(--cyan);"></i> Verificación de Tablas y Conteo de Registros SQL</h3>
      <p class="text-muted" style="margin:0 0 1rem;">Estado real en <code>${escapeHtml(conn.database || 'pia_db')}</code> obtenido directamente desde el motor relacional.</p>
      <div class="storage-table-wrap">
        <table class="storage-table">
          <thead>
            <tr>
              <th>Tabla SQL</th>
              <th>Módulo Asociado</th>
              <th>Rol</th>
              <th>Existencia</th>
              <th>Cantidad de Registros</th>
            </tr>
          </thead>
          <tbody>
            ${tables.map(t => `
              <tr>
                <td style="font-family:monospace; font-weight:700;">${escapeHtml(t.table)}</td>
                <td>${escapeHtml(t.label)}</td>
                <td>${t.isChild ? '<span class="text-muted">Relacional / Detalle</span>' : '<strong>Principal</strong>'}</td>
                <td>${t.exists ? '<span class="pill-source pill-source-sql"><i class="fas fa-check"></i> Verificada</span>' : '<span class="pill-source pill-source-warn"><i class="fas fa-clock"></i> No creada</span>'}</td>
                <td><strong>${Number(t.rowCount) || 0}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${Array.isArray(migrationHistory) && migrationHistory.length > 0 ? `
      <div class="storage-panel">
        <h3 style="margin:0 0 0.35rem; color:var(--navy);"><i class="fas fa-history" style="color:var(--cyan);"></i> Historial Reciente de Migraciones JSON ↔ SQL</h3>
        <div class="storage-table-wrap" style="margin-top:0.75rem;">
          <table class="storage-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Dirección</th>
                <th>Módulo</th>
                <th>Política</th>
                <th>Insertados</th>
                <th>Actualizados</th>
                <th>Omitidos</th>
                <th>Errores</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              ${migrationHistory.map(h => `
                <tr>
                  <td style="font-size:0.78rem;">${escapeHtml(new Date(h.executed_at).toLocaleString('es-GT'))}</td>
                  <td>${h.direction === 'json_to_sql' ? 'JSON → SQL' : 'SQL → JSON'}</td>
                  <td><strong>${escapeHtml(h.module_name)}</strong></td>
                  <td>${escapeHtml(h.conflict_mode)}</td>
                  <td>${Number(h.inserted_count) || 0}</td>
                  <td>${Number(h.updated_count) || 0}</td>
                  <td>${Number(h.skipped_count) || 0}</td>
                  <td>${Number(h.error_count) || 0}</td>
                  <td style="font-size:0.78rem;">${escapeHtml(h.executed_by)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function renderInstallGuideTab() {
  const sqlScript = (installAssets && installAssets.sqlScript) ? installAssets.sqlScript : FALLBACK_SQL_NOTICE;
  const sqlSeedScript = (installAssets && installAssets.sqlSeedScript) ? installAssets.sqlSeedScript : '-- Ejecuta el servidor Node.js activo para cargar sql/02_seed_initial_config.sql.';
  const envTemplate = (installAssets && installAssets.envTemplate) ? installAssets.envTemplate : FALLBACK_ENV_TEMPLATE;
  const deployPs1 = (installAssets && installAssets.deployPs1) ? installAssets.deployPs1 : '-- Ejecuta el servidor Node.js activo para cargar deploy-iis.ps1 o ábrelo en la raíz del proyecto.';
  const deployLinuxSh = (installAssets && installAssets.deployLinuxSh) ? installAssets.deployLinuxSh : '# Ejecuta el servidor Node.js activo para cargar deploy-linux.sh o ábrelo en la raíz del proyecto.';
  const webConfig = (installAssets && installAssets.webConfig) ? installAssets.webConfig : '<!-- Ejecuta el servidor Node.js activo para cargar web.config o ábrelo en la raíz del proyecto. -->';
  const migrateScript = (installAssets && installAssets.migrateScript) ? installAssets.migrateScript : '// Ejecuta el servidor Node.js activo para cargar admin/scripts/migrate_json_to_sql.js.';
  const initConfigScript = (installAssets && installAssets.initConfigScript) ? installAssets.initConfigScript : '// Ejecuta el servidor Node.js activo para cargar admin/scripts/init_pia_config.js.';

  const hasLiveSql = Boolean(installAssets && installAssets.sqlScript);
  const hasLiveSqlSeed = Boolean(installAssets && installAssets.sqlSeedScript);
  const hasLivePs1 = Boolean(installAssets && installAssets.deployPs1);
  const hasLiveLinuxSh = Boolean(installAssets && installAssets.deployLinuxSh);
  const hasLiveWebConfig = Boolean(installAssets && installAssets.webConfig);
  const hasLiveMigrate = Boolean(installAssets && installAssets.migrateScript);
  const hasLiveInitCfg = Boolean(installAssets && installAssets.initConfigScript);

  const scriptMeta = {
    sql: {
      title: 'sql/01_schema_mysql.sql',
      subtitle: 'MySQL 8.0+ / MariaDB 10.6+ · InnoDB · utf8mb4_unicode_ci · 18 tablas',
      content: sqlScript,
      fileName: '01_schema_mysql.sql',
      mime: 'application/sql;charset=utf-8'
    },
    sqlseed: {
      title: 'sql/02_seed_initial_config.sql',
      subtitle: 'Semilla idempotente de configuración UI, KPIs, fondos y métricas base del Portal PIA',
      content: sqlSeedScript,
      fileName: '02_seed_initial_config.sql',
      mime: 'application/sql;charset=utf-8'
    },
    initcfg: {
      title: 'admin/scripts/init_pia_config.js',
      subtitle: 'Inicialización y verificación idempotente de directorios, .env, configs JSON y esquema SQL',
      content: initConfigScript,
      fileName: 'init_pia_config.js',
      mime: 'application/javascript;charset=utf-8'
    },
    migrate: {
      title: 'admin/scripts/migrate_json_to_sql.js',
      subtitle: 'Migración masiva CLI de los JSON a SQL con validación de esquema y log por registro',
      content: migrateScript,
      fileName: 'migrate_json_to_sql.js',
      mime: 'application/javascript;charset=utf-8'
    },
    ps1: {
      title: 'deploy-iis.ps1',
      subtitle: 'PowerShell Administrador · ACLs NTFS en C:\\PIA_Data y uploads, AppPool IIS, init_pia_config y Healthcheck',
      content: deployPs1,
      fileName: 'deploy-iis.ps1',
      mime: 'text/plain;charset=utf-8'
    },
    linuxsh: {
      title: 'deploy-linux.sh',
      subtitle: 'Bash Linux (Ubuntu/Debian/RHEL) · Permisos, .env, systemd, Nginx y Healthcheck',
      content: deployLinuxSh,
      fileName: 'deploy-linux.sh',
      mime: 'text/x-shellscript;charset=utf-8'
    },
    webconfig: {
      title: 'web.config',
      subtitle: 'IIS Reverse Proxy (URL Rewrite + ARR), límite 20 MB para fondos, bloqueo .env/.sql/.ps1/.sh/data/db/sql y MIME',
      content: webConfig,
      fileName: 'web.config',
      mime: 'application/xml;charset=utf-8'
    },
    env: {
      title: '.env.example',
      subtitle: 'Plantilla institucional de variables de entorno (solo backend)',
      content: envTemplate,
      fileName: '.env.example',
      mime: 'text/plain;charset=utf-8'
    }
  };
  const activeScript = scriptMeta[activeScriptTab] || scriptMeta.sql;
  const activeLineCount = activeScript.content.split(/\r?\n/).length;

  const cmdInstall = `cd C:\\inetpub\\wwwroot\\PIA\nnpm install --omit=dev\n\n# Inicializar configuración base y carpetas protegidas:\nnpm run setup:init\n\n# Despliegue automatizado completo IIS + C:\\PIA_Data (PowerShell Administrador):\n.\\deploy-iis.ps1`;
  const cmdSessionSecret = `# Generar llave criptográfica segura de 96 caracteres hexadecimales para PIA_SESSION_SECRET:\nnode -e "console.log(require('crypto').randomBytes(48).toString('hex'))"\n\n# O ejecutar el asistente de configuración inicial con generación automática:\nnode admin/scripts/init_pia_config.js --generate-secret`;
  const cmdCreateDbUser = `CREATE DATABASE IF NOT EXISTS \`pia_db\`\n  CHARACTER SET utf8mb4\n  COLLATE utf8mb4_unicode_ci;\n\nCREATE USER IF NOT EXISTS 'pia_app_user'@'localhost' IDENTIFIED BY 'CONTRASEÑA_SEGURA_AQUI';\nGRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER\n  ON \`pia_db\`.* TO 'pia_app_user'@'localhost';\nFLUSH PRIVILEGES;`;
  const cmdRunSqlCli = `# 1. Crear estructura relacional (18 tablas):\nmysql -u pia_app_user -p < sql\\01_schema_mysql.sql\n\n# 2. Cargar configuración inicial (métricas, KPIs, fondos de héroe y banderas):\nmysql -u pia_app_user -p < sql\\02_seed_initial_config.sql`;
  const cmdMigrateCli = `# 1. Simular y validar los archivos JSON contra el esquema SQL sin escribir en BD:\nnpm run migrate:sql:dry-run\n\n# 2. Ejecutar inserción masiva hacia MySQL/MariaDB (crea 18 tablas + semilla + logs en data/migration_logs/):\nnode admin/scripts/migrate_json_to_sql.js --init-schema --include-portal`;
  const cmdService = `# Opción A — PM2 como servicio de Windows:\nnpm install -g pm2 pm2-windows-service\npm2-service-install -n PIA_Portal\npm2 start server.js --name pia-backend --env production\npm2 save\n\n# Opción B — NSSM (Servicio nativo Windows):\nnssm install PIA_Service "C:\\Program Files\\nodejs\\node.exe" "C:\\inetpub\\wwwroot\\PIA\\server.js"\nnssm set PIA_Service AppDirectory "C:\\inetpub\\wwwroot\\PIA"\nnssm start PIA_Service`;
  const cmdLinuxSystemd = `# Opción rápida automatizada en Linux:\nsudo bash deploy-linux.sh --install-systemd\n\n# O manualmente en /etc/systemd/system/pia.service:\n[Unit]\nDescription=Portal de Integridad Activa (PIA) - CNC\nAfter=network.target mysql.service mariadb.service\n\n[Service]\nType=simple\nUser=www-data\nWorkingDirectory=/var/www/pia\nEnvironmentFile=/var/www/pia/.env\nEnvironment=NODE_ENV=production\nExecStart=/usr/bin/node /var/www/pia/server.js\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target`;
  const cmdLinuxNginx = `# /etc/nginx/sites-available/pia (Proxy Inverso + Límite carga imágenes + Bloqueo archivos sensibles)\nserver {\n    listen 80;\n    server_name pia.cnc.gob.gt;\n    client_max_body_size 20M;\n\n    location ~* \\.(env|sql|bak|tmp|ps1|sh)$ { deny all; return 404; }\n    location ^~ /data/ { deny all; return 404; }\n    location ^~ /db/ { deny all; return 404; }\n    location ^~ /sql/ { deny all; return 404; }\n    location ^~ /admin/scripts/ { deny all; return 403; }\n\n    location / {\n        proxy_pass http://127.0.0.1:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}`;
  const cmdBackupRestore = `# Respaldo diario programado de MySQL/MariaDB (PowerShell):\n$fecha = Get-Date -Format "yyyyMMdd_HHmm"\nmysqldump -u pia_app_user -p --single-transaction --routines --triggers pia_db > "C:\\PIA_Backups\\pia_db_$fecha.sql"\n\n# Restauración de emergencia desde respaldo SQL:\nmysql -u pia_app_user -p pia_db < C:\\PIA_Backups\\pia_db_20261118_0200.sql`;
  const cmdVerify = `npm run setup:check\nnpm run lint\nnpm test\n# Verificar módulos, métricas dinámicas y configuración UI:\ncurl http://127.0.0.1:3000/api/modules\ncurl http://127.0.0.1:3000/api/ui/portal`;

  return `
    <!-- Encabezado y paquete completo de descargas -->
    <div class="storage-panel">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="margin:0; color:var(--navy);"><i class="fas fa-server" style="color:var(--cyan);"></i> Guía Completa de Instalación en Servidor (Windows Server / Linux + Node.js + SQL)</h3>
          <p class="text-muted" style="margin:0.35rem 0 0;">
            Procedimiento integral, scripts oficiales de despliegue e infraestructura (18 tablas SQL, semilla inicial e inicializador CLI), configuración de proxy inverso y respaldos.
          </p>
        </div>
        <div class="storage-btn-toolbar">
          <button type="button" class="btn btn-primary" id="btnDownloadSqlScript" ${!hasLiveSql ? 'disabled' : ''}>
            <i class="fas fa-database"></i> 01_schema_mysql.sql
          </button>
          <button type="button" class="btn btn-primary" id="btnDownloadSqlSeedScript" ${!hasLiveSqlSeed ? 'disabled' : ''}>
            <i class="fas fa-seedling"></i> 02_seed_initial_config.sql
          </button>
          <button type="button" class="btn btn-info-alt" id="btnDownloadInitConfigScript" ${!hasLiveInitCfg ? 'disabled' : ''}>
            <i class="fas fa-cogs"></i> init_pia_config.js
          </button>
          <button type="button" class="btn btn-info-alt" id="btnDownloadMigrateScript" ${!hasLiveMigrate ? 'disabled' : ''}>
            <i class="fas fa-file-import"></i> migrate_json_to_sql.js
          </button>
          <button type="button" class="btn btn-info-alt" id="btnDownloadDeployPs1" ${!hasLivePs1 ? 'disabled' : ''}>
            <i class="fas fa-terminal"></i> deploy-iis.ps1
          </button>
          <button type="button" class="btn btn-info-alt" id="btnDownloadDeployLinux" ${!hasLiveLinuxSh ? 'disabled' : ''}>
            <i class="fab fa-linux"></i> deploy-linux.sh
          </button>
          <button type="button" class="btn btn-success-alt" id="btnDownloadWebConfig" ${!hasLiveWebConfig ? 'disabled' : ''}>
            <i class="fas fa-file-code"></i> web.config
          </button>
          <button type="button" class="btn btn-warning-alt" id="btnDownloadEnvTemplate">
            <i class="fas fa-file-alt"></i> .env.example
          </button>
          <button type="button" class="btn btn-secondary" id="btnDownloadFullGuide" ${!(installAssets && installAssets.guideMarkdown) ? 'disabled' : ''}>
            <i class="fas fa-book"></i> Guía (.md)
          </button>
        </div>
      </div>

      <div class="install-guide-grid">
        <div class="install-req-card">
          <strong style="color:var(--navy); display:flex; align-items:center; gap:7px; margin-bottom:0.3rem;"><i class="fab fa-windows" style="color:var(--cyan);"></i> Sistema Operativo</strong>
          <span class="text-muted" style="font-size:0.82rem;">Windows Server 2019 / 2022 (IIS + ARR) o Linux (Ubuntu/Debian/RHEL con Nginx + Systemd).</span>
        </div>
        <div class="install-req-card">
          <strong style="color:var(--navy); display:flex; align-items:center; gap:7px; margin-bottom:0.3rem;"><i class="fab fa-node-js" style="color:#16a34a;"></i> Node.js LTS</strong>
          <span class="text-muted" style="font-size:0.82rem;">Versión 18.x, 20.x o 22.x ejecutando <code>server.js</code> en <code>127.0.0.1:3000</code>.</span>
        </div>
        <div class="install-req-card">
          <strong style="color:var(--navy); display:flex; align-items:center; gap:7px; margin-bottom:0.3rem;"><i class="fas fa-database" style="color:#2B82C9;"></i> Motor SQL Relacional</strong>
          <span class="text-muted" style="font-size:0.82rem;">MySQL 8.0+ o MariaDB 10.6+ (<code>InnoDB</code> + <code>utf8mb4_unicode_ci</code>). Opcional si opera en modo JSON.</span>
        </div>
        <div class="install-req-card">
          <strong style="color:var(--navy); display:flex; align-items:center; gap:7px; margin-bottom:0.3rem;"><i class="fas fa-shield-alt" style="color:#d97706;"></i> Seguridad & Proxy</strong>
          <span class="text-muted" style="font-size:0.82rem;">HTTPS/TLS en puerto <code>443</code>, bloqueo de <code>.env/.sql/data</code> y firewall restringiendo puertos internos.</span>
        </div>
      </div>
    </div>

    <!-- Pasos de Instalación (1 al 9) -->
    <div class="storage-panel">
      <h3 style="margin:0 0 0.25rem; color:var(--navy);"><i class="fas fa-tasks" style="color:var(--cyan);"></i> Procedimiento Completo de Instalación y Puesta en Producción</h3>
      <p class="text-muted" style="margin:0;">Siga los pasos en orden para desplegar la aplicación de forma segura, auditable y sin exposición de credenciales.</p>

      <div class="install-step-list">
        <!-- Paso 1 -->
        <div class="install-step-card">
          <div class="install-step-num">1</div>
          <div class="install-step-body">
            <h4>Ubicar el proyecto, instalar dependencias y preparar carpeta protegida de datos</h4>
            <p class="text-muted" style="margin:0;">Copie el proyecto en <code>C:\\inetpub\\wwwroot\\PIA</code> (Windows) o <code>/var/www/pia</code> (Linux). En Windows Server, el script <code>deploy-iis.ps1</code> automatiza dependencias, creación de <code>C:\\PIA_Data\\backups</code> con permisos NTFS restringidos y el Application Pool <code>PiaAppPool</code>.</p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>PowerShell (Administrador)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep1"><i class="fas fa-copy"></i> Copiar comandos</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep1">${escapeHtml(cmdInstall)}</pre>
            </div>
          </div>
        </div>

        <!-- Paso 2 -->
        <div class="install-step-card">
          <div class="install-step-num">2</div>
          <div class="install-step-body">
            <h4>Generar <code>PIA_SESSION_SECRET</code> y configurar <code>.env</code> (Solo Backend)</h4>
            <p class="text-muted" style="margin:0;">Copie <code>.env.example</code> hacia <code>.env</code>, genere una llave secreta única de sesión y configure <code>PIA_DATA_DIR</code>, <code>PIA_STORAGE_MODE</code> y las credenciales MySQL/MariaDB. <strong>Nunca guarde contraseñas en el navegador ni en archivos JSON públicos.</strong></p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Generador seguro de llave criptográfica (Node.js)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep2a"><i class="fas fa-copy"></i> Copiar comando</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep2a">${escapeHtml(cmdSessionSecret)}</pre>
            </div>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Plantilla .env.example (variables de servidor)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep2"><i class="fas fa-copy"></i> Copiar plantilla .env</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep2" style="max-height:200px; overflow-y:auto;">${escapeHtml(envTemplate)}</pre>
            </div>
          </div>
        </div>

        <!-- Paso 3 -->
        <div class="install-step-card">
          <div class="install-step-num">3</div>
          <div class="install-step-body">
            <h4>Crear base de datos y usuario SQL con privilegios mínimos</h4>
            <p class="text-muted" style="margin:0;">Ejecute en MySQL/MariaDB como DBA para crear <code>pia_db</code> y la cuenta dedicada <code>pia_app_user</code> restringida únicamente a los privilegios requeridos por PIA.</p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>SQL (MySQL 8.0+ / MariaDB 10.6+)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep3"><i class="fas fa-copy"></i> Copiar SQL de usuario</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep3">${escapeHtml(cmdCreateDbUser)}</pre>
            </div>
          </div>
        </div>

        <!-- Paso 4 -->
        <div class="install-step-card">
          <div class="install-step-num">4</div>
          <div class="install-step-body">
            <h4>Ejecutar Creación de Tablas (18 tablas relacionales) y Semilla Inicial</h4>
            <p class="text-muted" style="margin:0;">Ejecute <code>sql/01_schema_mysql.sql</code> y <code>sql/02_seed_initial_config.sql</code> desde consola MySQL o utilice el botón <strong>Inicializar / Verificar Tablas SQL</strong> en <strong>Almacenamiento Híbrido y SQL</strong> (idempotente).</p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Consola MySQL / PowerShell</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep4"><i class="fas fa-copy"></i> Copiar comando</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep4">${escapeHtml(cmdRunSqlCli)}</pre>
            </div>
          </div>
        </div>

        <!-- Paso 5 -->
        <div class="install-step-card">
          <div class="install-step-num">5</div>
          <div class="install-step-body">
            <h4>Importar datos iniciales JSON → SQL (Panel Web o Script CLI en <code>admin/scripts</code>)</h4>
            <p class="text-muted" style="margin:0;">Desde <strong>Almacenamiento Híbrido y SQL</strong> (botón <strong>Importar JSON → SQL</strong>) o desde consola mediante el script masivo <code>admin/scripts/migrate_json_to_sql.js</code>, el cual valida los 5 archivos JSON contra las columnas SQL e inserta en lote generando logs detallados por registro.</p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Script CLI de Migración Masiva (admin/scripts/migrate_json_to_sql.js)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep5"><i class="fas fa-copy"></i> Copiar comandos</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep5">${escapeHtml(cmdMigrateCli)}</pre>
            </div>
            <div style="margin-top:0.65rem;">
              <button type="button" class="btn btn-primary" id="btnBackToHybridFromGuide" style="font-size:0.84rem; padding:0.5rem 0.95rem;">
                <i class="fas fa-sliders-h"></i> Ir a Almacenamiento Híbrido y SQL
              </button>
            </div>
          </div>
        </div>

        <!-- Paso 6 -->
        <div class="install-step-card">
          <div class="install-step-num">6</div>
          <div class="install-step-body">
            <h4>Windows Server: Proxy Inverso IIS (URL Rewrite + ARR), SSL/HTTPS y Servicio Permanente</h4>
            <p class="text-muted" style="margin:0;">
              1) Instale <strong>URL Rewrite 2.1</strong> y <strong>Application Request Routing (ARR 3.0)</strong>.<br>
              2) En IIS → nodo del servidor → <em>Application Request Routing Cache → Server Proxy Settings</em> → marque <strong>Enable proxy</strong>.<br>
              3) Use el archivo <code>web.config</code> incluido (enruta <code>/api/*</code>, <code>/admin/*</code> y los 6 JSON hacia <code>127.0.0.1:3000</code> y bloquea <code>.env</code>, <code>.sql</code>, <code>.bak</code> y <code>data/</code>).<br>
              4) Instale el certificado SSL/TLS en el puerto 443 y registre el servicio permanente con PM2 o NSSM:
            </p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Servicio Permanente Windows (PM2 / NSSM)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep6a"><i class="fas fa-copy"></i> Copiar comandos</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep6a">${escapeHtml(cmdService)}</pre>
            </div>
          </div>
        </div>

        <!-- Paso 7 -->
        <div class="install-step-card">
          <div class="install-step-num">7</div>
          <div class="install-step-body">
            <h4>Alternativa Linux Server (Ubuntu / Debian / RHEL): Systemd + Nginx</h4>
            <p class="text-muted" style="margin:0;">Si el servidor institucional utiliza Linux en lugar de Windows/IIS, configure la unidad <code>systemd</code> y el proxy inverso Nginx bloqueando archivos sensibles:</p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Unidad Systemd (/etc/systemd/system/pia.service)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep7a"><i class="fas fa-copy"></i> Copiar unidad</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep7a">${escapeHtml(cmdLinuxSystemd)}</pre>
            </div>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Nginx Reverse Proxy (/etc/nginx/sites-available/pia)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep7b"><i class="fas fa-copy"></i> Copiar Nginx</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep7b">${escapeHtml(cmdLinuxNginx)}</pre>
            </div>
          </div>
        </div>

        <!-- Paso 8 -->
        <div class="install-step-card">
          <div class="install-step-num">8</div>
          <div class="install-step-body">
            <h4>Endurecimiento de Red (Firewall), Cambio de Claves Iniciales y Respaldos Programados</h4>
            <p class="text-muted" style="margin:0;">
              • <strong>Firewall:</strong> Permitir únicamente <code>80/TCP</code> y <code>443/TCP</code> desde el exterior. Bloquear acceso externo a <code>3000/TCP</code> (Node.js) y <code>3306/TCP</code> (MySQL/MariaDB).<br>
              • <strong>Cuentas iniciales:</strong> Al finalizar la instalación, ingrese a <strong>Usuarios</strong> en este panel y actualice las contraseñas iniciales de las cuentas <code>@cnc.gob.gt</code>.<br>
              • <strong>Respaldos programados:</strong> Programe respaldo diario de MySQL (<code>mysqldump</code>) y de la carpeta <code>PIA_DATA_DIR</code> (<code>C:\\PIA_Data</code>):
            </p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Respaldo y Restauración SQL (mysqldump / mysql)</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep8"><i class="fas fa-copy"></i> Copiar script</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep8">${escapeHtml(cmdBackupRestore)}</pre>
            </div>
          </div>
        </div>

        <!-- Paso 9 -->
        <div class="install-step-card">
          <div class="install-step-num">9</div>
          <div class="install-step-body">
            <h4>Verificación Integral Post-Instalación</h4>
            <p class="text-muted" style="margin:0;">Ejecute la suite automatizada de seguridad y regresión para validar autenticación, protección de rutas, mappers SQL/JSON, endpoints públicos y ausencia de secretos expuestos:</p>
            <div class="install-code-wrap">
              <div class="install-code-header">
                <span>Verificación post-instalación</span>
                <button type="button" class="btn-copy-mini" data-copy-id="codeInstallStep9"><i class="fas fa-copy"></i> Copiar verificación</button>
              </div>
              <pre class="install-code-pre" id="codeInstallStep9">${escapeHtml(cmdVerify)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Visor Interactivo de Todos los Scripts Oficiales del Servidor -->
    <div class="storage-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:0.85rem;">
        <div>
          <h3 style="margin:0; color:var(--navy);"><i class="fas fa-code" style="color:var(--cyan);"></i> Visor Oficial de Scripts y Plantillas de Servidor</h3>
          <p class="text-muted" style="margin:0.2rem 0 0;">Inspeccione, copie o descargue cualquiera de los 5 archivos críticos de instalación, migración masiva y despliegue en servidor.</p>
        </div>
        <div class="storage-btn-toolbar">
          <button type="button" class="btn btn-info-alt" data-copy-id="codeActiveServerScript">
            <i class="fas fa-copy"></i> Copiar ${escapeHtml(activeScript.fileName)}
          </button>
          <button type="button" class="btn btn-primary" id="btnDownloadActiveScript">
            <i class="fas fa-download"></i> Descargar ${escapeHtml(activeScript.fileName)}
          </button>
        </div>
      </div>

      <div class="script-subtabs" style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.85rem;">
        <button type="button" class="btn ${activeScriptTab === 'sql' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="sql" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fas fa-database"></i> 01_schema_mysql.sql
        </button>
        <button type="button" class="btn ${activeScriptTab === 'sqlseed' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="sqlseed" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fas fa-seedling"></i> 02_seed_initial_config.sql
        </button>
        <button type="button" class="btn ${activeScriptTab === 'initcfg' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="initcfg" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fas fa-cogs"></i> init_pia_config.js
        </button>
        <button type="button" class="btn ${activeScriptTab === 'migrate' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="migrate" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fas fa-file-import"></i> migrate_json_to_sql.js
        </button>
        <button type="button" class="btn ${activeScriptTab === 'ps1' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="ps1" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fas fa-terminal"></i> deploy-iis.ps1
        </button>
        <button type="button" class="btn ${activeScriptTab === 'linuxsh' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="linuxsh" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fab fa-linux"></i> deploy-linux.sh
        </button>
        <button type="button" class="btn ${activeScriptTab === 'webconfig' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="webconfig" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fas fa-server"></i> web.config (IIS)
        </button>
        <button type="button" class="btn ${activeScriptTab === 'env' ? 'btn-primary' : 'btn-secondary'} script-subtab-btn" data-script-tab="env" style="font-size:0.82rem; padding:0.45rem 0.9rem;">
          <i class="fas fa-key"></i> .env.example
        </button>
      </div>

      <div class="install-code-wrap">
        <div class="install-code-header">
          <span>${escapeHtml(activeScript.title)} · ${escapeHtml(activeScript.subtitle)}</span>
          <span>${activeLineCount} líneas</span>
        </div>
        <pre class="install-code-pre install-sql-viewer" id="codeActiveServerScript">${escapeHtml(activeScript.content)}</pre>
      </div>
    </div>
  `;
}

function renderDatabaseManager() {
  const config = getDbConfig();
  const databases = getAllDatabases();
  const sqlConnected = Boolean(storageStatus?.schema?.connection?.connected);
  const activeMode = storageStatus?.config?.mode || 'json';

  const html = `
    <div class="db-manager-container" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
      <div class="db-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="color: var(--navy); font-family: var(--font-head); font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 0.2rem;">
            <i class="fas fa-database" style="color: var(--cyan);"></i> Gestión de almacenamiento y base de datos
          </h2>
          <p class="text-muted" style="font-size: 0.92rem;">
            Administración híbrida JSON + SQL (MySQL/MariaDB), verificación de tablas, migración controlada y edición de ficheros JSON locales.
          </p>
        </div>
        <div class="db-actions" style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary" id="addNewDb" style="padding: 0.65rem 1rem; font-weight: 700;"><i class="fas fa-plus"></i> Nuevo Almacén JSON</button>
          <button class="btn btn-secondary" id="exportConfig" style="padding: 0.65rem 1rem;"><i class="fas fa-download"></i> Exportar Config</button>
          <button class="btn btn-secondary" id="importConfig" style="padding: 0.65rem 1rem;"><i class="fas fa-upload"></i> Importar Config</button>
        </div>
      </div>

      <!-- Banner informativo sobre convivencia JSON + SQL -->
      <div style="background: linear-gradient(135deg, rgba(0,194,224,0.08), rgba(43,130,201,0.08)); border: 1px solid rgba(0,194,224,0.25); padding: 1rem 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 14px;">
        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(0,194,224,0.15); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
          <i class="fas fa-shield-alt"></i>
        </div>
        <div style="font-size: 0.88rem; color: var(--navy); line-height: 1.4;">
          <strong>Arquitectura Híbrida Institucional (Modo actual: ${escapeHtml(activeMode.toUpperCase())}):</strong>
          Los cinco archivos JSON originales y sus rutas públicas se conservan intactos. ${sqlConnected ? 'El motor MySQL/MariaDB está en línea y disponible para migración u operación híbrida.' : 'Mientras SQL no sea activado, todos los módulos continúan operando de forma nativa sobre JSON sin dependencias externas.'}
        </div>
      </div>

      <div class="db-tabs" style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; flex-wrap: wrap;">
        <button class="tab-btn ${currentTab === 'hybrid' ? 'active' : ''}" data-tab="hybrid">
          <i class="fas fa-database"></i> Almacenamiento Híbrido y SQL
        </button>
        <button class="tab-btn ${currentTab === 'installguide' ? 'active' : ''}" data-tab="installguide">
          <i class="fas fa-book-open"></i> Guía de Instalación en Servidor
        </button>
        <button class="tab-btn ${currentTab === 'mockdata' ? 'active' : ''}" data-tab="mockdata">
          <i class="fas fa-file-code"></i> Editor Directo JSON
        </button>
        <button class="tab-btn ${currentTab === 'databases' ? 'active' : ''}" data-tab="databases">
          <i class="fas fa-server"></i> Catálogo JSON (${databases.length})
        </button>
        <button class="tab-btn ${currentTab === 'assignments' ? 'active' : ''}" data-tab="assignments">
          <i class="fas fa-link"></i> Asignación por Página (${Object.keys(config.pageDatabaseMap).length}/${AVAILABLE_PAGES.length})
        </button>
        <button class="tab-btn ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
          <i class="fas fa-cog"></i> Configuración Local
        </button>
      </div>

      <div class="tab-content ${currentTab === 'hybrid' ? '' : 'hidden'}" id="hybridTab">
        ${renderHybridSqlTab()}
      </div>

      <div class="tab-content ${currentTab === 'installguide' ? '' : 'hidden'}" id="installguideTab">
        ${renderInstallGuideTab()}
      </div>

      <div class="tab-content ${currentTab === 'databases' ? '' : 'hidden'}" id="databasesTab">
        <div class="db-list" id="databaseList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.25rem;">
          ${renderDatabaseList(databases, config.defaultDatabase)}
        </div>
      </div>

      <div class="tab-content ${currentTab === 'assignments' ? '' : 'hidden'}" id="assignmentsTab">
        <div class="assignments-container" style="background: var(--card-bg); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(5,17,31,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="color: var(--navy); margin-bottom: 0.25rem; font-family: var(--font-head); font-weight: 700;"><i class="fas fa-link" style="color: var(--cyan);"></i> Asignación Homogénea de Datos a Módulos</h3>
              <p class="text-muted" style="font-size: 0.88rem;">Selecciona la fuente o fichero JSON asignado a cada sección pública del Portal PIA.</p>
            </div>
            <span class="badge badge-success" style="padding: 6px 14px; font-size: 0.85rem;"><i class="fas fa-check-circle"></i> ${Object.keys(config.pageDatabaseMap).length} de ${AVAILABLE_PAGES.length} Módulos Conectados</span>
          </div>
          <div class="page-assignments" id="pageAssignments" style="display: flex; flex-direction: column; gap: 1rem;">
            ${renderPageAssignments(config.pageDatabaseMap, databases)}
          </div>
        </div>
      </div>

      <div class="tab-content ${currentTab === 'mockdata' ? '' : 'hidden'}" id="mockdataTab">
        <div class="mockdata-container">
          <h3 style="color: var(--navy); margin-bottom: 0.25rem;"><i class="fas fa-edit" style="color: var(--cyan);"></i> Edición Directa de Ficheros JSON del Portal</h3>
          <p class="text-muted" style="margin-bottom: 1.25rem;">Modifica los registros en formato JSON directo. Cualquier cambio se guardará atómicamente con respaldo previo y registro en la Bitácora de Auditoría.</p>
          <div class="mock-files" id="mockFiles" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.25rem;"></div>
        </div>
      </div>

      <div class="tab-content ${currentTab === 'settings' ? '' : 'hidden'}" id="settingsTab">
        <div class="settings-container" style="background: var(--card-bg); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="color: var(--navy); margin-bottom: 0.25rem;"><i class="fas fa-cogs" style="color: var(--cyan);"></i> Configuración del Motor JSON Local</h3>
              <p class="text-muted">Motor primario de respuesta para modo local / offline.</p>
            </div>
            <button class="btn btn-secondary" id="resetDefaultDbConfig"><i class="fas fa-undo"></i> Restablecer Catálogo por Defecto</button>
          </div>

          <div class="form-group" style="max-width: 550px;">
            <label style="font-weight: 700; color: var(--navy);">Motor Principal por Defecto</label>
            <select class="form-control" id="defaultDbSelect" style="padding: 0.7rem 1rem;">
              <option value="">-- Seleccionar Motor --</option>
              ${databases.map(db => `<option value="${escapeHtml(db.id)}" ${config.defaultDatabase === db.id ? 'selected' : ''}>${escapeHtml(db.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DE NUEVO / EDITAR ALMACÉN JSON -->
    <div class="modal" id="dbModal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modalTitle">Nuevo Almacén de Datos JSON</h3>
          <button class="modal-close" id="modalClose">&times;</button>
        </div>
        <div class="modal-body" id="modalBody"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modalCancel">Cancelar</button>
          <button class="btn btn-primary" id="modalSave">Guardar Almacén</button>
        </div>
      </div>
    </div>

    <!-- MODAL EDITOR JSON -->
    <div class="modal" id="jsonEditorModal" style="display: none;">
      <div class="modal-content" style="max-width: 850px;">
        <div class="modal-header">
          <h3 id="jsonModalTitle">Editar Fichero JSON</h3>
          <button class="modal-close" id="jsonModalClose">&times;</button>
        </div>
        <div class="modal-body">
          <div id="jsonEditorContainer"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="jsonModalCancel">Cancelar</button>
          <button class="btn btn-primary" id="jsonModalSave"><i class="fas fa-save"></i> Guardar Cambios</button>
        </div>
      </div>
    </div>

    <!-- MODAL OPERACIONES SQL / MIGRACIÓN CONTROLADA -->
    <div class="modal" id="sqlActionModal" style="display: none;">
      <div class="modal-content" style="max-width: 640px;">
        <div class="modal-header">
          <h3 id="sqlModalTitle">Operación Controlada SQL</h3>
          <button class="modal-close" id="sqlModalClose">&times;</button>
        </div>
        <div class="modal-body" id="sqlModalBody"></div>
        <div class="modal-footer" id="sqlModalFooter">
          <button class="btn btn-secondary" id="sqlModalCancel">Cancelar</button>
          <button class="btn btn-primary" id="sqlModalConfirm">Confirmar Operación</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('contentArea').innerHTML = html;
  setupEventListeners();
  if (currentTab === 'mockdata') {
    renderMockFiles();
  }
}

function renderDatabaseList(databases, defaultDbId) {
  if (databases.length === 0) {
    return '<p class="text-muted" style="padding: 1.5rem; text-align: center;">No hay almacenes configurados en el catálogo.</p>';
  }

  return databases.map(db => {
    const typeInfo = DB_TYPES[db.type] || { name: db.type, icon: 'fa-file-code' };
    return `
      <div class="db-card" data-id="${escapeHtml(db.id)}" style="background: var(--card-bg); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border); box-shadow: 0 2px 10px rgba(5,17,31,0.04); display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 40px; height: 40px; background: rgba(0,194,224,0.12); color: var(--cyan); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                <i class="fas ${typeInfo.icon}"></i>
              </div>
              <div>
                <strong style="font-size: 0.98rem; color: var(--navy); display: block;">${escapeHtml(db.name)}</strong>
                <span class="badge badge-info" style="font-size: 0.72rem;">${escapeHtml(typeInfo.name)}</span>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="btn-icon edit-db" data-id="${escapeHtml(db.id)}" title="Editar"><i class="fas fa-pen"></i></button>
              <button class="btn-icon delete-db" data-id="${escapeHtml(db.id)}" title="Eliminar"><i class="fas fa-trash"></i></button>
              ${defaultDbId === db.id ? '<span class="badge badge-success" style="font-size: 0.7rem;">Principal</span>' : ''}
            </div>
          </div>

          <p style="font-size: 0.83rem; color: var(--text-muted); margin-bottom: 0.75rem; line-height: 1.4;">${escapeHtml(db.description || 'Almacén de datos JSON para el portal.')}</p>

          <div style="background: var(--surface); padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.8rem; color: var(--navy); font-family: monospace; margin-bottom: 0.75rem; word-break: break-all; border: 1px solid var(--border);">
            <i class="fas fa-folder-open" style="color: var(--cyan); margin-right: 4px;"></i> ${escapeHtml(db.filePath)}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.65rem; margin-top: 0.5rem; font-size: 0.78rem;">
          <span style="color: var(--green); font-weight: 700;"><i class="fas fa-check-circle"></i> Sincronizado</span>
          <span style="color: var(--text-muted);">${escapeHtml(db.syncMode || 'JSON Atómico')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderPageAssignments(pageMap, databases) {
  return AVAILABLE_PAGES.map(page => {
    const dbId = pageMap[page];
    const assignedDb = databases.find(db => db.id === dbId);
    const info = PAGE_DETAILS[page] || { label: page, route: page, file: 'N/A', icon: 'fa-file-alt' };

    return `
      <div class="page-assignment" data-page="${escapeHtml(page)}" style="background: var(--surface); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
        <div class="page-info" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
          <div style="width: 44px; height: 44px; background: rgba(0,194,224,0.12); color: var(--cyan); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
            <i class="fas ${info.icon}"></i>
          </div>
          <div>
            <strong style="font-size: 1.02rem; color: var(--navy); display: block; font-family: var(--font-head);">${escapeHtml(info.label)}</strong>
            <div style="display: flex; gap: 10px; align-items: center; margin-top: 2px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;"><i class="fas fa-link"></i> ${escapeHtml(info.route)}</span>
              <span style="font-size: 0.8rem; color: var(--blue-bright); font-family: monospace;"><i class="fas fa-file-code"></i> ${escapeHtml(info.file)}</span>
            </div>
            <div style="margin-top: 6px;">
              ${assignedDb ? `<span class="badge badge-success" style="font-size: 0.75rem; padding: 3px 10px;"><i class="fas fa-database"></i> Motor Asignado: <strong>${escapeHtml(assignedDb.name)}</strong></span>` : '<span style="font-size: 0.75rem; color: var(--red); font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> Sin asignación</span>'}
            </div>
          </div>
        </div>
        <div class="assignment-select" style="min-width: 280px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: var(--navy); display: block; margin-bottom: 4px;">Seleccionar Motor JSON:</label>
          <select class="form-control page-db-select" data-page="${escapeHtml(page)}" style="padding: 0.65rem 0.9rem; font-weight: 600; border-radius: 10px; width: 100%;">
            <option value="">-- Sin Asignar --</option>
            ${databases.map(db => `<option value="${escapeHtml(db.id)}" ${dbId === db.id ? 'selected' : ''}>${escapeHtml(db.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }).join('');
}

async function renderMockFiles() {
  const container = document.getElementById('mockFiles');
  if (!container) return;

  container.innerHTML = '<p class="text-muted">Cargando ficheros JSON...</p>';

  const filePromises = AVAILABLE_JSON_FILES.map(async f => {
    let preview = 'Sin datos';
    try {
      const res = await fetch(`/api/raw-json?path=${encodeURIComponent(f.path)}`, {
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (res.ok) {
        const resData = await res.json();
        preview = JSON.stringify(resData).substring(0, 110) + '...';
      } else if (window.PiaDataEngine) {
        const data = await window.PiaDataEngine.fetchRawJson(f.path);
        if (data) preview = JSON.stringify(data).substring(0, 110) + '...';
      }
    } catch {
      preview = 'No se pudo leer el archivo';
    }

    return `
      <div class="mock-file-card" data-path="${escapeHtml(f.path)}" style="background: var(--card-bg); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(5,17,31,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-file-code" style="font-size: 1.5rem; color: var(--cyan);"></i>
            <div>
              <strong style="color: var(--navy); font-size: 0.95rem;">${escapeHtml(f.name)}</strong>
              <span style="display: block; font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(f.label)}</span>
            </div>
          </div>
          <button class="btn btn-primary edit-json-btn" data-path="${escapeHtml(f.path)}" style="padding: 0.45rem 0.85rem; font-size: 0.82rem;">
            <i class="fas fa-edit"></i> Editar JSON
          </button>
        </div>
        <div style="background: var(--surface); padding: 0.65rem; border-radius: 8px; border: 1px solid var(--border); font-family: monospace; font-size: 0.75rem; color: var(--navy); overflow: hidden;">
          <pre style="margin: 0;">${escapeHtml(preview)}</pre>
        </div>
      </div>
    `;
  });

  const htmlArray = await Promise.all(filePromises);
  container.innerHTML = htmlArray.join('');

  document.querySelectorAll('.edit-json-btn').forEach(btn => {
    btn.addEventListener('click', () => openJsonEditor(btn.dataset.path));
  });
}

// ============================================================================
// OPERACIONES CONTROLADAS SQL Y MIGRACIÓN JSON <-> SQL
// ============================================================================

function openSqlActionModal({ title, bodyHtml, confirmLabel = 'Confirmar', confirmClass = 'btn-primary', onConfirm }) {
  const modal = document.getElementById('sqlActionModal');
  const titleEl = document.getElementById('sqlModalTitle');
  const bodyEl = document.getElementById('sqlModalBody');
  const confirmBtn = document.getElementById('sqlModalConfirm');
  const cancelBtn = document.getElementById('sqlModalCancel');
  const closeBtn = document.getElementById('sqlModalClose');
  if (!modal || !titleEl || !bodyEl || !confirmBtn) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  confirmBtn.className = `btn ${confirmClass}`;
  confirmBtn.innerHTML = confirmLabel;
  confirmBtn.disabled = false;

  const closeSqlModal = () => {
    modal.style.display = 'none';
  };

  if (closeBtn) closeBtn.onclick = closeSqlModal;
  if (cancelBtn) cancelBtn.onclick = closeSqlModal;
  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    const prevHtml = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    try {
      const shouldClose = await onConfirm(closeSqlModal);
      if (shouldClose !== false) closeSqlModal();
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = prevHtml;
    }
  };

  modal.style.display = 'flex';
}

async function handleTestSqlConnection() {
  if (isBusy) return;
  isBusy = true;
  renderDatabaseManager();
  try {
    const res = await fetch('/api/admin/storage/sql/test', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    await fetchStorageStatus();
    if (res.ok && data.success) {
      lastOpReport = {
        success: true,
        title: 'Conexión SQL verificada exitosamente',
        message: `Motor ${data.connection?.engine || 'MySQL'} (${data.connection?.serverVersion || ''}) accesible en ${data.connection?.hostMasked}:${data.connection?.port}. Tablas verificadas: ${data.schema?.tablesFound || 0}/${data.schema?.totalTables || 14}.`
      };
      showToast('Conexión MySQL/MariaDB activa y verificada', 'success');
    } else {
      lastOpReport = {
        success: false,
        title: 'Diagnóstico de conexión SQL',
        message: data.connection?.error || data.error || 'No se pudo conectar con MySQL/MariaDB.'
      };
      showToast(lastOpReport.message, 'error');
    }
  } catch (err) {
    lastOpReport = {
      success: false,
      title: 'Error probando conexión SQL',
      message: err.message
    };
    showToast(err.message, 'error');
  } finally {
    isBusy = false;
    renderDatabaseManager();
  }
}

async function handleReloadSqlEnv() {
  if (isBusy) return;
  isBusy = true;
  renderDatabaseManager();
  try {
    const res = await fetch('/api/admin/storage/sql/reload-env', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    await fetchStorageStatus();
    if (res.ok && data.success) {
      lastOpReport = {
        success: Boolean(data.connected),
        title: data.reloaded ? 'Variables .env recargadas en el servidor' : 'Estado de entorno .env verificado',
        message: data.connected
          ? `Conexión activa con ${data.connection?.engine || 'MySQL'} (${data.connection?.hostMasked}:${data.connection?.port}).`
          : (data.connection?.error || 'Variables recargadas; servidor MySQL/MariaDB no configurado o sin conexión.')
      };
      showToast(data.connected ? 'Variables .env recargadas y conexión activa' : 'Variables de entorno verificadas', data.connected ? 'success' : 'info');
    } else {
      lastOpReport = {
        success: false,
        title: 'Error recargando variables .env',
        message: data.error || 'No fue posible recargar la configuración de entorno SQL.'
      };
      showToast(lastOpReport.message, 'error');
    }
  } catch (err) {
    lastOpReport = {
      success: false,
      title: 'Error recargando variables .env',
      message: err.message
    };
    showToast(err.message, 'error');
  } finally {
    isBusy = false;
    renderDatabaseManager();
  }
}

function handleOpenInitSqlModal() {
  const dbName = storageStatus?.schema?.connection?.database || 'pia_db';
  openSqlActionModal({
    title: 'Inicialización Controlada de Base de Datos SQL',
    confirmLabel: '<i class="fas fa-database"></i> Ejecutar Inicialización',
    confirmClass: 'btn-primary',
    bodyHtml: `
      <div style="background:rgba(0,194,224,0.08); border:1px solid rgba(0,194,224,0.25); padding:1rem; border-radius:12px; margin-bottom:1rem;">
        <strong style="color:var(--navy); display:block; margin-bottom:0.35rem;"><i class="fas fa-info-circle" style="color:var(--cyan);"></i> Proceso Idempotente y Seguro</strong>
        <p style="margin:0; font-size:0.86rem; color:var(--navy);">Se verificará y creará la base de datos <code>${escapeHtml(dbName)}</code> junto con las 14 tablas relacionales, llaves foráneas e índices mediante <code>CREATE TABLE IF NOT EXISTS</code>. <strong>No elimina ni sobrescribe registros existentes.</strong></p>
      </div>
      <div class="form-check">
        <input type="checkbox" id="confirmInitSqlCheck" class="form-check-input" checked />
        <label for="confirmInitSqlCheck" class="form-check-label">Confirmo ejecutar la inicialización/verificación estructural en SQL.</label>
      </div>
    `,
    onConfirm: async () => {
      const checked = document.getElementById('confirmInitSqlCheck')?.checked;
      if (!checked) {
        showToast('Debe confirmar la ejecución para continuar.', 'error');
        return false;
      }
      isBusy = true;
      try {
        const res = await fetch('/api/admin/storage/sql/init', {
          method: 'POST',
          headers: getAuthHeaders()
        });
        const data = await res.json().catch(() => ({}));
        await fetchStorageStatus();
        if (res.ok && data.success) {
          lastOpReport = {
            success: true,
            title: 'Base de datos SQL inicializada y verificada',
            message: data.message || 'Tablas creadas y verificadas correctamente.'
          };
          showToast(lastOpReport.title, 'success');
        } else {
          lastOpReport = {
            success: false,
            title: 'Error en inicialización SQL',
            message: data.error || 'No fue posible inicializar la estructura SQL.'
          };
          showToast(lastOpReport.message, 'error');
        }
      } finally {
        isBusy = false;
        renderDatabaseManager();
      }
      return true;
    }
  });
}

async function handleSaveStorageMode() {
  if (isBusy) return;
  isBusy = true;
  renderDatabaseManager();
  try {
    const res = await fetch('/api/admin/storage/config', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        mode: draftMode,
        modules: draftModules
      })
    });
    const data = await res.json().catch(() => ({}));
    await fetchStorageStatus();
    if (res.ok && data.success) {
      lastOpReport = {
        success: true,
        title: 'Modalidad de almacenamiento actualizada',
        message: data.message || `Configuración guardada (${draftMode.toUpperCase()}).`
      };
      showToast(lastOpReport.message, 'success');
    } else {
      lastOpReport = {
        success: false,
        title: 'No se pudo cambiar la modalidad',
        message: data.error || 'Verifique que las tablas SQL existan antes de activar modo SQL.'
      };
      showToast(lastOpReport.message, 'error');
    }
  } catch (err) {
    lastOpReport = {
      success: false,
      title: 'Error guardando modalidad',
      message: err.message
    };
    showToast(err.message, 'error');
  } finally {
    isBusy = false;
    renderDatabaseManager();
  }
}

function handleOpenImportModal() {
  const modules = storageStatus?.modules || [];
  openSqlActionModal({
    title: 'Importar Datos desde JSON hacia SQL',
    confirmLabel: '<i class="fas fa-file-import"></i> Ejecutar Importación',
    confirmClass: 'btn-success-alt',
    bodyHtml: `
      <p style="font-size:0.88rem; color:var(--navy); margin-bottom:0.85rem;">
        Se validarán los archivos JSON, se generará un respaldo previo automático en <code>data/backups/</code> y se ejecutará una transacción SQL ACID por cada módulo seleccionado.
      </p>
      <div class="form-group">
        <label>Módulos a importar hacia MySQL/MariaDB:</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.45rem; background:var(--bg-light); padding:0.75rem; border-radius:10px; border:1px solid var(--border-color);">
          ${modules.map(m => `
            <label style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:0.84rem; margin:0; cursor:pointer;">
              <input type="checkbox" class="mig-import-mod" value="${escapeHtml(m.key)}" checked />
              <span>${escapeHtml(m.label)} (${Number(m.jsonCount) || 0})</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label for="importConflictPolicy">Política ante registros existentes (Prevención de duplicados):</label>
        <select id="importConflictPolicy" class="form-control">
          <option value="skip" selected>Omitir duplicados existentes (Seguro — No sobrescribe)</option>
          <option value="overwrite">Sobrescribir registros existentes con los datos del JSON</option>
        </select>
      </div>
      <div id="importOverwriteAuthBox" style="display:none; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); padding:0.85rem; border-radius:10px;">
        <div class="form-check" style="padding:0;">
          <input type="checkbox" id="importConfirmOverwrite" class="form-check-input" />
          <label for="importConfirmOverwrite" class="form-check-label" style="font-size:0.83rem; color:#92400e;">
            Autorizo crear respaldo previo automático y sobrescribir los registros existentes en SQL con el contenido de los archivos JSON.
          </label>
        </div>
      </div>
    `,
    onConfirm: async () => {
      const selected = Array.from(document.querySelectorAll('.mig-import-mod:checked')).map(el => el.value);
      if (selected.length === 0) {
        showToast('Seleccione al menos un módulo para importar.', 'error');
        return false;
      }
      const conflictMode = document.getElementById('importConflictPolicy')?.value || 'skip';
      const confirmOverwrite = Boolean(document.getElementById('importConfirmOverwrite')?.checked);
      if (conflictMode === 'overwrite' && !confirmOverwrite) {
        showToast('Debe marcar la autorización explícita para sobrescribir registros existentes.', 'error');
        return false;
      }

      isBusy = true;
      try {
        const res = await fetch('/api/admin/storage/migrate/json-to-sql', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            modules: selected,
            conflictMode,
            confirmOverwrite
          })
        });
        const data = await res.json().catch(() => ({}));
        await fetchStorageStatus();
        if (res.ok && data.success) {
          lastOpReport = {
            success: true,
            direction: 'json_to_sql',
            title: 'Importación JSON → SQL completada',
            message: `Insertados: ${data.summary?.inserted || 0} · Actualizados: ${data.summary?.updated || 0} · Omitidos por duplicado: ${data.summary?.skipped || 0}.`,
            backupFolder: data.backupFolder,
            modules: data.modules
          };
          showToast('Importación hacia SQL completada exitosamente', 'success');
        } else {
          lastOpReport = {
            success: false,
            direction: 'json_to_sql',
            title: 'Importación JSON → SQL con incidencias',
            message: data.error || 'Ocurrieron errores durante la migración hacia SQL.',
            backupFolder: data.backupFolder,
            modules: data.modules
          };
          showToast(lastOpReport.message, 'error');
        }
      } finally {
        isBusy = false;
        renderDatabaseManager();
      }
      return true;
    }
  });

  const policyEl = document.getElementById('importConflictPolicy');
  const authBox = document.getElementById('importOverwriteAuthBox');
  if (policyEl && authBox) {
    policyEl.addEventListener('change', () => {
      authBox.style.display = policyEl.value === 'overwrite' ? 'block' : 'none';
    });
  }
}

function handleOpenExportModal() {
  const modules = storageStatus?.modules || [];
  openSqlActionModal({
    title: 'Exportar Datos desde SQL hacia JSON',
    confirmLabel: '<i class="fas fa-file-export"></i> Ejecutar Exportación',
    confirmClass: 'btn-warning-alt',
    bodyHtml: `
      <p style="font-size:0.88rem; color:var(--navy); margin-bottom:0.85rem;">
        Extrae la información almacenada en MySQL/MariaDB reconstruyendo fielmente la estructura JSON original de cada módulo.
      </p>
      <div class="form-group">
        <label>Módulos a exportar desde SQL:</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.45rem; background:var(--bg-light); padding:0.75rem; border-radius:10px; border:1px solid var(--border-color);">
          ${modules.map(m => `
            <label style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:0.84rem; margin:0; cursor:pointer;">
              <input type="checkbox" class="mig-export-mod" value="${escapeHtml(m.key)}" checked />
              <span>${escapeHtml(m.label)} (${Number(m.sqlCount) || 0} SQL)</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label for="exportModeSelect">Destino de la exportación:</label>
        <select id="exportModeSelect" class="form-control">
          <option value="download" selected>Descargar archivos JSON generados (No modifica los archivos del servidor)</option>
          <option value="write_disk">Sincronizar hacia los archivos JSON del servidor (Genera respaldo .bak previo)</option>
        </select>
      </div>
      <div id="exportOverwriteAuthBox" style="display:none; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); padding:0.85rem; border-radius:10px;">
        <div class="form-check" style="padding:0;">
          <input type="checkbox" id="exportConfirmOverwrite" class="form-check-input" />
          <label for="exportConfirmOverwrite" class="form-check-label" style="font-size:0.83rem; color:#92400e;">
            Autorizo crear copias de respaldo .bak y actualizar los archivos JSON en el servidor con los registros actuales de SQL.
          </label>
        </div>
      </div>
    `,
    onConfirm: async () => {
      const selected = Array.from(document.querySelectorAll('.mig-export-mod:checked')).map(el => el.value);
      if (selected.length === 0) {
        showToast('Seleccione al menos un módulo para exportar.', 'error');
        return false;
      }
      const exportMode = document.getElementById('exportModeSelect')?.value || 'download';
      const confirmOverwrite = Boolean(document.getElementById('exportConfirmOverwrite')?.checked);
      if (exportMode === 'write_disk' && !confirmOverwrite) {
        showToast('Debe marcar la autorización explícita para actualizar los archivos JSON en disco.', 'error');
        return false;
      }

      isBusy = true;
      try {
        const res = await fetch('/api/admin/storage/migrate/sql-to-json', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            modules: selected,
            exportMode,
            confirmOverwrite
          })
        });
        const data = await res.json().catch(() => ({}));
        await fetchStorageStatus();
        if (res.ok && data.success) {
          if (exportMode === 'download' && data.files) {
            for (const info of Object.values(data.files)) {
              const blob = new Blob([JSON.stringify(info.data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sql_export_${info.fileName}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          }
          lastOpReport = {
            success: true,
            direction: 'sql_to_json',
            title: 'Exportación SQL → JSON completada',
            message: exportMode === 'download'
              ? `Se exportaron ${data.summary?.exportedRecords || 0} registros en archivos JSON descargables sin alterar el servidor.`
              : `Se sincronizaron ${data.summary?.writtenFiles || 0} archivo(s) JSON en el servidor con respaldo automático previo.`,
            backupFolder: data.backupFolder,
            modules: data.modules
          };
          showToast('Exportación SQL → JSON completada', 'success');
        } else {
          lastOpReport = {
            success: false,
            direction: 'sql_to_json',
            title: 'Error en exportación SQL → JSON',
            message: data.error || 'Ocurrió un error al exportar datos desde SQL.',
            modules: data.modules
          };
          showToast(lastOpReport.message, 'error');
        }
      } finally {
        isBusy = false;
        renderDatabaseManager();
      }
      return true;
    }
  });

  const exportModeEl = document.getElementById('exportModeSelect');
  const authBox = document.getElementById('exportOverwriteAuthBox');
  if (exportModeEl && authBox) {
    exportModeEl.addEventListener('change', () => {
      authBox.style.display = exportModeEl.value === 'write_disk' ? 'block' : 'none';
    });
  }
}

function setupEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  // Listeners de la pestaña Almacenamiento Híbrido y SQL
  document.getElementById('btnRefreshStorageStatus')?.addEventListener('click', async () => {
    isBusy = true;
    renderDatabaseManager();
    await fetchStorageStatus();
    isBusy = false;
    renderDatabaseManager();
    showToast('Estado de almacenamiento actualizado', 'info');
  });

  document.getElementById('btnTestSqlConn')?.addEventListener('click', handleTestSqlConnection);
  document.getElementById('btnReloadSqlEnv')?.addEventListener('click', handleReloadSqlEnv);
  document.getElementById('btnOpenInitSqlModal')?.addEventListener('click', handleOpenInitSqlModal);
  document.getElementById('btnOpenImportModal')?.addEventListener('click', handleOpenImportModal);
  document.getElementById('btnOpenExportModal')?.addEventListener('click', handleOpenExportModal);
  document.getElementById('btnSaveStorageMode')?.addEventListener('click', handleSaveStorageMode);
  document.getElementById('btnGoToInstallGuide')?.addEventListener('click', () => switchTab('installguide'));
  document.getElementById('btnBackToHybridFromGuide')?.addEventListener('click', () => switchTab('hybrid'));

  const handleDownloadSql = () => {
    if (installAssets && installAssets.sqlScript) {
      downloadTextFile('01_schema_mysql.sql', installAssets.sqlScript, 'application/sql;charset=utf-8');
    }
  };
  document.getElementById('btnDownloadSqlScript')?.addEventListener('click', handleDownloadSql);

  document.getElementById('btnDownloadSqlSeedScript')?.addEventListener('click', () => {
    if (installAssets && installAssets.sqlSeedScript) {
      downloadTextFile('02_seed_initial_config.sql', installAssets.sqlSeedScript, 'application/sql;charset=utf-8');
    }
  });

  document.getElementById('btnDownloadInitConfigScript')?.addEventListener('click', () => {
    if (installAssets && installAssets.initConfigScript) {
      downloadTextFile('init_pia_config.js', installAssets.initConfigScript, 'application/javascript;charset=utf-8');
    }
  });

  document.getElementById('btnDownloadMigrateScript')?.addEventListener('click', () => {
    if (installAssets && installAssets.migrateScript) {
      downloadTextFile('migrate_json_to_sql.js', installAssets.migrateScript, 'application/javascript;charset=utf-8');
    }
  });

  document.getElementById('btnDownloadDeployPs1')?.addEventListener('click', () => {
    if (installAssets && installAssets.deployPs1) {
      downloadTextFile('deploy-iis.ps1', installAssets.deployPs1, 'text/plain;charset=utf-8');
    }
  });

  document.getElementById('btnDownloadDeployLinux')?.addEventListener('click', () => {
    if (installAssets && installAssets.deployLinuxSh) {
      downloadTextFile('deploy-linux.sh', installAssets.deployLinuxSh, 'text/x-shellscript;charset=utf-8');
    }
  });

  document.getElementById('btnDownloadWebConfig')?.addEventListener('click', () => {
    if (installAssets && installAssets.webConfig) {
      downloadTextFile('web.config', installAssets.webConfig, 'application/xml;charset=utf-8');
    }
  });

  document.getElementById('btnDownloadEnvTemplate')?.addEventListener('click', () => {
    const content = (installAssets && installAssets.envTemplate) ? installAssets.envTemplate : FALLBACK_ENV_TEMPLATE;
    downloadTextFile('.env.example', content, 'text/plain;charset=utf-8');
  });

  document.getElementById('btnDownloadFullGuide')?.addEventListener('click', () => {
    if (installAssets && installAssets.guideMarkdown) {
      downloadTextFile('GUIA_INSTALACION_WINDOWS_SQL.md', installAssets.guideMarkdown, 'text/markdown;charset=utf-8');
    }
  });

  document.querySelectorAll('.script-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.scriptTab;
      if (next) {
        activeScriptTab = next;
        renderDatabaseManager();
      }
    });
  });

  document.getElementById('btnDownloadActiveScript')?.addEventListener('click', () => {
    const map = {
      sql: { file: '01_schema_mysql.sql', content: installAssets?.sqlScript || FALLBACK_SQL_NOTICE, mime: 'application/sql;charset=utf-8' },
      sqlseed: { file: '02_seed_initial_config.sql', content: installAssets?.sqlSeedScript || '', mime: 'application/sql;charset=utf-8' },
      initcfg: { file: 'init_pia_config.js', content: installAssets?.initConfigScript || '', mime: 'application/javascript;charset=utf-8' },
      migrate: { file: 'migrate_json_to_sql.js', content: installAssets?.migrateScript || '', mime: 'application/javascript;charset=utf-8' },
      ps1: { file: 'deploy-iis.ps1', content: installAssets?.deployPs1 || '', mime: 'text/plain;charset=utf-8' },
      linuxsh: { file: 'deploy-linux.sh', content: installAssets?.deployLinuxSh || '', mime: 'text/x-shellscript;charset=utf-8' },
      webconfig: { file: 'web.config', content: installAssets?.webConfig || '', mime: 'application/xml;charset=utf-8' },
      env: { file: '.env.example', content: installAssets?.envTemplate || FALLBACK_ENV_TEMPLATE, mime: 'text/plain;charset=utf-8' }
    };
    const chosen = map[activeScriptTab] || map.sql;
    if (chosen.content) {
      downloadTextFile(chosen.file, chosen.content, chosen.mime);
    }
  });

  document.querySelectorAll('[data-copy-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.copyId);
      if (target) {
        copyTextToClipboard(target.textContent || '', 'Contenido');
      }
    });
  });

  document.getElementById('dismissOpReport')?.addEventListener('click', () => {
    lastOpReport = null;
    renderDatabaseManager();
  });

  document.querySelectorAll('.storage-mode-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode) {
        draftMode = mode;
        renderDatabaseManager();
      }
    });
  });

  document.querySelectorAll('.module-source-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const modKey = sel.dataset.moduleKey;
      if (modKey) {
        draftModules[modKey] = sel.value;
      }
    });
  });

  // Listeners existentes de Catálogo JSON, Asignaciones y Editor Directo
  document.getElementById('addNewDb')?.addEventListener('click', () => openDbModal());
  document.getElementById('exportConfig')?.addEventListener('click', exportConfig);
  document.getElementById('importConfig')?.addEventListener('click', importConfig);

  document.getElementById('resetDefaultDbConfig')?.addEventListener('click', () => {
    localStorage.removeItem('pia_db_configurations_v2');
    getDbConfig();
    showToast('Catálogo restablecido por defecto', 'success');
    renderDatabaseManager();
  });

  document.getElementById('defaultDbSelect')?.addEventListener('change', (e) => {
    const dbId = e.target.value;
    if (dbId) {
      setDefaultDatabase(dbId);
      showToast('Motor principal actualizado', 'success');
      renderDatabaseManager();
    }
  });

  document.querySelectorAll('.page-db-select').forEach(select => {
    select.addEventListener('change', () => {
      const page = select.dataset.page;
      const dbId = select.value;
      if (dbId) {
        assignDatabaseToPage(page, dbId);
        showToast(`Motor asignado correctamente a '${page}'`, 'success');
      } else {
        removePageAssignment(page);
        showToast(`Asignación removida para '${page}'`, 'info');
      }
      renderDatabaseManager();
    });
  });

  document.querySelectorAll('.edit-db').forEach(btn => {
    btn.addEventListener('click', () => openDbModal(btn.dataset.id));
  });

  document.querySelectorAll('.delete-db').forEach(btn => {
    btn.addEventListener('click', () => deleteDbHandler(btn.dataset.id));
  });

  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  document.getElementById('modalSave')?.addEventListener('click', saveDbHandler);

  document.getElementById('jsonModalClose')?.addEventListener('click', closeJsonModal);
  document.getElementById('jsonModalCancel')?.addEventListener('click', closeJsonModal);
  document.getElementById('jsonModalSave')?.addEventListener('click', saveJsonEditor);
}

function openDbModal(dbId = null) {
  currentDbId = dbId;
  const databases = getAllDatabases();
  const db = dbId ? databases.find(d => d.id === dbId) : null;

  const formHtml = `
    <div id="dbModalAlert" style="display: none; margin-bottom: 1rem; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #b91c1c; font-size: 0.83rem;"></div>
    <form id="dbForm">
      <div class="form-group">
        <label for="dbName">Nombre del Almacén JSON *</label>
        <input type="text" class="form-control" id="dbName" value="${db ? escapeHtml(db.name) : ''}" required placeholder="Ej. Fichero JSON - Canales x Integridad" />
        <small class="text-muted">Mínimo 3 caracteres para identificación única en el catálogo.</small>
      </div>

      <div class="form-group">
        <label for="dbType">Tipo de Almacén *</label>
        <select class="form-control" id="dbType" required>
          ${Object.entries(DB_TYPES).map(([key, info]) => `<option value="${escapeHtml(key)}" ${db && db.type === key ? 'selected' : ''}>${escapeHtml(info.name)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="dbFilePath">Ruta del Fichero o Endpoint JSON *</label>
        <input type="text" class="form-control" id="dbFilePath" value="${db ? escapeHtml(db.filePath) : ''}" required placeholder="/directorio/data_acceso.json" />
        <small class="text-muted">Debe iniciar con '/' y finalizar con extensión '.json' o referenciar un endpoint '/api/'.</small>
      </div>

      <div class="form-group">
        <label for="dbDescription">Descripción</label>
        <textarea class="form-control" id="dbDescription" rows="2">${db ? escapeHtml(db.description) : ''}</textarea>
      </div>
    </form>
  `;

  document.getElementById('modalTitle').textContent = db ? 'Editar Almacén JSON' : 'Nuevo Almacén JSON';
  document.getElementById('modalBody').innerHTML = formHtml;
  document.getElementById('dbModal').style.display = 'flex';
}

function saveDbHandler() {
  const dbData = {
    name: document.getElementById('dbName')?.value || '',
    type: document.getElementById('dbType')?.value || '',
    filePath: document.getElementById('dbFilePath')?.value || '',
    description: document.getElementById('dbDescription')?.value || '',
    syncMode: 'Sincronización Atómica JSON'
  };

  const errors = validateDbEngineConfig(dbData);
  const alertBox = document.getElementById('dbModalAlert');

  if (errors.length > 0) {
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px;"><i class="fas fa-exclamation-triangle"></i> Requisitos no cumplidos (${errors.length}):</div>
        <ul style="margin: 0; padding-left: 1.25rem;">${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
      `;
    }
    showToast('Corrija la configuración del almacén JSON antes de guardar.', 'error');
    return;
  }

  if (alertBox) alertBox.style.display = 'none';

  try {
    if (currentDbId) {
      updateDatabase(currentDbId, dbData);
      showToast('Almacén de datos JSON actualizado correctamente', 'success');
    } else {
      addDatabase(dbData);
      showToast('Nuevo almacén de datos JSON registrado', 'success');
    }
    closeModal();
    renderDatabaseManager();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function deleteDbHandler(dbId) {
  try {
    deleteDatabase(dbId);
    showToast('Almacén eliminado del catálogo', 'success');
    renderDatabaseManager();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function exportConfig() {
  const config = exportDbConfig();
  const blob = new Blob([config], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pia-db-json-config-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Configuración exportada correctamente', 'success');
}

function importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (importDbConfig(ev.target.result)) {
        showToast('Configuración importada correctamente', 'success');
        renderDatabaseManager();
      } else {
        showToast('Error al importar la configuración', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function closeModal() {
  const modal = document.getElementById('dbModal');
  if (modal) modal.style.display = 'none';
  currentDbId = null;
}

// EDITOR JSON DIRECTO CON VALIDACIÓN EN TIEMPO REAL

let currentJsonEtag = null;

async function openJsonEditor(jsonPath) {
  currentJsonPath = jsonPath;
  currentJsonEtag = null;
  const f = AVAILABLE_JSON_FILES.find(x => x.path === jsonPath) || { name: jsonPath, label: 'JSON' };

  let currentData = {};
  try {
    const res = await fetch(`/api/raw-json?path=${encodeURIComponent(jsonPath)}`, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (res.status === 401 && typeof window.logout === 'function') {
      window.logout('Tu sesión ha expirado. Inicia sesión nuevamente.');
      return;
    }
    if (res.ok) {
      currentJsonEtag = res.headers.get('ETag');
      currentData = await res.json();
    } else if (window.location.protocol === 'file:' && window.PiaDataEngine) {
      currentData = (await window.PiaDataEngine.fetchRawJson(jsonPath)) || {};
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || `No se pudo cargar ${f.name} desde el servidor.`, 'error');
      return;
    }
  } catch (err) {
    console.error('Error al cargar JSON:', err);
    showToast('Error de conexión al cargar el archivo JSON del servidor.', 'error');
    return;
  }

  const initialJsonStr = JSON.stringify(currentData, null, 2);

  const html = `
    <div class="json-editor">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <label style="color: var(--navy); font-weight: 700; margin: 0; font-size: 0.95rem;">
            Archivo: <strong>${escapeHtml(f.name)}</strong> (${escapeHtml(f.label)})
          </label>
          <span style="display: block; font-size: 0.78rem; color: var(--text-muted);">
            Validador de Esquema en Tiempo Real Activado
          </span>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button type="button" class="btn btn-secondary" id="btnFormatJson" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
            <i class="fas fa-magic"></i> Formatear JSON
          </button>
          <button type="button" class="btn btn-info" id="btnValidateJson" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: var(--cyan); color: #fff; border: none; border-radius: 6px; font-weight: 600;">
            <i class="fas fa-check-double"></i> Validar Esquema
          </button>
        </div>
      </div>

      <div id="jsonValidationAlert" style="margin-bottom: 0.85rem; border-radius: 10px; font-size: 0.83rem; transition: all 0.2s ease;"></div>

      <div class="form-group" style="margin-bottom: 0.5rem;">
        <textarea id="jsonEditorTextarea" class="form-control" rows="18" style="font-family: monospace; white-space: pre; font-size: 0.85rem; padding: 0.75rem; border-radius: 8px; transition: border-color 0.2s ease;"></textarea>
      </div>
      <p class="text-muted" style="font-size: 0.78rem; margin: 0;"><i class="fas fa-info-circle"></i> Los cambios solo se guardarán en el servidor si la sintaxis y el esquema cumplen con los requisitos mínimos del módulo.</p>
    </div>
  `;

  document.getElementById('jsonModalTitle').textContent = 'Editar y Validar ' + f.name;
  document.getElementById('jsonEditorContainer').innerHTML = html;
  const textarea = document.getElementById('jsonEditorTextarea');
  if (textarea) textarea.value = initialJsonStr;
  document.getElementById('jsonEditorModal').style.display = 'flex';

  const btnFormat = document.getElementById('btnFormatJson');
  const btnValidate = document.getElementById('btnValidateJson');

  const runLiveValidation = () => {
    const text = textarea.value;
    const syntaxResult = validateJsonSyntax(text);
    const alertBox = document.getElementById('jsonValidationAlert');
    if (!alertBox) return false;

    if (!syntaxResult.isValid) {
      textarea.style.borderColor = '#ef4444';
      alertBox.style.cssText = 'background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #b91c1c; padding: 0.75rem 1rem; border-radius: 10px; margin-bottom: 0.85rem; font-size: 0.83rem;';
      alertBox.innerHTML = `
        <div style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.1rem;"></i>
          Sintaxis JSON Inválida (Línea ${escapeHtml(syntaxResult.line)})
        </div>
        <div style="margin-top: 4px; font-family: monospace;">${escapeHtml(syntaxResult.error)}</div>
      `;
      return false;
    }

    const schemaResult = validateJsonSchema(jsonPath, syntaxResult.data);
    if (!schemaResult.isValid) {
      textarea.style.borderColor = '#f59e0b';
      alertBox.style.cssText = 'background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #b45309; padding: 0.75rem 1rem; border-radius: 10px; margin-bottom: 0.85rem; font-size: 0.83rem;';
      const errorItems = schemaResult.errors.map(err => `<li>${escapeHtml(err)}</li>`).join('');
      alertBox.innerHTML = `
        <div style="font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 1.1rem;"></i>
          Errores de Validación de Esquema (${schemaResult.errors.length}):
        </div>
        <ul style="margin: 0; padding-left: 1.25rem; line-height: 1.4;">${errorItems}</ul>
      `;
      return false;
    }

    textarea.style.borderColor = '#10b981';
    alertBox.style.cssText = 'background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #047857; padding: 0.65rem 1rem; border-radius: 10px; margin-bottom: 0.85rem; font-size: 0.83rem;';
    alertBox.innerHTML = `
      <div style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-check-circle" style="color: #10b981; font-size: 1.1rem;"></i>
        Sintaxis y Esquema JSON Válidos para ${escapeHtml(f.name)}. Listo para guardar.
      </div>
    `;
    return true;
  };

  let timer = null;
  textarea.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runLiveValidation, 300);
  });

  if (btnFormat) {
    btnFormat.addEventListener('click', () => {
      const syntaxResult = validateJsonSyntax(textarea.value);
      if (syntaxResult.isValid) {
        textarea.value = JSON.stringify(syntaxResult.data, null, 2);
        runLiveValidation();
        showToast('JSON auto-formateado con sangría limpia', 'info');
      } else {
        showToast('No se puede formatear: repare la sintaxis JSON primero.', 'error');
      }
    });
  }

  if (btnValidate) {
    btnValidate.addEventListener('click', () => {
      const isValid = runLiveValidation();
      if (isValid) {
        showToast('¡Validación exitosa! El archivo cumple todos los requisitos.', 'success');
      } else {
        showToast('Se detectaron errores en el archivo JSON. Revisa el panel superior.', 'error');
      }
    });
  }

  runLiveValidation();
}

async function saveJsonEditor() {
  const textarea = document.getElementById('jsonEditorTextarea');
  if (!textarea || !currentJsonPath) return;

  const rawText = textarea.value;
  const syntaxResult = validateJsonSyntax(rawText);
  if (!syntaxResult.isValid) {
    showToast(`Error de Sintaxis JSON: ${syntaxResult.error}`, 'error');
    textarea.focus();
    return;
  }

  const schemaResult = validateJsonSchema(currentJsonPath, syntaxResult.data);
  if (!schemaResult.isValid) {
    showToast(`Error de Esquema JSON: Hay ${schemaResult.errors.length} error(es) en los datos. Corríjalos para continuar.`, 'error');
    const alertBox = document.getElementById('jsonValidationAlert');
    if (alertBox) alertBox.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  try {
    if (window.location.protocol === 'file:') {
      localStorage.setItem('pia_custom_json_' + currentJsonPath, JSON.stringify(syntaxResult.data));
      const blob = new Blob([JSON.stringify(syntaxResult.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentJsonPath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Fichero JSON actualizado localmente y descargado a tu equipo', 'success');
      closeJsonModal();
      await renderMockFiles();
      return;
    }

    const sendRawSave = (etagOverride = null) => {
      const headers = getAuthHeaders();
      const etag = etagOverride || currentJsonEtag;
      if (etag) headers['If-Match'] = etag;
      return fetch('/api/raw-json', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          path: currentJsonPath,
          data: syntaxResult.data
        }),
        cache: 'no-store'
      });
    };

    let res = await sendRawSave();
    if (res.status === 409) {
      const freshRes = await fetch(`/api/raw-json?path=${encodeURIComponent(currentJsonPath)}`, {
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (freshRes.ok) {
        const freshEtag = freshRes.headers.get('ETag');
        if (freshEtag) {
          currentJsonEtag = freshEtag;
          res = await sendRawSave(freshEtag);
        }
      }
    }

    if (res.status === 401 && typeof window.logout === 'function') {
      window.logout('Tu sesión ha expirado. Inicia sesión nuevamente.');
      return;
    }

    const resData = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(resData.error || `Error al guardar el archivo JSON en el servidor (HTTP ${res.status}).`);
    }

    const newEtag = res.headers.get('ETag');
    if (newEtag) currentJsonEtag = newEtag;
    localStorage.removeItem('pia_custom_json_' + currentJsonPath);
    const jsonCloudMap = {
      '/data_portal.json': 'portal',
      '/canales-por-la-integridad/data_directorio.json': 'canales',
      '/directorio/data_acceso.json': 'directorio',
      '/gobierno_en_numeros/data_tableros.json': 'tableros',
      '/riesgo/datos.json': 'riesgo'
    };
    const mappedDocId = jsonCloudMap[currentJsonPath];
    if (mappedDocId) {
      syncModuleDataToCloud(mappedDocId, getAuthHeaders).catch(() => {});
    }
    await fetchStorageStatus();
    showToast('Fichero JSON validado y guardado correctamente en el servidor', 'success');

    closeJsonModal();
    await renderMockFiles();
  } catch (err) {
    showToast(err.message || 'Error al guardar el archivo JSON.', 'error');
  }
}

function closeJsonModal() {
  const modal = document.getElementById('jsonEditorModal');
  if (modal) modal.style.display = 'none';
  currentJsonPath = null;
  currentJsonEtag = null;
}

function showToast(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
