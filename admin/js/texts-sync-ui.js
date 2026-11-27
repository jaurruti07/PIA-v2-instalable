// admin/js/texts-sync-ui.js
// Utilidades compartidas de sincronización en la nube (Firestore) y respaldo JSON (.json)
// para los administradores de textos estáticos del Portal Principal y módulos.

import {
  TEXT_DOC_IDS,
  MULTILINGUAL_DOC_IDS,
  DATA_DOC_IDS,
  getCloudSyncAuthState,
  connectGoogleForCloudSync,
  pushPublishedTextsToCloud,
  pushMultilingualToCloud,
  pushModuleDataToCloud
} from "./firebase-firestore.js";

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtShortTs(iso) {
  if (!iso) return 'Sin registro';
  try {
    return new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) {
    return iso;
  }
}

export async function fetchTextsExportBundle(getHeaders, authLogout) {
  const res = await fetch('/api/admin/texts/export-bundle', {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (res.status === 401) {
    await authLogout('Tu sesión ha expirado o es inválida. Inicia sesión nuevamente.');
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo exportar el respaldo de textos.');
  }
  return data;
}

export async function syncSavedModuleToCloud(docId, overrides, updatedAt, getHeaders, authLogout) {
  try {
    const authState = await getCloudSyncAuthState();
    if (!authState.isAuthorizedOperator) {
      return { synced: false, reason: 'AUTH_REQUIRED', authState };
    }
    const bundle = await fetchTextsExportBundle(getHeaders, authLogout).catch(() => null);
    const res = await pushPublishedTextsToCloud(
      docId,
      overrides || {},
      updatedAt || new Date().toISOString(),
      bundle?.modules || null
    );
    return res;
  } catch (err) {
    return { synced: false, reason: 'CLOUD_ERROR', error: err?.message || 'Error al sincronizar con la nube' };
  }
}

export async function pushEntireBundleToCloud(getHeaders, authLogout) {
  const authState = await getCloudSyncAuthState();
  if (!authState.isAuthorizedOperator) {
    throw new Error('Primero vincula tu cuenta Google (@cnc.gob.gt) para escribir en la nube.');
  }
  const bundle = await fetchTextsExportBundle(getHeaders, authLogout);
  if (!bundle || !bundle.modules) {
    throw new Error('No se pudo obtener el respaldo local de textos.');
  }

  let pushed = 0;
  for (const id of TEXT_DOC_IDS) {
    const modEntry = bundle.modules[id];
    if (!modEntry) continue;
    await pushPublishedTextsToCloud(
      id,
      modEntry.overrides || {},
      modEntry.updatedAt || new Date().toISOString(),
      id === 'riesgo' ? bundle.modules : null
    );
    pushed++;
  }
  return { pushed, totalModified: bundle.totalModified || 0 };
}

export function renderSyncToolbarHtml(prefix, cloudSync, authState) {
  const isLinked = Boolean(authState?.isAuthorizedOperator);
  const linkedEmail = authState?.email || '';
  const cloudCount = Number(cloudSync?.cloudModifiedCount || 0);
  const cloudExists = Boolean(cloudSync?.existsInCloud);
  const cloudTs = cloudSync?.cloudUpdatedAt ? fmtShortTs(cloudSync.cloudUpdatedAt) : null;

  const cloudStatusText = isLinked
    ? `Nube conectada (${escHtml(linkedEmail)})`
    : 'Nube: sesión Google pendiente de vincular para publicar cambios';

  const cloudDocDetail = cloudExists
    ? `Estado en la nube para esta vista: ${cloudCount} ${cloudCount === 1 ? 'texto personalizado' : 'textos personalizados'}${cloudTs ? ` · ${escHtml(cloudTs)}` : ''}`
    : 'Aún no hay una copia publicada en la nube para esta página';

  return `
    <div id="${prefix}SyncBar" style="background:#FFFFFF; border:1px solid rgba(0,194,224,0.28); border-radius:15px; padding:0.9rem 1.2rem; margin-bottom:1.15rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.85rem; box-shadow:0 4px 14px rgba(5,17,31,0.04);">
      <div style="display:flex; align-items:center; gap:0.8rem; flex:1; min-width:250px;">
        <div style="width:38px; height:38px; border-radius:10px; background:${isLinked ? '#ECFDF5' : '#EFF6FF'}; color:${isLinked ? '#059669' : '#1D4ED8'}; display:flex; align-items:center; justify-content:center; font-size:1.05rem; flex-shrink:0;">
          <i class="fas ${isLinked ? 'fa-cloud-upload-alt' : 'fa-cloud'}"></i>
        </div>
        <div style="font-size:0.82rem; line-height:1.4;">
          <div style="font-weight:700; color:#05111F;">${cloudStatusText}</div>
          <div style="color:#5E7A8E; font-size:0.78rem;">${cloudDocDetail}</div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
        ${isLinked
          ? `<button type="button" id="${prefix}PushCloudBtn" style="padding:0.5rem 0.85rem; background:#05111F; color:#00C2E0; border:none; border-radius:9px; font-weight:700; font-size:0.79rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Publicar los textos de este servidor hacia la nube compartida">
              <i class="fas fa-cloud-upload-alt"></i> Publicar en Nube
            </button>`
          : `<button type="button" id="${prefix}ConnectGoogleBtn" style="padding:0.5rem 0.9rem; background:#1D4ED8; color:#fff; border:none; border-radius:9px; font-weight:700; font-size:0.79rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Conecta tu cuenta @cnc.gob.gt para sincronizar automáticamente Producción y Preview">
              <i class="fab fa-google"></i> Vincular Nube (@cnc.gob.gt)
            </button>`
        }
        <button type="button" id="${prefix}PullCloudBtn" style="padding:0.5rem 0.85rem; background:#F0F9FF; color:#0369A1; border:1px solid #BAE6FD; border-radius:9px; font-weight:700; font-size:0.79rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Traer cambios guardados desde la nube compartida a este servidor">
          <i class="fas fa-cloud-download-alt"></i> Traer de Nube
        </button>
        <button type="button" id="${prefix}ExportBundleBtn" style="padding:0.5rem 0.85rem; background:#F8FAFC; color:#0F172A; border:1px solid #CBD5E1; border-radius:9px; font-weight:700; font-size:0.79rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Descargar copia de respaldo (.json) con todos los textos editados">
          <i class="fas fa-file-export"></i> Exportar .json
        </button>
        <button type="button" id="${prefix}ImportBundleBtn" style="padding:0.5rem 0.85rem; background:#F8FAFC; color:#0F172A; border:1px solid #CBD5E1; border-radius:9px; font-weight:700; font-size:0.79rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Importar un respaldo .json generado en Producción o Preview">
          <i class="fas fa-file-import"></i> Importar .json
        </button>
        <input type="file" id="${prefix}ImportFileInput" accept=".json,application/json" style="display:none;" />
      </div>
    </div>
  `;
}

export function wireSyncToolbarEvents({
  prefix,
  getActiveDocId,
  getHeaders,
  authLogout,
  showToast,
  onReloadNeeded,
  onInlineAlert,
  onRefreshSyncBar
}) {
  const connectBtn = document.getElementById(`${prefix}ConnectGoogleBtn`);
  const pushBtn = document.getElementById(`${prefix}PushCloudBtn`);
  const pullBtn = document.getElementById(`${prefix}PullCloudBtn`);
  const exportBtn = document.getElementById(`${prefix}ExportBundleBtn`);
  const importBtn = document.getElementById(`${prefix}ImportBundleBtn`);
  const fileInput = document.getElementById(`${prefix}ImportFileInput`);

  connectBtn?.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vinculando...';
    try {
      const user = await connectGoogleForCloudSync();
      const pushRes = await pushEntireBundleToCloud(getHeaders, authLogout).catch(() => null);
      const msg = pushRes
        ? `Cuenta ${user.email} vinculada y ${pushRes.pushed} catálogos sincronizados en la nube.`
        : `Cuenta ${user.email} vinculada para sincronización en la nube.`;
      onInlineAlert('success', msg);
      showToast(msg, 'success');
      if (typeof onRefreshSyncBar === 'function') await onRefreshSyncBar();
    } catch (err) {
      const msg = err?.message || 'No se pudo vincular la cuenta Google.';
      onInlineAlert('error', msg);
      showToast(msg, 'error');
    } finally {
      connectBtn.disabled = false;
    }
  });

  pushBtn?.addEventListener('click', async () => {
    pushBtn.disabled = true;
    pushBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
    try {
      const res = await pushEntireBundleToCloud(getHeaders, authLogout);
      const msg = `Textos publicados en la nube (${res.totalModified} cambios en ${res.pushed} catálogos).`;
      onInlineAlert('success', msg);
      showToast(msg, 'success');
      if (typeof onRefreshSyncBar === 'function') await onRefreshSyncBar();
    } catch (err) {
      const msg = err?.message || 'Error al publicar en la nube.';
      onInlineAlert('error', msg);
      showToast(msg, 'error');
    } finally {
      pushBtn.disabled = false;
      pushBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publicar en Nube';
    }
  });

  pullBtn?.addEventListener('click', async () => {
    pullBtn.disabled = true;
    pullBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    try {
      const docId = typeof getActiveDocId === 'function' ? getActiveDocId() : 'all';
      const res = await fetch('/api/admin/texts/sync-from-cloud', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ module: docId || 'all', mode: 'replace' }),
        cache: 'no-store'
      });
      if (res.status === 401) {
        await authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo traer la copia desde la nube.');
      }

      if (data.syncedCount > 0) {
        await onReloadNeeded();
        const msg = `Sincronización completada desde la nube (${data.syncedCount} ${data.syncedCount === 1 ? 'catálogo actualizado' : 'catálogos actualizados'}).`;
        onInlineAlert('success', msg);
        showToast(msg, 'success');
      } else {
        const msg = 'No se encontraron cambios publicados aún en la nube compartida.';
        onInlineAlert('success', msg);
        showToast(msg, 'info');
      }
    } catch (err) {
      const msg = err?.message || 'Error al traer cambios desde la nube.';
      onInlineAlert('error', msg);
      showToast(msg, 'error');
    } finally {
      pullBtn.disabled = false;
      pullBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Traer de Nube';
    }
  });

  exportBtn?.addEventListener('click', async () => {
    try {
      const bundle = await fetchTextsExportBundle(getHeaders, authLogout);
      if (!bundle) return;
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `pia-textos-respaldo-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Respaldo exportado (${bundle.totalModified || 0} textos personalizados).`, 'success');
    } catch (err) {
      const msg = err?.message || 'Error al exportar el respaldo JSON.';
      onInlineAlert('error', msg);
      showToast(msg, 'error');
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
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const modulesPayload = parsed?.modules || parsed;
      if (!modulesPayload || typeof modulesPayload !== 'object' || Array.isArray(modulesPayload)) {
        throw new Error('El archivo JSON no contiene un bloque válido "modules" de respaldo de textos.');
      }

      const res = await fetch('/api/admin/texts/import-bundle', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ modules: modulesPayload, mode: 'merge' }),
        cache: 'no-store'
      });
      if (res.status === 401) {
        await authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
        return;
      }
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || 'No se pudo importar el respaldo de textos.');
      }

      // Replicar automáticamente en la nube si la cuenta Google está vinculada
      await pushEntireBundleToCloud(getHeaders, authLogout).catch(() => null);
      await onReloadNeeded();
      const msg = `Respaldo importado correctamente (${result.totalKeysApplied || 0} textos personalizados activos).`;
      onInlineAlert('success', msg);
      showToast(msg, 'success');
    } catch (err) {
      const msg = err?.message || 'El archivo seleccionado no es un respaldo válido.';
      onInlineAlert('error', msg);
      showToast(msg, 'error');
    }
  });
}

export async function syncMultilingualSectionToCloud(section, sectionData, updatedAt) {
  try {
    const authState = await getCloudSyncAuthState();
    if (!authState.isAuthorizedOperator) {
      return { synced: false, reason: 'AUTH_REQUIRED', authState };
    }
    return await pushMultilingualToCloud(section, sectionData, updatedAt || new Date().toISOString());
  } catch (err) {
    return { synced: false, reason: 'CLOUD_ERROR', error: err?.message || 'Error al publicar guía multilingüe en la nube' };
  }
}

export async function pushEntireMultilingualToCloud(getHeaders, authLogout) {
  const authState = await getCloudSyncAuthState();
  if (!authState.isAuthorizedOperator) {
    throw new Error('Primero vincula tu cuenta Google (@cnc.gob.gt) para escribir en la nube.');
  }
  const res = await fetch('/api/admin/multilingual-guide', {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (res.status === 401 && typeof authLogout === 'function') {
    await authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
    return null;
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.data) {
    throw new Error(payload.error || 'No se pudo leer la guía multilingüe local.');
  }
  let pushed = 0;
  for (const sec of MULTILINGUAL_DOC_IDS) {
    if (!payload.data[sec]) continue;
    await pushMultilingualToCloud(sec, payload.data[sec], payload.sectionUpdatedAt?.[sec] || payload.updatedAt || new Date().toISOString());
    pushed++;
  }
  return { pushed };
}

export async function syncModuleDataToCloud(docId, getHeaders, authLogout) {
  try {
    if (!DATA_DOC_IDS.includes(docId)) {
      return { synced: false, reason: 'UNSUPPORTED_DOC' };
    }
    const authState = await getCloudSyncAuthState();
    if (!authState.isAuthorizedOperator) {
      return { synced: false, reason: 'AUTH_REQUIRED', authState };
    }
    const res = await fetch(`/api/admin/sync/dataset/${encodeURIComponent(docId)}`, {
      headers: typeof getHeaders === 'function' ? getHeaders() : { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (res.status === 401 && typeof authLogout === 'function') {
      await authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
      return { synced: false, reason: 'EXPIRED' };
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.data) {
      return { synced: false, reason: 'FETCH_ERROR', error: payload.error || 'Error leyendo dataset.' };
    }
    return await pushModuleDataToCloud(docId, payload.data, payload.itemCount || 0, new Date().toISOString());
  } catch (err) {
    return { synced: false, reason: 'CLOUD_ERROR', error: err?.message || 'Error al sincronizar dataset con la nube' };
  }
}

export async function pushAllDataAndTextsToCloud(getHeaders, authLogout) {
  const authState = await getCloudSyncAuthState();
  if (!authState.isAuthorizedOperator) {
    throw new Error('Primero vincula tu cuenta Google (@cnc.gob.gt) para publicar en la nube.');
  }
  const res = await fetch('/api/admin/sync/export-all', {
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (res.status === 401 && typeof authLogout === 'function') {
    await authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
    return null;
  }
  const bundle = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(bundle.error || 'No se pudo obtener el respaldo completo del servidor.');
  }

  let textsCount = 0;
  for (const id of TEXT_DOC_IDS) {
    const entry = bundle.texts?.[id];
    if (!entry) continue;
    await pushPublishedTextsToCloud(id, entry.overrides || {}, entry.updatedAt || new Date().toISOString(), id === 'riesgo' ? bundle.texts : null);
    textsCount++;
  }

  let mgCount = 0;
  for (const sec of MULTILINGUAL_DOC_IDS) {
    const secData = bundle.multilingual?.[sec];
    if (!secData) continue;
    await pushMultilingualToCloud(sec, secData, bundle.multilingual?.updatedAt || new Date().toISOString());
    mgCount++;
  }

  let dsCount = 0;
  for (const docId of DATA_DOC_IDS) {
    const dsEntry = bundle.datasets?.[docId];
    if (!dsEntry || !dsEntry.data) continue;
    await pushModuleDataToCloud(docId, dsEntry.data, dsEntry.itemCount || 0, bundle.exportedAt || new Date().toISOString());
    dsCount++;
  }

  return { textsCount, mgCount, dsCount };
}

export async function materializeCodeOnServer(getHeaders, authLogout) {
  const res = await fetch('/api/admin/sync/materialize', {
    method: 'POST',
    headers: getHeaders(),
    cache: 'no-store'
  });
  if (res.status === 401 && typeof authLogout === 'function') {
    await authLogout('Tu sesión ha expirado. Inicia sesión nuevamente.');
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No fue posible materializar los archivos de código.');
  }
  return data;
}

