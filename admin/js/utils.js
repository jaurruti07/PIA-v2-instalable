// utils.js - Utilidades comunes

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
}

function getApiBase() {
    return '/api';
}

function getHeaders() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// ========================================================
// MOTOR UNIVERSAL DE DATOS PIA (Soporte Servidor CNC y Modo Local Descargado)
// ========================================================

const PIA_MODULE_FALLBACK_PATHS = {
    'canales': ['../canales-por-la-integridad/data_directorio.json', '/canales-por-la-integridad/data_directorio.json', 'data_directorio.json'],
    'directorio': ['../directorio/data_acceso.json', '/directorio/data_acceso.json', 'data_acceso.json'],
    'tableros': ['../gobierno_en_numeros/data_tableros.json', '/gobierno_en_numeros/data_tableros.json', 'data_tableros.json'],
    'riesgo': ['../riesgo/datos.json', '/riesgo/datos.json', 'datos.json'],
    'vehiculos': ['../vehiculos/vehiculos.json', '/vehiculos/vehiculos.json', 'vehiculos.json'],
    'vehiculos_instituciones': ['../vehiculos/vehiculos.json', '/vehiculos/vehiculos.json', 'vehiculos.json'],
    'portal': ['../data_portal.json', '/data_portal.json', 'data_portal.json'],
    'visits': ['../data/page_visits.json', '/data/page_visits.json', 'page_visits.json'],
    'audit': ['../data/audit_logs.json', '/data/audit_logs.json', 'audit_logs.json'],
    'users': ['../data/users_roles.json', '/data/users_roles.json', 'users_roles.json'],
    'chatbot_knowledge': ['../chatbot_knowledge.json', '/chatbot_knowledge.json', 'chatbot_knowledge.json'],
    'chatbot_settings': ['../chatbot_settings.json', '/chatbot_settings.json', 'chatbot_settings.json']
};

const PIA_DEFAULT_USERS = [
    {
        "id": "usr_cnc_01",
        "email": "deteccionydenuncia@cnc.gob.gt",
        "displayName": "Dirección de Apoyo en la Gestión de Irregularidades - DAGI",
        "role": "admin",
        "modules": ["canales", "directorio", "tableros", "riesgo", "portal", "visits", "chatbot", "users", "audit", "database", "multilingual-guide", "guide"],
        "status": "active",
        "operatorIndex": 1,
        "lastPasswordChange": "2026-03-30T10:00:00.000Z",
        "updatedAt": "2026-03-30T10:00:00.000Z"
    },
    {
        "id": "usr_cnc_02",
        "email": "apoyogi@cnc.gob.gt",
        "displayName": "Apoyo a la Gestión de Irregularidades (CNC)",
        "role": "admin",
        "modules": ["canales", "directorio", "tableros", "riesgo", "portal", "visits", "chatbot", "users", "audit", "database", "multilingual-guide", "guide"],
        "status": "active",
        "operatorIndex": 2,
        "lastPasswordChange": "2026-03-30T10:00:00.000Z",
        "updatedAt": "2026-03-30T10:00:00.000Z"
    }
];

function isStandaloneFileMode() {
    return typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
}

function handleSessionExpiredError(message = 'Tu sesión ha expirado o es inválida. Inicia sesión nuevamente.') {
    if (typeof window !== 'undefined' && typeof window.logout === 'function') {
        window.logout(message);
    }
    return new Error(message);
}

window.PiaDataEngine = {
    isServerActive: null,
    moduleETags: {},

    async checkServerHealth(forceCheck = false) {
        if (isStandaloneFileMode()) {
            this.isServerActive = false;
            this.updateConnectionIndicator();
            return false;
        }
        if (this.isServerActive === true && !forceCheck) return true;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${getApiBase()}/modules`, {
                signal: controller.signal,
                headers: getHeaders(),
                cache: 'no-store'
            });
            clearTimeout(timeoutId);
            this.isServerActive = res.ok;
        } catch (e) {
            this.isServerActive = false;
        }
        this.updateConnectionIndicator();
        return this.isServerActive;
    },

    updateConnectionIndicator() {
        let el = document.getElementById('piaServerStatusBadge');
        if (!el) {
            const headerRight = document.querySelector('.header-right') || document.querySelector('.user-info');
            if (headerRight) {
                el = document.createElement('div');
                el.id = 'piaServerStatusBadge';
                el.style.cssText = 'display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; padding:4px 10px; border-radius:20px; font-weight:700; margin-right:10px;';
                headerRight.prepend(el);
            }
        }
        if (el) {
            if (this.isServerActive) {
                el.style.background = 'rgba(34, 197, 94, 0.15)';
                el.style.color = '#15803D';
                el.style.border = '1px solid rgba(34, 197, 94, 0.3)';
                el.innerHTML = '<i class="fas fa-server"></i> Servidor CNC Activo';
                el.title = 'Conectado a la API institucional en producción';
            } else {
                el.style.background = 'rgba(0, 194, 224, 0.15)';
                el.style.color = '#00C2E0';
                el.style.border = '1px solid rgba(0, 194, 224, 0.3)';
                el.innerHTML = '<i class="fas fa-folder-open"></i> Modo Local / Descargado';
                el.title = 'Datos cargados desde archivos JSON locales (funcional sin servidor)';
            }
        }
    },

    async fetchRawJson(path) {
        if (!isStandaloneFileMode()) {
            const res = await fetch(`/api/raw-json?path=${encodeURIComponent(path)}`, {
                headers: getHeaders(),
                cache: 'no-store'
            });
            if (res.status === 401) {
                throw handleSessionExpiredError();
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `No se pudo leer el archivo JSON (${res.status})`);
            }
            this.isServerActive = true;
            this.updateConnectionIndicator();
            localStorage.removeItem('pia_custom_json_' + path);
            return await res.json();
        }

        const cleanPath = path.replace(/^\//, '');
        const pathsToTry = [
            path,
            '../' + cleanPath,
            './' + cleanPath,
            cleanPath
        ];

        for (const p of pathsToTry) {
            try {
                const res = await fetch(p, { cache: 'no-store' });
                if (res.ok) return await res.json();
            } catch (e) {}
        }

        const custom = localStorage.getItem('pia_custom_json_' + path);
        if (custom) {
            try { return JSON.parse(custom); } catch (e) {}
        }
        return null;
    },

    async fetchModuleRecords(module) {
        if (!isStandaloneFileMode()) {
            let res;
            try {
                res = await fetch(`${getApiBase()}/${encodeURIComponent(module)}`, {
                    headers: getHeaders(),
                    cache: 'no-store'
                });
            } catch (e) {
                this.isServerActive = false;
                this.updateConnectionIndicator();
                throw new Error('No se pudo conectar con el servidor para cargar los datos. Verifica la conexión e intenta nuevamente.');
            }

            if (res.status === 401) {
                throw handleSessionExpiredError();
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Error al cargar el módulo '${module}' desde el servidor (HTTP ${res.status}).`);
            }

            this.isServerActive = true;
            this.updateConnectionIndicator();
            const etag = res.headers.get('ETag');
            if (etag) this.moduleETags[module] = etag;
            localStorage.removeItem('pia_offline_records_' + module);
            const data = await res.json();
            return Array.isArray(data) ? data : [data];
        }

        const localMod = localStorage.getItem('pia_offline_records_' + module);
        if (localMod) {
            try {
                const parsed = JSON.parse(localMod);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) {}
        }

        this.isServerActive = false;
        this.updateConnectionIndicator();

        const fallbacks = PIA_MODULE_FALLBACK_PATHS[module] || [];
        let rawData = null;

        for (const candidatePath of fallbacks) {
            try {
                const res = await fetch(candidatePath, { cache: 'no-store' });
                if (res.ok) {
                    rawData = await res.json();
                    break;
                }
            } catch (e) {}
        }

        if (!rawData) {
            for (const candidatePath of fallbacks) {
                try {
                    const res = await fetch('/' + candidatePath.replace(/^(\.\.\/|\.\/)/, ''), { cache: 'no-store' });
                    if (res.ok) {
                        rawData = await res.json();
                        break;
                    }
                } catch (e) {}
            }
        }

        let parsedRecords = [];
        if (module === 'riesgo') {
            if (rawData && rawData.years && rawData.years['2025'] && Array.isArray(rawData.years['2025'].instituciones)) {
                parsedRecords = rawData.years['2025'].instituciones;
            } else if (Array.isArray(rawData)) {
                parsedRecords = rawData;
            }
        } else if (module === 'vehiculos_instituciones') {
            parsedRecords = rawData?.catalogInstituciones || [];
        } else if (module === 'vehiculos') {
            parsedRecords = rawData?.vehicles || (Array.isArray(rawData) ? rawData : []);
        } else if (module === 'portal') {
            parsedRecords = rawData ? [{ id: 1, ...rawData }] : [];
        } else if (Array.isArray(rawData)) {
            parsedRecords = rawData;
        }

        parsedRecords = parsedRecords.map((item, idx) => ({
            id: item.id !== undefined ? item.id : (module === 'vehiculos_instituciones' ? item.nombre : (idx + 1)),
            ...item
        }));

        localStorage.setItem('pia_offline_records_' + module, JSON.stringify(parsedRecords));
        return parsedRecords;
    },

    async refreshModuleEtag(module) {
        if (isStandaloneFileMode()) return;
        try {
            const res = await fetch(`${getApiBase()}/${encodeURIComponent(module)}`, { headers: getHeaders(), cache: 'no-store' });
            if (res.ok) {
                this.isServerActive = true;
                this.updateConnectionIndicator();
                const etag = res.headers.get('ETag');
                if (etag) this.moduleETags[module] = etag;
            }
        } catch (_) {}
    },

    async saveRecord(module, recordData, id = null) {
        if (!isStandaloneFileMode()) {
            let url = `${getApiBase()}/${encodeURIComponent(module)}`;
            let method = 'POST';
            if (id !== null && id !== undefined && id !== '') {
                url += `/${encodeURIComponent(id)}`;
                method = 'PUT';
            }

            const sendSave = async (etagOverride = null) => {
                const headers = getHeaders();
                const etag = etagOverride || this.moduleETags[module];
                if (etag) headers['If-Match'] = etag;
                return fetch(url, {
                    method,
                    headers,
                    body: JSON.stringify(recordData),
                    cache: 'no-store'
                });
            };

            let res;
            try {
                res = await sendSave();
            } catch (e) {
                this.isServerActive = false;
                this.updateConnectionIndicator();
                throw new Error('No se pudo conectar con el servidor para guardar el registro en el archivo JSON.');
            }

            if (res.status === 409) {
                try {
                    const freshRes = await fetch(`${getApiBase()}/${encodeURIComponent(module)}`, {
                        headers: getHeaders(),
                        cache: 'no-store'
                    });
                    if (freshRes.ok) {
                        const freshEtag = freshRes.headers.get('ETag');
                        if (freshEtag) {
                            this.moduleETags[module] = freshEtag;
                            res = await sendSave(freshEtag);
                        }
                    }
                } catch (_) {}
            }

            if (res.status === 401) {
                throw handleSessionExpiredError();
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (res.status === 409) {
                    throw new Error(err.error || 'Conflicto de concurrencia: Los datos fueron modificados. Por favor intente guardar de nuevo.');
                }
                throw new Error(err.error || `Error al guardar en el archivo JSON del servidor (HTTP ${res.status}).`);
            }

            this.isServerActive = true;
            this.updateConnectionIndicator();
            const newEtag = res.headers.get('ETag');
            if (newEtag) this.moduleETags[module] = newEtag;
            const saved = await res.json();
            localStorage.removeItem('pia_offline_records_' + module);
            if (['canales', 'directorio', 'tableros', 'riesgo', 'portal'].includes(module)) {
                window.piaSyncModuleDataToCloud?.(module);
            }
            return saved;
        }

        // Modo local/descargado únicamente para archivos locales (file://)
        let records = await this.fetchModuleRecords(module);
        let savedRecord = null;

        if (id) {
            const idx = records.findIndex(r => String(r.id) === String(id) || (r.nombre && String(r.nombre) === String(id)));
            if (idx !== -1) {
                records[idx] = { ...records[idx], ...recordData, id: records[idx].id || id };
                savedRecord = records[idx];
            } else {
                savedRecord = { id, ...recordData };
                records.push(savedRecord);
            }
        } else {
            const nextId = (records.length > 0)
                ? Math.max(...records.map(r => Number(r.id) || 0).filter(n => !isNaN(n)), 0) + 1
                : 1;
            savedRecord = { id: nextId, ...recordData };
            records.push(savedRecord);
        }

        localStorage.setItem('pia_offline_records_' + module, JSON.stringify(records));
        this.logLocalAudit({
            action: id ? 'ACTUALIZACIÓN' : 'CREACIÓN',
            module,
            recordId: id || savedRecord.id,
            details: `Modificación local guardada en navegador (Modo sin servidor)`
        });

        return savedRecord;
    },

    async deleteRecord(module, id) {
        if (!isStandaloneFileMode()) {
            const url = `${getApiBase()}/${encodeURIComponent(module)}/${encodeURIComponent(id)}`;
            const sendDelete = async (etagOverride = null) => {
                const headers = getHeaders();
                const etag = etagOverride || this.moduleETags[module];
                if (etag) headers['If-Match'] = etag;
                return fetch(url, {
                    method: 'DELETE',
                    headers,
                    cache: 'no-store'
                });
            };

            let res;
            try {
                res = await sendDelete();
            } catch (e) {
                this.isServerActive = false;
                this.updateConnectionIndicator();
                throw new Error('No se pudo conectar con el servidor para eliminar el registro del archivo JSON.');
            }

            if (res.status === 409) {
                try {
                    const freshRes = await fetch(`${getApiBase()}/${encodeURIComponent(module)}`, {
                        headers: getHeaders(),
                        cache: 'no-store'
                    });
                    if (freshRes.ok) {
                        const freshEtag = freshRes.headers.get('ETag');
                        if (freshEtag) {
                            this.moduleETags[module] = freshEtag;
                            res = await sendDelete(freshEtag);
                        }
                    }
                } catch (_) {}
            }

            if (res.status === 401) {
                throw handleSessionExpiredError();
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (res.status === 409) {
                    throw new Error(err.error || 'Conflicto de concurrencia: Los datos fueron modificados. Intenta eliminar nuevamente.');
                }
                throw new Error(err.error || `Error al eliminar en el servidor (HTTP ${res.status}).`);
            }

            this.isServerActive = true;
            this.updateConnectionIndicator();
            const newEtag = res.headers.get('ETag');
            if (newEtag) this.moduleETags[module] = newEtag;
            localStorage.removeItem('pia_offline_records_' + module);
            if (['canales', 'directorio', 'tableros', 'riesgo', 'portal'].includes(module)) {
                window.piaSyncModuleDataToCloud?.(module);
            }
            return true;
        }

        // Modo local/descargado únicamente para archivos locales (file://)
        let records = await this.fetchModuleRecords(module);
        const filtered = records.filter(r => String(r.id) !== String(id) && (!r.nombre || String(r.nombre) !== String(id)));
        localStorage.setItem('pia_offline_records_' + module, JSON.stringify(filtered));

        this.logLocalAudit({
            action: 'ELIMINACIÓN',
            module,
            recordId: id,
            details: `Eliminación local efectuada en navegador (Modo sin servidor)`
        });
        return true;
    },

    async fetchDashboardStats() {
        try {
            const res = await fetch('/api/dashboard/stats', { headers: getHeaders(), cache: 'no-store' });
            if (res.status === 401) {
                throw handleSessionExpiredError();
            }
            if (res.ok) {
                this.isServerActive = true;
                this.updateConnectionIndicator();
                return await res.json();
            }
        } catch (e) {
            if (!isStandaloneFileMode()) throw e;
        }

        this.isServerActive = false;
        this.updateConnectionIndicator();

        const [canales, directorio, tableros, riesgo, vehiculos, visits, audit] = await Promise.all([
            this.fetchModuleRecords('canales'),
            this.fetchModuleRecords('directorio'),
            this.fetchModuleRecords('tableros'),
            this.fetchModuleRecords('riesgo'),
            this.fetchModuleRecords('vehiculos'),
            this.fetchVisitsData(),
            this.fetchAuditData()
        ]);

        const totalRegs = canales.length + directorio.length + tableros.length + riesgo.length + vehiculos.length;

        return {
            modulos: 6,
            registros: totalRegs,
            operadoresAutorizados: 2,
            instituciones: 68,
            tableros: tableros.length,
            vehiculos: vehiculos.length,
            visitasTotales: visits.totalVisits || 15,
            creados: audit.filter(a => a.action === 'CREACIÓN').length,
            actualizados: audit.filter(a => a.action === 'ACTUALIZACIÓN').length,
            eliminados: audit.filter(a => a.action === 'ELIMINACIÓN').length
        };
    },

    async fetchVisitsData() {
        try {
            const res = await fetch('/api/admin/visits', { headers: getHeaders(), cache: 'no-store' });
            if (res.status === 401) {
                throw handleSessionExpiredError();
            }
            if (res.ok) return await res.json();
        } catch (e) {
            if (!isStandaloneFileMode()) throw e;
        }

        const paths = PIA_MODULE_FALLBACK_PATHS['visits'] || [];
        let data = null;
        for (const p of paths) {
            try {
                const res = await fetch(p);
                if (res.ok) {
                    data = await res.json();
                    break;
                }
            } catch (e) {}
        }

        if (!data) {
            data = {
                totalVisits: 15,
                pages: {
                    "/": { name: "Portal Principal / Inicio", visits: 8, lastVisit: new Date().toISOString() },
                    "/directorio": { name: "Directorio Acceso al Ejecutivo", visits: 1, lastVisit: new Date().toISOString() },
                    "/canales-por-la-integridad": { name: "Canales por la Integridad", visits: 2, lastVisit: new Date().toISOString() },
                    "/gobierno_en_numeros": { name: "Tu Gobierno en Números", visits: 3, lastVisit: new Date().toISOString() },
                    "/riesgo": { name: "Riesgo en la Mira", visits: 1, lastVisit: new Date().toISOString() }
                },
                recentVisits: []
            };
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const recent = data.recentVisits || [];
        const todayVisits = recent.filter(v => v.timestamp && v.timestamp.startsWith(todayStr)).length;

        let topPage = { path: '/', name: 'Portal Principal / Inicio', visits: 0 };
        for (const [p, info] of Object.entries(data.pages || {})) {
            if ((info.visits || 0) >= topPage.visits) {
                topPage = { path: p, name: info.name || p, visits: info.visits || 0 };
            }
        }

        return {
            totalVisits: data.totalVisits || 0,
            todayVisits: todayVisits || 1,
            topPage,
            lastUpdated: data.lastUpdated || new Date().toISOString(),
            pages: data.pages || {},
            recentVisits: recent.slice(0, 40)
        };
    },

    async fetchAuditData() {
        try {
            const res = await fetch('/api/dashboard/audit', { headers: getHeaders(), cache: 'no-store' });
            if (res.status === 401) {
                throw handleSessionExpiredError();
            }
            if (res.ok) return await res.json();
        } catch (e) {
            if (!isStandaloneFileMode()) throw e;
        }

        const paths = PIA_MODULE_FALLBACK_PATHS['audit'] || [];
        let logs = [];
        for (const p of paths) {
            try {
                const res = await fetch(p);
                if (res.ok) {
                    logs = await res.json();
                    break;
                }
            } catch (e) {}
        }

        const localAudit = JSON.parse(localStorage.getItem('pia_offline_audit') || '[]');
        return [...localAudit, ...logs].slice(0, 30);
    },

    logLocalAudit(entry) {
        try {
            const list = JSON.parse(localStorage.getItem('pia_offline_audit') || '[]');
            list.unshift({
                id: 'local_aud_' + Date.now(),
                timestamp: new Date().toISOString(),
                user: localStorage.getItem('userEmail') || 'deteccionydenuncia@cnc.gob.gt',
                ip: '127.0.0.1 (Local)',
                ...entry
            });
            localStorage.setItem('pia_offline_audit', JSON.stringify(list.slice(0, 50)));
        } catch (e) {}
    },

    getFallbackUsers() {
        const stored = localStorage.getItem('pia_offline_users');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) {}
        }
        return PIA_DEFAULT_USERS;
    },

    async createUser(userData) {
        if (!isStandaloneFileMode()) {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(userData),
                cache: 'no-store'
            });
            if (res.status === 401) throw handleSessionExpiredError();
            if (res.ok) {
                const data = await res.json();
                return data.user;
            }
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Error al crear usuario en el servidor');
        }

        // Modo offline / local (solo file://)
        const currentUsers = this.getFallbackUsers();
        const cleanEmail = (userData.email || '').trim().toLowerCase();
        if (currentUsers.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
            throw new Error(`El usuario '${cleanEmail}' ya existe en el sistema local.`);
        }

        const now = new Date().toISOString();
        const newUser = {
            id: `usr_cnc_${Date.now()}`,
            email: cleanEmail,
            displayName: (userData.displayName || '').trim(),
            role: userData.role || 'admin',
            modules: userData.modules || ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'multilingual-guide', 'guide'],
            status: 'active',
            operatorIndex: currentUsers.length + 1,
            lastPasswordChange: now,
            updatedAt: now,
            createdAt: now
        };

        currentUsers.push(newUser);
        localStorage.setItem('pia_offline_users', JSON.stringify(currentUsers));
        this.logLocalAudit({
            action: 'CREACIÓN DE USUARIO',
            module: 'users',
            target: cleanEmail,
            details: `Usuario ${cleanEmail} agregado localmente (Modo sin servidor)`
        });

        return newUser;
    },

    async deleteUser(email) {
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!isStandaloneFileMode()) {
            const res = await fetch(`/api/admin/users/${encodeURIComponent(cleanEmail)}`, {
                method: 'DELETE',
                headers: getHeaders(),
                cache: 'no-store'
            });
            if (res.status === 401) throw handleSessionExpiredError();
            if (res.ok) return true;
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Error al eliminar usuario en el servidor');
        }

        const currentUsers = this.getFallbackUsers();
        const filtered = currentUsers.filter(u => (u.email || '').toLowerCase() !== cleanEmail);
        localStorage.setItem('pia_offline_users', JSON.stringify(filtered));
        this.logLocalAudit({
            action: 'ELIMINACIÓN DE USUARIO',
            module: 'users',
            target: cleanEmail,
            details: `Usuario ${cleanEmail} eliminado localmente (Modo sin servidor)`
        });
        return true;
    },

    async downloadModuleJson(module) {
        let filename = `${module}.json`;
        if (module === 'canales') filename = 'data_directorio.json';
        else if (module === 'directorio') filename = 'data_acceso.json';
        else if (module === 'tableros') filename = 'data_tableros.json';
        else if (module === 'riesgo') filename = 'datos.json';
        else if (module === 'vehiculos' || module === 'vehiculos_instituciones') filename = 'vehiculos.json';
        else if (module === 'portal') filename = 'data_portal.json';

        try {
            let outputData = null;
            if (!isStandaloneFileMode()) {
                try {
                    outputData = await this.fetchRawJson(module === 'vehiculos_instituciones' ? 'vehiculos' : module);
                } catch (_) {
                    const records = await this.fetchModuleRecords(module);
                    outputData = (module === 'portal') ? (records[0] || {}) : records;
                }
            } else {
                const records = JSON.parse(localStorage.getItem('pia_offline_records_' + module) || '[]');
                outputData = records;
                if (module === 'riesgo') {
                    outputData = { years: { "2025": { instituciones: records } } };
                } else if (module === 'vehiculos' || module === 'vehiculos_instituciones') {
                    const cat = (module === 'vehiculos_instituciones') ? records : (JSON.parse(localStorage.getItem('pia_offline_records_vehiculos_instituciones') || '[]'));
                    const veh = (module === 'vehiculos') ? records : (JSON.parse(localStorage.getItem('pia_offline_records_vehiculos') || '[]'));
                    outputData = { catalogInstituciones: cat, vehicles: veh };
                } else if (module === 'portal') {
                    outputData = records[0] || {};
                }
            }

            const blob = new Blob([JSON.stringify(outputData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showToast(`Archivo '${filename}' descargado exitosamente`, 'success');
        } catch (err) {
            window.showToast(err.message || `No se pudo descargar '${filename}'`, 'error');
        }
    }
};

// Enriched Toasts & Skeleton Loader utilities
function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    return container;
}

window.showToast = function(message, type = 'info', undoCallback = null, duration = 4000) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const iconClass = icons[type] || icons.info;

    let undoBtnHtml = '';
    if (typeof undoCallback === 'function') {
        undoBtnHtml = `<button class="toast-undo-btn"><i class="fas fa-undo-alt"></i> Deshacer</button>`;
    }

    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
        <div class="toast-content">
            <div class="toast-title">${type.toUpperCase()}</div>
            <div>${message}</div>
        </div>
        ${undoBtnHtml}
        <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    if (undoCallback) {
        const btn = toast.querySelector('.toast-undo-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                undoCallback();
                toast.classList.add('toast-exiting');
                setTimeout(() => toast.remove(), 250);
            });
        }
    }

    container.appendChild(toast);

    const timer = setTimeout(() => {
        toast.classList.add('toast-exiting');
        setTimeout(() => toast.remove(), 250);
    }, duration);

    toast.addEventListener('mouseenter', () => {
        const progress = toast.querySelector('.toast-progress');
        if (progress) progress.style.animationPlayState = 'paused';
    });
    toast.addEventListener('mouseleave', () => {
        const progress = toast.querySelector('.toast-progress');
        if (progress) progress.style.animationPlayState = 'running';
    });
};

function showToast(message, type = 'info', undoCallback = null, duration = 4000) {
    window.showToast(message, type, undoCallback, duration);
}

// Generador universal de tablas esqueletizadas (Skeleton Table Loader)
window.renderSkeletonTable = function(target, cols = 5, rows = 5) {
    let el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;

    // Si el elemento recibido es un contenedor o la tabla misma
    let table = el.tagName === 'TABLE' ? el : el.querySelector('table');
    if (!table && el.tagName !== 'TABLE') {
        el.innerHTML = `<table style="width:100%; border-collapse:collapse;"><thead></thead><tbody></tbody></table>`;
        table = el.querySelector('table');
    }

    if (!table) return;

    let headersHtml = '<tr>';
    for (let c = 0; c < cols; c++) {
        headersHtml += `<th style="padding: 0.85rem 1rem;"><div class="skeleton-loader" style="width: ${60 + (c % 3) * 15}%;"></div></th>`;
    }
    headersHtml += '</tr>';

    let bodyHtml = '';
    const widths = [85, 65, 45, 90, 70, 50, 75, 60, 40];
    for (let r = 0; r < rows; r++) {
        bodyHtml += `<tr class="skeleton-row" style="border-bottom: 1px solid var(--border);">`;
        for (let c = 0; c < cols; c++) {
            const w = widths[(r + c) % widths.length];
            bodyHtml += `<td style="padding: 0.85rem 1rem;"><div class="skeleton-loader" style="width: ${w}%;"></div></td>`;
        }
        bodyHtml += `</tr>`;
    }

    table.innerHTML = `<thead>${headersHtml}</thead><tbody>${bodyHtml}</tbody>`;
};


function getDatabaseConfigForPage(pageName) {
    const stored = localStorage.getItem('pia_db_configurations');
    if (stored) {
        try {
            const config = JSON.parse(stored);
            const dbId = config.pageDatabaseMap[pageName];
            if (dbId) {
                const db = config.databases.find(d => d.id === dbId);
                if (db) return db;
            }
            if (config.defaultDatabase) {
                const db = config.databases.find(d => d.id === config.defaultDatabase);
                if (db) return db;
            }
        } catch (e) {
            console.error('Error parsing DB config:', e);
        }
    }
    return null;
}

function getAllDatabaseConfigs() {
    const stored = localStorage.getItem('pia_db_configurations');
    if (!stored) return { databases: [], defaultDatabase: null, pageDatabaseMap: {} };
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error('Error parsing DB config:', e);
        return { databases: [], defaultDatabase: null, pageDatabaseMap: {} };
    }
}

const toastStyles = document.createElement('style');
toastStyles.textContent = `
    .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #05111F;
        color: #fff;
        padding: 10px 24px;
        border-radius: 50px;
        font-weight: 600;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideUp 0.3s ease;
    }
    .toast-success { background: #22C55E; }
    .toast-error { background: #EF4444; }
    .toast-info { background: #2B82C9; }
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(toastStyles);
