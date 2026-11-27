// admin/js/multilingual-guide-manager.js
// Módulo unificado de administración:
// 1. Guía Multilingüe (Portal Inclusión Universal, Canales Guía Maya, Diccionario pia-i18n)
// 2. Guía Técnica de Implementación (Desarrollo) integrada en el mismo módulo
// 3. Sincronización global Producción <-> Preview (Firestore + Respaldo .json + Materialización en Código)

import {
  getCloudSyncAuthState,
  connectGoogleForCloudSync
} from './firebase-firestore.js';
import {
  syncMultilingualSectionToCloud,
  pushAllDataAndTextsToCloud,
  materializeCodeOnServer
} from './texts-sync-ui.js';
import { initTechnicalGuide } from './technical-guide.js';

let depsRef = {
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
  showToast: () => {},
  authLogout: async () => {}
};

const state = {
  activeTab: 'portal', // 'portal' | 'canales' | 'i18n' | 'tech-guide'
  activeLang: {
    portal: 'es',
    canales: 'kiche',
    i18n: 'en'
  },
  searchI18n: '',
  etag: null,
  sectionsMeta: {},
  portalModuleOrder: [],
  portalModuleLabels: {},
  portalLangOrder: [],
  canalesLangOrder: [],
  serverData: { portal: {}, canales: {}, i18n: {} },
  draftData: { portal: {}, canales: {}, i18n: {} },
  defaults: { portal: {}, canales: {}, i18n: {} },
  stats: { portal: { total: 0, modified: 0 }, canales: { total: 0, modified: 0 }, i18n: { total: 0, modified: 0 }, totalEntries: 0, totalModified: 0 },
  updatedAt: null,
  updatedBy: null,
  sectionUpdatedAt: {},
  cloudSync: null,
  cloudAuth: null,
  syncStatus: null,
  isSaving: false,
  techGuideMounted: false,
  pendingReset: null
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cloneJson(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function fmtTs(iso) {
  if (!iso) return 'Sin registro aún';
  try {
    return new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) {
    return iso;
  }
}

function speakPreview(text, langCode = 'es-GT') {
  const clean = String(text || '').trim();
  if (!clean) {
    depsRef.showToast('No hay texto de locución para reproducir.', 'info');
    return;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    depsRef.showToast('Tu navegador no soporta síntesis de voz Web Speech API.', 'info');
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = langCode || 'es-GT';
    utter.rate = 0.96;
    window.speechSynthesis.speak(utter);
  } catch (_) {
    depsRef.showToast('No se pudo iniciar la reproducción de audio.', 'error');
  }
}

function showInlineBanner(type, message, { showReload = false } = {}) {
  const box = document.getElementById('mgAlertBanner');
  if (!box) return;
  if (!message) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  const palette = type === 'error'
    ? { bg: '#FEF2F2', border: '#FCA5A5', color: '#991B1B', icon: 'fa-exclamation-circle' }
    : (type === 'warning'
      ? { bg: '#FFFBEB', border: '#FCD34D', color: '#92400E', icon: 'fa-exclamation-triangle' }
      : { bg: '#ECFDF5', border: '#86EFAC', color: '#166534', icon: 'fa-check-circle' });

  box.style.display = 'flex';
  box.style.background = palette.bg;
  box.style.borderColor = palette.border;
  box.style.color = palette.color;
  box.innerHTML = `
    <i class="fas ${palette.icon}" style="margin-top:2px;"></i>
    <span style="flex:1;">${esc(message)}</span>
    ${showReload ? `<button type="button" id="mgConflictReloadBtn" style="padding:0.35rem 0.75rem; background:#05111F; color:#00C2E0; border:none; border-radius:7px; font-weight:700; font-size:0.78rem; cursor:pointer;"><i class="fas fa-sync-alt"></i> Recargar ahora</button>` : ''}
    <button type="button" id="mgCloseAlertBtn" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;line-height:1;">&times;</button>
  `;
  document.getElementById('mgCloseAlertBtn')?.addEventListener('click', () => {
    box.style.display = 'none';
  });
  document.getElementById('mgConflictReloadBtn')?.addEventListener('click', () => {
    reloadAllData({ forceSync: true });
  });
}

function applyAdminPayload(payload) {
  state.sectionsMeta = payload.sectionsMeta || {};
  state.portalModuleOrder = Array.isArray(payload.portalModuleOrder) ? payload.portalModuleOrder : [];
  state.portalModuleLabels = payload.portalModuleLabels || {};
  state.portalLangOrder = Array.isArray(payload.portalLangOrder) ? payload.portalLangOrder : ['es', 'en', 'kiche', 'qeqchi', 'kaqchikel', 'mam'];
  state.canalesLangOrder = Array.isArray(payload.canalesLangOrder) ? payload.canalesLangOrder : ['es', 'en', 'kiche', 'qeqchi', 'kaqchikel', 'mam', 'tzutujil', 'poqomchi'];
  state.serverData = cloneJson(payload.data || { portal: {}, canales: {}, i18n: {} });
  state.draftData = cloneJson(payload.data || { portal: {}, canales: {}, i18n: {} });
  if (payload.defaults) {
    state.defaults = cloneJson(payload.defaults);
  }
  if (payload.stats) state.stats = payload.stats;
  state.updatedAt = payload.updatedAt || null;
  state.updatedBy = payload.updatedBy || null;
  state.sectionUpdatedAt = payload.sectionUpdatedAt || {};
  if (payload.cloudSync !== undefined) state.cloudSync = payload.cloudSync;
}

async function fetchAllState({ forceSync = false } = {}) {
  const mgUrl = forceSync ? '/api/admin/multilingual-guide?sync=1' : '/api/admin/multilingual-guide';
  const [mgRes, statusRes, cloudAuth] = await Promise.all([
    fetch(mgUrl, { headers: depsRef.getHeaders(), cache: 'no-store' }),
    fetch('/api/admin/sync/status', { headers: depsRef.getHeaders(), cache: 'no-store' }),
    getCloudSyncAuthState().catch(() => null)
  ]);

  if (mgRes.status === 401 || statusRes.status === 401) {
    await depsRef.authLogout('Tu sesión ha expirado o es inválida. Inicia sesión nuevamente.');
    return false;
  }

  const mgData = await mgRes.json().catch(() => ({}));
  if (!mgRes.ok) {
    throw new Error(mgData.error || 'No se pudo cargar la Guía Multilingüe.');
  }
  const etag = mgRes.headers.get('ETag');
  if (etag) state.etag = etag;
  applyAdminPayload(mgData);

  if (statusRes.ok) {
    state.syncStatus = await statusRes.json().catch(() => null);
  }
  state.cloudAuth = cloudAuth;
  return true;
}

async function refreshSyncStatusOnly() {
  try {
    const [statusRes, cloudAuth] = await Promise.all([
      fetch('/api/admin/sync/status', { headers: depsRef.getHeaders(), cache: 'no-store' }),
      getCloudSyncAuthState().catch(() => null)
    ]);
    if (statusRes.ok) {
      state.syncStatus = await statusRes.json().catch(() => null);
    }
    state.cloudAuth = cloudAuth;
    renderSyncStrip();
  } catch (_) {}
}

function getSectionDirtyLangs(section) {
  const dirty = [];
  const langs = section === 'portal' ? state.portalLangOrder : state.canalesLangOrder;
  for (const l of langs) {
    const cur = state.serverData?.[section]?.[l];
    const dr = state.draftData?.[section]?.[l];
    if (JSON.stringify(cur) !== JSON.stringify(dr)) {
      dirty.push(l);
    }
  }
  return dirty;
}

function isCurrentLangDirty(section, lang) {
  return JSON.stringify(state.serverData?.[section]?.[lang]) !== JSON.stringify(state.draftData?.[section]?.[lang]);
}

function updateDirtyIndicator() {
  const dirtyPortal = getSectionDirtyLangs('portal').length;
  const dirtyCanales = getSectionDirtyLangs('canales').length;
  const dirtyI18n = getSectionDirtyLangs('i18n').length;
  const totalDirtyLangs = dirtyPortal + dirtyCanales + dirtyI18n;

  const bar = document.getElementById('mgDirtyBar');
  const txt = document.getElementById('mgDirtyText');
  if (bar) {
    bar.style.display = (state.activeTab !== 'tech-guide' && totalDirtyLangs > 0) ? 'flex' : 'none';
  }
  if (txt) {
    txt.textContent = `Hay cambios sin guardar en ${totalDirtyLangs} ${totalDirtyLangs === 1 ? 'idioma' : 'idiomas'} de la Guía Multilingüe`;
  }

  ['portal', 'canales', 'i18n'].forEach(sec => {
    const btn = document.querySelector(`.mg-tab-btn[data-mg-tab="${sec}"]`);
    if (!btn) return;
    const count = sec === 'portal' ? dirtyPortal : (sec === 'canales' ? dirtyCanales : dirtyI18n);
    const dot = btn.querySelector('.mg-tab-dirty-dot');
    if (dot) dot.style.display = count > 0 ? 'inline-block' : 'none';
  });

  if (state.activeTab !== 'tech-guide') {
    const langs = state.activeTab === 'portal' ? state.portalLangOrder : state.canalesLangOrder;
    langs.forEach(l => {
      const pill = document.querySelector(`.mg-lang-pill[data-mg-lang="${l}"]`);
      if (!pill) return;
      const dot = pill.querySelector('.mg-lang-dirty');
      if (dot) dot.style.display = isCurrentLangDirty(state.activeTab, l) ? 'inline-block' : 'none';
    });
  }
}

function renderHeaderStats() {
  const container = document.getElementById('mgStatsRow');
  if (!container) return;
  const st = state.stats || {};
  container.innerHTML = `
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:14px; padding:0.95rem 1.15rem;">
      <div style="font-size:0.74rem; font-weight:700; color:#5E7A8E; text-transform:uppercase;">Portal Inclusión</div>
      <div style="font-size:1.35rem; font-weight:800; color:#05111F; margin-top:2px;">${state.portalLangOrder.length} idiomas · ${st.portal?.modified || 0} editados</div>
      <div style="font-size:0.75rem; color:#0284C7;">${st.portal?.total || 0} campos de audio y texto</div>
    </div>
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:14px; padding:0.95rem 1.15rem;">
      <div style="font-size:0.74rem; font-weight:700; color:#5E7A8E; text-transform:uppercase;">Canales Guía Maya</div>
      <div style="font-size:1.35rem; font-weight:800; color:#05111F; margin-top:2px;">${state.canalesLangOrder.length} idiomas · ${st.canales?.modified || 0} editados</div>
      <div style="font-size:0.75rem; color:#0284C7;">${st.canales?.total || 0} entradas (pasos, garantías, glosario)</div>
    </div>
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:14px; padding:0.95rem 1.15rem;">
      <div style="font-size:0.74rem; font-weight:700; color:#5E7A8E; text-transform:uppercase;">Diccionario pia-i18n</div>
      <div style="font-size:1.35rem; font-weight:800; color:#05111F; margin-top:2px;">${st.i18n?.total || 0} frases · ${st.i18n?.modified || 0} editadas</div>
      <div style="font-size:0.75rem; color:#0284C7;">Traducción dinámica de UI</div>
    </div>
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:14px; padding:0.95rem 1.15rem;">
      <div style="font-size:0.74rem; font-weight:700; color:#5E7A8E; text-transform:uppercase;">Última materialización</div>
      <div style="font-size:0.95rem; font-weight:800; color:#05111F; margin-top:4px;">${esc(fmtTs(state.updatedAt))}</div>
      <div style="font-size:0.75rem; color:#5E7A8E; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${state.updatedBy ? `Por ${esc(state.updatedBy)}` : 'Sin ediciones registradas'}</div>
    </div>
  `;
}

function renderSyncStrip() {
  const wrap = document.getElementById('mgGlobalSyncWrap');
  if (!wrap) return;

  const auth = state.cloudAuth;
  const isLinked = Boolean(auth?.isAuthorizedOperator);
  const email = auth?.email || '';
  const bakedList = Array.isArray(state.syncStatus?.bakedFiles) ? state.syncStatus.bakedFiles : [];
  const textsSummary = state.syncStatus?.textsSummary || {};
  const totalCustomTexts = Object.values(textsSummary).reduce((a, b) => a + Number(b || 0), 0);
  const datasetsSummary = state.syncStatus?.datasetsSummary || {};
  const datasetTotalItems = Object.values(datasetsSummary).reduce((a, d) => a + Number(d?.itemCount || 0), 0);

  const renderBakedBadge = (relPath, label) => {
    const info = bakedList.find(b => b.relativePath === relPath) || null;
    const ok = Boolean(info?.exists);
    const kb = info?.sizeBytes ? `${(info.sizeBytes / 1024).toFixed(1)} KB` : '0 KB';
    return `
      <span style="display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:8px; font-size:0.74rem; font-weight:700; background:${ok ? '#ECFDF5' : '#FEF2F2'}; color:${ok ? '#047857' : '#B91C1C'}; border:1px solid ${ok ? '#A7F3D0' : '#FECACA'};" title="${info?.mtimeIso ? `Actualizado: ${fmtTs(info.mtimeIso)}` : 'Archivo no generado aún'}">
        <i class="fas ${ok ? 'fa-file-code' : 'fa-exclamation-triangle'}"></i> ${esc(label)} · ${kb}
      </span>
    `;
  };

  wrap.innerHTML = `
    <div style="background:#FFFFFF; border:1px solid rgba(0,194,224,0.32); border-radius:16px; padding:1.1rem 1.25rem; margin-bottom:1.25rem; box-shadow:0 4px 16px rgba(5,17,31,0.04);">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.9rem;">
        <div style="display:flex; align-items:center; gap:0.85rem; flex:1; min-width:260px;">
          <div style="width:42px; height:42px; border-radius:12px; background:${isLinked ? '#ECFDF5' : '#EFF6FF'}; color:${isLinked ? '#059669' : '#1D4ED8'}; display:flex; align-items:center; justify-content:center; font-size:1.15rem; flex-shrink:0;">
            <i class="fas ${isLinked ? 'fa-cloud-upload-alt' : 'fa-cloud'}"></i>
          </div>
          <div style="font-size:0.84rem; line-height:1.45;">
            <div style="font-weight:800; color:#05111F;">
              ${isLinked
                ? `Sincronización Producción ↔ Preview activa (${esc(email)})`
                : 'Sincronización Producción ↔ Preview: vincula cuenta Google (@cnc.gob.gt)'}
            </div>
            <div style="color:#5E7A8E; font-size:0.78rem;">
              Persistencia automática en JSON + código JS y replicación Firestore · ${totalCustomTexts} textos personalizados · ${datasetTotalItems} registros JSON monitoreados
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          ${isLinked
            ? `<button type="button" id="mgPushAllCloudBtn" style="padding:0.52rem 0.9rem; background:#05111F; color:#00C2E0; border:none; border-radius:9px; font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Publicar todos los textos, guía multilingüe y datasets JSON a Firestore">
                <i class="fas fa-cloud-upload-alt"></i> Publicar Todo en Nube
              </button>`
            : `<button type="button" id="mgConnectGoogleBtn" style="padding:0.52rem 0.95rem; background:#1D4ED8; color:#fff; border:none; border-radius:9px; font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                <i class="fab fa-google"></i> Vincular Cuenta Google (@cnc.gob.gt)
              </button>`
          }
          <button type="button" id="mgPullAllCloudBtn" style="padding:0.52rem 0.88rem; background:#F0F9FF; color:#0369A1; border:1px solid #BAE6FD; border-radius:9px; font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Descargar textos, guía multilingüe y datos JSON desde Firestore hacia este servidor y regenerar código">
            <i class="fas fa-cloud-download-alt"></i> Traer Todo de Nube
          </button>
          <button type="button" id="mgMaterializeBtn" style="padding:0.52rem 0.88rem; background:#ECFEFF; color:#0E7490; border:1px solid #A5F3FC; border-radius:9px; font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Regenerar /js/pia-baked-texts.js, /js/pia-multilingual-data.js y /db/bakedTextOverrides.json desde disco">
            <i class="fas fa-code"></i> Materializar en Código
          </button>
          <button type="button" id="mgExportAllBtn" style="padding:0.52rem 0.88rem; background:#F8FAFC; color:#0F172A; border:1px solid #CBD5E1; border-radius:9px; font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
            <i class="fas fa-file-export"></i> Exportar Respaldo .json
          </button>
          <button type="button" id="mgImportAllBtn" style="padding:0.52rem 0.88rem; background:#F8FAFC; color:#0F172A; border:1px solid #CBD5E1; border-radius:9px; font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
            <i class="fas fa-file-import"></i> Importar Respaldo .json
          </button>
          <input type="file" id="mgImportAllFile" accept=".json,application/json" style="display:none;" />
        </div>
      </div>

      <div style="margin-top:0.85rem; padding-top:0.85rem; border-top:1px solid #F1F5F9; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.6rem;">
        <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
          <span style="font-size:0.75rem; font-weight:700; color:#475569; margin-right:4px;">Código materializado en disco:</span>
          ${renderBakedBadge('js/pia-baked-texts.js', 'js/pia-baked-texts.js')}
          ${renderBakedBadge('js/pia-multilingual-data.js', 'js/pia-multilingual-data.js')}
          ${renderBakedBadge('db/bakedTextOverrides.json', 'db/bakedTextOverrides.json')}
        </div>
        <div style="font-size:0.74rem; color:#64748B;">
          <i class="fas fa-terminal" style="color:#00C2E0; margin-right:4px;"></i>Sincronización CLI para repositorio: <code>npm run sync:cloud</code>
        </div>
      </div>
    </div>
  `;

  wireSyncStripEvents();
}

function wireSyncStripEvents() {
  const connectBtn = document.getElementById('mgConnectGoogleBtn');
  const pushAllBtn = document.getElementById('mgPushAllCloudBtn');
  const pullAllBtn = document.getElementById('mgPullAllCloudBtn');
  const materializeBtn = document.getElementById('mgMaterializeBtn');
  const exportBtn = document.getElementById('mgExportAllBtn');
  const importBtn = document.getElementById('mgImportAllBtn');
  const fileInput = document.getElementById('mgImportAllFile');

  connectBtn?.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vinculando...';
    try {
      const user = await connectGoogleForCloudSync();
      const pushRes = await pushAllDataAndTextsToCloud(depsRef.getHeaders, depsRef.authLogout).catch(() => null);
      const msg = pushRes
        ? `Cuenta ${user.email} vinculada y sincronización completa ejecutada (${pushRes.textsCount} textos, ${pushRes.mgCount} multilingüe, ${pushRes.dsCount} JSON).`
        : `Cuenta ${user.email} vinculada para sincronización en la nube.`;
      showInlineBanner('success', msg);
      depsRef.showToast(msg, 'success');
      await refreshSyncStatusOnly();
    } catch (err) {
      const msg = err?.message || 'No se pudo vincular la cuenta Google.';
      showInlineBanner('error', msg);
      depsRef.showToast(msg, 'error');
    } finally {
      connectBtn.disabled = false;
    }
  });

  pushAllBtn?.addEventListener('click', async () => {
    pushAllBtn.disabled = true;
    pushAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
    try {
      const res = await pushAllDataAndTextsToCloud(depsRef.getHeaders, depsRef.authLogout);
      if (res) {
        const msg = `Todo publicado en la nube compartida (${res.textsCount} catálogos de textos, ${res.mgCount} secciones multilingües, ${res.dsCount} conjuntos JSON).`;
        showInlineBanner('success', msg);
        depsRef.showToast(msg, 'success');
        await refreshSyncStatusOnly();
      }
    } catch (err) {
      const msg = err?.message || 'Error al publicar en la nube.';
      showInlineBanner('error', msg);
      depsRef.showToast(msg, 'error');
    } finally {
      pushAllBtn.disabled = false;
      pushAllBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publicar Todo en Nube';
    }
  });

  pullAllBtn?.addEventListener('click', async () => {
    pullAllBtn.disabled = true;
    pullAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Trayendo...';
    try {
      const res = await fetch('/api/admin/sync/pull-all-cloud', {
        method: 'POST',
        headers: depsRef.getHeaders(),
        cache: 'no-store'
      });
      if (res.status === 401) {
        await depsRef.authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo traer la información desde la nube.');

      await reloadAllData({ forceSync: false });
      const syncedTexts = (data.summary?.texts || []).filter(t => t.status === 'synced').length;
      const syncedDs = (data.summary?.datasets || []).filter(d => d.status === 'synced').length;
      const syncedMg = (data.summary?.multilingual || []).length;
      const msg = `Sincronización desde nube completada y materializada en código (textos: ${syncedTexts}, multilingüe: ${syncedMg}, JSON: ${syncedDs}).`;
      showInlineBanner('success', msg);
      depsRef.showToast(msg, 'success');
    } catch (err) {
      const msg = err?.message || 'Error al sincronizar desde la nube.';
      showInlineBanner('error', msg);
      depsRef.showToast(msg, 'error');
    } finally {
      pullAllBtn.disabled = false;
      pullAllBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Traer Todo de Nube';
    }
  });

  materializeBtn?.addEventListener('click', async () => {
    materializeBtn.disabled = true;
    materializeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
    try {
      const res = await materializeCodeOnServer(depsRef.getHeaders, depsRef.authLogout);
      if (res) {
        await refreshSyncStatusOnly();
        const msg = 'Archivos de código (/js/pia-baked-texts.js, /js/pia-multilingual-data.js y /db/bakedTextOverrides.json) materializados en disco.';
        showInlineBanner('success', msg);
        depsRef.showToast('Código materializado correctamente.', 'success');
      }
    } catch (err) {
      const msg = err?.message || 'Error al materializar el código.';
      showInlineBanner('error', msg);
      depsRef.showToast(msg, 'error');
    } finally {
      materializeBtn.disabled = false;
      materializeBtn.innerHTML = '<i class="fas fa-code"></i> Materializar en Código';
    }
  });

  exportBtn?.addEventListener('click', async () => {
    exportBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/sync/export-all', {
        headers: depsRef.getHeaders(),
        cache: 'no-store'
      });
      if (res.status === 401) {
        await depsRef.authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
        return;
      }
      const bundle = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(bundle.error || 'No se pudo generar el respaldo unificado.');

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pia-respaldo-completo-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      depsRef.showToast('Respaldo completo .json descargado.', 'success');
    } catch (err) {
      showInlineBanner('error', err.message);
      depsRef.showToast(err.message, 'error');
    } finally {
      exportBtn.disabled = false;
    }
  });

  importBtn?.addEventListener('click', () => {
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || (!parsed.texts && !parsed.multilingual && !parsed.datasets)) {
        throw new Error('El archivo .json no contiene bloques válidos ("texts", "multilingual" o "datasets").');
      }

      const res = await fetch('/api/admin/sync/import-all', {
        method: 'POST',
        headers: depsRef.getHeaders(),
        body: JSON.stringify({
          mode: 'merge',
          texts: parsed.texts,
          multilingual: parsed.multilingual,
          datasets: parsed.datasets
        }),
        cache: 'no-store'
      });
      if (res.status === 401) {
        await depsRef.authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
        return;
      }
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'No se pudo importar el respaldo completo.');

      await pushAllDataAndTextsToCloud(depsRef.getHeaders, depsRef.authLogout).catch(() => null);
      await reloadAllData({ forceSync: false });
      const msg = 'Respaldo unificado aplicado en archivos JSON, materializado en código y replicado en nube.';
      showInlineBanner('success', msg);
      depsRef.showToast(msg, 'success');
    } catch (err) {
      const msg = err?.message || 'El archivo seleccionado no es válido.';
      showInlineBanner('error', msg);
      depsRef.showToast(msg, 'error');
    }
  });
}

function getLangDisplayLabel(section, lang) {
  if (section === 'portal') {
    return state.draftData?.portal?.[lang]?.langName || lang;
  }
  if (section === 'canales') {
    return state.draftData?.canales?.[lang]?.name || lang;
  }
  const canalesName = state.draftData?.canales?.[lang]?.name;
  if (canalesName) return canalesName;
  const fallbackNames = {
    es: 'Español',
    en: 'English',
    kiche: "K'iche'",
    qeqchi: "Q'eqchi'",
    kaqchikel: 'Kaqchikel',
    mam: 'Mam',
    tzutujil: "Tz'utujil",
    poqomchi: "Poqomchi'"
  };
  return fallbackNames[lang] || lang;
}

function renderLangPills(section, langs) {
  const current = state.activeLang[section] || langs[0];
  return `
    <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.15rem;">
      ${langs.map(lang => {
        const isActive = lang === current;
        const dirty = isCurrentLangDirty(section, lang);
        const label = getLangDisplayLabel(section, lang);
        return `
          <button type="button" class="mg-lang-pill" data-mg-lang="${esc(lang)}" style="padding:0.48rem 0.9rem; border-radius:10px; border:1px solid ${isActive ? '#05111F' : '#CBD5E1'}; background:${isActive ? '#05111F' : '#fff'}; color:${isActive ? '#00C2E0' : '#0C1F30'}; font-weight:700; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
            <span>${esc(label)}</span>
            <span style="font-size:0.7rem; opacity:0.72;">(${esc(lang)})</span>
            <span class="mg-lang-dirty" style="display:${dirty ? 'inline-block' : 'none'}; width:8px; height:8px; border-radius:50%; background:#F59E0B;" title="Cambios sin guardar"></span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderPortalEditor() {
  const langs = state.portalLangOrder;
  const lang = langs.includes(state.activeLang.portal) ? state.activeLang.portal : langs[0];
  state.activeLang.portal = lang;
  const langObj = state.draftData.portal?.[lang] || { langName: lang, ttsLang: 'es-GT', modules: {} };
  const defObj = state.defaults.portal?.[lang] || {};
  const dirty = isCurrentLangDirty('portal', lang);

  return `
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:18px; padding:1.4rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
        <div>
          <h2 style="font-family:var(--font-head); font-size:1.25rem; color:#05111F; margin:0 0 0.25rem;">
            ${esc(state.sectionsMeta.portal?.label || 'Portal Principal (Inclusión Universal)')}
          </h2>
          <p style="font-size:0.84rem; color:#5E7A8E; margin:0;">
            ${esc(state.sectionsMeta.portal?.description || '')}
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" id="mgPortalResetLangBtn" style="padding:0.52rem 0.9rem; background:#fff; color:#B45309; border:1px solid #F59E0B; border-radius:9px; font-weight:700; font-size:0.8rem; cursor:pointer;">
            <i class="fas fa-undo-alt"></i> Restaurar Idioma (${esc(lang)})
          </button>
          <button type="button" id="mgPortalSaveBtn" ${state.isSaving ? 'disabled' : ''} style="padding:0.55rem 1.1rem; background:${dirty ? '#00C2E0' : '#05111F'}; color:${dirty ? '#05111F' : '#00C2E0'}; border:none; border-radius:9px; font-weight:800; font-size:0.82rem; cursor:pointer;">
            <i class="fas fa-save"></i> Guardar Idioma en JSON y Código
          </button>
        </div>
      </div>

      ${renderLangPills('portal', langs)}

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:0.9rem; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:0.95rem; margin-bottom:1.15rem;">
        <div>
          <label style="display:block; font-size:0.78rem; font-weight:700; color:#334155; margin-bottom:4px;">Nombre visible del idioma</label>
          <input type="text" id="mgPortalLangName" value="${esc(langObj.langName || '')}" maxlength="120" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.88rem; color:#05111F;" />
        </div>
        <div>
          <label style="display:block; font-size:0.78rem; font-weight:700; color:#334155; margin-bottom:4px;">Código de voz Web Speech (ttsLang)</label>
          <input type="text" id="mgPortalTtsLang" value="${esc(langObj.ttsLang || 'es-GT')}" maxlength="24" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.88rem; color:#05111F;" />
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr; gap:1rem;">
        ${state.portalModuleOrder.map(mk => {
          const mod = langObj.modules?.[mk] || { title: '', text: '' };
          const defMod = defObj.modules?.[mk] || { title: '', text: '' };
          const isModified = mod.title !== defMod.title || mod.text !== defMod.text;
          return `
            <div style="background:#FAFBFD; border:1px solid ${isModified ? '#7DD3FC' : '#E2E8F0'}; border-radius:14px; padding:1.05rem 1.15rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-bottom:0.7rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <strong style="color:#05111F; font-size:0.95rem;">${esc(state.portalModuleLabels[mk] || mk)}</strong>
                  <code style="font-size:0.74rem; background:#EEF2F7; color:#334155; padding:2px 7px; border-radius:6px;">${esc(mk)}</code>
                  ${isModified ? '<span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:999px; background:#E0F2FE; color:#0369A1;">Personalizado</span>' : ''}
                </div>
                <button type="button" class="mg-speak-portal-btn" data-mk="${esc(mk)}" style="padding:0.38rem 0.75rem; background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer;">
                  <i class="fas fa-volume-up"></i> Probar Audio
                </button>
              </div>
              <div style="margin-bottom:0.65rem;">
                <label style="display:block; font-size:0.76rem; font-weight:700; color:#475569; margin-bottom:4px;">Título de tarjeta / rama</label>
                <input type="text" class="mg-portal-title-input" data-mk="${esc(mk)}" value="${esc(mod.title || '')}" maxlength="200" style="width:100%; padding:0.55rem 0.8rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.88rem; color:#0C1F30; background:#fff;" />
              </div>
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <label style="font-size:0.76rem; font-weight:700; color:#475569;">Guión de lectura e inclusión auditiva</label>
                  <span class="mg-portal-len" data-mk="${esc(mk)}" style="font-size:0.73rem; color:#64748B;">${String(mod.text || '').length} / 2500</span>
                </div>
                <textarea class="mg-portal-text-input" data-mk="${esc(mk)}" rows="3" maxlength="2500" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #CBD5E1; border-radius:9px; font-size:0.88rem; font-family:inherit; color:#0C1F30; background:#fff; line-height:1.5; resize:vertical;">${esc(mod.text || '')}</textarea>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCanalesEditor() {
  const langs = state.canalesLangOrder;
  const lang = langs.includes(state.activeLang.canales) ? state.activeLang.canales : langs[0];
  state.activeLang.canales = lang;
  const obj = state.draftData.canales?.[lang] || {};
  const dirty = isCurrentLangDirty('canales', lang);

  return `
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:18px; padding:1.4rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
        <div>
          <h2 style="font-family:var(--font-head); font-size:1.25rem; color:#05111F; margin:0 0 0.25rem;">
            ${esc(state.sectionsMeta.canales?.label || 'Canales por la Integridad (Guía Maya)')}
          </h2>
          <p style="font-size:0.84rem; color:#5E7A8E; margin:0;">
            ${esc(state.sectionsMeta.canales?.description || '')}
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" id="mgCanalesResetLangBtn" style="padding:0.52rem 0.9rem; background:#fff; color:#B45309; border:1px solid #F59E0B; border-radius:9px; font-weight:700; font-size:0.8rem; cursor:pointer;">
            <i class="fas fa-undo-alt"></i> Restaurar Idioma (${esc(lang)})
          </button>
          <button type="button" id="mgCanalesSaveBtn" ${state.isSaving ? 'disabled' : ''} style="padding:0.55rem 1.1rem; background:${dirty ? '#00C2E0' : '#05111F'}; color:${dirty ? '#05111F' : '#00C2E0'}; border:none; border-radius:9px; font-weight:800; font-size:0.82rem; cursor:pointer;">
            <i class="fas fa-save"></i> Guardar Guía Maya en JSON y Código
          </button>
        </div>
      </div>

      ${renderLangPills('canales', langs)}

      <!-- Encabezados y locución principal -->
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:14px; padding:1.05rem; margin-bottom:1.15rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
          <strong style="color:#05111F; font-size:0.96rem;"><i class="fas fa-heading" style="color:#00C2E0; margin-right:6px;"></i>Metadatos, Títulos y Resumen Auditivo</strong>
          <button type="button" id="mgCanalesSpeakSummaryBtn" style="padding:0.38rem 0.75rem; background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer;">
            <i class="fas fa-volume-up"></i> Probar Locución Principal
          </button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem; margin-bottom:0.75rem;">
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Nombre del idioma</label>
            <input type="text" class="mg-canales-field" data-field="name" value="${esc(obj.name || '')}" maxlength="120" style="width:100%; padding:0.5rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff;" />
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Región / Etiqueta (badge)</label>
            <input type="text" class="mg-canales-field" data-field="badge" value="${esc(obj.badge || '')}" maxlength="120" style="width:100%; padding:0.5rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff;" />
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:0.75rem; margin-bottom:0.75rem;">
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Título principal de la guía</label>
            <input type="text" class="mg-canales-field" data-field="title" value="${esc(obj.title || '')}" maxlength="220" style="width:100%; padding:0.5rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff;" />
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Subtítulo descriptivo</label>
            <input type="text" class="mg-canales-field" data-field="subtitle" value="${esc(obj.subtitle || '')}" maxlength="400" style="width:100%; padding:0.5rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff;" />
          </div>
        </div>
        <div style="margin-bottom:0.75rem;">
          <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Guión de síntesis auditiva (speechText)</label>
          <textarea class="mg-canales-field" data-field="speechText" rows="3" maxlength="2500" style="width:100%; padding:0.6rem 0.8rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; font-family:inherit; background:#fff; line-height:1.45;">${esc(obj.speechText || '')}</textarea>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem;">
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Encabezado 4 Pasos (stepsHeading)</label>
            <input type="text" class="mg-canales-field" data-field="stepsHeading" value="${esc(obj.stepsHeading || '')}" maxlength="220" style="width:100%; padding:0.5rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff;" />
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Encabezado Garantías (guaranteesTitle)</label>
            <input type="text" class="mg-canales-field" data-field="guaranteesTitle" value="${esc(obj.guaranteesTitle || '')}" maxlength="220" style="width:100%; padding:0.5rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff;" />
          </div>
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Encabezado Glosario (glossaryTitle)</label>
            <input type="text" class="mg-canales-field" data-field="glossaryTitle" value="${esc(obj.glossaryTitle || '')}" maxlength="220" style="width:100%; padding:0.5rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff;" />
          </div>
        </div>
      </div>

      <!-- 4 Pasos -->
      <div style="margin-bottom:1.15rem;">
        <h3 style="font-size:0.96rem; font-weight:800; color:#05111F; margin:0 0 0.65rem;"><i class="fas fa-list-ol" style="color:#00C2E0; margin-right:6px;"></i>Procedimiento de Denuncia en 4 Pasos</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:0.85rem;">
          ${(obj.steps || []).map((st, idx) => `
            <div style="background:#FAFBFD; border:1px solid #E2E8F0; border-radius:12px; padding:0.9rem;">
              <div style="font-weight:800; color:#0369A1; font-size:0.82rem; margin-bottom:0.5rem;">Paso ${st.num || idx + 1}</div>
              <input type="text" class="mg-canales-step" data-idx="${idx}" data-prop="title" value="${esc(st.title || '')}" placeholder="Título del paso" maxlength="180" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; margin-bottom:0.45rem; background:#fff;" />
              <input type="text" class="mg-canales-step" data-idx="${idx}" data-prop="native" value="${esc(st.native || '')}" placeholder="Etiqueta en idioma" maxlength="180" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; margin-bottom:0.45rem; background:#fff;" />
              <textarea class="mg-canales-step" data-idx="${idx}" data-prop="desc" rows="2" maxlength="500" placeholder="Descripción del paso" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; font-family:inherit; background:#fff;">${esc(st.desc || '')}</textarea>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 3 Garantías -->
      <div style="margin-bottom:1.15rem;">
        <h3 style="font-size:0.96rem; font-weight:800; color:#05111F; margin:0 0 0.65rem;"><i class="fas fa-shield-alt" style="color:#00C2E0; margin-right:6px;"></i>Garantías CNC (3 tarjetas)</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:0.85rem;">
          ${(obj.guarantees || []).map((g, idx) => `
            <div style="background:#FAFBFD; border:1px solid #E2E8F0; border-radius:12px; padding:0.9rem;">
              <div style="font-weight:800; color:#0369A1; font-size:0.82rem; margin-bottom:0.5rem;">Garantía ${idx + 1}</div>
              <input type="text" class="mg-canales-guarantee" data-idx="${idx}" data-prop="title" value="${esc(g.title || '')}" maxlength="180" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; margin-bottom:0.45rem; background:#fff;" />
              <textarea class="mg-canales-guarantee" data-idx="${idx}" data-prop="desc" rows="2" maxlength="450" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; font-family:inherit; background:#fff;">${esc(g.desc || '')}</textarea>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 5 Glosario -->
      <div>
        <h3 style="font-size:0.96rem; font-weight:800; color:#05111F; margin:0 0 0.65rem;"><i class="fas fa-book" style="color:#00C2E0; margin-right:6px;"></i>Glosario Multilingüe (5 términos)</h3>
        <div style="display:grid; grid-template-columns:1fr; gap:0.7rem;">
          ${(obj.glossary || []).map((gl, idx) => `
            <div style="background:#FAFBFD; border:1px solid #E2E8F0; border-radius:12px; padding:0.85rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.65rem; align-items:end;">
              <div>
                <label style="display:block; font-size:0.73rem; font-weight:700; color:#475569; margin-bottom:3px;">Término base (termEs)</label>
                <input type="text" class="mg-canales-glossary" data-idx="${idx}" data-prop="termEs" value="${esc(gl.termEs || '')}" maxlength="120" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; background:#fff;" />
              </div>
              <div>
                <label style="display:block; font-size:0.73rem; font-weight:700; color:#475569; margin-bottom:3px;">Traducción (${esc(lang)})</label>
                <input type="text" class="mg-canales-glossary" data-idx="${idx}" data-prop="maya" value="${esc(gl.maya || '')}" maxlength="180" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; background:#fff;" />
              </div>
              <div style="grid-column:span 2; min-width:220px; display:flex; gap:0.5rem; align-items:end;">
                <div style="flex:1;">
                  <label style="display:block; font-size:0.73rem; font-weight:700; color:#475569; margin-bottom:3px;">Texto de audio (speech)</label>
                  <input type="text" class="mg-canales-glossary" data-idx="${idx}" data-prop="speech" value="${esc(gl.speech || '')}" maxlength="400" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #CBD5E1; border-radius:7px; font-size:0.84rem; background:#fff;" />
                </div>
                <button type="button" class="mg-speak-glossary-btn" data-idx="${idx}" style="padding:0.48rem 0.7rem; background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; border-radius:7px; font-size:0.78rem; font-weight:700; cursor:pointer; flex-shrink:0;" title="Probar audio de este término">
                  <i class="fas fa-volume-up"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderI18nEditor() {
  const langs = state.canalesLangOrder;
  const lang = langs.includes(state.activeLang.i18n) ? state.activeLang.i18n : langs[0];
  state.activeLang.i18n = lang;

  const esKeys = Object.keys(state.defaults.i18n?.es || state.draftData.i18n?.es || {});
  const langDict = state.draftData.i18n?.[lang] || {};
  const defLangDict = state.defaults.i18n?.[lang] || {};
  const q = state.searchI18n.trim().toLowerCase();
  const filteredKeys = esKeys.filter(k => {
    if (!q) return true;
    return k.toLowerCase().includes(q) || String(langDict[k] || '').toLowerCase().includes(q);
  });
  const dirty = isCurrentLangDirty('i18n', lang);

  return `
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:18px; padding:1.4rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
        <div>
          <h2 style="font-family:var(--font-head); font-size:1.25rem; color:#05111F; margin:0 0 0.25rem;">
            ${esc(state.sectionsMeta.i18n?.label || 'Diccionario de Interfaz (pia-i18n)')}
          </h2>
          <p style="font-size:0.84rem; color:#5E7A8E; margin:0;">
            ${esc(state.sectionsMeta.i18n?.description || '')}
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" id="mgI18nResetLangBtn" style="padding:0.52rem 0.9rem; background:#fff; color:#B45309; border:1px solid #F59E0B; border-radius:9px; font-weight:700; font-size:0.8rem; cursor:pointer;">
            <i class="fas fa-undo-alt"></i> Restaurar Idioma (${esc(lang)})
          </button>
          <button type="button" id="mgI18nSaveBtn" ${state.isSaving ? 'disabled' : ''} style="padding:0.55rem 1.1rem; background:${dirty ? '#00C2E0' : '#05111F'}; color:${dirty ? '#05111F' : '#00C2E0'}; border:none; border-radius:9px; font-weight:800; font-size:0.82rem; cursor:pointer;">
            <i class="fas fa-save"></i> Guardar Diccionario en JSON y Código
          </button>
        </div>
      </div>

      ${renderLangPills('i18n', langs)}

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:1rem;">
        <div style="position:relative; flex:1; min-width:240px;">
          <i class="fas fa-search" style="position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#64748B; font-size:0.85rem;"></i>
          <input type="text" id="mgI18nSearchInput" value="${esc(state.searchI18n)}" placeholder="Filtrar frases de menú, botones o traducciones..." style="width:100%; padding:0.6rem 0.9rem 0.6rem 2.3rem; border:1px solid #CBD5E1; border-radius:10px; font-size:0.88rem;" />
        </div>
        <span style="font-size:0.8rem; font-weight:700; color:#5E7A8E;">Mostrando ${filteredKeys.length} de ${esKeys.length} frases</span>
      </div>

      <div id="mgI18nListWrap" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:0.75rem;">
        ${filteredKeys.map(key => {
          const val = langDict[key] ?? '';
          const defVal = defLangDict[key] ?? '';
          const isModified = val !== defVal;
          return `
            <div style="background:#FAFBFD; border:1px solid ${isModified ? '#7DD3FC' : '#E2E8F0'}; border-radius:11px; padding:0.75rem 0.9rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; margin-bottom:4px;">
                <span style="font-size:0.77rem; font-weight:700; color:#334155;">${esc(key)}</span>
                ${isModified ? '<span style="font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:999px; background:#E0F2FE; color:#0369A1;">Editado</span>' : ''}
              </div>
              <input type="text" class="mg-i18n-input" data-i18n-key="${esc(key)}" value="${esc(val)}" maxlength="300" style="width:100%; padding:0.48rem 0.7rem; border:1px solid #CBD5E1; border-radius:8px; font-size:0.86rem; background:#fff; color:#05111F;" />
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function saveActiveSection(section) {
  if (state.isSaving) return;
  const lang = state.activeLang[section];
  if (!lang || !state.draftData[section]?.[lang]) return;

  state.isSaving = true;
  renderMainBody();
  showInlineBanner('', '');

  try {
    const buildHeaders = () => {
      const h = depsRef.getHeaders();
      if (state.etag) h['If-Match'] = state.etag;
      return h;
    };

    const res = await fetch('/api/admin/multilingual-guide', {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify({
        section,
        data: { [lang]: state.draftData[section][lang] }
      }),
      cache: 'no-store'
    });

    if (res.status === 401) {
      await depsRef.authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
      return;
    }

    if (res.status === 409) {
      const errObj = await res.json().catch(() => ({}));
      showInlineBanner('warning', errObj.error || 'Otro operador actualizó la guía multilingüe. Recarga para continuar.', { showReload: true });
      depsRef.showToast('Conflicto de edición concurrente (409). Recarga la vista.', 'error');
      return;
    }

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || 'No se pudo guardar la sección.');
    }

    const newEtag = res.headers.get('ETag');
    if (newEtag) state.etag = newEtag;
    applyAdminPayload(result);

    // Sincronización automática hacia Firestore (Producción <-> Preview)
    const ts = result.sectionUpdatedAt?.[section] || result.updatedAt;
    const cloudRes = await syncMultilingualSectionToCloud(section, result.data?.[section], ts);
    await refreshSyncStatusOnly();

    renderHeaderStats();
    renderMainBody();

    const cloudNote = cloudRes?.synced
      ? ' y replicado en nube compartida'
      : ' (para replicar hacia Producción/Preview vincula tu cuenta @cnc.gob.gt arriba)';
    const msg = `Idioma "${lang}" (${section}) guardado en JSON, materializado en /js/pia-multilingual-data.js${cloudNote}.`;
    showInlineBanner('success', msg);
    depsRef.showToast('Guía multilingüe guardada y materializada en código.', 'success');
  } catch (err) {
    showInlineBanner('error', err.message || 'Error al guardar.');
    depsRef.showToast(err.message || 'Error al guardar.', 'error');
  } finally {
    state.isSaving = false;
    updateDirtyIndicator();
  }
}

function openResetModal(section, lang) {
  state.pendingReset = { section, lang };
  const modal = document.getElementById('mgResetModal');
  const titleEl = document.getElementById('mgResetModalTitle');
  const descEl = document.getElementById('mgResetModalDesc');
  if (titleEl) titleEl.textContent = `Restaurar idioma "${lang}" (${section})`;
  if (descEl) {
    descEl.textContent = `Se restaurarán los textos y locuciones originales del idioma "${lang}" en la sección "${section}", actualizando tanto el archivo JSON como /js/pia-multilingual-data.js.`;
  }
  if (modal) modal.style.display = 'flex';
}

function closeResetModal() {
  state.pendingReset = null;
  const modal = document.getElementById('mgResetModal');
  if (modal) modal.style.display = 'none';
}

async function confirmResetModal() {
  const pending = state.pendingReset;
  closeResetModal();
  if (!pending) return;

  try {
    const h = depsRef.getHeaders();
    if (state.etag) h['If-Match'] = state.etag;
    const res = await fetch('/api/admin/multilingual-guide/reset', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ section: pending.section, lang: pending.lang }),
      cache: 'no-store'
    });
    if (res.status === 401) {
      await depsRef.authLogout('Tu sesión ha expirado.');
      return;
    }
    if (res.status === 409) {
      const errObj = await res.json().catch(() => ({}));
      showInlineBanner('warning', errObj.error || 'Conflicto de concurrencia al restaurar.', { showReload: true });
      return;
    }
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'No se pudo restaurar el idioma.');

    const newEtag = res.headers.get('ETag');
    if (newEtag) state.etag = newEtag;
    applyAdminPayload(result);

    const ts = result.sectionUpdatedAt?.[pending.section] || result.updatedAt;
    await syncMultilingualSectionToCloud(pending.section, result.data?.[pending.section], ts);
    await refreshSyncStatusOnly();

    renderHeaderStats();
    renderMainBody();
    showInlineBanner('success', `Idioma "${pending.lang}" restaurado a valores originales y materializado en código.`);
    depsRef.showToast('Idioma restaurado.', 'success');
  } catch (err) {
    showInlineBanner('error', err.message);
    depsRef.showToast(err.message, 'error');
  }
}

function wireSectionEvents() {
  document.querySelectorAll('.mg-lang-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-mg-lang');
      if (!lang || state.activeTab === 'tech-guide') return;
      state.activeLang[state.activeTab] = lang;
      renderMainBody();
    });
  });

  if (state.activeTab === 'portal') {
    const lang = state.activeLang.portal;
    const target = state.draftData.portal?.[lang];
    document.getElementById('mgPortalLangName')?.addEventListener('input', (e) => {
      if (target) target.langName = e.target.value;
      updateDirtyIndicator();
    });
    document.getElementById('mgPortalTtsLang')?.addEventListener('input', (e) => {
      if (target) target.ttsLang = e.target.value;
      updateDirtyIndicator();
    });
    document.querySelectorAll('.mg-portal-title-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const mk = inp.getAttribute('data-mk');
        if (target?.modules?.[mk]) target.modules[mk].title = e.target.value;
        updateDirtyIndicator();
      });
    });
    document.querySelectorAll('.mg-portal-text-input').forEach(ta => {
      ta.addEventListener('input', (e) => {
        const mk = ta.getAttribute('data-mk');
        if (target?.modules?.[mk]) target.modules[mk].text = e.target.value;
        const lenEl = document.querySelector(`.mg-portal-len[data-mk="${mk}"]`);
        if (lenEl) lenEl.textContent = `${e.target.value.length} / 2500`;
        updateDirtyIndicator();
      });
    });
    document.querySelectorAll('.mg-speak-portal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mk = btn.getAttribute('data-mk');
        const text = target?.modules?.[mk]?.text || '';
        speakPreview(text, target?.ttsLang || 'es-GT');
      });
    });
    document.getElementById('mgPortalSaveBtn')?.addEventListener('click', () => saveActiveSection('portal'));
    document.getElementById('mgPortalResetLangBtn')?.addEventListener('click', () => openResetModal('portal', lang));
  } else if (state.activeTab === 'canales') {
    const lang = state.activeLang.canales;
    const target = state.draftData.canales?.[lang];
    document.querySelectorAll('.mg-canales-field').forEach(el => {
      el.addEventListener('input', (e) => {
        const field = el.getAttribute('data-field');
        if (target && field) target[field] = e.target.value;
        updateDirtyIndicator();
      });
    });
    document.querySelectorAll('.mg-canales-step').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = Number(el.getAttribute('data-idx'));
        const prop = el.getAttribute('data-prop');
        if (target?.steps?.[idx] && prop) target.steps[idx][prop] = e.target.value;
        updateDirtyIndicator();
      });
    });
    document.querySelectorAll('.mg-canales-guarantee').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = Number(el.getAttribute('data-idx'));
        const prop = el.getAttribute('data-prop');
        if (target?.guarantees?.[idx] && prop) target.guarantees[idx][prop] = e.target.value;
        updateDirtyIndicator();
      });
    });
    document.querySelectorAll('.mg-canales-glossary').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = Number(el.getAttribute('data-idx'));
        const prop = el.getAttribute('data-prop');
        if (target?.glossary?.[idx] && prop) target.glossary[idx][prop] = e.target.value;
        updateDirtyIndicator();
      });
    });
    document.getElementById('mgCanalesSpeakSummaryBtn')?.addEventListener('click', () => {
      speakPreview(target?.speechText || '', lang === 'en' ? 'en-US' : 'es-GT');
    });
    document.querySelectorAll('.mg-speak-glossary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        speakPreview(target?.glossary?.[idx]?.speech || '', lang === 'en' ? 'en-US' : 'es-GT');
      });
    });
    document.getElementById('mgCanalesSaveBtn')?.addEventListener('click', () => saveActiveSection('canales'));
    document.getElementById('mgCanalesResetLangBtn')?.addEventListener('click', () => openResetModal('canales', lang));
  } else if (state.activeTab === 'i18n') {
    const lang = state.activeLang.i18n;
    const target = state.draftData.i18n?.[lang];
    document.getElementById('mgI18nSearchInput')?.addEventListener('input', (e) => {
      state.searchI18n = e.target.value || '';
      const caret = e.target.selectionStart || 0;
      renderMainBody();
      const restored = document.getElementById('mgI18nSearchInput');
      if (restored) {
        restored.focus();
        try { restored.setSelectionRange(caret, caret); } catch (_) {}
      }
    });
    document.querySelectorAll('.mg-i18n-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const k = inp.getAttribute('data-i18n-key');
        if (target && k) target[k] = e.target.value;
        updateDirtyIndicator();
      });
    });
    document.getElementById('mgI18nSaveBtn')?.addEventListener('click', () => saveActiveSection('i18n'));
    document.getElementById('mgI18nResetLangBtn')?.addEventListener('click', () => openResetModal('i18n', lang));
  }
}

function renderMainBody() {
  const body = document.getElementById('mgBodyArea');
  if (!body) return;

  if (state.activeTab === 'tech-guide') {
    body.innerHTML = `<div id="mgTechGuideContainer"></div>`;
    initTechnicalGuide({ containerId: 'mgTechGuideContainer', embedded: true });
    state.techGuideMounted = true;
    updateDirtyIndicator();
    return;
  }

  state.techGuideMounted = false;
  if (state.activeTab === 'portal') {
    body.innerHTML = renderPortalEditor();
  } else if (state.activeTab === 'canales') {
    body.innerHTML = renderCanalesEditor();
  } else {
    body.innerHTML = renderI18nEditor();
  }

  wireSectionEvents();
  updateDirtyIndicator();
}

function renderShell() {
  const container = document.getElementById('contentArea');
  if (!container) return;

  container.innerHTML = `
    <div style="max-width:1320px; margin:0 auto;">
      <!-- Encabezado principal -->
      <div style="background:#fff; border:1px solid var(--border); border-radius:20px; padding:1.6rem 1.85rem; margin-bottom:1.25rem; box-shadow:0 4px 20px rgba(5,17,31,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div>
            <div style="display:inline-flex; align-items:center; gap:7px; padding:0.32rem 0.85rem; border-radius:999px; background:rgba(0,194,224,0.12); color:#0284C7; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.55rem;">
              <i class="fas fa-language"></i> Inclusión Universal · Sincronización en Código y Nube
            </div>
            <h1 style="font-family:var(--font-head); font-size:1.65rem; font-weight:800; color:#05111F; margin:0 0 0.35rem;">
              Guía Multilingüe y Guía Técnica de Implementación
            </h1>
            <p style="color:#5E7A8E; font-size:0.9rem; margin:0; max-width:820px; line-height:1.5;">
              Administra los textos y locuciones de la Guía Multilingüe en el Portal Principal, Canales por la Integridad y diccionario i18n, consulta la documentación técnica de desarrollo y sincroniza todos los JSON y archivos de código entre Producción y Preview.
            </p>
          </div>
          <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
            <button type="button" id="mgReloadAllBtn" style="padding:0.6rem 1rem; background:#F0F5FB; color:#05111F; border:1px solid #CBD5E1; border-radius:11px; font-weight:700; font-size:0.84rem; cursor:pointer;">
              <i class="fas fa-sync-alt"></i> Recargar Estado
            </button>
          </div>
        </div>
      </div>

      <!-- Barra de estadísticas -->
      <div id="mgStatsRow" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.25rem;"></div>

      <!-- Barra unificada Cloud + Código + Respaldo -->
      <div id="mgGlobalSyncWrap"></div>

      <!-- Alerta inline -->
      <div id="mgAlertBanner" style="display:none; align-items:center; gap:0.75rem; padding:0.85rem 1.15rem; border-radius:12px; border:1px solid transparent; margin-bottom:1.15rem; font-size:0.88rem; font-weight:600;"></div>

      <!-- Barra flotante de cambios pendientes -->
      <div id="mgDirtyBar" style="display:none; position:sticky; top:0.75rem; z-index:40; background:#05111F; color:#fff; border:1px solid #00C2E0; border-radius:14px; padding:0.8rem 1.2rem; margin-bottom:1.15rem; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; box-shadow:0 12px 28px rgba(5,17,31,0.25);">
        <div style="display:flex; align-items:center; gap:0.65rem; font-weight:700; font-size:0.88rem;">
          <i class="fas fa-exclamation-triangle" style="color:#F5A623;"></i>
          <span id="mgDirtyText">Cambios pendientes por guardar</span>
        </div>
        <div style="display:flex; gap:0.55rem; flex-wrap:wrap;">
          <button type="button" id="mgDiscardDraftBtn" style="padding:0.48rem 0.9rem; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.22); border-radius:8px; font-weight:600; font-size:0.82rem; cursor:pointer;">
            Descartar cambios
          </button>
          <button type="button" id="mgSaveCurrentTabBtn" style="padding:0.48rem 1.05rem; background:#00C2E0; color:#05111F; border:none; border-radius:8px; font-weight:800; font-size:0.82rem; cursor:pointer;">
            <i class="fas fa-save"></i> Guardar idioma actual
          </button>
        </div>
      </div>

      <!-- Pestañas del módulo -->
      <div style="display:flex; gap:0.55rem; flex-wrap:wrap; margin-bottom:1.25rem;" id="mgTabsBar">
        <button type="button" class="mg-tab-btn" data-mg-tab="portal" style="padding:0.65rem 1.15rem; border-radius:12px; border:1px solid #05111F; background:#05111F; color:#00C2E0; font-weight:800; font-size:0.85rem; cursor:pointer; display:inline-flex; align-items:center; gap:7px;">
          <i class="fas fa-universal-access"></i> Portal Principal (Inclusión Universal)
          <span class="mg-tab-dirty-dot" style="display:none; width:8px; height:8px; border-radius:50%; background:#F59E0B;"></span>
        </button>
        <button type="button" class="mg-tab-btn" data-mg-tab="canales" style="padding:0.65rem 1.15rem; border-radius:12px; border:1px solid #CBD5E1; background:#fff; color:#0C1F30; font-weight:700; font-size:0.85rem; cursor:pointer; display:inline-flex; align-items:center; gap:7px;">
          <i class="fas fa-bullhorn"></i> Canales por la Integridad (Guía Maya)
          <span class="mg-tab-dirty-dot" style="display:none; width:8px; height:8px; border-radius:50%; background:#F59E0B;"></span>
        </button>
        <button type="button" class="mg-tab-btn" data-mg-tab="i18n" style="padding:0.65rem 1.15rem; border-radius:12px; border:1px solid #CBD5E1; background:#fff; color:#0C1F30; font-weight:700; font-size:0.85rem; cursor:pointer; display:inline-flex; align-items:center; gap:7px;">
          <i class="fas fa-book-open"></i> Diccionario de Interfaz (pia-i18n)
          <span class="mg-tab-dirty-dot" style="display:none; width:8px; height:8px; border-radius:50%; background:#F59E0B;"></span>
        </button>
        <button type="button" class="mg-tab-btn" data-mg-tab="tech-guide" style="padding:0.65rem 1.15rem; border-radius:12px; border:1px solid #CBD5E1; background:#fff; color:#0C1F30; font-weight:700; font-size:0.85rem; cursor:pointer; display:inline-flex; align-items:center; gap:7px;">
          <i class="fas fa-code"></i> Guía Técnica de Desarrollo
        </button>
      </div>

      <!-- Cuerpo dinámico de la pestaña -->
      <div id="mgBodyArea">
        <div style="background:#fff; border-radius:16px; padding:2.5rem; text-align:center; color:#5E7A8E;">
          <i class="fas fa-spinner fa-spin" style="font-size:1.5rem; color:#00C2E0; margin-bottom:0.5rem;"></i>
          <div>Cargando Guía Multilingüe y estado de sincronización...</div>
        </div>
      </div>
    </div>

    <!-- Modal de confirmación para restaurar idioma -->
    <div id="mgResetModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.72); backdrop-filter:blur(6px); z-index:1060; align-items:center; justify-content:center; padding:1rem;">
      <div style="background:#fff; border-radius:18px; max-width:480px; width:100%; padding:1.5rem 1.7rem; box-shadow:0 24px 60px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem;">
          <h3 id="mgResetModalTitle" style="font-family:var(--font-head); font-size:1.15rem; color:#05111F; margin:0;">Restaurar idioma</h3>
          <button type="button" id="mgResetModalClose" style="background:none; border:none; font-size:1.4rem; color:#5E7A8E; cursor:pointer;">&times;</button>
        </div>
        <p id="mgResetModalDesc" style="font-size:0.9rem; color:#334155; line-height:1.5; margin-bottom:1.25rem;"></p>
        <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" id="mgResetCancelBtn" style="padding:0.65rem 1.15rem; background:#E8EEF7; color:#05111F; border:none; border-radius:10px; font-weight:600; cursor:pointer;">Cancelar</button>
          <button type="button" id="mgResetConfirmBtn" style="padding:0.65rem 1.25rem; background:#D97706; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer;">
            <i class="fas fa-undo-alt" style="margin-right:6px;"></i>Sí, restaurar
          </button>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.mg-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-mg-tab');
      if (!tab) return;
      state.activeTab = tab;
      styleActiveTabButtons();
      renderMainBody();
    });
  });

  document.getElementById('mgReloadAllBtn')?.addEventListener('click', () => reloadAllData({ forceSync: true }));
  document.getElementById('mgDiscardDraftBtn')?.addEventListener('click', () => {
    state.draftData = cloneJson(state.serverData);
    renderMainBody();
    depsRef.showToast('Cambios sin guardar descartados.', 'info');
  });
  document.getElementById('mgSaveCurrentTabBtn')?.addEventListener('click', () => {
    if (state.activeTab !== 'tech-guide') {
      saveActiveSection(state.activeTab);
    }
  });

  document.getElementById('mgResetModalClose')?.addEventListener('click', closeResetModal);
  document.getElementById('mgResetCancelBtn')?.addEventListener('click', closeResetModal);
  document.getElementById('mgResetModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'mgResetModal') closeResetModal();
  });
  document.getElementById('mgResetConfirmBtn')?.addEventListener('click', confirmResetModal);
}

function styleActiveTabButtons() {
  document.querySelectorAll('.mg-tab-btn').forEach(btn => {
    const active = btn.getAttribute('data-mg-tab') === state.activeTab;
    btn.style.background = active ? '#05111F' : '#fff';
    btn.style.color = active ? '#00C2E0' : '#0C1F30';
    btn.style.borderColor = active ? '#05111F' : '#CBD5E1';
    btn.style.fontWeight = active ? '800' : '700';
  });
}

async function reloadAllData({ forceSync = false } = {}) {
  try {
    const ok = await fetchAllState({ forceSync });
    if (!ok) return;
    renderHeaderStats();
    renderSyncStrip();
    styleActiveTabButtons();
    renderMainBody();
  } catch (err) {
    showInlineBanner('error', err.message || 'Error al cargar la Guía Multilingüe.');
  }
}

export async function initMultilingualGuideManager(deps = {}) {
  depsRef = { ...depsRef, ...deps };
  state.activeTab = 'portal';
  state.searchI18n = '';
  renderShell();
  await reloadAllData({ forceSync: true });
}
