// js/pia-portal-texts.js
// Carga segura de textos estáticos institucionales administrables en el Portal Principal PIA
(function () {
  'use strict';

  function applyTextsMap(texts) {
    if (!texts || typeof texts !== 'object') return;
    const nodes = document.querySelectorAll('[data-pia-text]');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const key = el.getAttribute('data-pia-text');
      if (!key || !Object.prototype.hasOwnProperty.call(texts, key)) continue;
      const val = texts[key];
      if (typeof val !== 'string' || !val.trim()) continue;
      if (el.textContent !== val) {
        el.textContent = val;
      }
    }
  }

  function applyBakedTextsSync() {
    try {
      const baked = window.PIA_BAKED_TEXTS && window.PIA_BAKED_TEXTS.portal;
      if (baked && typeof baked === 'object') {
        applyTextsMap(baked);
      }
    } catch (_) {}
  }

  async function loadAndApplyPortalTexts() {
    applyBakedTextsSync();
    try {
      const res = await fetch('/api/portal/texts', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || data.success !== true || !data.texts) return;
      applyTextsMap(data.texts);
    } catch (_) {
      // Mantiene los textos por defecto o materializados en código si hay error de red
    }
  }

  window.PIA_PORTAL_TEXTS = {
    reload: loadAndApplyPortalTexts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndApplyPortalTexts);
  } else {
    loadAndApplyPortalTexts();
  }
})();
