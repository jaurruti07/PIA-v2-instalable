// data-service-register.js - Desregistro de Service Worker y limpieza de caché
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach(r => r.unregister().catch(() => {}));
  }).catch(() => {});
}

// Función para actualizar datos mock (usada desde el módulo administrativo)
function updateMockData(path, data) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'UPDATE_MOCK_DATA',
        payload: { [path]: data }
      });
    } else {
      // Fallback: guardar en localStorage
      const mockData = JSON.parse(localStorage.getItem('pia_mock_data') || '{}');
      if (data !== undefined) {
        mockData[path] = data;
      } else {
        delete mockData[path];
      }
      localStorage.setItem('pia_mock_data', JSON.stringify(mockData));
    }
  }
  
  // Exponer función globalmente
  window.updateMockData = updateMockData;
