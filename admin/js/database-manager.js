// database-manager.js - Interfaz de administración de almacenamiento JSON homogéneo y asignaciones

import { 
  getDbConfig, saveDbConfig, getAllDatabases, addDatabase, 
  updateDatabase, deleteDatabase, assignDatabaseToPage, 
  removePageAssignment, setDefaultDatabase, exportDbConfig, 
  importDbConfig, DB_TYPES, validateDbConfig
} from './database-config.js';
import { 
  validateJsonSyntax, validateJsonSchema, validateDbEngineConfig 
} from './schema-validator.js';

// Páginas disponibles en el portal PIA
const AVAILABLE_PAGES = [
  'canales-por-la-integridad',
  'directorio',
  'gobierno_en_numeros',
  'riesgo',
  'vehiculos',
  'index'
];

// Detalles explicativos de cada página del portal
const PAGE_DETAILS = {
  'canales-por-la-integridad': { label: 'Canales por la Integridad', route: '/canales-por-la-integridad', file: '/canales-por-la-integridad/data_directorio.json', icon: 'fa-comments' },
  'directorio': { label: 'Directorio Ejecutivo de Acceso', route: '/directorio', file: '/directorio/data_acceso.json', icon: 'fa-address-book' },
  'gobierno_en_numeros': { label: 'Tu Gobierno en Números', route: '/gobierno_en_numeros', file: '/gobierno_en_numeros/data_tableros.json', icon: 'fa-chart-bar' },
  'riesgo': { label: 'Riesgo en la Mira', route: '/riesgo', file: '/riesgo/datos.json', icon: 'fa-bullseye' },
  'vehiculos': { label: 'Transparencia Vehicular', route: '/vehiculos', file: '/vehiculos/vehiculos.json', icon: 'fa-car' },
  'index': { label: 'Portal Principal PIA', route: '/', file: '/data_portal.json', icon: 'fa-globe' }
};

// Archivos JSON del sistema
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
let currentTab = 'databases';

// Inicializar el módulo
export async function initDatabaseManager() {
  renderDatabaseManager();
}

// Cambiar de pestaña
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.dataset.tab === tabName) b.classList.add('active');
    else b.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.add('hidden');
  });
  const tabId = tabName + 'Tab';
  const targetEl = document.getElementById(tabId);
  if (targetEl) targetEl.classList.remove('hidden');

  if (tabName === 'mockdata') {
    renderMockFiles();
  }
}

// Renderizar la interfaz principal
function renderDatabaseManager() {
  const config = getDbConfig();
  const databases = getAllDatabases();
  
  const html = `
    <div class="db-manager-container" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
      <div class="db-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="color: var(--navy); font-family: var(--font-head); font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 0.2rem;">
            <i class="fas fa-database" style="color: var(--cyan);"></i> Motores de Almacenamiento JSON y Asignaciones
          </h2>
          <p class="text-muted" style="font-size: 0.92rem;">
            Administración unificada de motores de datos JSON locales y asignación transparente de esquemas a cada sección del Portal PIA.
          </p>
        </div>
        <div class="db-actions" style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary" id="addNewDb" style="padding: 0.65rem 1rem; font-weight: 700;"><i class="fas fa-plus"></i> Nuevo Almacén JSON</button>
          <button class="btn btn-secondary" id="exportConfig" style="padding: 0.65rem 1rem;"><i class="fas fa-download"></i> Exportar</button>
          <button class="btn btn-secondary" id="importConfig" style="padding: 0.65rem 1rem;"><i class="fas fa-upload"></i> Importar</button>
        </div>
      </div>

      <!-- Banner informativo sobre arquitectura homogénena -->
      <div style="background: linear-gradient(135deg, rgba(0,194,224,0.08), rgba(43,130,201,0.08)); border: 1px solid rgba(0,194,224,0.25); padding: 1rem 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 14px;">
        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(0,194,224,0.15); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
          <i class="fas fa-info-circle"></i>
        </div>
        <div style="font-size: 0.88rem; color: var(--navy); line-height: 1.4;">
          <strong>Arquitectura de Datos Homogénea:</strong> Todas las páginas del Portal PIA operan sobre ficheros y motores de persistencia <strong>JSON homogéneos</strong> con soporte de Service Worker. Cada módulo consume datos estructurados con sincronización en tiempo real y registro auditado.
        </div>
      </div>
      
      <div class="db-tabs" style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem;">
        <button class="tab-btn ${currentTab === 'databases' ? 'active' : ''}" data-tab="databases">
          <i class="fas fa-server"></i> Catálogo de Motores JSON (${databases.length})
        </button>
        <button class="tab-btn ${currentTab === 'assignments' ? 'active' : ''}" data-tab="assignments">
          <i class="fas fa-link"></i> Asignación por Página (${Object.keys(config.pageDatabaseMap).length}/${AVAILABLE_PAGES.length})
        </button>
        <button class="tab-btn ${currentTab === 'mockdata' ? 'active' : ''}" data-tab="mockdata">
          <i class="fas fa-file-code"></i> Editor Directo JSON
        </button>
        <button class="tab-btn ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
          <i class="fas fa-cog"></i> Configuración Servidor
        </button>
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
          <p class="text-muted" style="margin-bottom: 1.25rem;">Modifica los registros en formato JSON directo. Cualquier cambio se guardará atómicamente y generará un registro en la Bitácora de Auditoría.</p>
          <div class="mock-files" id="mockFiles" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.25rem;"></div>
        </div>
      </div>

      <div class="tab-content ${currentTab === 'settings' ? '' : 'hidden'}" id="settingsTab">
        <div class="settings-container" style="background: var(--card-bg); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="color: var(--navy); margin-bottom: 0.25rem;"><i class="fas fa-cogs" style="color: var(--cyan);"></i> Configuración del Motor JSON Principal</h3>
              <p class="text-muted">Motor primario de respuesta ante consultas sin asignación específica.</p>
            </div>
            <button class="btn btn-secondary" id="resetDefaultDbConfig"><i class="fas fa-undo"></i> Restablecer Catálogo por Defecto</button>
          </div>
          
          <div class="form-group" style="max-width: 550px;">
            <label style="font-weight: 700; color: var(--navy);">Motor Principal por Defecto</label>
            <select class="form-control" id="defaultDbSelect" style="padding: 0.7rem 1rem;">
              <option value="">-- Seleccionar Motor --</option>
              ${databases.map(db => `<option value="${db.id}" ${config.defaultDatabase === db.id ? 'selected' : ''}>${db.name}</option>`).join('')}
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
      <div class="db-card" data-id="${db.id}" style="background: var(--card-bg); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border); box-shadow: 0 2px 10px rgba(5,17,31,0.04); display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 40px; height: 40px; background: rgba(0,194,224,0.12); color: var(--cyan); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                <i class="fas ${typeInfo.icon}"></i>
              </div>
              <div>
                <strong style="font-size: 0.98rem; color: var(--navy); display: block;">${db.name}</strong>
                <span class="badge badge-info" style="font-size: 0.72rem;">${typeInfo.name}</span>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="btn-icon edit-db" data-id="${db.id}" title="Editar"><i class="fas fa-pen"></i></button>
              <button class="btn-icon delete-db" data-id="${db.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
              ${defaultDbId === db.id ? '<span class="badge badge-success" style="font-size: 0.7rem;">Principal</span>' : ''}
            </div>
          </div>

          <p style="font-size: 0.83rem; color: var(--text-muted); margin-bottom: 0.75rem; line-height: 1.4;">${db.description || 'Almacén de datos JSON para el portal.'}</p>
          
          <div style="background: var(--surface); padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.8rem; color: var(--navy); font-family: monospace; margin-bottom: 0.75rem; word-break: break-all; border: 1px solid var(--border);">
            <i class="fas fa-folder-open" style="color: var(--cyan); margin-right: 4px;"></i> ${db.filePath}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.65rem; margin-top: 0.5rem; font-size: 0.78rem;">
          <span style="color: var(--green); font-weight: 700;"><i class="fas fa-check-circle"></i> Sincronizado</span>
          <span style="color: var(--text-muted);">${db.syncMode || 'JSON Atómico'}</span>
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
      <div class="page-assignment" data-page="${page}" style="background: var(--surface); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
        <div class="page-info" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
          <div style="width: 44px; height: 44px; background: rgba(0,194,224,0.12); color: var(--cyan); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
            <i class="fas ${info.icon}"></i>
          </div>
          <div>
            <strong style="font-size: 1.02rem; color: var(--navy); display: block; font-family: var(--font-head);">${info.label}</strong>
            <div style="display: flex; gap: 10px; align-items: center; margin-top: 2px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;"><i class="fas fa-link"></i> ${info.route}</span>
              <span style="font-size: 0.8rem; color: var(--blue-bright); font-family: monospace;"><i class="fas fa-file-code"></i> ${info.file}</span>
            </div>
            <div style="margin-top: 6px;">
              ${assignedDb ? `<span class="badge badge-success" style="font-size: 0.75rem; padding: 3px 10px;"><i class="fas fa-database"></i> Motor Asignado: <strong>${assignedDb.name}</strong></span>` : '<span style="font-size: 0.75rem; color: var(--red); font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> Sin asignación</span>'}
            </div>
          </div>
        </div>
        <div class="assignment-select" style="min-width: 280px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: var(--navy); display: block; margin-bottom: 4px;">Seleccionar Motor JSON:</label>
          <select class="form-control page-db-select" data-page="${page}" style="padding: 0.65rem 0.9rem; font-weight: 600; border-radius: 10px; width: 100%;">
            <option value="">-- Sin Asignar --</option>
            ${databases.map(db => `<option value="${db.id}" ${dbId === db.id ? 'selected' : ''}>${db.name}</option>`).join('')}
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
      const data = window.PiaDataEngine ? await window.PiaDataEngine.fetchRawJson(f.path) : null;
      if (data) {
        preview = JSON.stringify(data).substring(0, 110) + '...';
      } else {
        const res = await fetch(`/api/raw-json?path=${encodeURIComponent(f.path)}`);
        if (res.ok) {
          const resData = await res.json();
          preview = JSON.stringify(resData).substring(0, 110) + '...';
        }
      }
    } catch {
      preview = 'No se pudo leer el archivo';
    }

    return `
      <div class="mock-file-card" data-path="${f.path}" style="background: var(--card-bg); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(5,17,31,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-file-code" style="font-size: 1.5rem; color: var(--cyan);"></i>
            <div>
              <strong style="color: var(--navy); font-size: 0.95rem;">${f.name}</strong>
              <span style="display: block; font-size: 0.78rem; color: var(--text-muted);">${f.label}</span>
            </div>
          </div>
          <button class="btn btn-primary edit-json-btn" data-path="${f.path}" style="padding: 0.45rem 0.85rem; font-size: 0.82rem;">
            <i class="fas fa-edit"></i> Editar JSON
          </button>
        </div>
        <div style="background: var(--surface); padding: 0.65rem; border-radius: 8px; border: 1px solid var(--border); font-family: monospace; font-size: 0.75rem; color: var(--navy); overflow: hidden;">
          <pre style="margin: 0;">${preview}</pre>
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

function setupEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
  });
  
  const addNewBtn = document.getElementById('addNewDb');
  if (addNewBtn) addNewBtn.addEventListener('click', () => openDbModal());
  
  const exportBtn = document.getElementById('exportConfig');
  if (exportBtn) exportBtn.addEventListener('click', exportConfig);
  
  const importBtn = document.getElementById('importConfig');
  if (importBtn) importBtn.addEventListener('click', importConfig);

  const resetBtn = document.getElementById('resetDefaultDbConfig');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('¿Desea restablecer el catálogo por defecto?')) {
        localStorage.removeItem('pia_db_configurations_v2');
        getDbConfig();
        showToast('Catálogo restablecido por defecto', 'success');
        renderDatabaseManager();
      }
    });
  }
  
  const defaultSelect = document.getElementById('defaultDbSelect');
  if (defaultSelect) {
    defaultSelect.addEventListener('change', (e) => {
      const dbId = e.target.value;
      if (dbId) {
        setDefaultDatabase(dbId);
        showToast('Motor principal actualizado', 'success');
        renderDatabaseManager();
      }
    });
  }

  document.querySelectorAll('.page-db-select').forEach(select => {
    select.addEventListener('change', (e) => {
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
    btn.addEventListener('click', () => {
      openDbModal(btn.dataset.id);
    });
  });

  document.querySelectorAll('.delete-db').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteDbHandler(btn.dataset.id);
    });
  });
  
  const modalClose = document.getElementById('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeModal);

  const modalCancel = document.getElementById('modalCancel');
  if (modalCancel) modalCancel.addEventListener('click', closeModal);

  const modalSave = document.getElementById('modalSave');
  if (modalSave) modalSave.addEventListener('click', saveDbHandler);

  const jsonModalClose = document.getElementById('jsonModalClose');
  if (jsonModalClose) jsonModalClose.addEventListener('click', closeJsonModal);

  const jsonModalCancel = document.getElementById('jsonModalCancel');
  if (jsonModalCancel) jsonModalCancel.addEventListener('click', closeJsonModal);

  const jsonModalSave = document.getElementById('jsonModalSave');
  if (jsonModalSave) jsonModalSave.addEventListener('click', saveJsonEditor);
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
        <input type="text" class="form-control" id="dbName" value="${db ? db.name : ''}" required placeholder="Ej. Fichero JSON - Canales x Integridad" />
        <small class="text-muted">Mínimo 3 caracteres para identificación única en el catálogo.</small>
      </div>
      
      <div class="form-group">
        <label for="dbType">Tipo de Almacén *</label>
        <select class="form-control" id="dbType" required>
          ${Object.entries(DB_TYPES).map(([key, info]) => `<option value="${key}" ${db && db.type === key ? 'selected' : ''}>${info.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="dbFilePath">Ruta del Fichero o Endpoint JSON *</label>
        <input type="text" class="form-control" id="dbFilePath" value="${db ? db.filePath : ''}" required placeholder="/directorio/data_acceso.json" />
        <small class="text-muted">Debe iniciar con '/' y finalizar con extensión '.json' o referenciar un endpoint '/api/'.</small>
      </div>

      <div class="form-group">
        <label for="dbDescription">Descripción</label>
        <textarea class="form-control" id="dbDescription" rows="2">${db ? db.description : ''}</textarea>
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
        <ul style="margin: 0; padding-left: 1.25rem;">${errors.map(e => `<li>${e}</li>`).join('')}</ul>
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
  if (!confirm('¿Estás seguro de eliminar este almacén del catálogo?')) return;
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

async function openJsonEditor(path) {
  currentJsonPath = path;
  const f = AVAILABLE_JSON_FILES.find(x => x.path === path) || { name: path, label: 'JSON' };
  
  let currentData = {};
  try {
    if (window.PiaDataEngine) {
      currentData = (await window.PiaDataEngine.fetchRawJson(path)) || {};
    } else {
      const res = await fetch(`/api/raw-json?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        currentData = await res.json();
      }
    }
  } catch (err) {
    console.error('Error al cargar JSON:', err);
  }

  const initialJsonStr = JSON.stringify(currentData, null, 2);

  const html = `
    <div class="json-editor">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <label style="color: var(--navy); font-weight: 700; margin: 0; font-size: 0.95rem;">
            Archivo: <strong>${f.name}</strong> (${f.label})
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

      <!-- Panel de Alerta de Validación del Esquema -->
      <div id="jsonValidationAlert" style="margin-bottom: 0.85rem; border-radius: 10px; font-size: 0.83rem; transition: all 0.2s ease;"></div>

      <div class="form-group" style="margin-bottom: 0.5rem;">
        <textarea id="jsonEditorTextarea" class="form-control" rows="18" style="font-family: monospace; white-space: pre; font-size: 0.85rem; padding: 0.75rem; border-radius: 8px; transition: border-color 0.2s ease;">${initialJsonStr}</textarea>
      </div>
      <p class="text-muted" style="font-size: 0.78rem; margin: 0;"><i class="fas fa-info-circle"></i> Los cambios solo se guardarán en el servidor si la sintaxis y el esquema cumplen con los requisitos mínimos del módulo.</p>
    </div>
  `;
  
  document.getElementById('jsonModalTitle').textContent = 'Editar y Validar ' + f.name;
  document.getElementById('jsonEditorContainer').innerHTML = html;
  document.getElementById('jsonEditorModal').style.display = 'flex';

  const textarea = document.getElementById('jsonEditorTextarea');
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
          Sintaxis JSON Inválida (Línea ${syntaxResult.line})
        </div>
        <div style="margin-top: 4px; font-family: monospace;">${syntaxResult.error}</div>
      `;
      return false;
    }

    const schemaResult = validateJsonSchema(path, syntaxResult.data);
    if (!schemaResult.isValid) {
      textarea.style.borderColor = '#f59e0b';
      alertBox.style.cssText = 'background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #b45309; padding: 0.75rem 1rem; border-radius: 10px; margin-bottom: 0.85rem; font-size: 0.83rem;';
      const errorItems = schemaResult.errors.map(err => `<li>${err}</li>`).join('');
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
        Sintaxis y Esquema JSON Válidos para ${f.name}. Listo para guardar.
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
    if (alertBox) {
      alertBox.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  try {
    let saved = false;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch('/api/raw-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          path: currentJsonPath,
          data: syntaxResult.data
        })
      });
      if (res.ok) saved = true;
    } catch (e) {}

    if (!saved) {
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
    } else {
      showToast('Fichero JSON validado y actualizado en el servidor', 'success');
    }

    closeJsonModal();
    await renderMockFiles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeJsonModal() {
  const modal = document.getElementById('jsonEditorModal');
  if (modal) modal.style.display = 'none';
  currentJsonPath = null;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
