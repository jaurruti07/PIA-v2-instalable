// db/codeMaterializer.js
// Materializa de forma atómica los textos estáticos y la guía multilingüe
// en archivos de código estático del proyecto (/js/*.js y /db/bakedTextOverrides.json)
// para garantizar persistencia física en disco además de los archivos JSON.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function safeResolveTarget(rootDir, relativePath) {
  const resolvedRoot = path.resolve(rootDir);
  const target = path.resolve(resolvedRoot, relativePath);
  if (!target.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Ruta fuera de la raíz del proyecto rechazada: ${relativePath}`);
  }
  return target;
}

function atomicWriteTextFile(targetPath, content) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = path.join(dir, `.tmp_${path.basename(targetPath)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return {
    path: targetPath,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    sha256: hash
  };
}

function safeJsonForScript(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function materializeBakedTextFiles(rootDir, { portalDoc, moduleDocs = {} }) {
  const updatedAt = new Date().toISOString();
  const overridesModules = {
    portal: {
      overrides: (portalDoc && portalDoc.overrides && typeof portalDoc.overrides === 'object') ? portalDoc.overrides : {},
      updatedAt: portalDoc?.updatedAt || null,
      updatedBy: portalDoc?.updatedBy || null
    }
  };

  const clientModulesOverrides = {};
  for (const modKey of ['directorio', 'tableros', 'canales', 'riesgo']) {
    const m = moduleDocs[modKey];
    const cleanOv = (m && m.overrides && typeof m.overrides === 'object') ? m.overrides : {};
    overridesModules[modKey] = {
      overrides: cleanOv,
      updatedAt: m?.updatedAt || null,
      updatedBy: m?.updatedBy || null
    };
    clientModulesOverrides[modKey] = cleanOv;
  }

  const bakedOverridesPayload = {
    schemaVersion: 1,
    updatedAt,
    modules: overridesModules
  };

  const bakedOverridesTarget = safeResolveTarget(rootDir, path.join('db', 'bakedTextOverrides.json'));
  const overridesResult = atomicWriteTextFile(
    bakedOverridesTarget,
    JSON.stringify(bakedOverridesPayload, null, 2) + '\n'
  );

  const clientTextsPayload = {
    schemaVersion: 1,
    updatedAt,
    portal: overridesModules.portal.overrides,
    modules: clientModulesOverrides
  };

  const clientScriptContent = [
    '// js/pia-baked-texts.js',
    '// Generado automáticamente desde el Administrador PIA.',
    '// Persistencia en código de textos estáticos personalizados para Portal Principal y Módulos.',
    '(function (window) {',
    "  'use strict';",
    `  window.PIA_BAKED_TEXTS = ${safeJsonForScript(clientTextsPayload)};`,
    "})(typeof window !== 'undefined' ? window : globalThis);",
    ''
  ].join('\n');

  const clientTextsTarget = safeResolveTarget(rootDir, path.join('js', 'pia-baked-texts.js'));
  const clientTextsResult = atomicWriteTextFile(clientTextsTarget, clientScriptContent);

  return {
    updatedAt,
    files: [
      { relativePath: 'db/bakedTextOverrides.json', ...overridesResult },
      { relativePath: 'js/pia-baked-texts.js', ...clientTextsResult }
    ]
  };
}

export function materializeMultilingualCodeFile(rootDir, multilingualDoc) {
  const updatedAt = multilingualDoc?.updatedAt || new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    updatedAt,
    updatedBy: multilingualDoc?.updatedBy || null,
    portal: multilingualDoc?.portal || {},
    canales: multilingualDoc?.canales || {},
    i18n: multilingualDoc?.i18n || {}
  };

  const scriptContent = [
    '// js/pia-multilingual-data.js',
    '// Generado automáticamente desde el Administrador PIA (Guía Multilingüe).',
    '// Persistencia en código para Inclusión Universal, Guía Maya (Canales) y Diccionario i18n.',
    '(function (window) {',
    "  'use strict';",
    `  window.PIA_BAKED_MULTILINGUAL = ${safeJsonForScript(payload)};`,
    "})(typeof window !== 'undefined' ? window : globalThis);",
    ''
  ].join('\n');

  const target = safeResolveTarget(rootDir, path.join('js', 'pia-multilingual-data.js'));
  const writeInfo = atomicWriteTextFile(target, scriptContent);
  return {
    updatedAt,
    file: {
      relativePath: 'js/pia-multilingual-data.js',
      ...writeInfo
    }
  };
}

export function readBakedTextOverridesFile(rootDir) {
  try {
    const target = safeResolveTarget(rootDir, path.join('db', 'bakedTextOverrides.json'));
    if (!fs.existsSync(target)) return null;
    const raw = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw;
  } catch (_) {
    return null;
  }
}

export function getBakedFilesStatus(rootDir) {
  const paths = [
    'db/bakedTextOverrides.json',
    'js/pia-baked-texts.js',
    'js/pia-multilingual-data.js'
  ];
  return paths.map(rel => {
    const full = safeResolveTarget(rootDir, rel);
    if (!fs.existsSync(full)) {
      return { relativePath: rel, exists: false, sizeBytes: 0, mtimeIso: null, sha256: null };
    }
    const content = fs.readFileSync(full);
    const stat = fs.statSync(full);
    return {
      relativePath: rel,
      exists: true,
      sizeBytes: stat.size,
      mtimeIso: stat.mtime.toISOString(),
      sha256: crypto.createHash('sha256').update(content).digest('hex')
    };
  });
}
