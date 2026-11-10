// auth.js - Autenticación Institucional del Portal de Integridad Activa (PIA)
// Soporte Dual: Backend Criptográfico Local (Node.js/Flask) + Firebase Authentication

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API_BASE = (typeof getApiBase === 'function') ? getApiBase() : ((typeof window !== 'undefined' && window.getApiBase) ? window.getApiBase() : '/api');
let firebaseAppInstance = null;
let firebaseAuthInstance = null;
let firebaseConfigCache = null;

// Cuentas institucionales oficiales con acceso exclusivo a la administración del Portal PIA
export const ALLOWED_ADMIN_EMAILS = [
    'deteccionydenuncia@cnc.gob.gt',
    'apoyogi@cnc.gob.gt'
];

// Configuración canónica completa de Firebase (evita el error auth/invalid-api-key al descargar el proyecto)
const CANONICAL_FIREBASE_CONFIG = {
    configured: true,
    projectId: 'pia-portal-integridad',
    apiKey: 'AIzaSyCWE4pPbpQKEgmR67F2b-x1yWYXee_34Sk',
    authDomain: 'pia-portal-integridad.firebaseapp.com',
    appId: '1:785917550733:web:2835a06188ec46bea0c2c4',
    storageBucket: 'pia-portal-integridad.firebasestorage.app',
    authorizedEmails: ALLOWED_ADMIN_EMAILS
};

export async function getFirebaseConfig() {
    if (firebaseConfigCache && firebaseConfigCache.apiKey) return firebaseConfigCache;
    try {
        const res = await fetch(`${API_BASE}/auth/firebase-config`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.apiKey) {
                firebaseConfigCache = { ...CANONICAL_FIREBASE_CONFIG, ...data };
                return firebaseConfigCache;
            }
        }
    } catch (_) {}
    firebaseConfigCache = CANONICAL_FIREBASE_CONFIG;
    return firebaseConfigCache;
}

export async function initFirebaseAuth() {
    if (firebaseAuthInstance) return firebaseAuthInstance;

    const config = await getFirebaseConfig();
    const apiKey = config.apiKey || CANONICAL_FIREBASE_CONFIG.apiKey;

    try {
        if (!firebaseAppInstance) {
            if (getApps().length > 0) {
                firebaseAppInstance = getApp();
            } else {
                firebaseAppInstance = initializeApp({
                    projectId: config.projectId || CANONICAL_FIREBASE_CONFIG.projectId,
                    apiKey: apiKey,
                    authDomain: config.authDomain || CANONICAL_FIREBASE_CONFIG.authDomain,
                    appId: config.appId || CANONICAL_FIREBASE_CONFIG.appId,
                    storageBucket: config.storageBucket || CANONICAL_FIREBASE_CONFIG.storageBucket
                });
            }
        }

        firebaseAuthInstance = getAuth(firebaseAppInstance);
        try {
            await setPersistence(firebaseAuthInstance, browserLocalPersistence);
        } catch (_) {}
        return firebaseAuthInstance;
    } catch (err) {
        console.warn('Advertencia en inicialización de Firebase:', err);
        return null;
    }
}

// Iniciar sesión institucional usando Email y Contraseña (Servidor PIA + Respaldo Offline/Firebase)
export async function loginWithFirebase(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = password || '';

    if (!cleanEmail || !cleanPassword) {
        throw new Error('Debe ingresar su correo institucional y su contraseña.');
    }

    // Regla 1: Restricción exclusiva en cliente antes de contactar cualquier proveedor
    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
        throw new Error(`Acceso denegado: El correo "${cleanEmail}" no figura entre las 2 cuentas oficiales autorizadas para la administración del Portal PIA.`);
    }

    // Intento 1: Autenticación institucional directa con el backend PIA (Node.js o Python Flask)
    try {
        const localLoginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
        });

        if (localLoginRes.ok) {
            const localData = await localLoginRes.json();
            if (localData && localData.token && localData.user) {
                localStorage.setItem('token', localData.token);
                sessionStorage.setItem('token', localData.token);
                localStorage.setItem('user', JSON.stringify(localData.user));
                return { token: localData.token, user: localData.user };
            }
        } else if (localLoginRes.status === 401) {
            const errData = await localLoginRes.json().catch(() => ({}));
            // Si el backend rechazó las credenciales, informar directamente sin invocar Firebase
            throw new Error(errData.error || 'Contraseña o correo institucional incorrecto.');
        }
    } catch (e) {
        // Si fue rechazo explícito de credenciales por el backend, relanzar
        if (e.message && (e.message.includes('incorrecto') || e.message.includes('Credenciales') || e.message.includes('no autorizado'))) {
            throw e;
        }
        console.warn('Backend API no disponible directamente en la red local. Evaluando autenticación directa...');
    }

    // Intento 2: Autenticación en modo descargado / standalone sin backend activo
    // Verifica las contraseñas oficiales autorizadas (12345 o cambiada desde el admin)
    const customStoredPwd = localStorage.getItem('pia_pwd_' + cleanEmail);
    const isLocalPasswordValid = (cleanPassword === '12345' || (customStoredPwd && cleanPassword === customStoredPwd));

    if (isLocalPasswordValid) {
        const isDagi = cleanEmail === 'deteccionydenuncia@cnc.gob.gt';
        const offlineUser = {
            id: isDagi ? 'usr_cnc_01' : 'usr_cnc_02',
            uid: isDagi ? 'usr_cnc_01' : 'usr_cnc_02',
            oid: isDagi ? 'usr_cnc_01' : 'usr_cnc_02',
            email: cleanEmail,
            upn: cleanEmail,
            displayName: isDagi ? 'Dirección de Apoyo en la Gestión de Irregularidades - DAGI' : 'Apoyo a la Gestión de Irregularidades (CNC)',
            role: 'admin',
            modules: ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide'],
            operatorIndex: isDagi ? 1 : 2
        };
        const offlineToken = 'pia_sess_offline_' + btoa(JSON.stringify(offlineUser));
        localStorage.setItem('token', offlineToken);
        sessionStorage.setItem('token', offlineToken);
        localStorage.setItem('user', JSON.stringify(offlineUser));
        return { token: offlineToken, user: offlineUser };
    }

    // Intento 3: Firebase Authentication si está disponible y la contraseña no coincidió con 12345
    try {
        const auth = await initFirebaseAuth();
        if (!auth) {
            throw new Error('Contraseña incorrecta. Verifique sus credenciales institucionales (12345).');
        }

        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        const user = userCredential.user;
        if (!user) throw new Error('No se recibió la identidad del usuario desde Firebase Auth.');

        const idToken = await user.getIdToken(true);
        const verified = await verifyToken(idToken);
        localStorage.setItem('token', idToken);
        sessionStorage.setItem('token', idToken);
        if (verified && verified.user) {
            localStorage.setItem('user', JSON.stringify(verified.user));
        }
        return { token: idToken, user: verified.user };
    } catch (fbErr) {
        if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential' || fbErr.code === 'auth/user-not-found') {
            throw new Error('Contraseña o correo institucional incorrecto.');
        }
        if (fbErr.code === 'auth/invalid-api-key') {
            // Protección contra errores crudos de Firebase en entornos descargados
            throw new Error('Contraseña incorrecta. Ingrese con la clave inicial autorizada (12345).');
        }
        throw new Error(fbErr.message || 'Error de autenticación.');
    }
}

// Envío nativo de correo de restablecimiento de contraseña mediante Firebase
export async function sendFirebasePasswordReset(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
        throw new Error('Debe ingresar su correo institucional para recibir el enlace de recuperación.');
    }

    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
        throw new Error(`La cuenta "${cleanEmail}" no pertenece a los operadores autorizados del Portal PIA.`);
    }

    try {
        const auth = await initFirebaseAuth();
        if (!auth) throw new Error('Servicio de restablecimiento no disponible.');
        await sendPasswordResetEmail(auth, cleanEmail);
        return {
            success: true,
            email: cleanEmail,
            message: `Se ha enviado el enlace oficial de restablecimiento a ${cleanEmail}. Por favor verifique su bandeja de entrada institucional.`
        };
    } catch (err) {
        let msg = 'No se pudo enviar el correo de recuperación.';
        if (err.code === 'auth/user-not-found') {
            msg = 'La cuenta indicada no se encuentra dada de alta en el sistema institucional.';
        } else if (err.code === 'auth/too-many-requests') {
            msg = 'Demasiadas solicitudes de recuperación recientes. Espere unos minutos antes de intentar de nuevo.';
        } else if (err.code === 'auth/invalid-api-key') {
            msg = 'Puede actualizar su contraseña directamente desde el panel de administración.';
        } else if (err.message) {
            msg = err.message;
        }
        throw new Error(msg);
    }
}

// Verificar validez del token y UID en el servidor PIA
export async function verifyToken(token) {
    if (!token) {
        throw new Error('Token no proporcionado.');
    }

    // Modo offline / standalone
    if (token.startsWith('pia_sess_offline_')) {
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (stored) {
            try {
                return { user: JSON.parse(stored) };
            } catch (_) {}
        }
    }

    try {
        const res = await fetch(`${API_BASE}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Token inválido o expirado.');
        }

        const data = await res.json();
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        return data;
    } catch (e) {
        // Respaldo en caso de caída temporal de red si el token es local
        if (token.startsWith('pia_sess_')) {
            const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (stored) {
                try {
                    return { user: JSON.parse(stored) };
                } catch (_) {}
            }
        }
        throw e;
    }
}

// Cierre de sesión y limpieza de estado local
export async function logout(reason) {
    try {
        const auth = await initFirebaseAuth();
        if (auth) await signOut(auth);
    } catch (_) {}

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    if (reason) {
        sessionStorage.setItem('logout_reason', reason);
    }
    window.location.reload();
}

// Exponer en el objeto window para interoperabilidad
window.initFirebaseAuth = initFirebaseAuth;
window.loginWithFirebase = loginWithFirebase;
window.sendFirebasePasswordReset = sendFirebasePasswordReset;
window.verifyToken = verifyToken;
window.logout = logout;
window.getFirebaseConfig = getFirebaseConfig;
window.ALLOWED_ADMIN_EMAILS = ALLOWED_ADMIN_EMAILS;