// auth.js - Autenticación Institucional Nativa con Firebase Authentication (Email/Contraseña)
// Proyecto: Portal de Integridad Activa (PIA) - CNC Organismo Ejecutivo

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API_BASE = (typeof getApiBase === 'function') ? getApiBase() : ((typeof window !== 'undefined' && window.getApiBase) ? window.getApiBase() : '/api');
let firebaseAppInstance = null;
let firebaseAuthInstance = null;
let firebaseConfigCache = null;

// Cuentas con acceso restringido exclusivo para la administración del Portal PIA
export const ALLOWED_ADMIN_EMAILS = [
    'deteccionydenuncia@cnc.gob.gt',
    'apoyogi@cnc.gob.gt'
];

export async function getFirebaseConfig() {
    if (firebaseConfigCache) return firebaseConfigCache;
    try {
        const res = await fetch(`${API_BASE}/auth/firebase-config`);
        if (!res.ok) throw new Error('Error al obtener la configuración de Firebase desde el servidor.');
        firebaseConfigCache = await res.json();
        return firebaseConfigCache;
    } catch (e) {
        console.error('Error cargando firebase-config:', e);
        // Fallback a configuración base en caso de fallo de red local
        return {
            configured: true,
            projectId: 'pia-portal-integridad',
            authDomain: 'pia-portal-integridad.firebaseapp.com'
        };
    }
}

export async function initFirebaseAuth() {
    if (firebaseAuthInstance) return firebaseAuthInstance;

    const config = await getFirebaseConfig();
    if (!config || !config.projectId) {
        throw new Error('Configuración de Firebase no disponible.');
    }

    if (!firebaseAppInstance) {
        if (getApps().length > 0) {
            firebaseAppInstance = getApp();
        } else {
            firebaseAppInstance = initializeApp({
                projectId: config.projectId,
                apiKey: config.apiKey,
                authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
                appId: config.appId,
                storageBucket: config.storageBucket
            });
        }
    }

    firebaseAuthInstance = getAuth(firebaseAppInstance);
    try {
        await setPersistence(firebaseAuthInstance, browserLocalPersistence);
    } catch (e) {
        console.warn('No se pudo fijar la persistencia de sesión local de Firebase:', e);
    }

    return firebaseAuthInstance;
}

// Iniciar sesión con Firebase Auth usando Email y Contraseña
export async function loginWithFirebase(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = password || '';

    if (!cleanEmail || !cleanPassword) {
        throw new Error('Debe ingresar su correo institucional y su contraseña.');
    }

    // Regla 1: Restricción exclusiva en cliente antes de contactar al proveedor
    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
        throw new Error(`Acceso denegado: El correo "${cleanEmail}" no figura entre las 2 cuentas oficiales autorizadas para la administración del Portal PIA.`);
    }

    const auth = await initFirebaseAuth();

    let userCredential;
    try {
        userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    } catch (err) {
        console.error('Firebase Auth Error:', err.code, err.message);
        let userMessage = 'Error al iniciar sesión.';
        switch (err.code) {
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
            case 'auth/user-not-found':
                userMessage = 'Credenciales incorrectas. Verifique su correo institucional y contraseña, o utilice la opción de recuperación.';
                break;
            case 'auth/too-many-requests':
                userMessage = 'Acceso bloqueado temporalmente por múltiples intentos fallidos. Por favor intente más tarde.';
                break;
            case 'auth/invalid-email':
                userMessage = 'El formato de correo institucional no es válido.';
                break;
            case 'auth/network-request-failed':
                userMessage = 'Error de conexión con los servidores de autenticación de Google/Firebase.';
                break;
            default:
                userMessage = err.message || 'Error de autenticación en Firebase.';
        }
        throw new Error(userMessage);
    }

    const user = userCredential.user;
    if (!user) {
        throw new Error('No se recibió la identidad del usuario desde Firebase Auth.');
    }

    // Obtener token JWT criptográfico emitido por Firebase para el usuario autenticado
    const idToken = await user.getIdToken(true);
    if (!idToken) {
        throw new Error('No se pudo generar el token de autorización de Firebase.');
    }

    // Regla 2: Validación estricta en el servidor mediante UID inmutable y JWKS de Google
    const verified = await verifyToken(idToken);

    // Guardar token de sesión
    localStorage.setItem('token', idToken);
    sessionStorage.setItem('token', idToken);
    if (verified && verified.user) {
        localStorage.setItem('user', JSON.stringify(verified.user));
    }

    return { token: idToken, user: verified.user };
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

    const auth = await initFirebaseAuth();
    try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return {
            success: true,
            email: cleanEmail,
            message: `Se ha enviado el enlace oficial de restablecimiento a ${cleanEmail}. Por favor verifique su bandeja de entrada institucional.`
        };
    } catch (err) {
        console.error('Password reset error:', err.code, err.message);
        let msg = 'No se pudo enviar el correo de recuperación.';
        if (err.code === 'auth/user-not-found') {
            msg = 'La cuenta indicada no se encuentra dada de alta en el sistema institucional.';
        } else if (err.code === 'auth/too-many-requests') {
            msg = 'Demasiadas solicitudes de recuperación recientes. Espere unos minutos antes de intentar de nuevo.';
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

    const res = await fetch(`${API_BASE}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Token de Firebase inválido, expirado o usuario no autorizado por UID.');
    }

    const data = await res.json();
    if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
}

// Cierre de sesión en Firebase y limpieza de estado local
export async function logout(reason) {
    try {
        const auth = await initFirebaseAuth();
        await signOut(auth);
    } catch (e) {
        console.warn('Error al cerrar sesión en Firebase:', e);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    if (reason) {
        sessionStorage.setItem('logout_reason', reason);
    }
    window.location.reload();
}

// Exponer en el objeto window para interoperabilidad con los scripts del panel
window.initFirebaseAuth = initFirebaseAuth;
window.loginWithFirebase = loginWithFirebase;
window.sendFirebasePasswordReset = sendFirebasePasswordReset;
window.verifyToken = verifyToken;
window.logout = logout;
window.getFirebaseConfig = getFirebaseConfig;
window.ALLOWED_ADMIN_EMAILS = ALLOWED_ADMIN_EMAILS;