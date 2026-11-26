// js/pia-module-texts.js
// Carga segura de textos estáticos institucionales administrables para las páginas de módulos PIA
(function () {
  'use strict';

  var currentScript = document.currentScript;

  function detectModuleKey() {
    var attr = currentScript && currentScript.getAttribute('data-module');
    if (attr) return attr.trim().toLowerCase();
    var p = (window.location.pathname || '').toLowerCase();
    if (p.indexOf('/directorio') !== -1) return 'directorio';
    if (p.indexOf('/gobierno_en_numeros') !== -1) return 'tableros';
    if (p.indexOf('/canales-por-la-integridad') !== -1) return 'canales';
    if (p.indexOf('/riesgo') !== -1) return 'riesgo';
    return null;
  }

  function applyTextsMap(texts) {
    if (!texts || typeof texts !== 'object') return;
    var nodes = document.querySelectorAll('[data-pia-text]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-pia-text');
      if (!key || !Object.prototype.hasOwnProperty.call(texts, key)) continue;
      var val = texts[key];
      if (typeof val !== 'string' || !val.trim()) continue;
      if (el.textContent !== val) {
        el.textContent = val;
      }
    }
  }

  async function loadAndApplyModuleTexts(explicitKey) {
    var modKey = explicitKey || detectModuleKey();
    if (!modKey) return;
    try {
      var url = '/api/module-texts/' + encodeURIComponent(modKey) + '?t=' + Date.now();
      var res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      var data = await res.json();
      if (!data || data.success !== true || !data.texts) return;
      applyTextsMap(data.texts);
    } catch (_) {
      // Mantiene los textos por defecto embebidos en el HTML si hay error de red
    }
  }

  window.PIA_MODULE_TEXTS = {
    reload: loadAndApplyModuleTexts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadAndApplyModuleTexts();
    });
  } else {
    loadAndApplyModuleTexts();
  }
})();
