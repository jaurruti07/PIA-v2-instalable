// /admin/js/module-ui-manager.js
// Gestor modular de KPIs dinámicos e Imágenes de Fondo para cada módulo del Portal PIA
import { syncModuleDataToCloud } from './texts-sync-ui.js';

const MODULE_UI_ICON_GALLERY = [
  { cls: 'fas fa-building', label: 'Instituciones' },
  { cls: 'fas fa-envelope-open-text', label: 'Canales' },
  { cls: 'fas fa-envelope', label: 'Correo' },
  { cls: 'fas fa-phone-alt', label: 'Teléfono' },
  { cls: 'fas fa-phone-volume', label: 'Línea Directa' },
  { cls: 'fas fa-gavel', label: 'Justicia' },
  { cls: 'fas fa-shield-alt', label: 'Integridad' },
  { cls: 'fas fa-layer-group', label: 'Plataformas' },
  { cls: 'fas fa-balance-scale', label: 'Probidad / Ética' },
  { cls: 'fas fa-landmark', label: 'Estado' },
  { cls: 'fas fa-university', label: 'Ministerios' },
  { cls: 'fas fa-sitemap', label: 'Dependencias' },
  { cls: 'fas fa-table', label: 'Tableros' },
  { cls: 'fas fa-chart-line', label: 'Indicadores' },
  { cls: 'fas fa-chart-pie', label: 'Estadísticas' },
  { cls: 'fas fa-file-contract', label: 'Protocolos' },
  { cls: 'fas fa-file-signature', label: 'Secretarías' },
  { cls: 'fas fa-file-alt', label: 'Documentos' },
  { cls: 'fas fa-check-circle', label: 'Cumplimiento' },
  { cls: 'fas fa-eye', label: 'Transparencia' },
  { cls: 'fas fa-clock', label: 'Disponibilidad' },
  { cls: 'fas fa-sync-alt', label: 'Actualización' },
  { cls: 'fas fa-star', label: 'Buenas Prácticas' },
  { cls: 'fas fa-globe', label: 'Portal Web' },
  { cls: 'fas fa-user-secret', label: 'Validación' },
  { cls: 'fas fa-car', label: 'Vehículos' }
];

const uiState = {
  module: null,
  kpis: [],
  backgrounds: [],
  sectionImages: {},
  autoKeysCatalog: [],
  etag: null,
  gallery: [],
  editingKpiId: null,
  pendingDeleteKpiId: null,
  editingBgId: null,
  pendingDeleteBgId: null,
  pendingResetScope: null,
  previewSlideIdx: 0,
  kpisContainerId: null,
  backgroundsContainerId: null,
  deps: null
};

function esc(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeIcon(rawIcon, fallback = 'fas fa-chart-line') {
  const cleaned = String(rawIcon || '').trim().replace(/\s+/g, ' ');
  if (/^fa(?:s|r|b|l|d|ss|sr)?\s+fa-[a-z0-9-]+$/i.test(cleaned)) return cleaned.toLowerCase();
  if (/^fa-[a-z0-9-]+$/i.test(cleaned)) return `fas ${cleaned.toLowerCase()}`;
  return fallback;
}

function sanitizeImageUrl(rawUrl) {
  const val = String(rawUrl || '').trim();
  if (!val || /[\s"'`<>()\\;]/.test(val) || val.includes('..')) return null;
  if (/^\/(?:img|uploads\/backgrounds)\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)$/i.test(val)) {
    return val;
  }
  try {
    const parsed = new URL(val);
    if (parsed.protocol === 'https:') return parsed.href;
  } catch (_) {
    return null;
  }
  return null;
}

function toast(msg, type = 'info') {
  if (uiState.deps?.showToast) uiState.deps.showToast(msg, type);
}

function getHeaders() {
  return uiState.deps?.getHeaders ? uiState.deps.getHeaders() : { 'Content-Type': 'application/json' };
}

async function handleUnauthorized() {
  if (uiState.deps?.authLogout) {
    await uiState.deps.authLogout('Tu sesión ha expirado o es inválida. Inicia sesión nuevamente.');
  }
}

async function fetchUiConfig(moduleKey) {
  const res = await fetch(`/api/admin/ui/${encodeURIComponent(moduleKey)}?t=${Date.now()}`, {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (res.status === 401) {
    await handleUnauthorized();
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error cargando configuración visual del módulo.');
  const etag = res.headers.get('ETag');
  if (etag) uiState.etag = etag;
  uiState.kpis = Array.isArray(data.kpis) ? data.kpis : [];
  uiState.backgrounds = Array.isArray(data.backgrounds) ? data.backgrounds : [];
  uiState.sectionImages = data.sectionImages || {};
  uiState.autoKeysCatalog = Array.isArray(data.autoKeysCatalog) ? data.autoKeysCatalog : [];
  return data;
}

async function mutateUiEndpoint(url, method, body = null) {
  const buildHeaders = () => {
    const headers = getHeaders();
    if (uiState.etag) headers['If-Match'] = uiState.etag;
    return headers;
  };

  const opts = { method, headers: buildHeaders(), cache: 'no-store' };
  if (body !== null) opts.body = JSON.stringify(body);

  let res = await fetch(url, opts);
  if (res.status === 409 && uiState.module) {
    await fetchUiConfig(uiState.module);
    const retryOpts = { method, headers: buildHeaders(), cache: 'no-store' };
    if (body !== null) retryOpts.body = JSON.stringify(body);
    res = await fetch(url, retryOpts);
  }

  if (res.status === 401) {
    await handleUnauthorized();
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo guardar la configuración.');
  }

  const newEtag = res.headers.get('ETag');
  if (newEtag) uiState.etag = newEtag;
  syncModuleDataToCloud('ui_config', getHeaders, uiState.deps?.authLogout).catch(() => {});
  return data;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file, moduleKey) {
  if (!file) throw new Error('Seleccione un archivo de imagen.');
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Solo se admiten imágenes en formato PNG, JPG/JPEG o WEBP.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen no debe superar los 5 MB.');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const res = await fetch('/api/admin/ui/backgrounds/upload', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filename: file.name,
      dataUrl,
      module: moduleKey
    })
  });
  if (res.status === 401) {
    await handleUnauthorized();
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen al servidor.');
  return data;
}

async function loadGallery() {
  const res = await fetch('/api/admin/ui/backgrounds/gallery', { headers: getHeaders(), cache: 'no-store' });
  if (res.status === 401) {
    await handleUnauthorized();
    return [];
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo cargar la galería.');
  uiState.gallery = Array.isArray(data.images) ? data.images : [];
  return uiState.gallery;
}

// ============================================================
// RENDERIZADO: PANEL DE KPIs DEL MÓDULO
// ============================================================
function renderKpisPanelMarkup() {
  const container = uiState.kpisContainerId ? document.getElementById(uiState.kpisContainerId) : null;
  if (!container) return;

  const active = uiState.kpis.filter(k => k.activo !== false);
  const isCarousel = active.length > 4;
  const totalCount = uiState.kpis.length;
  const activeCount = active.length;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.85rem; margin-bottom:1.15rem;">
      <div>
        <h2 style="font-family:var(--font-head); font-size:1.25rem; font-weight:800; color:#05111F; margin:0;">
          <i class="fas fa-tachometer-alt" style="color:#00C2E0; margin-right:6px;"></i>Indicadores KPI del Módulo
        </h2>
        <p style="font-size:0.86rem; color:#5E7A8E; margin:2px 0 0;">Agrega nuevos KPIs o edita valor, título, texto inferior e ícono. Si hay más de 4 visibles, el portal activa un carrusel automático.</p>
      </div>
      <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
        <button type="button" id="muiBtnNewKpi" style="padding:0.65rem 1.15rem; background:#00C2E0; color:#05111F; font-weight:700; border-radius:10px; border:none; cursor:pointer;">
          <i class="fas fa-plus"></i> Agregar KPI
        </button>
        <button type="button" id="muiBtnResetKpis" style="padding:0.65rem 1.05rem; background:#F1F5F9; color:#0C1F30; font-weight:600; border-radius:10px; border:1px solid #CBD5E1; cursor:pointer;">
          <i class="fas fa-undo"></i> Restaurar KPIs base
        </button>
      </div>
    </div>

    <div style="margin-bottom:1.25rem; background:#fff; border:1px solid rgba(26,92,143,0.16); border-left:5px solid #00C2E0; border-radius:14px; padding:1rem 1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.85rem;">
      <div style="font-size:0.85rem; color:#334155;">
        ${isCarousel
          ? `<strong>Modo Carrusel Automático Activo:</strong> Hay ${activeCount} KPIs visibles (&gt;4), por lo que se despliegan en carrusel interactivo en la página pública.`
          : `<strong>Modo Cuadrícula Estática:</strong> Hay ${activeCount} KPIs visibles. Al habilitar más de 4 KPIs visibles se activará automáticamente el carrusel.`}
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <span style="font-size:0.78rem; font-weight:700; padding:4px 10px; border-radius:20px; background:#F0F5FB; color:#1A5C8F;">${activeCount} visibles / ${totalCount} total</span>
        <span style="font-size:0.78rem; font-weight:700; padding:4px 10px; border-radius:20px; background:${isCarousel ? '#DCFCE7' : '#E0F2FE'}; color:${isCarousel ? '#15803D' : '#0369A1'};">
          ${isCarousel ? 'Carrusel Automático (>4)' : 'Cuadrícula Estática'}
        </span>
      </div>
    </div>

    <div style="background:#0C2033; border-radius:16px; padding:1.1rem 1.25rem; margin-bottom:1.25rem; border:1px solid rgba(0,194,224,0.18);">
      <div style="font-size:0.72rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#00C2E0; margin-bottom:0.75rem;">
        <i class="fas fa-eye" style="margin-right:6px;"></i>Vista Previa de KPIs Visibles
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1px; background:rgba(0,194,224,0.12); border:1px solid rgba(0,194,224,0.12); border-radius:12px; overflow:hidden;">
        ${active.length === 0
          ? '<div style="padding:1rem; text-align:center; color:#A8BFCC;">No hay KPIs visibles.</div>'
          : active.map(k => {
              const valLabel = k.modoValor === 'auto' ? `AUTO${k.sufijo || ''}` : `${k.valor ?? 0}${k.sufijo || ''}`;
              return `
                <div style="background:#0C2033; padding:0.95rem 0.75rem; text-align:center;">
                  <div style="font-size:1.1rem; color:#00C2E0; margin-bottom:0.3rem;"><i class="${sanitizeIcon(k.icono)}"></i></div>
                  <div style="font-family:var(--font-head); font-size:1.35rem; font-weight:800; color:#fff;">${esc(valLabel)}</div>
                  <div style="font-size:0.75rem; font-weight:700; color:rgba(255,255,255,0.82); margin-top:0.2rem;">${esc(k.titulo)}</div>
                  <div style="font-size:0.67rem; color:#A8BFCC; margin-top:0.15rem;">${esc(k.descripcion || '')}</div>
                </div>
              `;
            }).join('')}
      </div>
    </div>

    <div style="background:#fff; border-radius:16px; padding:1.25rem; box-shadow:0 4px 18px rgba(5,17,31,0.06);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.9rem; flex-wrap:wrap; gap:0.65rem;">
        <input type="text" id="muiKpiSearch" placeholder="Buscar KPI por título, texto o ícono..." style="padding:0.55rem 0.9rem; width:300px; max-width:100%; border:1px solid rgba(26,92,143,0.2); border-radius:8px;" />
        <span style="font-size:0.84rem; color:#5E7A8E; font-weight:600;">${totalCount} KPIs registrados</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.88rem;">
          <thead>
            <tr style="background:#F0F5FB; border-bottom:2px solid rgba(26,92,143,0.14);">
              <th style="padding:0.75rem;">Orden</th>
              <th style="padding:0.75rem;">Ícono</th>
              <th style="padding:0.75rem;">Cifra / Fuente</th>
              <th style="padding:0.75rem;">Título y Texto debajo</th>
              <th style="padding:0.75rem;">Visibilidad</th>
              <th style="padding:0.75rem; text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="muiKpisTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('muiBtnNewKpi')?.addEventListener('click', () => openKpiModal(null));
  document.getElementById('muiBtnResetKpis')?.addEventListener('click', () => openResetConfirmModal('kpis'));
  document.getElementById('muiKpiSearch')?.addEventListener('input', (e) => renderKpisTableRows(e.target.value));
  renderKpisTableRows('');
}

function renderKpisTableRows(searchQuery = '') {
  const tbody = document.getElementById('muiKpisTableBody');
  if (!tbody) return;
  const q = String(searchQuery || '').trim().toLowerCase();
  const filtered = q
    ? uiState.kpis.filter(k =>
        String(k.titulo || '').toLowerCase().includes(q) ||
        String(k.descripcion || '').toLowerCase().includes(q) ||
        String(k.icono || '').toLowerCase().includes(q) ||
        String(k.valor || '').toLowerCase().includes(q)
      )
    : uiState.kpis;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:1.75rem; text-align:center; color:#5E7A8E;">No hay KPIs que coincidan con la búsqueda.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((k, idx) => {
    const safeIcon = sanitizeIcon(k.icono);
    const isActive = k.activo !== false;
    const canUp = !q && idx > 0;
    const canDown = !q && idx < filtered.length - 1;
    const isAuto = k.modoValor === 'auto';
    const autoLabel = (uiState.autoKeysCatalog.find(a => a.key === k.autoKey)?.label) || k.autoKey || 'Automático';
    return `
      <tr style="border-bottom:1px solid #E8EEF7; ${!isActive ? 'opacity:0.62; background:#F8FAFC;' : ''}">
        <td style="padding:0.75rem; white-space:nowrap;">
          <div style="display:flex; align-items:center; gap:0.35rem;">
            <span style="font-weight:800; color:#1A5C8F; min-width:22px;">#${esc(String(k.orden || idx + 1))}</span>
            <button type="button" class="mui-kpi-move" data-id="${k.id}" data-delta="-1" ${canUp ? '' : 'disabled'} style="padding:3px 6px; border-radius:6px; border:1px solid #CBD5E1; background:#fff; cursor:${canUp ? 'pointer' : 'not-allowed'}; opacity:${canUp ? '1' : '0.35'};"><i class="fas fa-chevron-up" style="font-size:0.7rem;"></i></button>
            <button type="button" class="mui-kpi-move" data-id="${k.id}" data-delta="1" ${canDown ? '' : 'disabled'} style="padding:3px 6px; border-radius:6px; border:1px solid #CBD5E1; background:#fff; cursor:${canDown ? 'pointer' : 'not-allowed'}; opacity:${canDown ? '1' : '0.35'};"><i class="fas fa-chevron-down" style="font-size:0.7rem;"></i></button>
          </div>
        </td>
        <td style="padding:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="width:36px; height:36px; border-radius:9px; background:#0C2033; color:#00C2E0; display:flex; align-items:center; justify-content:center;"><i class="${safeIcon}"></i></div>
            <code style="font-size:0.74rem; color:#5E7A8E; background:#F0F5FB; padding:2px 6px; border-radius:6px;">${esc(safeIcon)}</code>
          </div>
        </td>
        <td style="padding:0.75rem;">
          ${isAuto
            ? `<span style="display:inline-block; padding:3px 8px; border-radius:8px; background:#E0F2FE; color:#0369A1; font-size:0.75rem; font-weight:700;"><i class="fas fa-bolt" style="margin-right:4px;"></i>Dinámico${k.sufijo ? ' (' + esc(k.sufijo) + ')' : ''}</span>
               <div style="font-size:0.72rem; color:#5E7A8E; margin-top:2px;">${esc(autoLabel)}</div>`
            : `<span style="font-family:var(--font-head); font-size:1.1rem; font-weight:800; color:#05111F;">${esc(String(k.valor ?? '0'))}${esc(k.sufijo || '')}</span>
               <div style="font-size:0.71rem; color:#5E7A8E;">Valor manual</div>`}
        </td>
        <td style="padding:0.75rem; max-width:320px;">
          <div style="font-weight:700; color:#05111F;">${esc(k.titulo)}</div>
          <div style="font-size:0.78rem; color:#5E7A8E; margin-top:2px;">${k.descripcion ? esc(k.descripcion) : '<span style="color:#A8BFCC;">Sin texto descriptivo</span>'}</div>
        </td>
        <td style="padding:0.75rem;">
          <button type="button" class="mui-kpi-toggle" data-id="${k.id}" style="padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; border:none; cursor:pointer; ${isActive ? 'background:#DCFCE7; color:#15803D;' : 'background:#FEF3C7; color:#92400E;'}">
            <i class="fas ${isActive ? 'fa-eye' : 'fa-eye-slash'}" style="margin-right:4px;"></i>${isActive ? 'Visible' : 'Oculta'}
          </button>
        </td>
        <td style="padding:0.75rem; text-align:right; white-space:nowrap;">
          <button type="button" class="mui-kpi-edit" data-id="${k.id}" style="padding:0.42rem 0.78rem; background:#00C2E0; color:#05111F; border-radius:8px; font-weight:700; margin-right:0.35rem; cursor:pointer;"><i class="fas fa-edit"></i> Editar</button>
          <button type="button" class="mui-kpi-del" data-id="${k.id}" style="padding:0.42rem 0.72rem; background:#EF4444; color:#fff; border-radius:8px; font-weight:600; cursor:pointer;" title="Eliminar KPI"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.mui-kpi-move').forEach(btn => {
    btn.addEventListener('click', () => moveKpi(Number(btn.dataset.id), Number(btn.dataset.delta)));
  });
  tbody.querySelectorAll('.mui-kpi-toggle').forEach(btn => {
    btn.addEventListener('click', () => toggleKpi(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.mui-kpi-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const kpi = uiState.kpis.find(x => Number(x.id) === Number(btn.dataset.id));
      if (kpi) openKpiModal(kpi);
    });
  });
  tbody.querySelectorAll('.mui-kpi-del').forEach(btn => {
    btn.addEventListener('click', () => openDeleteKpiModal(Number(btn.dataset.id)));
  });
}

// ============================================================
// RENDERIZADO: PANEL DE IMÁGENES DE FONDO
// ============================================================
function renderBackgroundsPanelMarkup() {
  const container = uiState.backgroundsContainerId ? document.getElementById(uiState.backgroundsContainerId) : null;
  if (!container) return;

  const activeBgs = uiState.backgrounds.filter(b => b.activo !== false);
  const currentSlide = activeBgs[uiState.previewSlideIdx % Math.max(1, activeBgs.length)] || uiState.backgrounds[0] || null;
  const currentUrl = currentSlide ? sanitizeImageUrl(currentSlide.url) : null;
  const porqueExisteUrl = sanitizeImageUrl(uiState.sectionImages?.porqueExiste || '/img/wallpaperdirectorio.jpg');

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.85rem; margin-bottom:1.15rem;">
      <div>
        <h2 style="font-family:var(--font-head); font-size:1.25rem; font-weight:800; color:#05111F; margin:0;">
          <i class="fas fa-images" style="color:#00C2E0; margin-right:6px;"></i>Imágenes de Fondo del Banner
        </h2>
        <p style="font-size:0.86rem; color:#5E7A8E; margin:2px 0 0;">Sube nuevas fotografías desde tu computadora o elige imágenes institucionales para actualizar el carrusel de fondo sin depender de TI.</p>
      </div>
      <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
        <button type="button" id="muiBtnNewBg" style="padding:0.65rem 1.15rem; background:#00C2E0; color:#05111F; font-weight:700; border-radius:10px; border:none; cursor:pointer;">
          <i class="fas fa-plus"></i> Agregar / Subir Fondo
        </button>
        <button type="button" id="muiBtnResetBgs" style="padding:0.65rem 1.05rem; background:#F1F5F9; color:#0C1F30; font-weight:600; border-radius:10px; border:1px solid #CBD5E1; cursor:pointer;">
          <i class="fas fa-undo"></i> Restaurar fondos base
        </button>
      </div>
    </div>

    <!-- Vista previa en vivo del carrusel de fondo -->
    <div style="position:relative; border-radius:18px; overflow:hidden; min-height:200px; background:#05111F; margin-bottom:1.25rem; border:1px solid rgba(0,194,224,0.25); box-shadow:0 10px 28px rgba(5,17,31,0.16); display:flex; align-items:flex-end;">
      <div id="muiBgHeroPreviewImg" style="position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.65; ${currentUrl ? `background-image:url('${esc(currentUrl)}')` : ''}"></div>
      <div style="position:absolute; inset:0; background:linear-gradient(135deg, rgba(5,17,31,0.84) 0%, rgba(12,32,51,0.52) 100%);"></div>
      <div style="position:relative; z-index:2; width:100%; padding:1.35rem 1.5rem; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">
        <div>
          <span style="display:inline-block; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#00C2E0; margin-bottom:0.35rem;">
            <i class="fas fa-eye"></i> Vista Previa del Carrusel de Fondo (${activeBgs.length} activas)
          </span>
          <div style="font-family:var(--font-head); font-size:1.15rem; font-weight:800; color:#fff;">
            ${currentSlide ? esc(currentSlide.titulo || 'Fondo activo') : 'Sin fondos activos'}
          </div>
          <div style="font-size:0.76rem; color:rgba(255,255,255,0.72); font-family:monospace;">
            ${currentSlide ? esc(currentSlide.url) : ''}
          </div>
        </div>
        ${activeBgs.length > 1 ? `
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <button type="button" id="muiBgPrevSlideBtn" style="width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.14); color:#fff; border:1px solid rgba(255,255,255,0.28); cursor:pointer;"><i class="fas fa-chevron-left"></i></button>
            <span style="font-size:0.8rem; color:#fff; font-weight:700;">${(uiState.previewSlideIdx % activeBgs.length) + 1} / ${activeBgs.length}</span>
            <button type="button" id="muiBgNextSlideBtn" style="width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.14); color:#fff; border:1px solid rgba(255,255,255,0.28); cursor:pointer;"><i class="fas fa-chevron-right"></i></button>
          </div>
        ` : ''}
      </div>
    </div>

    ${uiState.module === 'portal' ? `
      <div style="background:#fff; border:1px solid rgba(26,92,143,0.16); border-left:5px solid #2B82C9; border-radius:14px; padding:1.1rem 1.3rem; margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:1rem; flex:1; min-width:250px;">
          <img src="${esc(porqueExisteUrl || '/img/wallpaperdirectorio.jpg')}" alt="Imagen ¿Por qué existe?" style="width:110px; height:68px; object-fit:cover; border-radius:10px; border:1px solid #CBD5E1; flex-shrink:0;" />
          <div>
            <div style="font-weight:800; color:#05111F; font-size:0.95rem;">Imagen de Sección "¿Por qué existe?" (Portal Principal)</div>
            <div style="font-size:0.78rem; color:#5E7A8E; font-family:monospace; margin-top:2px;">${esc(porqueExisteUrl || '/img/wallpaperdirectorio.jpg')}</div>
          </div>
        </div>
        <button type="button" id="muiBtnChangePorqueExiste" style="padding:0.6rem 1.05rem; background:#163250; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer;">
          <i class="fas fa-image"></i> Cambiar Imagen de Sección
        </button>
      </div>
    ` : ''}

    <div style="background:#fff; border-radius:16px; padding:1.25rem; box-shadow:0 4px 18px rgba(5,17,31,0.06);">
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.88rem;">
          <thead>
            <tr style="background:#F0F5FB; border-bottom:2px solid rgba(26,92,143,0.14);">
              <th style="padding:0.75rem;">Orden</th>
              <th style="padding:0.75rem;">Vista Previa</th>
              <th style="padding:0.75rem;">Título y Ruta</th>
              <th style="padding:0.75rem;">Visibilidad</th>
              <th style="padding:0.75rem; text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="muiBgsTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('muiBtnNewBg')?.addEventListener('click', () => openBgModal({ mode: 'slide', bg: null }));
  document.getElementById('muiBtnResetBgs')?.addEventListener('click', () => openResetConfirmModal('backgrounds'));
  document.getElementById('muiBtnChangePorqueExiste')?.addEventListener('click', () => openBgModal({ mode: 'section_porque_existe', bg: { url: porqueExisteUrl, titulo: '¿Por qué existe?' } }));
  document.getElementById('muiBgPrevSlideBtn')?.addEventListener('click', () => {
    if (activeBgs.length > 0) {
      uiState.previewSlideIdx = (uiState.previewSlideIdx - 1 + activeBgs.length) % activeBgs.length;
      renderBackgroundsPanelMarkup();
    }
  });
  document.getElementById('muiBgNextSlideBtn')?.addEventListener('click', () => {
    if (activeBgs.length > 0) {
      uiState.previewSlideIdx = (uiState.previewSlideIdx + 1) % activeBgs.length;
      renderBackgroundsPanelMarkup();
    }
  });

  renderBackgroundsTableRows();
}

function renderBackgroundsTableRows() {
  const tbody = document.getElementById('muiBgsTableBody');
  if (!tbody) return;
  if (uiState.backgrounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:1.5rem; text-align:center; color:#5E7A8E;">No hay imágenes de fondo configuradas.</td></tr>';
    return;
  }

  tbody.innerHTML = uiState.backgrounds.map((b, idx) => {
    const safeUrl = sanitizeImageUrl(b.url) || '/img/wallpaperportal2.png';
    const isActive = b.activo !== false;
    const canUp = idx > 0;
    const canDown = idx < uiState.backgrounds.length - 1;
    const isUpload = safeUrl.startsWith('/uploads/');
    return `
      <tr style="border-bottom:1px solid #E8EEF7; ${!isActive ? 'opacity:0.62; background:#F8FAFC;' : ''}">
        <td style="padding:0.75rem; white-space:nowrap;">
          <div style="display:flex; align-items:center; gap:0.35rem;">
            <span style="font-weight:800; color:#1A5C8F; min-width:22px;">#${esc(String(b.orden || idx + 1))}</span>
            <button type="button" class="mui-bg-move" data-id="${b.id}" data-delta="-1" ${canUp ? '' : 'disabled'} style="padding:3px 6px; border-radius:6px; border:1px solid #CBD5E1; background:#fff; cursor:${canUp ? 'pointer' : 'not-allowed'}; opacity:${canUp ? '1' : '0.35'};"><i class="fas fa-chevron-up" style="font-size:0.7rem;"></i></button>
            <button type="button" class="mui-bg-move" data-id="${b.id}" data-delta="1" ${canDown ? '' : 'disabled'} style="padding:3px 6px; border-radius:6px; border:1px solid #CBD5E1; background:#fff; cursor:${canDown ? 'pointer' : 'not-allowed'}; opacity:${canDown ? '1' : '0.35'};"><i class="fas fa-chevron-down" style="font-size:0.7rem;"></i></button>
          </div>
        </td>
        <td style="padding:0.75rem;">
          <img src="${esc(safeUrl)}" alt="${esc(b.titulo)}" style="width:112px; height:64px; object-fit:cover; border-radius:10px; border:1px solid #CBD5E1; background:#05111F;" />
        </td>
        <td style="padding:0.75rem;">
          <div style="font-weight:700; color:#05111F;">${esc(b.titulo || `Fondo ${b.id}`)}</div>
          <div style="font-size:0.75rem; color:#5E7A8E; font-family:monospace; margin-top:2px;">${esc(safeUrl)}</div>
          <span style="display:inline-block; margin-top:4px; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:12px; background:${isUpload ? '#EDE9FE' : '#E0F2FE'}; color:${isUpload ? '#6D28D9' : '#0369A1'};">
            ${isUpload ? 'Imagen cargada por administrador' : (safeUrl.startsWith('/img/') ? 'Galería institucional' : 'URL externa')}
          </span>
        </td>
        <td style="padding:0.75rem;">
          <button type="button" class="mui-bg-toggle" data-id="${b.id}" style="padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; border:none; cursor:pointer; ${isActive ? 'background:#DCFCE7; color:#15803D;' : 'background:#FEF3C7; color:#92400E;'}">
            <i class="fas ${isActive ? 'fa-eye' : 'fa-eye-slash'}" style="margin-right:4px;"></i>${isActive ? 'Visible' : 'Oculta'}
          </button>
        </td>
        <td style="padding:0.75rem; text-align:right; white-space:nowrap;">
          <button type="button" class="mui-bg-edit" data-id="${b.id}" style="padding:0.42rem 0.78rem; background:#00C2E0; color:#05111F; border-radius:8px; font-weight:700; margin-right:0.35rem; cursor:pointer;"><i class="fas fa-edit"></i> Editar</button>
          <button type="button" class="mui-bg-del" data-id="${b.id}" style="padding:0.42rem 0.72rem; background:#EF4444; color:#fff; border-radius:8px; font-weight:600; cursor:pointer;" title="Quitar fondo"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.mui-bg-move').forEach(btn => {
    btn.addEventListener('click', () => moveBg(Number(btn.dataset.id), Number(btn.dataset.delta)));
  });
  tbody.querySelectorAll('.mui-bg-toggle').forEach(btn => {
    btn.addEventListener('click', () => toggleBg(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.mui-bg-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const bg = uiState.backgrounds.find(x => Number(x.id) === Number(btn.dataset.id));
      if (bg) openBgModal({ mode: 'slide', bg });
    });
  });
  tbody.querySelectorAll('.mui-bg-del').forEach(btn => {
    btn.addEventListener('click', () => openDeleteBgModal(Number(btn.dataset.id)));
  });
}

// ============================================================
// MODALES COMPARTIDOS (KPI, FONDO, ELIMINACIONES, RESTAURAR)
// ============================================================
function ensureSharedModals() {
  if (document.getElementById('muiSharedModalsRoot')) return;
  const root = document.createElement('div');
  root.id = 'muiSharedModalsRoot';
  root.innerHTML = `
    <!-- Modal Crear / Editar KPI de Módulo -->
    <div id="muiKpiModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.72); backdrop-filter:blur(8px); z-index:1120; align-items:center; justify-content:center; padding:1rem;">
      <div style="background:#fff; border-radius:20px; max-width:700px; width:100%; max-height:92vh; overflow-y:auto; padding:1.65rem 1.85rem; box-shadow:0 24px 60px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E8EEF7; padding-bottom:0.8rem; margin-bottom:1.1rem;">
          <h3 id="muiKpiModalTitle" style="font-family:var(--font-head); font-size:1.3rem; color:#05111F; margin:0;">Nuevo KPI del Módulo</h3>
          <button type="button" id="muiKpiModalClose" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#5E7A8E;">&times;</button>
        </div>

        <div style="background:#0C2033; border-radius:14px; padding:1rem 1.2rem; text-align:center; margin-bottom:1.15rem; border:1px solid rgba(0,194,224,0.22);">
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.5); margin-bottom:0.4rem;">Vista previa del KPI</div>
          <div id="muiKpiPrevIcon" style="font-size:1.3rem; color:#00C2E0; margin-bottom:0.35rem;"><i class="fas fa-chart-line"></i></div>
          <div id="muiKpiPrevVal" style="font-family:var(--font-head); font-size:1.85rem; font-weight:800; color:#fff; line-height:1;">0</div>
          <div id="muiKpiPrevTitle" style="font-size:0.84rem; font-weight:700; color:rgba(255,255,255,0.82); margin-top:0.25rem;">Título del KPI</div>
          <div id="muiKpiPrevDesc" style="font-size:0.72rem; color:#A8BFCC; margin-top:0.15rem;">Texto descriptivo inferior</div>
        </div>

        <form id="muiKpiForm">
          <div style="margin-bottom:0.9rem;">
            <label style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Origen del valor</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
              <label style="display:flex; align-items:center; gap:0.5rem; padding:0.65rem 0.85rem; border:1px solid #CBD5E1; border-radius:10px; cursor:pointer; background:#F8FAFC;">
                <input type="radio" name="muiModoValor" id="muiModoManual" value="manual" checked />
                <span style="font-size:0.86rem; font-weight:700; color:#05111F;">Valor manual / fijo</span>
              </label>
              <label style="display:flex; align-items:center; gap:0.5rem; padding:0.65rem 0.85rem; border:1px solid #CBD5E1; border-radius:10px; cursor:pointer; background:#F8FAFC;">
                <input type="radio" name="muiModoValor" id="muiModoAuto" value="auto" />
                <span style="font-size:0.86rem; font-weight:700; color:#05111F;">Calculado desde los datos</span>
              </label>
            </div>
          </div>

          <div id="muiAutoSourceRow" style="display:none; margin-bottom:0.9rem;">
            <label for="muiKpiAutoKey" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Dato automático vinculado *</label>
            <select id="muiKpiAutoKey" style="width:100%; padding:0.68rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-size:0.92rem; background:#fff;"></select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem; margin-bottom:0.9rem;">
            <div id="muiManualValorWrap">
              <label for="muiKpiValor" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Valor (número o texto corto) *</label>
              <input type="text" id="muiKpiValor" maxlength="40" style="width:100%; padding:0.68rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-size:0.94rem;" placeholder="Ej. 100, 24/7 o Validada" />
            </div>
            <div>
              <label for="muiKpiSufijo" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Sufijo opcional (+, %, etc.)</label>
              <div style="display:flex; gap:0.35rem;">
                <input type="text" id="muiKpiSufijo" maxlength="12" style="flex:1; padding:0.68rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-size:0.94rem;" placeholder="Ej. +" />
                <button type="button" class="mui-suf-preset" data-suf="+" style="padding:0 0.65rem; border-radius:8px; border:1px solid #CBD5E1; background:#F8FAFC; font-weight:700;">+</button>
                <button type="button" class="mui-suf-preset" data-suf="%" style="padding:0 0.65rem; border-radius:8px; border:1px solid #CBD5E1; background:#F8FAFC; font-weight:700;">%</button>
                <button type="button" class="mui-suf-preset" data-suf="" style="padding:0 0.6rem; border-radius:8px; border:1px solid #CBD5E1; background:#F8FAFC; font-size:0.78rem;">N/A</button>
              </div>
            </div>
          </div>

          <div style="margin-bottom:0.9rem;">
            <label for="muiKpiTitulo" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Título principal del KPI *</label>
            <input type="text" id="muiKpiTitulo" maxlength="120" required style="width:100%; padding:0.68rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-size:0.94rem;" placeholder="Ej. Instituciones atendidas" />
          </div>

          <div style="margin-bottom:0.9rem;">
            <label for="muiKpiDesc" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Texto debajo del KPI (Descripción / Tooltip)</label>
            <textarea id="muiKpiDesc" rows="2" maxlength="240" style="width:100%; padding:0.68rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-size:0.9rem; resize:vertical;" placeholder="Texto aclaratorio visible debajo del indicador"></textarea>
          </div>

          <div style="margin-bottom:0.9rem;">
            <label for="muiKpiIcono" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Ícono FontAwesome *</label>
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.55rem;">
              <div id="muiKpiIconInputPreview" style="width:40px; height:40px; border-radius:10px; background:#0C2033; color:#00C2E0; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-chart-line"></i></div>
              <input type="text" id="muiKpiIcono" required style="flex:1; padding:0.65rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-family:monospace; font-size:0.88rem;" placeholder="fas fa-chart-line" />
            </div>
            <div id="muiKpiIconGallery" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:0.4rem; max-height:155px; overflow-y:auto; padding:0.6rem; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px;">
              ${MODULE_UI_ICON_GALLERY.map(ic => `
                <button type="button" class="mui-icon-choice" data-icon="${ic.cls}" style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:0.45rem 0.3rem; border-radius:8px; border:1px solid #E2E8F0; background:#fff; color:#0C1F30; font-size:0.7rem; cursor:pointer;">
                  <i class="${ic.cls}" style="font-size:1rem; color:#1A5C8F;"></i>
                  <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${esc(ic.label)}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; padding:0.7rem 0.95rem; background:#F0F5FB; border-radius:12px; margin-bottom:1.15rem;">
            <label style="display:flex; align-items:center; gap:0.5rem; font-weight:700; color:#05111F; cursor:pointer;">
              <input type="checkbox" id="muiKpiActivo" checked style="width:17px; height:17px;" /> Visible en el portal público
            </label>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <label for="muiKpiOrden" style="font-weight:700; font-size:0.84rem;">Posición:</label>
              <input type="number" id="muiKpiOrden" min="1" step="1" style="width:74px; padding:0.35rem 0.5rem; border:1px solid #A8BFCC; border-radius:8px; text-align:center;" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
            <button type="button" id="muiKpiModalCancel" style="padding:0.7rem 1.3rem; background:#E8EEF7; color:#05111F; border-radius:10px; font-weight:600; cursor:pointer;">Cancelar</button>
            <button type="submit" id="muiKpiSubmitBtn" style="padding:0.7rem 1.4rem; background:#00C2E0; color:#05111F; border-radius:10px; font-weight:700; cursor:pointer;">Guardar KPI</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Agregar / Editar Imagen de Fondo -->
    <div id="muiBgModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.72); backdrop-filter:blur(8px); z-index:1120; align-items:center; justify-content:center; padding:1rem;">
      <div style="background:#fff; border-radius:20px; max-width:740px; width:100%; max-height:92vh; overflow-y:auto; padding:1.65rem 1.85rem; box-shadow:0 24px 60px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E8EEF7; padding-bottom:0.8rem; margin-bottom:1.1rem;">
          <h3 id="muiBgModalTitle" style="font-family:var(--font-head); font-size:1.3rem; color:#05111F; margin:0;">Configurar Imagen de Fondo</h3>
          <button type="button" id="muiBgModalClose" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#5E7A8E;">&times;</button>
        </div>

        <div id="muiBgModalPreviewBox" style="position:relative; height:150px; border-radius:14px; overflow:hidden; background:#05111F; margin-bottom:1rem; border:1px solid #CBD5E1; display:flex; align-items:flex-end;">
          <div id="muiBgModalPreviewImg" style="position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.82;"></div>
          <div style="position:absolute; inset:0; background:linear-gradient(180deg, transparent 35%, rgba(5,17,31,0.75) 100%);"></div>
          <div style="position:relative; z-index:2; padding:0.75rem 1rem; color:#fff; font-size:0.8rem; font-weight:700;" id="muiBgModalPreviewCaption">Vista previa del fondo</div>
        </div>

        <form id="muiBgForm">
          <!-- Subida directa desde el equipo -->
          <div style="background:#F0F9FF; border:1px dashed #00C2E0; border-radius:12px; padding:0.9rem 1rem; margin-bottom:1rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
            <div>
              <div style="font-weight:800; color:#05111F; font-size:0.88rem;"><i class="fas fa-cloud-upload-alt" style="color:#0284C7; margin-right:6px;"></i>Subir nueva imagen desde tu equipo</div>
              <div style="font-size:0.76rem; color:#5E7A8E;">Formatos PNG, JPG o WEBP (máximo 5 MB). Se almacenará de forma segura en el servidor.</div>
            </div>
            <label style="padding:0.55rem 1rem; background:#0284C7; color:#fff; border-radius:9px; font-weight:700; font-size:0.83rem; cursor:pointer;">
              <i class="fas fa-folder-open" style="margin-right:5px;"></i>Seleccionar archivo
              <input type="file" id="muiBgFileInput" accept="image/png,image/jpeg,image/webp" style="display:none;" />
            </label>
          </div>

          <div style="margin-bottom:0.9rem;">
            <label for="muiBgUrl" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Ruta de imagen o URL https:// *</label>
            <input type="text" id="muiBgUrl" required style="width:100%; padding:0.65rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-family:monospace; font-size:0.86rem;" placeholder="/img/wallpaperportal2.png" />
          </div>

          <div id="muiBgTitleRow" style="margin-bottom:0.9rem;">
            <label for="muiBgTitulo" style="display:block; font-weight:700; color:#0C1F30; font-size:0.85rem; margin-bottom:0.35rem;">Nombre descriptivo</label>
            <input type="text" id="muiBgTitulo" maxlength="100" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #A8BFCC; border-radius:10px; font-size:0.92rem;" placeholder="Ej. Fondo Institucional 2026" />
          </div>

          <!-- Galería rápida del servidor -->
          <div style="margin-bottom:0.95rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <label style="font-weight:700; color:#0C1F30; font-size:0.85rem;">O seleccionar de la Galería del Portal</label>
              <input type="text" id="muiBgGalleryFilter" placeholder="Filtrar imágenes..." style="padding:0.3rem 0.65rem; font-size:0.78rem; border:1px solid #CBD5E1; border-radius:7px; width:170px;" />
            </div>
            <div id="muiBgGalleryGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(112px, 1fr)); gap:0.5rem; max-height:190px; overflow-y:auto; padding:0.65rem; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px;">
              <div style="grid-column:1/-1; text-align:center; color:#5E7A8E; font-size:0.82rem; padding:1rem;">Cargando galería...</div>
            </div>
          </div>

          <div id="muiBgVisibilityRow" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; padding:0.7rem 0.95rem; background:#F0F5FB; border-radius:12px; margin-bottom:1.15rem;">
            <label style="display:flex; align-items:center; gap:0.5rem; font-weight:700; color:#05111F; cursor:pointer;">
              <input type="checkbox" id="muiBgActivo" checked style="width:17px; height:17px;" /> Visible en el banner público
            </label>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <label for="muiBgOrden" style="font-weight:700; font-size:0.84rem;">Posición:</label>
              <input type="number" id="muiBgOrden" min="1" step="1" style="width:74px; padding:0.35rem 0.5rem; border:1px solid #A8BFCC; border-radius:8px; text-align:center;" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
            <button type="button" id="muiBgModalCancel" style="padding:0.7rem 1.3rem; background:#E8EEF7; color:#05111F; border-radius:10px; font-weight:600; cursor:pointer;">Cancelar</button>
            <button type="submit" id="muiBgSubmitBtn" style="padding:0.7rem 1.4rem; background:#00C2E0; color:#05111F; border-radius:10px; font-weight:700; cursor:pointer;">Guardar Fondo</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Confirmación de Eliminación / Restauración (iframe-safe) -->
    <div id="muiConfirmModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.72); backdrop-filter:blur(8px); z-index:1140; align-items:center; justify-content:center; padding:1rem;">
      <div style="background:#fff; border-radius:20px; max-width:460px; width:100%; padding:1.6rem 1.75rem; box-shadow:0 24px 60px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.9rem;">
          <h3 id="muiConfirmTitle" style="font-family:var(--font-head); font-size:1.2rem; color:#05111F; margin:0;">Confirmar acción</h3>
          <button type="button" id="muiConfirmClose" style="background:none; border:none; font-size:1.45rem; cursor:pointer; color:#5E7A8E;">&times;</button>
        </div>
        <p id="muiConfirmMessage" style="color:#334155; font-size:0.92rem; line-height:1.5; margin-bottom:1.25rem;"></p>
        <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" id="muiConfirmCancel" style="padding:0.68rem 1.2rem; background:#E8EEF7; color:#05111F; border-radius:10px; font-weight:600; cursor:pointer;">Cancelar</button>
          <button type="button" id="muiConfirmAccept" style="padding:0.68rem 1.3rem; background:#EF4444; color:#fff; border-radius:10px; font-weight:700; cursor:pointer;">Confirmar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // Eventos KPI Modal
  document.getElementById('muiKpiModalClose')?.addEventListener('click', closeKpiModal);
  document.getElementById('muiKpiModalCancel')?.addEventListener('click', closeKpiModal);
  document.getElementById('muiKpiModal')?.addEventListener('click', (e) => { if (e.target.id === 'muiKpiModal') closeKpiModal(); });
  document.getElementById('muiKpiForm')?.addEventListener('submit', submitKpiForm);
  document.querySelectorAll('input[name="muiModoValor"]').forEach(r => r.addEventListener('change', syncKpiModeInputs));
  ['muiKpiValor', 'muiKpiSufijo', 'muiKpiTitulo', 'muiKpiDesc', 'muiKpiIcono', 'muiKpiAutoKey'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateKpiModalPreview);
    document.getElementById(id)?.addEventListener('change', updateKpiModalPreview);
  });
  document.querySelectorAll('.mui-suf-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById('muiKpiSufijo');
      if (el) { el.value = btn.dataset.suf || ''; updateKpiModalPreview(); }
    });
  });
  document.querySelectorAll('.mui-icon-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById('muiKpiIcono');
      if (el) { el.value = btn.dataset.icon || 'fas fa-chart-line'; updateKpiModalPreview(); }
    });
  });

  // Eventos Fondo Modal
  document.getElementById('muiBgModalClose')?.addEventListener('click', closeBgModal);
  document.getElementById('muiBgModalCancel')?.addEventListener('click', closeBgModal);
  document.getElementById('muiBgModal')?.addEventListener('click', (e) => { if (e.target.id === 'muiBgModal') closeBgModal(); });
  document.getElementById('muiBgForm')?.addEventListener('submit', submitBgForm);
  document.getElementById('muiBgUrl')?.addEventListener('input', updateBgModalPreview);
  document.getElementById('muiBgTitulo')?.addEventListener('input', updateBgModalPreview);
  document.getElementById('muiBgGalleryFilter')?.addEventListener('input', (e) => renderBgGalleryGrid(e.target.value));
  document.getElementById('muiBgFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Subiendo imagen...', 'info');
      const uploaded = await uploadImageFile(file, uiState.module);
      if (!uploaded) return;
      const urlInput = document.getElementById('muiBgUrl');
      const titleInput = document.getElementById('muiBgTitulo');
      if (urlInput) urlInput.value = uploaded.url;
      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80);
      }
      updateBgModalPreview();
      await loadGallery();
      renderBgGalleryGrid(document.getElementById('muiBgGalleryFilter')?.value || '');
      toast('Imagen subida correctamente al servidor', 'success');
    } catch (err) {
      toast(err.message || 'No se pudo subir la imagen', 'error');
    } finally {
      e.target.value = '';
    }
  });

  // Eventos Confirm Modal
  document.getElementById('muiConfirmClose')?.addEventListener('click', closeConfirmModal);
  document.getElementById('muiConfirmCancel')?.addEventListener('click', closeConfirmModal);
  document.getElementById('muiConfirmModal')?.addEventListener('click', (e) => { if (e.target.id === 'muiConfirmModal') closeConfirmModal(); });
  document.getElementById('muiConfirmAccept')?.addEventListener('click', executePendingConfirmation);
}

let bgModalTargetMode = 'slide'; // 'slide' | 'section_porque_existe'

function syncKpiModeInputs() {
  const isAuto = document.getElementById('muiModoAuto')?.checked;
  const autoRow = document.getElementById('muiAutoSourceRow');
  const manualWrap = document.getElementById('muiManualValorWrap');
  const valInput = document.getElementById('muiKpiValor');
  if (autoRow) autoRow.style.display = isAuto ? 'block' : 'none';
  if (manualWrap) manualWrap.style.display = isAuto ? 'none' : 'block';
  if (valInput) valInput.required = !isAuto;
  updateKpiModalPreview();
}

function updateKpiModalPreview() {
  const isAuto = document.getElementById('muiModoAuto')?.checked;
  const val = isAuto ? 'AUTO' : (document.getElementById('muiKpiValor')?.value.trim() || '0');
  const suf = document.getElementById('muiKpiSufijo')?.value || '';
  const tit = document.getElementById('muiKpiTitulo')?.value.trim() || 'Título del KPI';
  const desc = document.getElementById('muiKpiDesc')?.value.trim() || 'Texto descriptivo inferior';
  const safeIcon = sanitizeIcon(document.getElementById('muiKpiIcono')?.value || '', 'fas fa-chart-line');

  const pIcon = document.getElementById('muiKpiPrevIcon');
  const pInIcon = document.getElementById('muiKpiIconInputPreview');
  const pVal = document.getElementById('muiKpiPrevVal');
  const pTit = document.getElementById('muiKpiPrevTitle');
  const pDesc = document.getElementById('muiKpiPrevDesc');
  if (pIcon) pIcon.innerHTML = `<i class="${safeIcon}"></i>`;
  if (pInIcon) pInIcon.innerHTML = `<i class="${safeIcon}"></i>`;
  if (pVal) pVal.textContent = `${val}${suf}`;
  if (pTit) pTit.textContent = tit;
  if (pDesc) pDesc.textContent = desc;

  document.querySelectorAll('.mui-icon-choice').forEach(btn => {
    const sel = (btn.dataset.icon || '').toLowerCase() === safeIcon.toLowerCase();
    btn.style.borderColor = sel ? '#00C2E0' : '#E2E8F0';
    btn.style.background = sel ? '#E0F7FA' : '#fff';
  });
}

function openKpiModal(kpi = null) {
  ensureSharedModals();
  uiState.editingKpiId = kpi ? Number(kpi.id) : null;
  const modal = document.getElementById('muiKpiModal');
  const titleEl = document.getElementById('muiKpiModalTitle');
  const autoSelect = document.getElementById('muiKpiAutoKey');
  const autoRadio = document.getElementById('muiModoAuto');
  const manualRadio = document.getElementById('muiModoManual');

  if (autoSelect) {
    if (uiState.autoKeysCatalog.length > 0) {
      autoSelect.innerHTML = uiState.autoKeysCatalog.map(a => `<option value="${esc(a.key)}">${esc(a.label)}</option>`).join('');
      if (autoRadio) autoRadio.disabled = false;
    } else {
      autoSelect.innerHTML = '<option value="">Sin fuentes automáticas</option>';
      if (autoRadio) autoRadio.disabled = true;
    }
  }

  if (titleEl) titleEl.textContent = kpi ? `Editar KPI #${kpi.id}` : 'Agregar Nuevo KPI al Módulo';

  const isAuto = kpi?.modoValor === 'auto' && uiState.autoKeysCatalog.length > 0;
  if (autoRadio) autoRadio.checked = isAuto;
  if (manualRadio) manualRadio.checked = !isAuto;
  if (autoSelect && kpi?.autoKey) autoSelect.value = kpi.autoKey;

  document.getElementById('muiKpiValor').value = kpi ? String(kpi.valor ?? '0') : '';
  document.getElementById('muiKpiSufijo').value = kpi ? (kpi.sufijo || '') : '';
  document.getElementById('muiKpiTitulo').value = kpi ? (kpi.titulo || '') : '';
  document.getElementById('muiKpiDesc').value = kpi ? (kpi.descripcion || '') : '';
  document.getElementById('muiKpiIcono').value = kpi ? sanitizeIcon(kpi.icono) : 'fas fa-chart-line';
  document.getElementById('muiKpiActivo').checked = kpi ? (kpi.activo !== false) : true;
  document.getElementById('muiKpiOrden').value = kpi ? String(kpi.orden || 1) : String(uiState.kpis.length + 1);

  syncKpiModeInputs();
  if (modal) modal.style.display = 'flex';
}

function closeKpiModal() {
  const modal = document.getElementById('muiKpiModal');
  if (modal) modal.style.display = 'none';
  uiState.editingKpiId = null;
}

async function submitKpiForm(e) {
  e.preventDefault();
  const isAuto = Boolean(document.getElementById('muiModoAuto')?.checked);
  const payload = {
    modoValor: isAuto ? 'auto' : 'manual',
    autoKey: isAuto ? (document.getElementById('muiKpiAutoKey')?.value || '') : null,
    valor: isAuto ? '0' : (document.getElementById('muiKpiValor')?.value.trim() || ''),
    sufijo: document.getElementById('muiKpiSufijo')?.value.trim() || '',
    titulo: document.getElementById('muiKpiTitulo')?.value.trim() || '',
    descripcion: document.getElementById('muiKpiDesc')?.value.trim() || '',
    icono: document.getElementById('muiKpiIcono')?.value.trim() || 'fas fa-chart-line',
    activo: Boolean(document.getElementById('muiKpiActivo')?.checked),
    orden: Number(document.getElementById('muiKpiOrden')?.value || (uiState.kpis.length + 1))
  };

  const btn = document.getElementById('muiKpiSubmitBtn');
  if (btn) btn.disabled = true;
  try {
    const isEdit = Boolean(uiState.editingKpiId);
    const url = isEdit
      ? `/api/admin/ui/${encodeURIComponent(uiState.module)}/kpis/${uiState.editingKpiId}`
      : `/api/admin/ui/${encodeURIComponent(uiState.module)}/kpis`;
    const data = await mutateUiEndpoint(url, isEdit ? 'PUT' : 'POST', payload);
    if (!data) return;
    uiState.kpis = Array.isArray(data.kpis) ? data.kpis : uiState.kpis;
    closeKpiModal();
    renderKpisPanelMarkup();
    toast(isEdit ? 'KPI actualizado correctamente' : 'Nuevo KPI agregado al módulo', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo guardar el KPI', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function toggleKpi(id) {
  const kpi = uiState.kpis.find(k => Number(k.id) === Number(id));
  if (!kpi) return;
  try {
    const data = await mutateUiEndpoint(
      `/api/admin/ui/${encodeURIComponent(uiState.module)}/kpis/${id}`,
      'PUT',
      { activo: !(kpi.activo !== false) }
    );
    if (!data) return;
    uiState.kpis = Array.isArray(data.kpis) ? data.kpis : uiState.kpis;
    renderKpisPanelMarkup();
    toast('Visibilidad del KPI actualizada', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo actualizar visibilidad', 'error');
  }
}

async function moveKpi(id, delta) {
  const idx = uiState.kpis.findIndex(k => Number(k.id) === Number(id));
  if (idx === -1) return;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= uiState.kpis.length) return;
  const reordered = [...uiState.kpis];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(targetIdx, 0, moved);
  try {
    const data = await mutateUiEndpoint(
      `/api/admin/ui/${encodeURIComponent(uiState.module)}/kpis/reorder`,
      'PUT',
      { orderedIds: reordered.map(k => k.id) }
    );
    if (!data) return;
    uiState.kpis = Array.isArray(data.kpis) ? data.kpis : reordered;
    renderKpisPanelMarkup();
    toast('Orden de KPIs actualizado', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo reordenar los KPIs', 'error');
  }
}

// Modales de Imagen de Fondo
function updateBgModalPreview() {
  const rawUrl = document.getElementById('muiBgUrl')?.value || '';
  const safeUrl = sanitizeImageUrl(rawUrl);
  const titulo = document.getElementById('muiBgTitulo')?.value.trim() || 'Vista previa del fondo';
  const prevImg = document.getElementById('muiBgModalPreviewImg');
  const prevCap = document.getElementById('muiBgModalPreviewCaption');
  if (prevImg) prevImg.style.backgroundImage = safeUrl ? `url("${safeUrl}")` : 'none';
  if (prevCap) prevCap.textContent = safeUrl ? `${titulo} (${safeUrl})` : 'Ingresa o selecciona una imagen válida';
}

function renderBgGalleryGrid(filterQuery = '') {
  const grid = document.getElementById('muiBgGalleryGrid');
  if (!grid) return;
  const q = String(filterQuery || '').trim().toLowerCase();
  const list = q ? uiState.gallery.filter(g => g.name.toLowerCase().includes(q) || g.url.toLowerCase().includes(q)) : uiState.gallery;
  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#5E7A8E; font-size:0.82rem; padding:1rem;">Sin imágenes coincidentes.</div>';
    return;
  }

  const currentUrl = (document.getElementById('muiBgUrl')?.value || '').trim();
  grid.innerHTML = list.map(img => {
    const selected = img.url === currentUrl;
    const isUpload = img.source === 'upload';
    return `
      <div style="position:relative; border-radius:9px; overflow:hidden; border:2px solid ${selected ? '#00C2E0' : '#E2E8F0'}; background:#fff;">
        <button type="button" class="mui-gallery-pick" data-url="${esc(img.url)}" data-name="${esc(img.name)}" style="display:block; width:100%; padding:0; background:none; border:none; cursor:pointer; text-align:left;">
          <img src="${esc(img.url)}" alt="${esc(img.name)}" style="width:100%; height:64px; object-fit:cover; display:block; background:#05111F;" />
          <div style="padding:4px 5px; font-size:0.66rem; color:#0C1F30; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:${selected ? '700' : '500'};" title="${esc(img.name)}">
            ${esc(img.name)}
          </div>
        </button>
        ${isUpload ? `
          <button type="button" class="mui-gallery-del-file" data-filename="${esc(img.name)}" title="Eliminar archivo subido" style="position:absolute; top:4px; right:4px; width:20px; height:20px; border-radius:50%; background:rgba(239,68,68,0.9); color:#fff; border:none; font-size:0.65rem; display:flex; align-items:center; justify-content:center; cursor:pointer;">
            <i class="fas fa-times"></i>
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.mui-gallery-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const urlIn = document.getElementById('muiBgUrl');
      const titIn = document.getElementById('muiBgTitulo');
      if (urlIn) urlIn.value = btn.dataset.url || '';
      if (titIn && !titIn.value.trim()) {
        titIn.value = (btn.dataset.name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80);
      }
      updateBgModalPreview();
      renderBgGalleryGrid(document.getElementById('muiBgGalleryFilter')?.value || '');
    });
  });

  grid.querySelectorAll('.mui-gallery-del-file').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const fname = btn.dataset.filename;
      if (!fname) return;
      try {
        const res = await fetch(`/api/admin/ui/backgrounds/upload/${encodeURIComponent(fname)}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        if (res.status === 401) { await handleUnauthorized(); return; }
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'No se pudo borrar la imagen.');
        await loadGallery();
        renderBgGalleryGrid(document.getElementById('muiBgGalleryFilter')?.value || '');
        toast('Imagen subida eliminada del servidor', 'success');
      } catch (err) {
        toast(err.message || 'Error al eliminar archivo', 'error');
      }
    });
  });
}

async function openBgModal({ mode = 'slide', bg = null } = {}) {
  ensureSharedModals();
  bgModalTargetMode = mode;
  uiState.editingBgId = (mode === 'slide' && bg && bg.id) ? Number(bg.id) : null;

  const modal = document.getElementById('muiBgModal');
  const titleEl = document.getElementById('muiBgModalTitle');
  const titleRow = document.getElementById('muiBgTitleRow');
  const visRow = document.getElementById('muiBgVisibilityRow');

  if (mode === 'section_porque_existe') {
    if (titleEl) titleEl.textContent = 'Cambiar Imagen: "¿Por qué existe?"';
    if (titleRow) titleRow.style.display = 'none';
    if (visRow) visRow.style.display = 'none';
  } else {
    if (titleEl) titleEl.textContent = uiState.editingBgId ? `Editar Fondo #${uiState.editingBgId}` : 'Agregar Nueva Imagen de Fondo';
    if (titleRow) titleRow.style.display = 'block';
    if (visRow) visRow.style.display = 'flex';
  }

  document.getElementById('muiBgUrl').value = bg?.url || '';
  document.getElementById('muiBgTitulo').value = bg?.titulo || '';
  document.getElementById('muiBgActivo').checked = bg ? (bg.activo !== false) : true;
  document.getElementById('muiBgOrden').value = bg?.orden ? String(bg.orden) : String(uiState.backgrounds.length + 1);
  document.getElementById('muiBgGalleryFilter').value = '';

  updateBgModalPreview();
  if (modal) modal.style.display = 'flex';

  try {
    await loadGallery();
    renderBgGalleryGrid('');
  } catch (err) {
    toast(err.message || 'No se pudo cargar la galería', 'error');
  }
}

function closeBgModal() {
  const modal = document.getElementById('muiBgModal');
  if (modal) modal.style.display = 'none';
  uiState.editingBgId = null;
}

async function submitBgForm(e) {
  e.preventDefault();
  const urlVal = document.getElementById('muiBgUrl')?.value.trim() || '';
  if (!sanitizeImageUrl(urlVal)) {
    toast('Ingresa o selecciona una ruta de imagen válida (/img/..., /uploads/backgrounds/... o https://...).', 'error');
    return;
  }

  const btn = document.getElementById('muiBgSubmitBtn');
  if (btn) btn.disabled = true;

  try {
    if (bgModalTargetMode === 'section_porque_existe') {
      const data = await mutateUiEndpoint(`/api/admin/ui/portal/section-images`, 'PUT', { porqueExiste: urlVal });
      if (!data) return;
      uiState.sectionImages = data.sectionImages || { porqueExiste: urlVal };
      closeBgModal();
      renderBackgroundsPanelMarkup();
      toast('Imagen de sección "¿Por qué existe?" actualizada', 'success');
      return;
    }

    const payload = {
      url: urlVal,
      titulo: document.getElementById('muiBgTitulo')?.value.trim() || 'Fondo institucional',
      activo: Boolean(document.getElementById('muiBgActivo')?.checked),
      orden: Number(document.getElementById('muiBgOrden')?.value || (uiState.backgrounds.length + 1))
    };

    const isEdit = Boolean(uiState.editingBgId);
    const endpoint = isEdit
      ? `/api/admin/ui/${encodeURIComponent(uiState.module)}/backgrounds/${uiState.editingBgId}`
      : `/api/admin/ui/${encodeURIComponent(uiState.module)}/backgrounds`;
    const data = await mutateUiEndpoint(endpoint, isEdit ? 'PUT' : 'POST', payload);
    if (!data) return;
    uiState.backgrounds = Array.isArray(data.backgrounds) ? data.backgrounds : uiState.backgrounds;
    closeBgModal();
    renderBackgroundsPanelMarkup();
    toast(isEdit ? 'Fondo actualizado correctamente' : 'Nuevo fondo agregado al carrusel', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo guardar el fondo', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function toggleBg(id) {
  const bg = uiState.backgrounds.find(b => Number(b.id) === Number(id));
  if (!bg) return;
  try {
    const data = await mutateUiEndpoint(
      `/api/admin/ui/${encodeURIComponent(uiState.module)}/backgrounds/${id}`,
      'PUT',
      { activo: !(bg.activo !== false) }
    );
    if (!data) return;
    uiState.backgrounds = Array.isArray(data.backgrounds) ? data.backgrounds : uiState.backgrounds;
    renderBackgroundsPanelMarkup();
    toast('Visibilidad del fondo actualizada', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo actualizar el fondo', 'error');
  }
}

async function moveBg(id, delta) {
  const idx = uiState.backgrounds.findIndex(b => Number(b.id) === Number(id));
  if (idx === -1) return;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= uiState.backgrounds.length) return;
  const reordered = [...uiState.backgrounds];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(targetIdx, 0, moved);
  try {
    const data = await mutateUiEndpoint(
      `/api/admin/ui/${encodeURIComponent(uiState.module)}/backgrounds/reorder`,
      'PUT',
      { orderedIds: reordered.map(b => b.id) }
    );
    if (!data) return;
    uiState.backgrounds = Array.isArray(data.backgrounds) ? data.backgrounds : reordered;
    renderBackgroundsPanelMarkup();
    toast('Orden de fondos actualizado', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo reordenar los fondos', 'error');
  }
}

// Confirmaciones sin window.confirm
function openDeleteKpiModal(id) {
  const kpi = uiState.kpis.find(k => Number(k.id) === Number(id));
  if (!kpi) return;
  if (uiState.kpis.length <= 1) {
    toast('Debe permanecer al menos un KPI registrado en el módulo.', 'warning');
    return;
  }
  ensureSharedModals();
  uiState.pendingDeleteKpiId = Number(id);
  uiState.pendingDeleteBgId = null;
  uiState.pendingResetScope = null;
  document.getElementById('muiConfirmTitle').textContent = 'Eliminar KPI del módulo';
  document.getElementById('muiConfirmMessage').textContent = `¿Seguro que deseas eliminar el KPI "${kpi.titulo}"? Esta acción actualizará el módulo público.`;
  document.getElementById('muiConfirmAccept').style.background = '#EF4444';
  document.getElementById('muiConfirmAccept').textContent = 'Sí, eliminar KPI';
  document.getElementById('muiConfirmModal').style.display = 'flex';
}

function openDeleteBgModal(id) {
  const bg = uiState.backgrounds.find(b => Number(b.id) === Number(id));
  if (!bg) return;
  if (uiState.backgrounds.length <= 1) {
    toast('Debe permanecer al menos una imagen de fondo configurada.', 'warning');
    return;
  }
  ensureSharedModals();
  uiState.pendingDeleteBgId = Number(id);
  uiState.pendingDeleteKpiId = null;
  uiState.pendingResetScope = null;
  document.getElementById('muiConfirmTitle').textContent = 'Quitar imagen de fondo';
  document.getElementById('muiConfirmMessage').textContent = `¿Seguro que deseas quitar "${bg.titulo || bg.url}" del carrusel de fondo de este módulo?`;
  document.getElementById('muiConfirmAccept').style.background = '#EF4444';
  document.getElementById('muiConfirmAccept').textContent = 'Sí, quitar fondo';
  document.getElementById('muiConfirmModal').style.display = 'flex';
}

function openResetConfirmModal(scope) {
  ensureSharedModals();
  uiState.pendingResetScope = scope;
  uiState.pendingDeleteKpiId = null;
  uiState.pendingDeleteBgId = null;
  const label = scope === 'kpis' ? 'los KPIs predeterminados' : 'las imágenes de fondo predeterminadas';
  document.getElementById('muiConfirmTitle').textContent = 'Restaurar valores predeterminados';
  document.getElementById('muiConfirmMessage').textContent = `¿Deseas restaurar ${label} de este módulo? Se creará un respaldo automático previo.`;
  document.getElementById('muiConfirmAccept').style.background = '#1A5C8F';
  document.getElementById('muiConfirmAccept').textContent = 'Restaurar';
  document.getElementById('muiConfirmModal').style.display = 'flex';
}

function closeConfirmModal() {
  const modal = document.getElementById('muiConfirmModal');
  if (modal) modal.style.display = 'none';
  uiState.pendingDeleteKpiId = null;
  uiState.pendingDeleteBgId = null;
  uiState.pendingResetScope = null;
}

async function executePendingConfirmation() {
  const btn = document.getElementById('muiConfirmAccept');
  if (btn) btn.disabled = true;
  try {
    if (uiState.pendingDeleteKpiId) {
      const data = await mutateUiEndpoint(`/api/admin/ui/${encodeURIComponent(uiState.module)}/kpis/${uiState.pendingDeleteKpiId}`, 'DELETE');
      if (!data) return;
      uiState.kpis = Array.isArray(data.kpis) ? data.kpis : uiState.kpis;
      closeConfirmModal();
      renderKpisPanelMarkup();
      toast('KPI eliminado correctamente', 'success');
    } else if (uiState.pendingDeleteBgId) {
      const data = await mutateUiEndpoint(`/api/admin/ui/${encodeURIComponent(uiState.module)}/backgrounds/${uiState.pendingDeleteBgId}`, 'DELETE');
      if (!data) return;
      uiState.backgrounds = Array.isArray(data.backgrounds) ? data.backgrounds : uiState.backgrounds;
      uiState.previewSlideIdx = 0;
      closeConfirmModal();
      renderBackgroundsPanelMarkup();
      toast('Imagen de fondo eliminada del carrusel', 'success');
    } else if (uiState.pendingResetScope) {
      const scope = uiState.pendingResetScope;
      const data = await mutateUiEndpoint(`/api/admin/ui/${encodeURIComponent(uiState.module)}/reset-defaults`, 'POST', { scope });
      if (!data) return;
      if (scope === 'kpis') uiState.kpis = data.kpis || [];
      else {
        uiState.backgrounds = data.backgrounds || [];
        uiState.sectionImages = data.sectionImages || {};
        uiState.previewSlideIdx = 0;
      }
      closeConfirmModal();
      if (scope === 'kpis') renderKpisPanelMarkup();
      else renderBackgroundsPanelMarkup();
      toast('Valores predeterminados restaurados correctamente', 'success');
    }
  } catch (err) {
    toast(err.message || 'No se pudo completar la acción', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function mountModuleUiTabs({ module, kpisContainerId = null, backgroundsContainerId = null, deps }) {
  uiState.module = module;
  uiState.kpisContainerId = kpisContainerId;
  uiState.backgroundsContainerId = backgroundsContainerId;
  uiState.previewSlideIdx = 0;
  uiState.deps = deps;
  ensureSharedModals();

  try {
    await fetchUiConfig(module);
    if (kpisContainerId) renderKpisPanelMarkup();
    if (backgroundsContainerId) renderBackgroundsPanelMarkup();
  } catch (err) {
    toast(err.message || 'No se pudo inicializar el gestor visual', 'error');
  }
}
