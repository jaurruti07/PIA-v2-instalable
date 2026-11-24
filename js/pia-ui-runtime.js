// /js/pia-ui-runtime.js
// Motor público unificado de KPIs dinámicos (con modo carrusel >4) e Imágenes de Fondo por módulo
(function () {
  'use strict';

  const SAFE_ICON_RE = /^fa(?:s|r|b|l|d|ss|sr)?\s+fa-[a-z0-9-]+$/i;

  function escapeText(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeIconClass(rawIcon, fallback) {
    const fb = fallback || 'fas fa-chart-line';
    const cleaned = String(rawIcon || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return fb;
    if (SAFE_ICON_RE.test(cleaned)) return cleaned.toLowerCase();
    if (/^fa-[a-z0-9-]+$/i.test(cleaned)) return `fas ${cleaned.toLowerCase()}`;
    return fb;
  }

  function sanitizeImageUrl(rawUrl) {
    const val = String(rawUrl || '').trim();
    if (!val || /[\s"'`<>()\\;]/.test(val) || val.includes('..')) return null;
    if (/^\/(?:img|uploads\/backgrounds)\/[a-zA-Z0-9._-]+$/i.test(val)) {
      return val;
    }
    try {
      const parsed = new URL(val);
      if (parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  function injectSharedStyles() {
    if (document.getElementById('pia-ui-runtime-styles')) return;
    const style = document.createElement('style');
    style.id = 'pia-ui-runtime-styles';
    style.textContent = `
      .pia-stats-ribbon-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.9rem;
        flex-wrap: wrap;
      }
      .pia-stats-ribbon-tag {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--cyan, #00C2E0);
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
      }
      .pia-stats-ribbon-tag::before {
        content: '';
        display: inline-block;
        width: 18px;
        height: 2px;
        background: var(--cyan, #00C2E0);
        border-radius: 2px;
      }
      .pia-stats-carousel-controls {
        display: none;
        align-items: center;
        gap: 0.6rem;
      }
      .pia-stats-nav-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid rgba(0, 194, 224, 0.35);
        background: rgba(5, 17, 31, 0.55);
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.8rem;
      }
      .pia-stats-nav-btn:hover {
        background: var(--cyan, #00C2E0);
        color: #05111F;
        border-color: var(--cyan, #00C2E0);
      }
      .pia-stats-pagination {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .pia-stats-pagination .swiper-pagination-bullet {
        width: 8px;
        height: 8px;
        background: rgba(255, 255, 255, 0.32);
        opacity: 1;
        transition: all 0.25s ease;
      }
      .pia-stats-pagination .swiper-pagination-bullet-active {
        width: 22px;
        border-radius: 99px;
        background: var(--cyan, #00C2E0);
      }
      .pia-stats-grid {
        display: grid !important;
        grid-template-columns: repeat(var(--stats-cols, 4), minmax(0, 1fr)) !important;
        gap: 1px;
        background: rgba(0, 194, 224, 0.1);
        border: 1px solid rgba(0, 194, 224, 0.1);
        border-radius: 14px;
        overflow: hidden;
      }
      .pia-stats-swiper {
        border: 1px solid rgba(0, 194, 224, 0.12);
        border-radius: 14px;
        overflow: hidden;
        background: rgba(0, 194, 224, 0.08);
      }
      .pia-stats-swiper .swiper-slide {
        height: auto !important;
        display: flex;
        align-items: stretch;
      }
      .pia-stats-swiper .stat-cell,
      .pia-stats-grid .stat-cell {
        width: 100%;
        background: var(--navy-mid, #0C2033);
        padding: 1.3rem 1.05rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: background 0.25s ease;
      }
      .pia-stats-swiper .stat-cell:hover,
      .pia-stats-grid .stat-cell:hover {
        background: rgba(0, 194, 224, 0.06);
      }
      .pia-stat-icon {
        font-size: 1.2rem;
        color: var(--cyan, #00C2E0);
        margin-bottom: 0.45rem;
        opacity: 0.92;
      }
      .pia-stat-num {
        font-family: var(--font-head, 'Sora', sans-serif);
        font-size: clamp(1.55rem, 2.5vw, 2.2rem);
        font-weight: 800;
        color: #fff;
        line-height: 1.08;
        margin-bottom: 0.35rem;
      }
      .pia-stat-lbl {
        font-size: 0.78rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.3;
      }
      .pia-stat-desc {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.56);
        margin-top: 0.3rem;
        line-height: 1.35;
        max-width: 240px;
      }
      .pia-semaphore-kpis-carousel .semaphore-kpi {
        height: 100%;
      }
      @media (max-width: 960px) {
        .pia-stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }
      @media (max-width: 540px) {
        .pia-stats-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const state = {
    module: null,
    config: null,
    statsContainerId: null,
    variant: 'ribbon', // 'ribbon' | 'semaphore'
    showTooltipButtons: false,
    manageKpis: true,
    manageBackgrounds: true,
    liveValues: {},
    flags: {},
    kpiSwiper: null,
    heroTimer: null,
    heroSlides: [],
    heroIndex: 0
  };

  function resolveKpiDisplayValue(kpi) {
    if (kpi.modoValor === 'auto' && kpi.autoKey && Object.prototype.hasOwnProperty.call(state.liveValues, kpi.autoKey)) {
      const liveVal = state.liveValues[kpi.autoKey];
      return `${liveVal === null || liveVal === undefined ? 0 : liveVal}${kpi.sufijo || ''}`;
    }
    const baseVal = kpi.valor !== undefined && kpi.valor !== null ? String(kpi.valor) : '0';
    return `${baseVal}${kpi.sufijo || ''}`;
  }

  function getVisibleKpis() {
    const raw = Array.isArray(state.config?.kpis) ? state.config.kpis : [];
    return raw
      .filter((k) => {
        if (k.activo === false) return false;
        if (k.requiresConfigFlag && state.flags[k.requiresConfigFlag] === false) return false;
        return true;
      })
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  }

  function buildRibbonCardHtml(kpi) {
    const safeIcon = sanitizeIconClass(kpi.icono, 'fas fa-chart-line');
    const safeTitle = escapeText(kpi.titulo || '');
    const safeDesc = escapeText(kpi.descripcion || '');
    const displayVal = escapeText(resolveKpiDisplayValue(kpi));
    const autoAttr = (kpi.modoValor === 'auto' && kpi.autoKey)
      ? ` data-pia-auto-key="${escapeText(kpi.autoKey)}" data-pia-suffix="${escapeText(kpi.sufijo || '')}"`
      : '';

    const tipHtml = (state.showTooltipButtons && safeDesc)
      ? `<button type="button" class="kpi-tip-btn" aria-label="Información sobre ${safeTitle}" data-kpi-tooltip="${safeDesc}"><i class="fas fa-question"></i></button>`
      : '';

    const labelHtml = tipHtml
      ? `<span class="kpi-label-with-tip"><span>${safeTitle}</span>${tipHtml}</span>`
      : safeTitle;

    return `
      <div class="stat-cell">
        <div class="pia-stat-icon"><i class="${safeIcon}"></i></div>
        <div class="stat-num pia-stat-num"${autoAttr}>${displayVal}</div>
        <div class="stat-lbl pia-stat-lbl">${labelHtml}</div>
        ${safeDesc ? `<div class="pia-stat-desc">${safeDesc}</div>` : ''}
      </div>
    `;
  }

  function buildSemaphoreCardHtml(kpi) {
    const safeIcon = sanitizeIconClass(kpi.icono, 'fas fa-chart-line');
    const safeTitle = escapeText(kpi.titulo || '');
    const safeDesc = escapeText(kpi.descripcion || '');
    const displayVal = escapeText(resolveKpiDisplayValue(kpi));
    const autoAttr = (kpi.modoValor === 'auto' && kpi.autoKey)
      ? ` data-pia-auto-key="${escapeText(kpi.autoKey)}" data-pia-suffix="${escapeText(kpi.sufijo || '')}"`
      : '';

    let colorCls = 'blue';
    if (kpi.autoKey === 'kpiCumple') colorCls = 'green';
    else if (kpi.autoKey === 'kpiProceso') colorCls = 'amber';
    else if (kpi.autoKey === 'kpiNoCumple') colorCls = 'red';

    return `
      <div class="semaphore-kpi">
        <div style="font-size:1.1rem; color:var(--cyan, #00C2E0); margin-bottom:0.35rem;"><i class="${safeIcon}"></i></div>
        <div class="num ${colorCls}"${autoAttr}>${displayVal}</div>
        <div class="label">${safeTitle}</div>
        ${safeDesc ? `<div style="font-size:0.72rem; color:var(--text-muted, #5E7A8E); margin-top:0.25rem; line-height:1.3;">${safeDesc}</div>` : ''}
      </div>
    `;
  }

  function renderKpis() {
    if (!state.manageKpis || !state.statsContainerId) return;
    const container = document.getElementById(state.statsContainerId);
    if (!container) return;

    const visibleKpis = getVisibleKpis();
    if (state.kpiSwiper) {
      try { state.kpiSwiper.destroy(true, true); } catch (_) {}
      state.kpiSwiper = null;
    }

    if (state.variant === 'semaphore') {
      if (visibleKpis.length === 0) {
        container.innerHTML = '';
        return;
      }
      if (visibleKpis.length > 3 && typeof window.Swiper === 'function') {
        container.classList.remove('semaphore-kpis');
        container.classList.add('pia-semaphore-kpis-carousel');
        container.innerHTML = `
          <div class="swiper" id="piaSemaphoreSwiper" style="padding-bottom:2rem;">
            <div class="swiper-wrapper">
              ${visibleKpis.map(k => `<div class="swiper-slide" style="height:auto;">${buildSemaphoreCardHtml(k)}</div>`).join('')}
            </div>
            <div class="swiper-pagination" id="piaSemaphorePagination"></div>
          </div>
        `;
        state.kpiSwiper = new window.Swiper('#piaSemaphoreSwiper', {
          slidesPerView: 1,
          spaceBetween: 14,
          loop: true,
          autoplay: { delay: 3600, disableOnInteraction: false, pauseOnMouseEnter: true },
          pagination: { el: '#piaSemaphorePagination', clickable: true },
          breakpoints: { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }
        });
      } else {
        container.classList.remove('pia-semaphore-kpis-carousel');
        container.classList.add('semaphore-kpis');
        container.innerHTML = visibleKpis.map(buildSemaphoreCardHtml).join('');
      }
      refreshLiveDomValues();
      return;
    }

    const controlsEl = document.getElementById('piaStatsCarouselControls');
    if (visibleKpis.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.65);padding:1rem;">No hay indicadores activos.</div>';
      if (controlsEl) controlsEl.style.display = 'none';
      return;
    }

    const useCarousel = visibleKpis.length > 4 && typeof window.Swiper === 'function';
    if (!useCarousel) {
      if (controlsEl) controlsEl.style.display = 'none';
      const cols = Math.max(1, Math.min(4, visibleKpis.length));
      container.innerHTML = `
        <div class="stats-grid pia-stats-grid" style="--stats-cols:${cols};">
          ${visibleKpis.map(buildRibbonCardHtml).join('')}
        </div>
      `;
    } else {
      if (controlsEl) controlsEl.style.display = 'inline-flex';
      container.innerHTML = `
        <div class="swiper pia-stats-swiper" id="piaModuleStatsSwiper">
          <div class="swiper-wrapper">
            ${visibleKpis.map(k => `<div class="swiper-slide">${buildRibbonCardHtml(k)}</div>`).join('')}
          </div>
        </div>
      `;
      state.kpiSwiper = new window.Swiper('#piaModuleStatsSwiper', {
        slidesPerView: 1,
        spaceBetween: 1,
        loop: true,
        speed: 650,
        autoplay: {
          delay: 3600,
          disableOnInteraction: false,
          pauseOnMouseEnter: true
        },
        navigation: {
          nextEl: '#piaStatsNextBtn',
          prevEl: '#piaStatsPrevBtn'
        },
        pagination: {
          el: '#piaStatsPagination',
          clickable: true
        },
        breakpoints: {
          560: { slidesPerView: 2 },
          880: { slidesPerView: 3 },
          1120: { slidesPerView: 4 }
        }
      });
    }

    refreshLiveDomValues();
  }

  function refreshLiveDomValues() {
    const scope = state.statsContainerId ? document.getElementById(state.statsContainerId) : document;
    if (!scope) return;
    scope.querySelectorAll('[data-pia-auto-key]').forEach((el) => {
      const key = el.getAttribute('data-pia-auto-key');
      const suffix = el.getAttribute('data-pia-suffix') || '';
      if (key && Object.prototype.hasOwnProperty.call(state.liveValues, key)) {
        const val = state.liveValues[key];
        el.textContent = `${val === null || val === undefined ? 0 : val}${suffix}`;
      }
    });
  }

  function applyHeroBackgrounds(backgrounds) {
    if (!state.manageBackgrounds) return;
    const slider = document.getElementById('heroBgSlider');
    const dotsWrap = document.getElementById('heroSliderDots');
    if (!slider) return;

    const activeSlides = (Array.isArray(backgrounds) ? backgrounds : [])
      .filter(b => b && b.activo !== false)
      .map(b => ({ ...b, safeUrl: sanitizeImageUrl(b.url) }))
      .filter(b => Boolean(b.safeUrl))
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    if (activeSlides.length === 0) return;

    // Detener cualquier temporizador previo del slider
    if (state.heroTimer) {
      clearInterval(state.heroTimer);
      state.heroTimer = null;
    }
    if (window.__piaLegacyHeroTimer) {
      clearInterval(window.__piaLegacyHeroTimer);
      window.__piaLegacyHeroTimer = null;
    }

    slider.dataset.piaManaged = '1';
    slider.innerHTML = '';
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      dotsWrap.style.display = activeSlides.length > 1 ? '' : 'none';
    }

    const slideNodes = [];
    const dotNodes = [];

    activeSlides.forEach((item, idx) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = idx === 0 ? 'hero-slide active' : 'hero-slide';
      slideDiv.style.backgroundImage = `url("${item.safeUrl}")`;
      if (item.titulo) slideDiv.setAttribute('aria-label', String(item.titulo));
      slider.appendChild(slideDiv);
      slideNodes.push(slideDiv);

      if (dotsWrap && activeSlides.length > 1) {
        const dotBtn = document.createElement('button');
        dotBtn.type = 'button';
        dotBtn.className = idx === 0 ? 'hero-dot active' : 'hero-dot';
        dotBtn.setAttribute('aria-label', item.titulo ? String(item.titulo) : `Diapositiva ${idx + 1}`);
        dotsWrap.appendChild(dotBtn);
        dotNodes.push(dotBtn);
      }
    });

    state.heroSlides = slideNodes;
    state.heroIndex = 0;

    function goToSlide(idx) {
      slideNodes.forEach((s, i) => s.classList.toggle('active', i === idx));
      dotNodes.forEach((d, i) => d.classList.toggle('active', i === idx));
      state.heroIndex = idx;
    }

    function restartTimer() {
      if (state.heroTimer) clearInterval(state.heroTimer);
      if (slideNodes.length > 1) {
        state.heroTimer = setInterval(() => {
          goToSlide((state.heroIndex + 1) % slideNodes.length);
        }, 5000);
      }
    }

    dotNodes.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        goToSlide(idx);
        restartTimer();
      });
    });

    restartTimer();
  }

  function applySectionImages(sectionImages) {
    if (!sectionImages || typeof sectionImages !== 'object') return;
    if (state.module === 'portal' && sectionImages.porqueExiste) {
      const safeUrl = sanitizeImageUrl(sectionImages.porqueExiste);
      if (safeUrl) {
        const imgEl = document.getElementById('portalPorqueExisteImg') || document.querySelector('#portal .portal-band-img img');
        if (imgEl) imgEl.src = safeUrl;
      }
    }
  }

  async function init(options) {
    injectSharedStyles();
    const opts = options || {};
    state.module = opts.module || 'portal';
    state.statsContainerId = opts.statsContainerId || null;
    state.variant = opts.variant || 'ribbon';
    state.showTooltipButtons = Boolean(opts.showTooltipButtons);
    state.manageKpis = opts.manageKpis !== false;
    state.manageBackgrounds = opts.manageBackgrounds !== false;
    if (opts.initialFlags && typeof opts.initialFlags === 'object') {
      state.flags = { ...state.flags, ...opts.initialFlags };
    }
    if (opts.initialLiveValues && typeof opts.initialLiveValues === 'object') {
      state.liveValues = { ...state.liveValues, ...opts.initialLiveValues };
    }

    try {
      const res = await fetch(`/api/ui/${encodeURIComponent(state.module)}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      state.config = data;
      applyHeroBackgrounds(data.backgrounds);
      applySectionImages(data.sectionImages);
      if (state.manageKpis) {
        renderKpis();
      }
      if (typeof opts.onLoaded === 'function') {
        opts.onLoaded(data);
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  function updateLiveValues(valuesMap) {
    if (!valuesMap || typeof valuesMap !== 'object') return;
    state.liveValues = { ...state.liveValues, ...valuesMap };
    refreshLiveDomValues();
  }

  function setFlags(flagsMap) {
    if (!flagsMap || typeof flagsMap !== 'object') return;
    state.flags = { ...state.flags, ...flagsMap };
    if (state.config && state.manageKpis) {
      renderKpis();
    }
  }

  window.PIA_UI = {
    init,
    updateLiveValues,
    setFlags,
    refreshKpis: renderKpis,
    sanitizeImageUrl,
    sanitizeIconClass
  };
})();
