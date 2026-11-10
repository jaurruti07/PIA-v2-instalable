// Service Worker Cleanup & Cache Purge to ensure fresh content is displayed
if ('serviceWorker' in navigator) {
  // Unregister any active service worker to prevent stale cached HTML
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach(r => {
      r.unregister().then(() => {
        console.log('Obsolete ServiceWorker unregistered:', r.scope);
      }).catch(() => {});
    });
  }).catch(() => {});
}

// Clear legacy window caches that might be holding old versions of pages
if (typeof caches !== 'undefined') {
  caches.keys().then((names) => {
    names.forEach(name => {
      caches.delete(name);
    });
  }).catch(() => {});
}

// Transición Suave entre Páginas (View Transitions & Anti-Flicker)
(function() {
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank' || link.hasAttribute('download')) {
      return;
    }

    try {
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && (destination.pathname !== window.location.pathname || destination.search !== window.location.search)) {
        if (CSS.supports && CSS.supports('view-transition-name', 'root')) {
          return; // Native cross-document view transition handled by browser engine
        }
        
        e.preventDefault();
        document.body.classList.add('page-exiting');
        setTimeout(function() {
          window.location.href = destination.href;
        }, 180);
      }
    } catch (err) {
      // Ignore invalid URLs
    }
  });

  window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      document.body.classList.remove('page-exiting');
    }
  });
})();
