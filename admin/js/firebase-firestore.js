// admin/js/firebase-firestore.js
// Cliente Firestore (Cloud Sync) del Panel Administrativo PIA
// Implementa validación de conexión, manejo estructurado de errores y sincronización Producción <-> Preview.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getFirebaseConfig,
  initFirebaseAuth,
  signInWithGooglePopup,
  ALLOWED_ADMIN_EMAILS
} from "./auth.js";

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

export const TEXT_DOC_IDS = ['portal', 'directorio', 'tableros', 'canales', 'riesgo'];

let firestoreDbInstance = null;
let firebaseAuthRef = null;
let connectionTested = false;
let connectionPromise = null;

function buildAuthInfo() {
  const user = firebaseAuthRef?.currentUser || null;
  return {
    userId: user?.uid ?? null,
    email: user?.email ?? null,
    emailVerified: user?.emailVerified ?? null,
    isAnonymous: user?.isAnonymous ?? null,
    tenantId: user?.tenantId ?? null,
    providerInfo: Array.isArray(user?.providerData)
      ? user.providerData.map(provider => ({
          providerId: provider.providerId ?? null,
          email: provider.email ?? null
        }))
      : []
  };
}

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: buildAuthInfo(),
    operationType,
    path: path ?? null
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(db) {
  if (connectionTested) return;
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    } finally {
      connectionTested = true;
    }
  })();
  return connectionPromise;
}

export async function ensureFirestore() {
  if (firestoreDbInstance) return { db: firestoreDbInstance, auth: firebaseAuthRef };

  const config = await getFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    throw new Error('Configuración de Firebase incompleta.');
  }
  if (!config.firestoreDatabaseId) {
    throw new Error('Falta firestoreDatabaseId en la configuración de Firebase.');
  }

  let app = getApps().length > 0 ? getApp() : null;
  if (!app) {
    app = initializeApp({
      projectId: config.projectId,
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      appId: config.appId,
      storageBucket: config.storageBucket
    });
  }

  firebaseAuthRef = (await initFirebaseAuth()) || getAuth(app);
  firestoreDbInstance = getFirestore(app, config.firestoreDatabaseId);
  await testConnection(firestoreDbInstance);

  return { db: firestoreDbInstance, auth: firebaseAuthRef };
}

export async function getCloudSyncAuthState() {
  try {
    const { auth } = await ensureFirestore();
    await new Promise(resolve => {
      if (!auth || typeof auth.authStateReady === 'function') {
        if (auth && typeof auth.authStateReady === 'function') {
          auth.authStateReady().then(resolve).catch(resolve);
          return;
        }
      }
      const unsub = onAuthStateChanged(auth, () => {
        unsub();
        resolve();
      });
      setTimeout(() => {
        try { unsub(); } catch (_) {}
        resolve();
      }, 600);
    });

    const user = auth?.currentUser || null;
    const email = (user?.email || '').toLowerCase();
    const isAuthorizedOperator = Boolean(
      user &&
      user.emailVerified === true &&
      ALLOWED_ADMIN_EMAILS.includes(email)
    );

    return {
      ready: true,
      signedIn: Boolean(user),
      uid: user?.uid || null,
      email: user?.email || null,
      emailVerified: Boolean(user?.emailVerified),
      isAuthorizedOperator
    };
  } catch (err) {
    return {
      ready: false,
      signedIn: false,
      uid: null,
      email: null,
      emailVerified: false,
      isAuthorizedOperator: false,
      error: err?.message || 'Firebase no disponible'
    };
  }
}

export async function connectGoogleForCloudSync() {
  const result = await signInWithGooglePopup();
  await ensureFirestore();
  return result;
}

export function detectEnvironmentTag() {
  try {
    const host = (window.location?.hostname || '').toLowerCase();
    if (host.startsWith('ais-pre-')) return 'production';
    if (host.startsWith('ais-dev-')) return 'preview';
    if (host === 'localhost' || host === '127.0.0.1') return 'local';
  } catch (_) {}
  return 'preview';
}

export async function fetchPublishedTextsFromCloud(docId) {
  if (!TEXT_DOC_IDS.includes(docId)) {
    throw new Error(`Documento de textos no válido: ${docId}`);
  }
  const { db } = await ensureFirestore();
  const docPath = `published_texts/${docId}`;
  try {
    const snap = await getDocFromServer(doc(db, 'published_texts', docId));
    if (!snap.exists()) {
      return { exists: false, docId, overrides: {}, modifiedCount: 0, clientUpdatedAtIso: null };
    }
    const data = snap.data() || {};
    const rawOverrides = (data.overrides && typeof data.overrides === 'object' && !Array.isArray(data.overrides))
      ? data.overrides
      : {};
    const cleanOverrides = {};
    for (const [k, v] of Object.entries(rawOverrides)) {
      if (typeof k === 'string' && typeof v === 'string') {
        cleanOverrides[k] = v;
      }
    }
    const iso = typeof data.clientUpdatedAtIso === 'string'
      ? data.clientUpdatedAtIso
      : (data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate().toISOString() : null);

    return {
      exists: true,
      docId,
      overrides: cleanOverrides,
      modifiedCount: Object.keys(cleanOverrides).length,
      clientUpdatedAtIso: iso
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function fetchAllPublishedTextsFromCloud() {
  const results = {};
  for (const id of TEXT_DOC_IDS) {
    results[id] = await fetchPublishedTextsFromCloud(id);
  }
  return results;
}

function sanitizeOverridesForFirestore(overrides) {
  const clean = {};
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return clean;
  const entries = Object.entries(overrides).slice(0, 200);
  for (const [k, v] of entries) {
    if (typeof k === 'string' && k.length > 0 && k.length <= 120 && typeof v === 'string') {
      clean[k] = v;
    }
  }
  return clean;
}

export async function pushPublishedTextsToCloud(docId, overrides, clientUpdatedAtIso = null, allModulesBundle = null) {
  if (!TEXT_DOC_IDS.includes(docId)) {
    throw new Error(`Documento de textos no válido: ${docId}`);
  }
  const authState = await getCloudSyncAuthState();
  if (!authState.isAuthorizedOperator) {
    return {
      synced: false,
      reason: 'AUTH_REQUIRED',
      authState
    };
  }

  const { db, auth } = await ensureFirestore();
  const cleanOverrides = sanitizeOverridesForFirestore(overrides);
  const nowIso = (typeof clientUpdatedAtIso === 'string' && clientUpdatedAtIso.length >= 10 && clientUpdatedAtIso.length <= 40)
    ? clientUpdatedAtIso
    : new Date().toISOString();

  // Documento público sin PII (estrictamente validado contra firestore.rules)
  const publishedPayload = {
    docId,
    overrides: cleanOverrides,
    modifiedCount: Object.keys(cleanOverrides).length,
    schemaVersion: 1,
    updatedAt: serverTimestamp(),
    clientUpdatedAtIso: nowIso
  };

  const docPath = `published_texts/${docId}`;
  try {
    await setDoc(doc(db, 'published_texts', docId), publishedPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }

  // Respaldo privado multi-módulo con atribución del operador autorizado (cuando se provee el bundle)
  if (allModulesBundle && typeof allModulesBundle === 'object' && Object.keys(allModulesBundle).length > 0) {
    const user = auth?.currentUser;
    const modulesMap = {};
    for (const id of TEXT_DOC_IDS) {
      const m = allModulesBundle[id];
      if (m && typeof m === 'object') {
        const modOverrides = sanitizeOverridesForFirestore(m.overrides || {});
        modulesMap[id] = {
          overrides: modOverrides,
          modifiedCount: Object.keys(modOverrides).length,
          updatedAt: typeof m.updatedAt === 'string' ? m.updatedAt : nowIso
        };
      }
    }
    if (Object.keys(modulesMap).length > 0 && user?.email && user?.uid) {
      const snapPath = 'admin_text_snapshots/latest_bundle';
      try {
        await setDoc(doc(db, 'admin_text_snapshots', 'latest_bundle'), {
          snapshotId: 'latest_bundle',
          updatedBy: String(user.email).toLowerCase(),
          updatedByUid: String(user.uid),
          updatedAt: serverTimestamp(),
          clientUpdatedAtIso: nowIso,
          sourceEnv: detectEnvironmentTag(),
          modules: modulesMap
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, snapPath);
      }
    }
  }

  return {
    synced: true,
    docId,
    modifiedCount: Object.keys(cleanOverrides).length,
    clientUpdatedAtIso: nowIso
  };
}
