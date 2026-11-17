// db/storageConfig.js - Configuración persistente de modalidad JSON / SQL / HÍBRIDO por módulo
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const VALID_STORAGE_MODES = ['json', 'sql', 'hybrid'];
export const VALID_SOURCES = ['json', 'sql'];

export const CONFIGURABLE_MODULES = [
  {
    key: 'canales',
    label: 'Canales por la Integridad',
    jsonFile: 'canales-por-la-integridad/data_directorio.json',
    sqlTables: ['pia_canales_integridad']
  },
  {
    key: 'directorio',
    label: 'Directorio Acceso al Ejecutivo',
    jsonFile: 'directorio/data_acceso.json',
    sqlTables: ['pia_directorio_acceso', 'pia_directorio_enlaces']
  },
  {
    key: 'tableros',
    label: 'Tu Gobierno en Números',
    jsonFile: 'gobierno_en_numeros/data_tableros.json',
    sqlTables: ['pia_tableros_gobierno']
  },
  {
    key: 'riesgo',
    label: 'Riesgo en la Mira',
    jsonFile: 'riesgo/datos.json',
    sqlTables: ['pia_riesgo_ciclos', 'pia_riesgo_instituciones', 'pia_riesgo_frecuentes']
  },
  {
    key: 'vehiculos',
    label: 'Transparencia Vehicular',
    jsonFile: 'vehiculos/vehiculos.json',
    sqlTables: [
      'pia_vehiculos_instituciones',
      'pia_vehiculos_institucion_criterios',
      'pia_vehiculos_institucion_documentos',
      'pia_vehiculos',
      'pia_vehiculos_historial'
    ]
  },
  {
    key: 'portal',
    label: 'Métricas Generales del Portal',
    jsonFile: 'data_portal.json',
    sqlTables: ['pia_portal_metricas']
  }
];

export function normalizeModuleKey(moduleName) {
  const m = String(moduleName || '').trim().toLowerCase();
  if (m === 'canales-por-la-integridad' || m === 'data_directorio.json') return 'canales';
  if (m === 'data_acceso.json') return 'directorio';
  if (m === 'gobierno_en_numeros' || m === 'data_tableros.json') return 'tableros';
  if (m === 'datos.json') return 'riesgo';
  if (m === 'vehiculos_instituciones' || m === 'vehiculos.json') return 'vehiculos';
  if (m === 'data_portal.json') return 'portal';
  return m;
}

export class StorageConfigManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.configFile = path.join(dataDir, 'storage_config.json');
  }

  getDefaultConfig() {
    const envMode = String(process.env.PIA_STORAGE_MODE || 'json').trim().toLowerCase();
    const mode = VALID_STORAGE_MODES.includes(envMode) ? envMode : 'json';

    const envSqlModules = String(process.env.PIA_SQL_MODULES || '')
      .split(',')
      .map(s => normalizeModuleKey(s))
      .filter(Boolean);

    const modules = {};
    for (const mod of CONFIGURABLE_MODULES) {
      if (mode === 'sql') {
        modules[mod.key] = 'sql';
      } else if (mode === 'hybrid') {
        modules[mod.key] = envSqlModules.includes(mod.key) ? 'sql' : 'json';
      } else {
        modules[mod.key] = 'json';
      }
    }

    return {
      mode,
      modules,
      updatedAt: new Date().toISOString(),
      updatedBy: 'sistema'
    };
  }

  getConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        const mode = VALID_STORAGE_MODES.includes(raw?.mode) ? raw.mode : 'json';
        const modules = {};
        for (const mod of CONFIGURABLE_MODULES) {
          const src = raw?.modules?.[mod.key];
          modules[mod.key] = VALID_SOURCES.includes(src) ? src : 'json';
        }
        return {
          mode,
          modules,
          updatedAt: raw?.updatedAt || new Date().toISOString(),
          updatedBy: raw?.updatedBy || 'sistema'
        };
      }
    } catch (err) {
      console.error('[StorageConfig] Error leyendo storage_config.json:', err.message);
    }

    const defaults = this.getDefaultConfig();
    this.saveConfig(defaults);
    return defaults;
  }

  saveConfig(nextConfig, updatedBy = 'sistema') {
    const mode = VALID_STORAGE_MODES.includes(nextConfig?.mode) ? nextConfig.mode : 'json';
    const current = fs.existsSync(this.configFile)
      ? (() => {
          try { return JSON.parse(fs.readFileSync(this.configFile, 'utf8')); } catch (_) { return {}; }
        })()
      : {};

    const modules = {};
    for (const mod of CONFIGURABLE_MODULES) {
      if (mode === 'json') {
        modules[mod.key] = 'json';
      } else if (mode === 'sql') {
        modules[mod.key] = 'sql';
      } else {
        const candidate = nextConfig?.modules?.[mod.key] ?? current?.modules?.[mod.key] ?? 'json';
        modules[mod.key] = VALID_SOURCES.includes(candidate) ? candidate : 'json';
      }
    }

    const payload = {
      mode,
      modules,
      updatedAt: new Date().toISOString(),
      updatedBy
    };

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    const tmp = path.join(this.dataDir, `.tmp_storage_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, this.configFile);
    return payload;
  }

  resolveModuleSource(moduleName) {
    const cfg = this.getConfig();
    if (cfg.mode === 'json') return 'json';
    if (cfg.mode === 'sql') return 'sql';
    const canonical = normalizeModuleKey(moduleName);
    return cfg.modules[canonical] === 'sql' ? 'sql' : 'json';
  }
}
