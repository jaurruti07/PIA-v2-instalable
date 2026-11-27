#!/usr/bin/env node
// admin/scripts/sync_cloud_to_code.js
// Sincroniza desde Firestore (published_texts, published_multilingual, published_data)
// hacia los archivos JSON locales y materializa el código estático (/js/*.js y /db/bakedTextOverrides.json).
// Uso: node admin/scripts/sync_cloud_to_code.js  |  npm run sync:cloud

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { normalizePortalTextsDoc } from '../../db/portalTextsCatalog.js';
import { TEXT_MODULES_ORDER, getModuleTextsDefinition, normalizeModuleTextsDoc } from '../../db/moduleTextsCatalog.js';
import { MULTILINGUAL_SECTIONS, normalizeMultilingualDoc, mergeSectionIntoCurrent } from '../../db/multilingualGuideCatalog.js';
import { materializeBakedTextFiles, materializeMultilingualCodeFile } from '../../db/codeMaterializer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.PIA_DATA_DIR ? path.resolve(process.env.PIA_DATA_DIR) : path.join(ROOT_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp_sync_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

function decodeFirestoreValue(val) {
  if (!val || typeof val !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(val, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(val, 'booleanValue')) return Boolean(val.booleanValue);
  if (Object.prototype.hasOwnProperty.call(val, 'integerValue')) return Number(val.integerValue);
  if (Object.prototype.hasOwnProperty.call(val, 'doubleValue')) return Number(val.doubleValue);
  if (Object.prototype.hasOwnProperty.call(val, 'stringValue')) return String(val.stringValue);
  if (Object.prototype.hasOwnProperty.call(val, 'timestampValue')) return String(val.timestampValue);
  if (val.arrayValue && typeof val.arrayValue === 'object') {
    return (Array.isArray(val.arrayValue.values) ? val.arrayValue.values : []).map(decodeFirestoreValue);
  }
  if (val.mapValue && typeof val.mapValue === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

async function fetchFirestoreDoc(projectId, dbId, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(dbId)}/documents/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} consultando ${collection}/${docId}`);
    const raw = await res.json();
    const fields = {};
    for (const [k, v] of Object.entries(raw.fields || {})) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      fields[k] = decodeFirestoreValue(v);
    }
    return {
      fields,
      updatedAt: fields.clientUpdatedAtIso || fields.updatedAt || raw.updateTime || new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const fbCfg = readJson(path.join(ROOT_DIR, 'firebase-applet-config.json'), {});
  const projectId = process.env.FIREBASE_PROJECT_ID || fbCfg.projectId;
  const dbId = process.env.FIRESTORE_DATABASE_ID || fbCfg.firestoreDatabaseId;

  console.log('=== PIA Cloud -> JSON & Código Sync CLI ===');

  if (!projectId || !dbId) {
    console.log('Configuración de Firestore no encontrada; materializando únicamente archivos locales.');
  } else {
    console.log(`Proyecto: ${projectId} | Base Firestore: ${dbId}`);

    // 1. Textos estáticos (published_texts)
    for (const docId of ['portal', ...TEXT_MODULES_ORDER]) {
      const cloud = await fetchFirestoreDoc(projectId, dbId, 'published_texts', docId).catch(() => null);
      if (!cloud || !cloud.fields?.overrides) continue;
      if (docId === 'portal') {
        const norm = normalizePortalTextsDoc({
          overrides: cloud.fields.overrides,
          updatedAt: cloud.updatedAt,
          updatedBy: 'cli-cloud-sync'
        });
        atomicWriteJson(path.join(DATA_DIR, 'portal_texts.json'), {
          overrides: norm.overrides,
          updatedAt: norm.updatedAt,
          updatedBy: norm.updatedBy
        });
        console.log(`✔ Textos [portal]: ${Object.keys(norm.overrides).length} overrides sincronizados`);
      } else {
        const def = getModuleTextsDefinition(docId);
        if (!def) continue;
        const norm = normalizeModuleTextsDoc(docId, {
          overrides: cloud.fields.overrides,
          updatedAt: cloud.updatedAt,
          updatedBy: 'cli-cloud-sync'
        });
        atomicWriteJson(path.join(DATA_DIR, def.fileName), {
          overrides: norm.overrides,
          updatedAt: norm.updatedAt,
          updatedBy: norm.updatedBy
        });
        console.log(`✔ Textos [${docId}]: ${Object.keys(norm.overrides).length} overrides sincronizados`);
      }
    }

    // 2. Guía Multilingüe (published_multilingual)
    const mgFile = path.join(DATA_DIR, 'multilingual_guide.json');
    let mgDoc = normalizeMultilingualDoc(readJson(mgFile, {}));
    let mgChanged = false;
    for (const sec of MULTILINGUAL_SECTIONS) {
      const cloud = await fetchFirestoreDoc(projectId, dbId, 'published_multilingual', sec).catch(() => null);
      if (!cloud || !cloud.fields?.data) continue;
      mgDoc[sec] = mergeSectionIntoCurrent(sec, mgDoc[sec], cloud.fields.data);
      mgDoc.sectionUpdatedAt[sec] = cloud.updatedAt;
      mgDoc.updatedAt = cloud.updatedAt;
      mgDoc.updatedBy = 'cli-cloud-sync';
      mgChanged = true;
      console.log(`✔ Guía Multilingüe [${sec}]: sincronizada desde la nube`);
    }
    if (mgChanged) {
      atomicWriteJson(mgFile, normalizeMultilingualDoc(mgDoc));
    }

    // 3. Datasets JSON (published_data)
    const DATASET_FILE_MAP = {
      canales: path.join(ROOT_DIR, 'canales-por-la-integridad', 'data_directorio.json'),
      directorio: path.join(ROOT_DIR, 'directorio', 'data_acceso.json'),
      tableros: path.join(ROOT_DIR, 'gobierno_en_numeros', 'data_tableros.json'),
      riesgo: path.join(ROOT_DIR, 'riesgo', 'datos.json'),
      portal: path.join(ROOT_DIR, 'data_portal.json'),
      ui_config: path.join(DATA_DIR, 'modules_ui_config.json'),
      canales_settings: path.join(DATA_DIR, 'canales_settings.json'),
      chatbot_knowledge: path.join(ROOT_DIR, 'chatbot_knowledge.json')
    };

    for (const [docId, targetPath] of Object.entries(DATASET_FILE_MAP)) {
      const cloud = await fetchFirestoreDoc(projectId, dbId, 'published_data', docId).catch(() => null);
      if (!cloud || !cloud.fields?.data) continue;
      const wrapped = cloud.fields.data;
      const payload = wrapped.items !== undefined ? wrapped.items : (wrapped.doc !== undefined ? wrapped.doc : wrapped);
      atomicWriteJson(targetPath, payload);
      console.log(`✔ Dataset [${docId}] -> ${path.relative(ROOT_DIR, targetPath)} actualizado`);
    }
  }

  // 4. Materializar siempre los archivos de código estático (/js/*.js y /db/bakedTextOverrides.json)
  const portalTexts = normalizePortalTextsDoc(readJson(path.join(DATA_DIR, 'portal_texts.json'), {}));
  const moduleDocs = {};
  for (const modKey of TEXT_MODULES_ORDER) {
    const def = getModuleTextsDefinition(modKey);
    if (!def) continue;
    moduleDocs[def.key] = normalizeModuleTextsDoc(def.key, readJson(path.join(DATA_DIR, def.fileName), {}));
  }
  const textsMat = materializeBakedTextFiles(ROOT_DIR, { portalDoc: portalTexts, moduleDocs });
  const latestMg = normalizeMultilingualDoc(readJson(path.join(DATA_DIR, 'multilingual_guide.json'), {}));
  const mgMat = materializeMultilingualCodeFile(ROOT_DIR, latestMg);

  console.log(`✔ Materializado db/bakedTextOverrides.json y js/pia-baked-texts.js (${textsMat.files.length} archivos)`);
  console.log(`✔ Materializado ${mgMat.file.relativePath} (${mgMat.file.sizeBytes} bytes)`);
  console.log('=== Sincronización completa ===');
}

run().catch(err => {
  console.error('Error en sync_cloud_to_code:', err.message);
  process.exit(1);
});
