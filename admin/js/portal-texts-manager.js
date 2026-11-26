// admin/js/portal-texts-manager.js
// Sección administrativa independiente: Administración de textos del portal

let state = {
  sections: [],
  items: [],
  stats: { total: 0, modified: 0 },
  updatedAt: null,
  updatedBy: null,
  etag: null,
  draftValues: {},      // { [key]: string } valores actuales en edición
  collapsedSections: new Set(),
  searchQuery: '',
  selectedSection: 'all',
  onlyModified: false,
  isSaving: false,
  pendingReset: null    // { scope: 'key'|'section'|'all', key?, section?, title, desc }
};

let depsRef = {
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
  showToast: () => {},
  authLogout: async () => {}
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTs(iso) {
  if (!iso) return 'Sin modificaciones registradas aún';
  try {
    return new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) {
    return iso;
  }
}

function getDirtyKeys() {
  const dirty = [];
  for (const item of state.items) {
    const draft = state.draftValues[item.key];
    if (typeof draft === 'string' && draft !== item.currentValue) {
      dirty.push(item.key);
    }
  }
  return dirty;
}

function validateClientText(item, rawVal) {
  let normalized = String(rawVal ?? '').replace(/\r\n/g, '\n');
  if (!item.multiline) {
    normalized = normalized.replace(/[\r\n]+/g, ' ');
  }
  normalized = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

  if (!normalized) {
    return { valid: false, error: `El texto "${item.label}" no puede quedar vacío.` };
  }
  if (normalized.length > item.maxLength) {
    return { valid: false, error: `El texto "${item.label}" supera el máximo de ${item.maxLength} caracteres.` };
  }
  if (/<\s*\/?\s*[a-z!][^>]*>/i.test(normalized) || /<\s*script/i.test(normalized) || /\b(?:javascript|vbscript)\s*:/i.test(normalized) || /\bon[a-z]+\s*=/i.test(normalized)) {
    return { valid: false, error: `El texto "${item.label}" contiene etiquetas HTML o código no permitido. Use solo texto plano.` };
  }
  return { valid: true, value: normalized };
}

async function fetchPortalTextsAdmin() {
  const res = await fetch('/api/admin/portal/texts', {
    headers: depsRef.getHeaders(),
    cache: 'no-store'
  });
  if (res.status === 401) {
    await depsRef.authLogout('Tu sesión ha expirado o es inválida. Inicia sesión nuevamente.');
    return false;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudieron cargar los textos del portal.');
  }
  const etag = res.headers.get('ETag');
  if (etag) state.etag = etag;

  state.sections = Array.isArray(data.sections) ? data.sections : [];
  state.items = Array.isArray(data.items) ? data.items : [];
  state.stats = data.stats || { total: state.items.length, modified: 0 };
  state.updatedAt = data.updatedAt || null;
  state.updatedBy = data.updatedBy || null;
  state.draftValues = {};
  state.items.forEach(item => {
    state.draftValues[item.key] = item.currentValue;
  });
  return true;
}

async function mutatePortalTexts(url, method, body) {
  const buildHeaders = () => {
    const h = depsRef.getHeaders();
    if (state.etag) h['If-Match'] = state.etag;
    return h;
  };

  let res = await fetch(url, {
    method,
    headers: buildHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  if (res.status === 409) {
    const errConflict = await res.json().catch(() => ({}));
    throw new Error(errConflict.error || 'Otro operador actualizó los textos. Recargue antes de guardar nuevamente.');
  }

  if (res.status === 401) {
    await depsRef.authLogout('Tu sesión ha expirado o es inválida. Inicia sesión nuevamente.');
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al actualizar los textos del portal.');
  }

  const newEtag = res.headers.get('ETag');
  if (newEtag) state.etag = newEtag;

  state.sections = Array.isArray(data.sections) ? data.sections : state.sections;
  state.items = Array.isArray(data.items) ? data.items : state.items;
  state.stats = data.stats || state.stats;
  state.updatedAt = data.updatedAt || null;
  state.updatedBy = data.updatedBy || null;
  return data;
}

function showInlineBanner(type, message) {
  const box = document.getElementById('portalTextsAlertBanner');
  if (!box) return;
  if (!message) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }
  const palette = type === 'error'
    ? { bg: '#FEF2F2', border: '#FCA5A5', color: '#991B1B', icon: 'fa-exclamation-circle' }
    : { bg: '#ECFDF5', border: '#86EFAC', color: '#166534', icon: 'fa-check-circle' };

  box.style.display = 'flex';
  box.style.background = palette.bg;
  box.style.borderColor = palette.border;
  box.style.color = palette.color;
  box.innerHTML = `<i class="fas ${palette.icon}" style="margin-top:2px;"></i><span style="flex:1;">${esc(message)}</span><button type="button" id="ptCloseAlertBtn" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1rem;">&times;</button>`;
  document.getElementById('ptCloseAlertBtn')?.addEventListener('click', () => {
    box.style.display = 'none';
  });
}

function getFilteredItems() {
  const q = state.searchQuery.trim().toLowerCase();
  return state.items.filter(item => {
    if (state.selectedSection !== 'all' && item.section !== state.selectedSection) {
      return false;
    }
    if (state.onlyModified && !item.isModified) {
      return false;
    }
    if (!q) return true;
    const draft = state.draftValues[item.key] ?? item.currentValue;
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.sectionLabel.toLowerCase().includes(q) ||
      String(draft).toLowerCase().includes(q) ||
      item.defaultText.toLowerCase().includes(q)
    );
  });
}

function updateDirtySummaryBar() {
  const dirtyKeys = getDirtyKeys();
  const bar = document.getElementById('ptDirtyActionBar');
  const countSpan = document.getElementById('ptDirtyCountText');
  if (bar) {
    bar.style.display = dirtyKeys.length > 0 ? 'flex' : 'none';
  }
  if (countSpan) {
    countSpan.textContent = dirtyKeys.length === 1
      ? '1 texto con cambios pendientes por guardar'
      : `${dirtyKeys.length} textos con cambios pendientes por guardar`;
  }
}

function renderTextItemCard(item) {
  const draft = state.draftValues[item.key] ?? item.currentValue;
  const isDirty = draft !== item.currentValue;
  const len = String(draft).length;
  const overLimit = len > item.maxLength;

  return `
    <div class="pt-item-card" data-pt-key="${esc(item.key)}" style="background:#FAFBFD; border:1px solid ${isDirty ? '#00C2E0' : '#E2E8F0'}; border-radius:14px; padding:1.05rem 1.15rem; transition:border-color 0.2s;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.55rem;">
        <div style="flex:1; min-width:220px;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <strong style="color:#05111F; font-size:0.95rem;">${esc(item.label)}</strong>
            ${item.isModified ? `<span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:999px; background:#E0F2FE; color:#0369A1;">Personalizado</span>` : ''}
            <span class="pt-dirty-badge" data-pt-badge="${esc(item.key)}" style="display:${isDirty ? 'inline-flex' : 'none'}; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:999px; background:#FEF3C7; color:#B45309;">Sin guardar</span>
          </div>
          <p style="margin:0.2rem 0 0; font-size:0.8rem; color:#5E7A8E; line-height:1.4;">
            <i class="fas fa-map-marker-alt" style="color:#00C2E0; margin-right:4px;"></i>${esc(item.description)}
          </p>
        </div>
        <div style="display:flex; align-items:center; gap:0.45rem; flex-shrink:0;">
          ${item.isModified ? `
            <button type="button" class="pt-btn-reset-item" data-key="${esc(item.key)}" style="padding:0.4rem 0.75rem; background:#fff; border:1px solid #CBD5E1; color:#475569; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer;" title="Restaurar este texto a su redacción original">
              <i class="fas fa-undo-alt"></i> Restaurar original
            </button>
          ` : ''}
          <button type="button" class="pt-btn-save-item" data-key="${esc(item.key)}" ${isDirty && !state.isSaving ? '' : 'disabled'} style="padding:0.4rem 0.85rem; background:${isDirty ? '#00C2E0' : '#CBD5E1'}; color:${isDirty ? '#05111F' : '#64748B'}; border:none; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:${isDirty ? 'pointer' : 'not-allowed'};">
            <i class="fas fa-save"></i> Guardar
          </button>
        </div>
      </div>

      ${item.multiline ? `
        <textarea class="pt-text-input" data-key="${esc(item.key)}" rows="3" maxlength="${item.maxLength}" style="width:100%; padding:0.7rem 0.85rem; border:1px solid ${overLimit ? '#EF4444' : '#CBD5E1'}; border-radius:10px; font-size:0.9rem; font-family:inherit; color:#0C1F30; background:#fff; resize:vertical; line-height:1.5;">${esc(draft)}</textarea>
      ` : `
        <input type="text" class="pt-text-input" data-key="${esc(item.key)}" maxlength="${item.maxLength}" value="${esc(draft)}" style="width:100%; padding:0.65rem 0.85rem; border:1px solid ${overLimit ? '#EF4444' : '#CBD5E1'}; border-radius:10px; font-size:0.9rem; font-family:inherit; color:#0C1F30; background:#fff;" />
      `}

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.45rem; font-size:0.75rem; color:#64748B;">
        <div>
          ${item.isModified ? `<span><strong>Original:</strong> ${esc(item.defaultText)}</span>` : `<span>Texto institucional vigente</span>`}
        </div>
        <span class="pt-char-counter" data-pt-counter="${esc(item.key)}" style="font-weight:600; color:${overLimit ? '#DC2626' : '#64748B'};">${len} / ${item.maxLength} caracteres</span>
      </div>
    </div>
  `;
}

function renderSectionsList() {
  const container = document.getElementById('portalTextsSectionsList');
  if (!container) return;

  const filtered = getFilteredItems();
  const countLabel = document.getElementById('ptVisibleCountBadge');
  if (countLabel) {
    countLabel.textContent = `${filtered.length} de ${state.items.length} textos mostrados`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="background:#fff; border-radius:16px; padding:2.5rem 1.5rem; text-align:center; border:1px solid rgba(26,92,143,0.14);">
        <i class="fas fa-search" style="font-size:2rem; color:#94A3B8; margin-bottom:0.75rem;"></i>
        <h3 style="color:#05111F; font-size:1.05rem; margin-bottom:0.35rem;">No se encontraron textos con esos criterios</h3>
        <p style="color:#5E7A8E; font-size:0.88rem; margin-bottom:1rem;">Prueba limpiando el buscador o seleccionando "Todas las secciones".</p>
        <button type="button" id="ptClearFiltersBtn" style="padding:0.55rem 1.1rem; background:#05111F; color:#00C2E0; border:none; border-radius:8px; font-weight:700; cursor:pointer;">Mostrar todos los textos</button>
      </div>
    `;
    document.getElementById('ptClearFiltersBtn')?.addEventListener('click', () => {
      state.searchQuery = '';
      state.selectedSection = 'all';
      state.onlyModified = false;
      const searchEl = document.getElementById('ptSearchInput');
      const secEl = document.getElementById('ptSectionFilter');
      const modEl = document.getElementById('ptOnlyModifiedToggle');
      if (searchEl) searchEl.value = '';
      if (secEl) secEl.value = 'all';
      if (modEl) modEl.checked = false;
      renderSectionsList();
    });
    return;
  }

  const bySection = new Map();
  filtered.forEach(item => {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item);
  });

  const orderedSections = state.sections.filter(s => bySection.has(s.id));

  container.innerHTML = orderedSections.map(sec => {
    const secItems = bySection.get(sec.id) || [];
    const secModified = secItems.filter(i => i.isModified).length;
    const isCollapsed = state.collapsedSections.has(sec.id) && !state.searchQuery.trim();

    return `
      <section style="background:#fff; border-radius:18px; border:1px solid rgba(26,92,143,0.14); box-shadow:0 4px 18px rgba(5,17,31,0.05); margin-bottom:1.25rem; overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1.1rem 1.35rem; background:#F8FBFF; border-bottom:${isCollapsed ? 'none' : '1px solid #E2E8F0'}; flex-wrap:wrap;">
          <button type="button" class="pt-section-toggle" data-section="${esc(sec.id)}" style="display:flex; align-items:center; gap:0.85rem; background:none; border:none; text-align:left; cursor:pointer; flex:1; min-width:220px; padding:0;">
            <div style="width:40px; height:40px; border-radius:11px; background:#05111F; color:#00C2E0; display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0;">
              <i class="fas ${esc(sec.icon || 'fa-file-alt')}"></i>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#05111F;">${esc(sec.label)}</h3>
                <span style="font-size:0.74rem; font-weight:700; padding:2px 9px; border-radius:999px; background:#E2E8F0; color:#334155;">${secItems.length} textos</span>
                ${secModified > 0 ? `<span style="font-size:0.74rem; font-weight:700; padding:2px 9px; border-radius:999px; background:#E0F2FE; color:#0369A1;">${secModified} editados</span>` : ''}
              </div>
              <p style="margin:0.15rem 0 0; font-size:0.8rem; color:#5E7A8E;">${esc(sec.description)}</p>
            </div>
          </button>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${secModified > 0 ? `
              <button type="button" class="pt-btn-reset-section" data-section="${esc(sec.id)}" data-label="${esc(sec.label)}" style="padding:0.42rem 0.8rem; background:#fff; border:1px solid #CBD5E1; border-radius:8px; color:#475569; font-size:0.78rem; font-weight:700; cursor:pointer;">
                <i class="fas fa-undo-alt"></i> Restaurar sección
              </button>
            ` : ''}
            <button type="button" class="pt-section-toggle" data-section="${esc(sec.id)}" style="width:34px; height:34px; border-radius:9px; border:1px solid #CBD5E1; background:#fff; color:#0C1F30; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;" title="${isCollapsed ? 'Expandir sección' : 'Contraer sección'}">
              <i class="fas ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>
            </button>
          </div>
        </div>
        ${isCollapsed ? '' : `
          <div style="padding:1.15rem 1.35rem; display:grid; gap:0.9rem;">
            ${secItems.map(renderTextItemCard).join('')}
          </div>
        `}
      </section>
    `;
  }).join('');

  attachSectionEvents();
  updateDirtySummaryBar();
}

function attachSectionEvents() {
  document.querySelectorAll('.pt-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const secId = btn.dataset.section;
      if (!secId) return;
      if (state.collapsedSections.has(secId)) state.collapsedSections.delete(secId);
      else state.collapsedSections.add(secId);
      renderSectionsList();
    });
  });

  document.querySelectorAll('.pt-text-input').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.dataset.key;
      const item = state.items.find(i => i.key === key);
      if (!item) return;

      state.draftValues[key] = input.value;
      const isDirty = input.value !== item.currentValue;
      const card = input.closest('.pt-item-card');
      const badge = card?.querySelector(`[data-pt-badge="${CSS.escape(key)}"]`);
      const saveBtn = card?.querySelector('.pt-btn-save-item');
      const counter = card?.querySelector(`[data-pt-counter="${CSS.escape(key)}"]`);

      if (card) card.style.borderColor = isDirty ? '#00C2E0' : '#E2E8F0';
      if (badge) badge.style.display = isDirty ? 'inline-flex' : 'none';
      if (saveBtn) {
        saveBtn.disabled = !isDirty || state.isSaving;
        saveBtn.style.background = isDirty ? '#00C2E0' : '#CBD5E1';
        saveBtn.style.color = isDirty ? '#05111F' : '#64748B';
        saveBtn.style.cursor = isDirty ? 'pointer' : 'not-allowed';
      }
      if (counter) {
        const len = input.value.length;
        counter.textContent = `${len} / ${item.maxLength} caracteres`;
        counter.style.color = len > item.maxLength ? '#DC2626' : '#64748B';
      }
      updateDirtySummaryBar();
    });
  });

  document.querySelectorAll('.pt-btn-save-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (key) saveSinglePortalText(key);
    });
  });

  document.querySelectorAll('.pt-btn-reset-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const item = state.items.find(i => i.key === key);
      if (!item) return;
      openResetConfirmModal({
        scope: 'key',
        key: item.key,
        title: `Restaurar "${item.label}"`,
        desc: `Se restablecerá el texto original de fábrica: "${item.defaultText}"`
      });
    });
  });

  document.querySelectorAll('.pt-btn-reset-section').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const label = btn.dataset.label || section;
      openResetConfirmModal({
        scope: 'section',
        section,
        title: `Restaurar sección "${label}"`,
        desc: 'Todos los textos personalizados dentro de esta sección volverán a su redacción original.'
      });
    });
  });
}

async function saveSinglePortalText(key) {
  const item = state.items.find(i => i.key === key);
  if (!item || state.isSaving) return;

  const check = validateClientText(item, state.draftValues[key]);
  if (!check.valid) {
    showInlineBanner('error', check.error);
    depsRef.showToast(check.error, 'error');
    return;
  }

  await performBatchSave({ [key]: check.value }, `Texto "${item.label}" actualizado correctamente.`);
}

async function saveAllDirtyPortalTexts() {
  if (state.isSaving) return;
  const dirtyKeys = getDirtyKeys();
  if (dirtyKeys.length === 0) return;

  const updates = {};
  for (const key of dirtyKeys) {
    const item = state.items.find(i => i.key === key);
    if (!item) continue;
    const check = validateClientText(item, state.draftValues[key]);
    if (!check.valid) {
      showInlineBanner('error', check.error);
      depsRef.showToast(check.error, 'error');
      return;
    }
    updates[key] = check.value;
  }

  await performBatchSave(updates, `Se guardaron ${dirtyKeys.length} cambios en los textos del portal.`);
}

async function performBatchSave(updates, successMessage) {
  state.isSaving = true;
  showInlineBanner('', '');
  const saveAllBtn = document.getElementById('ptSaveAllBtn');
  if (saveAllBtn) {
    saveAllBtn.disabled = true;
    saveAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const result = await mutatePortalTexts('/api/admin/portal/texts', 'PUT', { updates });
    if (!result) return;

    // Sincronizar los borradores solo para las claves recién guardadas (preservando otros borradores si se guardó 1 solo)
    const updatedKeys = Object.keys(updates);
    state.items.forEach(item => {
      if (updatedKeys.includes(item.key) || !(item.key in state.draftValues)) {
        state.draftValues[item.key] = item.currentValue;
      }
    });

    updateHeaderStats();
    renderSectionsList();
    showInlineBanner('success', successMessage);
    depsRef.showToast(successMessage, 'success');
  } catch (err) {
    showInlineBanner('error', err.message || 'No se pudieron guardar los cambios.');
    depsRef.showToast(err.message || 'Error al guardar textos del portal', 'error');
  } finally {
    state.isSaving = false;
    if (saveAllBtn) {
      saveAllBtn.disabled = false;
      saveAllBtn.innerHTML = '<i class="fas fa-save"></i> Guardar cambios pendientes';
    }
  }
}

function openResetConfirmModal(config) {
  state.pendingReset = config;
  const modal = document.getElementById('ptResetConfirmModal');
  const titleEl = document.getElementById('ptResetModalTitle');
  const descEl = document.getElementById('ptResetModalDesc');
  if (titleEl) titleEl.textContent = config.title || 'Restaurar textos';
  if (descEl) descEl.textContent = config.desc || '';
  if (modal) modal.style.display = 'flex';
}

function closeResetConfirmModal() {
  state.pendingReset = null;
  const modal = document.getElementById('ptResetConfirmModal');
  if (modal) modal.style.display = 'none';
}

async function executeConfirmedReset() {
  if (!state.pendingReset || state.isSaving) return;
  const { scope, key, section } = state.pendingReset;
  const confirmBtn = document.getElementById('ptResetConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = true;
  state.isSaving = true;

  try {
    const result = await mutatePortalTexts('/api/admin/portal/texts/reset', 'POST', { scope, key, section });
    if (!result) return;

    state.items.forEach(item => {
      if (
        scope === 'all' ||
        (scope === 'key' && item.key === key) ||
        (scope === 'section' && item.section === section)
      ) {
        state.draftValues[item.key] = item.currentValue;
      }
    });

    closeResetConfirmModal();
    updateHeaderStats();
    renderSectionsList();
    const msg = 'Textos restaurados a su versión original correctamente.';
    showInlineBanner('success', msg);
    depsRef.showToast(msg, 'success');
  } catch (err) {
    showInlineBanner('error', err.message || 'Error al restaurar textos.');
    depsRef.showToast(err.message || 'Error al restaurar textos', 'error');
  } finally {
    state.isSaving = false;
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function updateHeaderStats() {
  const totalEl = document.getElementById('ptStatTotal');
  const modEl = document.getElementById('ptStatModified');
  const updEl = document.getElementById('ptStatUpdated');
  const resetAllBtn = document.getElementById('ptResetAllBtn');

  if (totalEl) totalEl.textContent = String(state.stats.total || state.items.length);
  if (modEl) modEl.textContent = String(state.stats.modified || 0);
  if (updEl) updEl.textContent = state.updatedAt ? `${formatTs(state.updatedAt)}${state.updatedBy ? ` (${state.updatedBy})` : ''}` : 'Textos originales de fábrica';
  if (resetAllBtn) resetAllBtn.style.display = (state.stats.modified || 0) > 0 ? 'inline-flex' : 'none';
}

function renderShellView() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;

  contentArea.innerHTML = `
    <div style="max-width: 1220px; margin: 0 auto;">
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem;">
        <div>
          <h1 style="font-family:var(--font-head); font-size:1.75rem; color:#05111F; margin-bottom:0.25rem;">
            Administración de textos del portal
          </h1>
          <p style="color:#5E7A8E; font-size:0.95rem; max-width:780px; margin:0;">
            Edita de forma segura los títulos, bienvenidas, descripciones, tarjetas informativas y textos institucionales del portal principal sin intervenir el código fuente.
          </p>
        </div>
        <div style="display:flex; gap:0.65rem; flex-wrap:wrap;">
          <a href="/" target="_blank" rel="noopener noreferrer" style="padding:0.65rem 1rem; background:#05111F; color:#00C2E0; border-radius:10px; font-weight:700; font-size:0.86rem; display:inline-flex; align-items:center; gap:7px; text-decoration:none;">
            <i class="fas fa-external-link-alt"></i> Ver Portal Principal
          </a>
          <button type="button" id="ptReloadBtn" style="padding:0.65rem 1rem; background:#fff; border:1px solid rgba(26,92,143,0.2); color:#05111F; border-radius:10px; font-weight:700; font-size:0.86rem; display:inline-flex; align-items:center; gap:7px; cursor:pointer;">
            <i class="fas fa-sync-alt"></i> Recargar
          </button>
          <button type="button" id="ptResetAllBtn" style="display:none; padding:0.65rem 1rem; background:#FEF2F2; border:1px solid #FECACA; color:#B91C1C; border-radius:10px; font-weight:700; font-size:0.86rem; align-items:center; gap:7px; cursor:pointer;">
            <i class="fas fa-undo-alt"></i> Restaurar todo a original
          </button>
        </div>
      </div>

      <!-- Aviso de alcance editorial -->
      <div style="background:linear-gradient(135deg, #05111F 0%, #0C2033 100%); color:#fff; border-radius:16px; padding:1rem 1.35rem; margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; border:1px solid rgba(0,194,224,0.25);">
        <div style="display:flex; align-items:center; gap:0.85rem; flex:1; min-width:260px;">
          <div style="width:42px; height:42px; border-radius:11px; background:rgba(0,194,224,0.16); color:#00C2E0; display:flex; align-items:center; justify-content:center; font-size:1.15rem; flex-shrink:0;">
            <i class="fas fa-pen-nib"></i>
          </div>
          <div style="font-size:0.84rem; color:rgba(255,255,255,0.85); line-height:1.45;">
            <strong style="color:#00C2E0;">Alcance editorial controlado:</strong> Las métricas dinámicas continúan administrándose en <em>Métricas Portal</em> y las imágenes de portada en <em>Imágenes de Fondo</em>. Aquí únicamente se gestionan textos fijos de texto plano para proteger el diseño y funcionamiento del sitio.
          </div>
        </div>
        <div style="display:flex; gap:1.25rem; flex-wrap:wrap;">
          <div>
            <div style="font-size:0.7rem; text-transform:uppercase; color:#A8BFCC; letter-spacing:0.05em;">Textos administrables</div>
            <div id="ptStatTotal" style="font-family:var(--font-head); font-size:1.25rem; font-weight:800; color:#fff;">0</div>
          </div>
          <div>
            <div style="font-size:0.7rem; text-transform:uppercase; color:#A8BFCC; letter-spacing:0.05em;">Personalizados</div>
            <div id="ptStatModified" style="font-family:var(--font-head); font-size:1.25rem; font-weight:800; color:#00C2E0;">0</div>
          </div>
          <div>
            <div style="font-size:0.7rem; text-transform:uppercase; color:#A8BFCC; letter-spacing:0.05em;">Última actualización</div>
            <div id="ptStatUpdated" style="font-size:0.8rem; font-weight:600; color:#fff; margin-top:4px;">...</div>
          </div>
        </div>
      </div>

      <!-- Banner inline de confirmación o error -->
      <div id="portalTextsAlertBanner" style="display:none; align-items:center; gap:0.65rem; padding:0.85rem 1.1rem; border-radius:12px; border:1px solid; font-size:0.88rem; font-weight:600; margin-bottom:1rem;"></div>

      <!-- Barra de búsqueda y organización -->
      <div style="background:#fff; border-radius:16px; padding:1rem 1.25rem; border:1px solid rgba(26,92,143,0.14); margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.85rem;">
        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; flex:1;">
          <div style="position:relative; flex:1; min-width:240px; max-width:380px;">
            <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94A3B8; font-size:0.85rem;"></i>
            <input type="text" id="ptSearchInput" placeholder="Buscar por texto, título o ubicación..." style="width:100%; padding:0.6rem 0.9rem 0.6rem 2.2rem; border:1px solid rgba(26,92,143,0.22); border-radius:10px; font-size:0.88rem;" />
          </div>
          <select id="ptSectionFilter" style="padding:0.6rem 0.9rem; border:1px solid rgba(26,92,143,0.22); border-radius:10px; font-size:0.86rem; font-weight:600; color:#05111F; background:#fff; min-width:220px;">
            <option value="all">Todas las secciones del portal</option>
          </select>
          <label style="display:inline-flex; align-items:center; gap:0.45rem; font-size:0.84rem; font-weight:700; color:#0C1F30; cursor:pointer; padding:0.45rem 0.75rem; background:#F0F5FB; border-radius:10px;">
            <input type="checkbox" id="ptOnlyModifiedToggle" style="width:16px; height:16px; accent-color:#00C2E0;" />
            Solo personalizados
          </label>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span id="ptVisibleCountBadge" style="font-size:0.8rem; color:#5E7A8E; font-weight:600; margin-right:0.35rem;">0 textos</span>
          <button type="button" id="ptExpandAllBtn" style="padding:0.45rem 0.75rem; background:#F0F5FB; color:#0C1F30; border:1px solid #CBD5E1; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer;">Expandir todo</button>
          <button type="button" id="ptCollapseAllBtn" style="padding:0.45rem 0.75rem; background:#F0F5FB; color:#0C1F30; border:1px solid #CBD5E1; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer;">Contraer todo</button>
        </div>
      </div>

      <!-- Barra de cambios pendientes -->
      <div id="ptDirtyActionBar" style="display:none; position:sticky; top:0.75rem; z-index:40; background:#05111F; color:#fff; border:1px solid #00C2E0; border-radius:14px; padding:0.85rem 1.25rem; margin-bottom:1.25rem; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; box-shadow:0 12px 30px rgba(5,17,31,0.28);">
        <div style="display:flex; align-items:center; gap:0.65rem; font-weight:700; font-size:0.9rem;">
          <i class="fas fa-exclamation-triangle" style="color:#F5A623;"></i>
          <span id="ptDirtyCountText">Cambios pendientes por guardar</span>
        </div>
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
          <button type="button" id="ptDiscardDraftsBtn" style="padding:0.55rem 1rem; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:9px; font-weight:600; font-size:0.84rem; cursor:pointer;">
            Descartar cambios
          </button>
          <button type="button" id="ptSaveAllBtn" style="padding:0.55rem 1.2rem; background:#00C2E0; color:#05111F; border:none; border-radius:9px; font-weight:800; font-size:0.86rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
            <i class="fas fa-save"></i> Guardar cambios pendientes
          </button>
        </div>
      </div>

      <!-- Listado por secciones -->
      <div id="portalTextsSectionsList">
        <div style="background:#fff; border-radius:16px; padding:2.5rem; text-align:center; color:#5E7A8E;">
          <i class="fas fa-spinner fa-spin" style="font-size:1.5rem; color:#00C2E0; margin-bottom:0.5rem;"></i>
          <div>Cargando textos administrables del portal...</div>
        </div>
      </div>
    </div>

    <!-- Modal de confirmación para restaurar textos -->
    <div id="ptResetConfirmModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.72); backdrop-filter:blur(6px); z-index:1060; align-items:center; justify-content:center; padding:1rem;">
      <div style="background:#fff; border-radius:18px; max-width:480px; width:100%; padding:1.5rem 1.7rem; box-shadow:0 24px 60px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem;">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <div style="width:40px; height:40px; border-radius:11px; background:#FEF3C7; color:#D97706; display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
              <i class="fas fa-undo-alt"></i>
            </div>
            <h3 id="ptResetModalTitle" style="font-family:var(--font-head); font-size:1.15rem; color:#05111F; margin:0;">Restaurar texto original</h3>
          </div>
          <button type="button" id="ptResetModalClose" style="background:none; border:none; font-size:1.4rem; color:#5E7A8E; cursor:pointer;">&times;</button>
        </div>
        <p id="ptResetModalDesc" style="font-size:0.9rem; color:#334155; line-height:1.5; margin-bottom:1.25rem;"></p>
        <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" id="ptResetCancelBtn" style="padding:0.65rem 1.15rem; background:#E8EEF7; color:#05111F; border:none; border-radius:10px; font-weight:600; cursor:pointer;">Cancelar</button>
          <button type="button" id="ptResetConfirmBtn" style="padding:0.65rem 1.25rem; background:#D97706; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer;">
            <i class="fas fa-undo-alt" style="margin-right:6px;"></i>Sí, restaurar
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('ptSearchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value || '';
    renderSectionsList();
  });
  document.getElementById('ptSectionFilter')?.addEventListener('change', (e) => {
    state.selectedSection = e.target.value || 'all';
    renderSectionsList();
  });
  document.getElementById('ptOnlyModifiedToggle')?.addEventListener('change', (e) => {
    state.onlyModified = Boolean(e.target.checked);
    renderSectionsList();
  });
  document.getElementById('ptExpandAllBtn')?.addEventListener('click', () => {
    state.collapsedSections.clear();
    renderSectionsList();
  });
  document.getElementById('ptCollapseAllBtn')?.addEventListener('click', () => {
    state.sections.forEach(s => state.collapsedSections.add(s.id));
    renderSectionsList();
  });
  document.getElementById('ptSaveAllBtn')?.addEventListener('click', saveAllDirtyPortalTexts);
  document.getElementById('ptDiscardDraftsBtn')?.addEventListener('click', () => {
    state.items.forEach(i => { state.draftValues[i.key] = i.currentValue; });
    showInlineBanner('', '');
    renderSectionsList();
    depsRef.showToast('Cambios sin guardar descartados', 'info');
  });
  document.getElementById('ptReloadBtn')?.addEventListener('click', async () => {
    try {
      const ok = await fetchPortalTextsAdmin();
      if (ok) {
        populateSectionFilter();
        updateHeaderStats();
        renderSectionsList();
        depsRef.showToast('Textos del portal recargados', 'success');
      }
    } catch (err) {
      showInlineBanner('error', err.message);
    }
  });
  document.getElementById('ptResetAllBtn')?.addEventListener('click', () => {
    openResetConfirmModal({
      scope: 'all',
      title: 'Restaurar todos los textos del portal',
      desc: 'Todos los textos personalizados volverán a la redacción institucional original de fábrica.'
    });
  });

  document.getElementById('ptResetModalClose')?.addEventListener('click', closeResetConfirmModal);
  document.getElementById('ptResetCancelBtn')?.addEventListener('click', closeResetConfirmModal);
  document.getElementById('ptResetConfirmModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'ptResetConfirmModal') closeResetConfirmModal();
  });
  document.getElementById('ptResetConfirmBtn')?.addEventListener('click', executeConfirmedReset);
}

function populateSectionFilter() {
  const sel = document.getElementById('ptSectionFilter');
  if (!sel) return;
  const current = state.selectedSection || 'all';
  sel.innerHTML = `<option value="all">Todas las secciones del portal (${state.sections.length})</option>` +
    state.sections.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
  sel.value = current;
}

export async function initPortalTextsManager(deps = {}) {
  depsRef = { ...depsRef, ...deps };
  state.searchQuery = '';
  state.selectedSection = 'all';
  state.onlyModified = false;
  state.collapsedSections = new Set();

  renderShellView();

  try {
    const ok = await fetchPortalTextsAdmin();
    if (!ok) return;
    populateSectionFilter();
    updateHeaderStats();
    renderSectionsList();
  } catch (err) {
    showInlineBanner('error', err.message || 'No fue posible cargar los textos del portal.');
    const listEl = document.getElementById('portalTextsSectionsList');
    if (listEl) {
      listEl.innerHTML = `<div style="background:#fff;border-radius:16px;padding:2rem;text-align:center;color:#B91C1C;">${esc(err.message || 'Error cargando los textos')}</div>`;
    }
  }
}
