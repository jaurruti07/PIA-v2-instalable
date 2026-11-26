// crud.js - Operaciones CRUD con control de concurrencia optimista (ETag)

const API_BASE = getApiBase();
const moduleETags = {};

async function getModules() {
    const res = await fetch(`${API_BASE}/modules`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Error al obtener módulos');
    return res.json();
}

async function getModuleData(module) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(module)}`, { headers: getHeaders(), cache: 'no-store' });
    if (res.status === 401 && typeof window.logout === 'function') {
        window.logout('Tu sesión ha expirado. Inicia sesión nuevamente.');
    }
    if (!res.ok) throw new Error(`Error al obtener datos de ${module}`);
    const etag = res.headers.get('ETag');
    if (etag) moduleETags[module] = etag;
    return res.json();
}

async function getRecord(module, id) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(module)}/${encodeURIComponent(id)}`, { headers: getHeaders(), cache: 'no-store' });
    if (res.status === 401 && typeof window.logout === 'function') {
        window.logout('Tu sesión ha expirado. Inicia sesión nuevamente.');
    }
    if (!res.ok) throw new Error('Registro no encontrado');
    const etag = res.headers.get('ETag');
    if (etag) moduleETags[module] = etag;
    return res.json();
}

async function createRecord(module, data) {
    const sendCreate = (etagOverride = null) => {
        const headers = getHeaders();
        const etag = etagOverride || moduleETags[module];
        if (etag) headers['If-Match'] = etag;
        return fetch(`${API_BASE}/${encodeURIComponent(module)}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            cache: 'no-store'
        });
    };

    let res = await sendCreate();
    if (res.status === 409) {
        try {
            const freshRes = await fetch(`${API_BASE}/${encodeURIComponent(module)}`, { headers: getHeaders(), cache: 'no-store' });
            if (freshRes.ok) {
                const freshEtag = freshRes.headers.get('ETag');
                if (freshEtag) {
                    moduleETags[module] = freshEtag;
                    res = await sendCreate(freshEtag);
                }
            }
        } catch (_) {}
    }
    if (res.status === 401 && typeof window.logout === 'function') {
        window.logout('Tu sesión ha expirado. Inicia sesión nuevamente.');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
            throw new Error(err.error || 'Conflicto de concurrencia: Los datos fueron modificados por la otra persona operadora. Por favor recargue la tabla.');
        }
        throw new Error(err.error || 'Error al crear');
    }
    const newEtag = res.headers.get('ETag');
    if (newEtag) moduleETags[module] = newEtag;
    return res.json();
}

async function updateRecord(module, id, data) {
    const headers = getHeaders();
    if (moduleETags[module]) headers['If-Match'] = moduleETags[module];

    const res = await fetch(`${API_BASE}/${encodeURIComponent(module)}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
        cache: 'no-store'
    });
    if (!res.ok) {
        if (res.status === 409) {
            try {
                const freshRes = await fetch(`${API_BASE}/${encodeURIComponent(module)}`, { headers: getHeaders(), cache: 'no-store' });
                if (freshRes.ok) {
                    const freshEtag = freshRes.headers.get('ETag');
                    if (freshEtag) {
                        moduleETags[module] = freshEtag;
                        const retryHeaders = getHeaders();
                        retryHeaders['If-Match'] = freshEtag;
                        const retryRes = await fetch(`${API_BASE}/${encodeURIComponent(module)}/${encodeURIComponent(id)}`, {
                            method: 'PUT',
                            headers: retryHeaders,
                            body: JSON.stringify(data),
                            cache: 'no-store'
                        });
                        if (retryRes.ok) {
                            const newEtag = retryRes.headers.get('ETag');
                            if (newEtag) moduleETags[module] = newEtag;
                            return retryRes.json();
                        }
                    }
                }
            } catch (_) {}
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Conflicto de concurrencia: Los datos fueron modificados. Por favor intente guardar de nuevo.');
        }
        if (res.status === 401 && typeof window.logout === 'function') {
            window.logout('Tu sesión ha expirado. Inicia sesión nuevamente.');
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al actualizar');
    }
    const newEtag = res.headers.get('ETag');
    if (newEtag) moduleETags[module] = newEtag;
    return res.json();
}

async function deleteRecord(module, id) {
    const sendDelete = (etagOverride = null) => {
        const headers = getHeaders();
        const etag = etagOverride || moduleETags[module];
        if (etag) headers['If-Match'] = etag;
        return fetch(`${API_BASE}/${encodeURIComponent(module)}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers,
            cache: 'no-store'
        });
    };

    let res = await sendDelete();
    if (res.status === 409) {
        try {
            const freshRes = await fetch(`${API_BASE}/${encodeURIComponent(module)}`, { headers: getHeaders(), cache: 'no-store' });
            if (freshRes.ok) {
                const freshEtag = freshRes.headers.get('ETag');
                if (freshEtag) {
                    moduleETags[module] = freshEtag;
                    res = await sendDelete(freshEtag);
                }
            }
        } catch (_) {}
    }
    if (res.status === 401 && typeof window.logout === 'function') {
        window.logout('Tu sesión ha expirado. Inicia sesión nuevamente.');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
            throw new Error(err.error || 'Conflicto de concurrencia: Los datos fueron modificados por la otra persona operadora. Por favor recargue la tabla.');
        }
        throw new Error(err.error || 'Error al eliminar');
    }
    const newEtag = res.headers.get('ETag');
    if (newEtag) moduleETags[module] = newEtag;
    return res.json();
}