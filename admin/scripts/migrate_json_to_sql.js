#!/usr/bin/env node
// admin/scripts/migrate_json_to_sql.js
// Script institucional de validación contra estructura SQL e inserción masiva
// de los cinco archivos JSON actuales del Portal de Integridad Activa (PIA) hacia MySQL/MariaDB.
// Genera logs detallados de éxito, omisión, actualización y error por cada registro procesado.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  getSqlEnvConfig,
  isSqlConfigured,
  getSqlPool,
  withTransaction,
  closeSqlPool
} from '../../db/sqlClient.js';
import {
  inspectSchemaStatus,
  initializeDatabaseSchema,
  isModuleSqlReady
} from '../../db/schemaInit.js';
import { computeCanalesCount } from '../../db/sqlRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const DATA_DIR = process.env.PIA_DATA_DIR
  ? path.resolve(process.env.PIA_DATA_DIR)
  : path.join(ROOT_DIR, 'data');
const DEFAULT_LOG_DIR = path.join(DATA_DIR, 'migration_logs');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// ============================================================================
// 1. DEFINICIÓN OFICIAL DE LOS 5 ARCHIVOS JSON Y SUS TABLAS SQL DESTINO
// ============================================================================

export const FIVE_JSON_MODULES = [
  {
    key: 'canales',
    order: 1,
    label: 'Canales por la Integridad',
    jsonRelativePath: 'canales-por-la-integridad/data_directorio.json',
    primaryTable: 'pia_canales_integridad',
    tables: ['pia_canales_integridad']
  },
  {
    key: 'directorio',
    order: 2,
    label: 'Directorio Acceso al Ejecutivo',
    jsonRelativePath: 'directorio/data_acceso.json',
    primaryTable: 'pia_directorio_acceso',
    tables: ['pia_directorio_acceso', 'pia_directorio_enlaces']
  },
  {
    key: 'tableros',
    order: 3,
    label: 'Tu Gobierno en Números',
    jsonRelativePath: 'gobierno_en_numeros/data_tableros.json',
    primaryTable: 'pia_tableros_gobierno',
    tables: ['pia_tableros_gobierno']
  },
  {
    key: 'riesgo',
    order: 4,
    label: 'Riesgo en la Mira',
    jsonRelativePath: 'riesgo/datos.json',
    primaryTable: 'pia_riesgo_instituciones',
    tables: ['pia_riesgo_ciclos', 'pia_riesgo_instituciones', 'pia_riesgo_frecuentes']
  },
  {
    key: 'vehiculos',
    order: 5,
    label: 'Transparencia Vehicular',
    jsonRelativePath: 'vehiculos/vehiculos.json',
    primaryTable: 'pia_vehiculos',
    tables: [
      'pia_vehiculos_instituciones',
      'pia_vehiculos_institucion_criterios',
      'pia_vehiculos_institucion_documentos',
      'pia_vehiculos',
      'pia_vehiculos_historial'
    ]
  }
];

export const PORTAL_OPTIONAL_MODULE = {
  key: 'portal',
  order: 6,
  label: 'Métricas Generales del Portal',
  jsonRelativePath: 'data_portal.json',
  primaryTable: 'pia_portal_metricas',
  tables: ['pia_portal_metricas']
};

// Especificación contractual derivada de sql/01_schema_mysql.sql para validar tipos,
// obligatoriedad (NOT NULL) y longitudes máximas antes de ejecutar SQL.
export const SQL_TABLE_COLUMN_SPECS = {
  pia_canales_integridad: {
    id: { type: 'int', required: true },
    institucion: { type: 'varchar', maxLength: 300, required: true },
    tipo: { type: 'varchar', maxLength: 120 },
    canales: { type: 'int' },
    correo: { type: 'varchar', maxLength: 255 },
    telefono: { type: 'varchar', maxLength: 150 },
    formulario: { type: 'varchar', maxLength: 600 },
    tipocom: { type: 'varchar', maxLength: 200 },
    otro: { type: 'varchar', maxLength: 500 },
    direccion: { type: 'varchar', maxLength: 500 },
    ubicacion: { type: 'varchar', maxLength: 500 },
    horario: { type: 'varchar', maxLength: 255 },
    protocolo_actuacion: { type: 'bool' }
  },
  pia_directorio_acceso: {
    id: { type: 'int', required: true },
    nombre_institucion: { type: 'varchar', maxLength: 300, required: true },
    siglas: { type: 'varchar', maxLength: 80 },
    sector: { type: 'varchar', maxLength: 150 },
    departamento: { type: 'varchar', maxLength: 120 },
    correo: { type: 'varchar', maxLength: 255 },
    telefono: { type: 'varchar', maxLength: 150 },
    direccion: { type: 'varchar', maxLength: 500 },
    horario_atencion: { type: 'varchar', maxLength: 255 },
    solicitud_en_linea: { type: 'bool' },
    informacion_publica_oficio: { type: 'bool' },
    sitio_web: { type: 'varchar', maxLength: 500 },
    latitud: { type: 'decimal', min: -90, max: 90 },
    longitud: { type: 'decimal', min: -180, max: 180 },
    ultima_actualizacion: { type: 'varchar', maxLength: 40 }
  },
  pia_directorio_enlaces: {
    directorio_id: { type: 'int', required: true },
    tipo_enlace: { type: 'enum', values: ['solicitud', 'oficio'], required: true },
    url: { type: 'varchar', maxLength: 700, required: true },
    orden: { type: 'int' }
  },
  pia_tableros_gobierno: {
    id: { type: 'int', required: true },
    nombre_institucion: { type: 'varchar', maxLength: 300, required: true },
    siglas: { type: 'varchar', maxLength: 80 },
    tipo_dependencia: { type: 'varchar', maxLength: 150 },
    sector: { type: 'varchar', maxLength: 150 },
    link_tablero: { type: 'varchar', maxLength: 600 },
    descripcion: { type: 'text' },
    fecha_actualizacion: { type: 'varchar', maxLength: 40 },
    estado: { type: 'varchar', maxLength: 60 }
  },
  pia_riesgo_ciclos: {
    anio: { type: 'varchar', maxLength: 10, required: true },
    estado_recoleccion: { type: 'varchar', maxLength: 60 },
    fecha_actualizacion: { type: 'varchar', maxLength: 40 },
    ribbon_stats_json: { type: 'text' }
  },
  pia_riesgo_instituciones: {
    id: { type: 'int', required: true },
    anio: { type: 'varchar', maxLength: 10, required: true },
    siglas: { type: 'varchar', maxLength: 80 },
    nombre: { type: 'varchar', maxLength: 300, required: true },
    sector: { type: 'varchar', maxLength: 150 },
    estado: { type: 'varchar', maxLength: 60 },
    nivel: { type: 'varchar', maxLength: 80 },
    check_identificacion: { type: 'bool' },
    check_analisis: { type: 'bool' },
    check_presentacion: { type: 'bool' },
    buenas_practicas: { type: 'bool' },
    verificacion_cgc: { type: 'varchar', maxLength: 255 },
    fecha_actualizacion: { type: 'varchar', maxLength: 40 }
  },
  pia_riesgo_frecuentes: {
    icono: { type: 'varchar', maxLength: 80 },
    texto: { type: 'varchar', maxLength: 300, required: true },
    descripcion_breve: { type: 'varchar', maxLength: 500 },
    detalle_completo: { type: 'text' },
    fuente: { type: 'varchar', maxLength: 200 },
    categoria: { type: 'varchar', maxLength: 150 },
    orden: { type: 'int' }
  },
  pia_vehiculos_instituciones: {
    id: { type: 'varchar', maxLength: 191, required: true },
    nombre: { type: 'varchar', maxLength: 300, required: true },
    siglas: { type: 'varchar', maxLength: 80 },
    sector: { type: 'varchar', maxLength: 150 }
  },
  pia_vehiculos_institucion_criterios: {
    institucion_id: { type: 'varchar', maxLength: 191, required: true },
    clave_criterio: { type: 'varchar', maxLength: 100, required: true },
    label: { type: 'varchar', maxLength: 300, required: true },
    cumple: { type: 'bool' },
    doc_url: { type: 'varchar', maxLength: 600 },
    doc_nombre: { type: 'varchar', maxLength: 300 }
  },
  pia_vehiculos_institucion_documentos: {
    institucion_id: { type: 'varchar', maxLength: 191, required: true },
    tipo: { type: 'varchar', maxLength: 150 },
    titulo: { type: 'varchar', maxLength: 300 },
    url: { type: 'varchar', maxLength: 600 },
    orden: { type: 'int' }
  },
  pia_vehiculos: {
    id: { type: 'int', required: true },
    plate: { type: 'varchar', maxLength: 40, required: true },
    plate_type: { type: 'varchar', maxLength: 20 },
    department: { type: 'varchar', maxLength: 300 },
    tipo_inst: { type: 'varchar', maxLength: 120 },
    sector: { type: 'varchar', maxLength: 150 },
    authorized_use: { type: 'varchar', maxLength: 255 },
    brand: { type: 'varchar', maxLength: 120 },
    model: { type: 'varchar', maxLength: 120 },
    year: { type: 'int' },
    color: { type: 'varchar', maxLength: 80 },
    status: { type: 'varchar', maxLength: 80 },
    inactive_reason: { type: 'varchar', maxLength: 255 },
    last_update: { type: 'varchar', maxLength: 60 },
    iscv_moroso: { type: 'bool' },
    multas: { type: 'int' }
  },
  pia_vehiculos_historial: {
    vehiculo_id: { type: 'int', required: true },
    fecha: { type: 'varchar', maxLength: 60, required: true },
    status: { type: 'varchar', maxLength: 80 },
    multas: { type: 'int' },
    iscv_moroso: { type: 'bool' },
    orden: { type: 'int' }
  },
  pia_portal_metricas: {
    id: { type: 'int', required: true },
    oficinas_probidad: { type: 'int' },
    canales_denuncia: { type: 'int' },
    denuncias_penales: { type: 'int' },
    plataformas_activas: { type: 'int' }
  }
};

// ============================================================================
// 2. UTILIDADES DE CONVERSIÓN, VALIDACIÓN Y BITÁCORA POR REGISTRO
// ============================================================================

function toBoolInt(v) {
  return (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true') ? 1 : 0;
}

function toStr(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function toNullableStr(v) {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function toIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function toFloatOrNaN(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function validateRowAgainstSpec(tableName, rowObj) {
  const spec = SQL_TABLE_COLUMN_SPECS[tableName];
  if (!spec) {
    return { valid: false, errors: [`Tabla SQL '${tableName}' sin especificación de esquema.`], warnings: [] };
  }

  const errors = [];
  const warnings = [];

  for (const [col, rule] of Object.entries(spec)) {
    const val = rowObj[col];

    if (rule.required) {
      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
        errors.push(`Columna '${col}' es obligatoria (NOT NULL) en '${tableName}' y llegó vacía.`);
        continue;
      }
    }

    if (val === null || val === undefined) continue;

    if (rule.type === 'int') {
      const n = Number(val);
      if (!Number.isInteger(n)) {
        errors.push(`Columna '${col}' requiere entero INT (valor recibido: ${JSON.stringify(val)}).`);
      }
    } else if (rule.type === 'decimal') {
      const n = Number(val);
      if (!Number.isFinite(n)) {
        errors.push(`Columna '${col}' requiere decimal numérico (valor recibido: ${JSON.stringify(val)}).`);
      } else if ((rule.min !== undefined && n < rule.min) || (rule.max !== undefined && n > rule.max)) {
        errors.push(`Columna '${col}' fuera de rango permitido [${rule.min}, ${rule.max}] (valor: ${n}).`);
      }
    } else if (rule.type === 'varchar') {
      const s = String(val);
      if (rule.maxLength && s.length > rule.maxLength) {
        errors.push(`Columna '${col}' excede longitud máxima VARCHAR(${rule.maxLength}) (${s.length} caracteres).`);
      }
    } else if (rule.type === 'enum') {
      if (!rule.values.includes(String(val))) {
        errors.push(`Columna '${col}' debe ser uno de [${rule.values.join(', ')}] (valor: ${JSON.stringify(val)}).`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function chunkArray(arr, size = 50) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

class RecordLogger {
  constructor({ quiet = false } = {}) {
    this.quiet = quiet;
    this.lines = [];
    this.records = [];
  }

  info(message) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [INFO] ${message}`;
    this.lines.push(line);
    if (!this.quiet) console.log(line);
  }

  warn(message) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [WARN] ${message}`;
    this.lines.push(line);
    if (!this.quiet) console.warn(line);
  }

  logRecord({ module, table, index, recordId, ref = '', status, message, details = null }) {
    const ts = new Date().toISOString();
    const entry = {
      timestamp: ts,
      module,
      table,
      index,
      recordId: recordId !== undefined && recordId !== null ? String(recordId) : 'N/A',
      ref: String(ref || '').slice(0, 120),
      status, // 'INSERTED' | 'UPDATED' | 'SKIPPED' | 'VALIDATED' | 'ERROR'
      message,
      ...(details ? { details } : {})
    };
    this.records.push(entry);

    const tag = status === 'ERROR'
      ? 'ERROR  '
      : (status === 'SKIPPED' ? 'SKIPPED' : (status === 'UPDATED' ? 'UPDATED' : (status === 'VALIDATED' ? 'VALID  ' : 'SUCCESS')));

    const refPart = entry.ref ? ` ref="${entry.ref}"` : '';
    const line = `[${ts}] [${tag}] [${module}] [${table}] #${index} (id=${entry.recordId}${refPart}) -> ${message}`;
    this.lines.push(line);

    if (!this.quiet) {
      if (status === 'ERROR') console.error(line);
      else console.log(line);
    }
    return entry;
  }
}

// ============================================================================
// 3. LECTURA Y VALIDACIÓN DE LOS 5 JSON CONTRA EL ESQUEMA SQL
// ============================================================================

function normalizeAndValidateModuleRecords(modDef, rawJson) {
  const result = {
    module: modDef.key,
    label: modDef.label,
    jsonFile: modDef.jsonRelativePath,
    validStructure: true,
    structuralErrors: [],
    totalSourceRecords: 0,
    validRecords: [],
    invalidRecords: [],
    duplicateKeysDetected: 0,
    // Estructuras extra para módulos compuestos
    riesgoCiclos: [],
    riesgoFrecuentes: [],
    vehiculosInstituciones: []
  };

  if (rawJson === null || rawJson === undefined) {
    result.validStructure = false;
    result.structuralErrors.push(`El archivo '${modDef.jsonRelativePath}' está vacío o no pudo parsearse.`);
    return result;
  }

  if (modDef.key === 'canales') {
    if (!Array.isArray(rawJson)) {
      result.validStructure = false;
      result.structuralErrors.push("Se esperaba un arreglo JSON raíz en 'data_directorio.json'.");
      return result;
    }
    result.totalSourceRecords = rawJson.length;
    const seenIds = new Set();

    for (let idx = 0; idx < rawJson.length; idx++) {
      const item = rawJson[idx];
      if (!item || typeof item !== 'object') {
        result.invalidRecords.push({
          table: 'pia_canales_integridad',
          index: idx + 1,
          recordId: null,
          ref: '',
          errors: ['El elemento no es un objeto JSON válido.']
        });
        continue;
      }

      const id = toIntOrNull(item.id ?? (idx + 1));
      const row = {
        id,
        institucion: toStr(item.institucion).trim(),
        tipo: toStr(item.tipo).trim(),
        canales: toIntOrNull(item.canales ?? computeCanalesCount(item)),
        correo: toStr(item.correo).trim(),
        telefono: toStr(item.telefono).trim(),
        formulario: toStr(item.formulario).trim(),
        tipocom: toStr(item.tipocom).trim(),
        otro: toStr(item.otro).trim(),
        direccion: toStr(item.direccion).trim(),
        ubicacion: toStr(item.ubicacion).trim(),
        horario: toStr(item.horario).trim(),
        protocolo_actuacion: toBoolInt(item['Protocolo de actuación'])
      };

      const check = validateRowAgainstSpec('pia_canales_integridad', row);
      if (seenIds.has(id)) {
        check.valid = false;
        check.errors.push(`ID duplicado (${id}) dentro del mismo archivo JSON.`);
      }
      if (check.valid) {
        seenIds.add(id);
        result.validRecords.push({ table: 'pia_canales_integridad', index: idx + 1, recordId: id, ref: row.institucion, row });
      } else {
        result.invalidRecords.push({ table: 'pia_canales_integridad', index: idx + 1, recordId: id, ref: row.institucion, errors: check.errors });
      }
    }
    return result;
  }

  if (modDef.key === 'directorio') {
    if (!Array.isArray(rawJson)) {
      result.validStructure = false;
      result.structuralErrors.push("Se esperaba un arreglo JSON raíz en 'data_acceso.json'.");
      return result;
    }
    result.totalSourceRecords = rawJson.length;
    const seenIds = new Set();

    for (let idx = 0; idx < rawJson.length; idx++) {
      const item = rawJson[idx];
      if (!item || typeof item !== 'object') {
        result.invalidRecords.push({
          table: 'pia_directorio_acceso',
          index: idx + 1,
          recordId: null,
          ref: '',
          errors: ['El elemento no es un objeto JSON válido.']
        });
        continue;
      }

      const id = toIntOrNull(item.id ?? (idx + 1));
      const row = {
        id,
        nombre_institucion: toStr(item.nombre_institucion).trim(),
        siglas: toStr(item.siglas).trim(),
        sector: toStr(item.sector).trim(),
        departamento: toStr(item.departamento).trim(),
        correo: toStr(item.correo).trim(),
        telefono: toStr(item.telefono).trim(),
        direccion: toStr(item.direccion).trim(),
        horario_atencion: toStr(item.horario_atencion).trim(),
        solicitud_en_linea: toBoolInt(item.solicitud_en_linea),
        informacion_publica_oficio: toBoolInt(item.informacion_publica_oficio),
        sitio_web: toStr(item.sitio_web).trim(),
        latitud: toFloatOrNaN(item.latitud, 0),
        longitud: toFloatOrNaN(item.longitud, 0),
        ultima_actualizacion: toStr(item.ultima_actualizacion).trim()
      };

      const check = validateRowAgainstSpec('pia_directorio_acceso', row);
      if (seenIds.has(id)) {
        check.valid = false;
        check.errors.push(`ID duplicado (${id}) dentro de 'data_acceso.json'.`);
      }

      const enlaces = [];
      if (Array.isArray(item.enlaces_solicitud)) {
        item.enlaces_solicitud.forEach((rawUrl, i) => {
          const url = toStr(rawUrl).trim();
          if (!url) return;
          const eRow = { directorio_id: id, tipo_enlace: 'solicitud', url, orden: i };
          const eCheck = validateRowAgainstSpec('pia_directorio_enlaces', eRow);
          if (!eCheck.valid) {
            check.valid = false;
            check.errors.push(...eCheck.errors.map(e => `enlaces_solicitud[${i}]: ${e}`));
          } else {
            enlaces.push(eRow);
          }
        });
      }
      if (Array.isArray(item.enlaces_oficio)) {
        item.enlaces_oficio.forEach((rawUrl, i) => {
          const url = toStr(rawUrl).trim();
          if (!url) return;
          const eRow = { directorio_id: id, tipo_enlace: 'oficio', url, orden: i };
          const eCheck = validateRowAgainstSpec('pia_directorio_enlaces', eRow);
          if (!eCheck.valid) {
            check.valid = false;
            check.errors.push(...eCheck.errors.map(e => `enlaces_oficio[${i}]: ${e}`));
          } else {
            enlaces.push(eRow);
          }
        });
      }

      if (check.valid) {
        seenIds.add(id);
        result.validRecords.push({
          table: 'pia_directorio_acceso',
          index: idx + 1,
          recordId: id,
          ref: row.siglas ? `${row.siglas} - ${row.nombre_institucion}` : row.nombre_institucion,
          row,
          children: { enlaces }
        });
      } else {
        result.invalidRecords.push({
          table: 'pia_directorio_acceso',
          index: idx + 1,
          recordId: id,
          ref: row.nombre_institucion,
          errors: check.errors
        });
      }
    }
    return result;
  }

  if (modDef.key === 'tableros') {
    if (!Array.isArray(rawJson)) {
      result.validStructure = false;
      result.structuralErrors.push("Se esperaba un arreglo JSON raíz en 'data_tableros.json'.");
      return result;
    }
    result.totalSourceRecords = rawJson.length;
    const seenIds = new Set();

    for (let idx = 0; idx < rawJson.length; idx++) {
      const item = rawJson[idx];
      if (!item || typeof item !== 'object') {
        result.invalidRecords.push({
          table: 'pia_tableros_gobierno',
          index: idx + 1,
          recordId: null,
          ref: '',
          errors: ['El elemento no es un objeto JSON válido.']
        });
        continue;
      }

      const id = toIntOrNull(item.id ?? (idx + 1));
      const row = {
        id,
        nombre_institucion: toStr(item.nombre_institucion).trim(),
        siglas: toStr(item.siglas).trim(),
        tipo_dependencia: toStr(item.tipo_dependencia).trim(),
        sector: toStr(item.sector).trim(),
        link_tablero: toStr(item.link_tablero).trim(),
        descripcion: toStr(item.descripcion),
        fecha_actualizacion: toStr(item.fecha_actualizacion).trim(),
        estado: toStr(item.estado, 'Disponible').trim() || 'Disponible'
      };

      const check = validateRowAgainstSpec('pia_tableros_gobierno', row);
      if (seenIds.has(id)) {
        check.valid = false;
        check.errors.push(`ID duplicado (${id}) dentro de 'data_tableros.json'.`);
      }

      if (check.valid) {
        seenIds.add(id);
        result.validRecords.push({
          table: 'pia_tableros_gobierno',
          index: idx + 1,
          recordId: id,
          ref: row.siglas ? `${row.siglas} - ${row.nombre_institucion}` : row.nombre_institucion,
          row
        });
      } else {
        result.invalidRecords.push({
          table: 'pia_tableros_gobierno',
          index: idx + 1,
          recordId: id,
          ref: row.nombre_institucion,
          errors: check.errors
        });
      }
    }
    return result;
  }

  if (modDef.key === 'riesgo') {
    if (typeof rawJson !== 'object' || Array.isArray(rawJson) || !rawJson.years || typeof rawJson.years !== 'object') {
      result.validStructure = false;
      result.structuralErrors.push("El archivo 'riesgo/datos.json' debe contener un objeto 'years'.");
      return result;
    }

    let seqIdx = 0;
    for (const [anioKey, yData] of Object.entries(rawJson.years)) {
      const anio = toStr(anioKey).trim();
      const cicloRow = {
        anio,
        estado_recoleccion: toStr(yData?.estadoRecoleccion, 'activo').trim(),
        fecha_actualizacion: toStr(yData?.fechaActualizacion).trim(),
        ribbon_stats_json: JSON.stringify(Array.isArray(yData?.ribbonStats) ? yData.ribbonStats : [])
      };
      seqIdx++;
      const cCheck = validateRowAgainstSpec('pia_riesgo_ciclos', cicloRow);
      if (cCheck.valid) {
        result.riesgoCiclos.push({ table: 'pia_riesgo_ciclos', index: seqIdx, recordId: anio, ref: `Ciclo ${anio}`, row: cicloRow });
      } else {
        result.invalidRecords.push({ table: 'pia_riesgo_ciclos', index: seqIdx, recordId: anio, ref: `Ciclo ${anio}`, errors: cCheck.errors });
      }

      const insts = Array.isArray(yData?.instituciones) ? yData.instituciones : [];
      const seenAnioIds = new Set();
      for (let i = 0; i < insts.length; i++) {
        seqIdx++;
        const inst = insts[i];
        if (!inst || typeof inst !== 'object') {
          result.invalidRecords.push({ table: 'pia_riesgo_instituciones', index: seqIdx, recordId: null, ref: `Ciclo ${anio}`, errors: ['Registro de institución inválido.'] });
          continue;
        }

        const id = toIntOrNull(inst.id ?? (i + 1));
        const checks = inst.checks || {};
        const row = {
          id,
          anio,
          siglas: toStr(inst.siglas).trim(),
          nombre: toStr(inst.nombre).trim(),
          sector: toStr(inst.sector).trim(),
          estado: toStr(inst.estado, 'en_proceso').trim(),
          nivel: toStr(inst.nivel, 'Inicial').trim(),
          check_identificacion: toBoolInt(checks.identificacion),
          check_analisis: toBoolInt(checks.analisis),
          check_presentacion: toBoolInt(checks.presentacion),
          buenas_practicas: toBoolInt(inst.buenasPracticas),
          verificacion_cgc: toStr(inst.verificacionCGC).trim(),
          fecha_actualizacion: toStr(inst.fechaActualizacion).trim()
        };

        const check = validateRowAgainstSpec('pia_riesgo_instituciones', row);
        if (seenAnioIds.has(id)) {
          check.valid = false;
          check.errors.push(`ID duplicado (${id}) dentro del ciclo '${anio}' (clave única uk_riesgo_anio_id).`);
        }

        if (check.valid) {
          seenAnioIds.add(id);
          result.validRecords.push({
            table: 'pia_riesgo_instituciones',
            index: seqIdx,
            recordId: `${anio}:${id}`,
            ref: `${row.siglas || row.nombre} (${anio})`,
            row
          });
        } else {
          result.invalidRecords.push({
            table: 'pia_riesgo_instituciones',
            index: seqIdx,
            recordId: `${anio}:${id}`,
            ref: row.nombre,
            errors: check.errors
          });
        }
      }
    }

    const frecuentes = Array.isArray(rawJson.riesgosFrecuentes) ? rawJson.riesgosFrecuentes : [];
    for (let i = 0; i < frecuentes.length; i++) {
      seqIdx++;
      const f = frecuentes[i];
      if (!f || typeof f !== 'object') {
        result.invalidRecords.push({ table: 'pia_riesgo_frecuentes', index: seqIdx, recordId: i + 1, ref: '', errors: ['Riesgo frecuente inválido.'] });
        continue;
      }
      const row = {
        icono: toStr(f.icono).trim(),
        texto: toStr(f.texto).trim(),
        descripcion_breve: toStr(f.descripcionBreve).trim(),
        detalle_completo: toStr(f.detalleCompleto),
        fuente: toStr(f.fuente).trim(),
        categoria: toStr(f.categoria).trim(),
        orden: i
      };
      const check = validateRowAgainstSpec('pia_riesgo_frecuentes', row);
      if (check.valid) {
        result.riesgoFrecuentes.push({
          table: 'pia_riesgo_frecuentes',
          index: seqIdx,
          recordId: `frec-${i + 1}`,
          ref: row.texto,
          row
        });
      } else {
        result.invalidRecords.push({
          table: 'pia_riesgo_frecuentes',
          index: seqIdx,
          recordId: `frec-${i + 1}`,
          ref: row.texto,
          errors: check.errors
        });
      }
    }

    result.totalSourceRecords =
      result.riesgoCiclos.length +
      result.validRecords.length +
      result.riesgoFrecuentes.length +
      result.invalidRecords.length;
    return result;
  }

  if (modDef.key === 'vehiculos') {
    if (typeof rawJson !== 'object' || Array.isArray(rawJson) || !Array.isArray(rawJson.vehicles)) {
      result.validStructure = false;
      result.structuralErrors.push("El archivo 'vehiculos/vehiculos.json' debe contener un arreglo 'vehicles'.");
      return result;
    }

    const catInsts = Array.isArray(rawJson.catalogInstituciones) ? rawJson.catalogInstituciones : [];
    const vehicles = rawJson.vehicles;
    let seqIdx = 0;
    const seenInstIds = new Set();

    for (let i = 0; i < catInsts.length; i++) {
      seqIdx++;
      const inst = catInsts[i];
      if (!inst || typeof inst !== 'object') {
        result.invalidRecords.push({ table: 'pia_vehiculos_instituciones', index: seqIdx, recordId: null, ref: '', errors: ['Objeto de institución inválido.'] });
        continue;
      }

      const instId = toStr(inst.id || inst.nombre).trim();
      const row = {
        id: instId,
        nombre: toStr(inst.nombre, instId).trim(),
        siglas: toStr(inst.siglas).trim(),
        sector: toStr(inst.sector).trim()
      };

      const check = validateRowAgainstSpec('pia_vehiculos_instituciones', row);
      if (seenInstIds.has(instId)) {
        check.valid = false;
        check.errors.push(`ID de institución duplicado (${instId}).`);
      }

      const criterios = [];
      if (inst.criterios && typeof inst.criterios === 'object') {
        for (const [clave, val] of Object.entries(inst.criterios)) {
          if (!val || typeof val !== 'object') continue;
          const cRow = {
            institucion_id: instId,
            clave_criterio: toStr(clave).trim(),
            label: toStr(val.label, clave).trim(),
            cumple: toBoolInt(val.cumple),
            doc_url: toNullableStr(val.docUrl),
            doc_nombre: toStr(val.docNombre).trim()
          };
          const cCheck = validateRowAgainstSpec('pia_vehiculos_institucion_criterios', cRow);
          if (!cCheck.valid) {
            check.valid = false;
            check.errors.push(...cCheck.errors.map(e => `criterios.${clave}: ${e}`));
          } else {
            criterios.push(cRow);
          }
        }
      }

      const documentos = [];
      if (Array.isArray(inst.documentosPublicos)) {
        inst.documentosPublicos.forEach((d, dIdx) => {
          if (!d || typeof d !== 'object') return;
          const dRow = {
            institucion_id: instId,
            tipo: toStr(d.tipo).trim(),
            titulo: toStr(d.titulo).trim(),
            url: toStr(d.url).trim(),
            orden: dIdx
          };
          const dCheck = validateRowAgainstSpec('pia_vehiculos_institucion_documentos', dRow);
          if (!dCheck.valid) {
            check.valid = false;
            check.errors.push(...dCheck.errors.map(e => `documentosPublicos[${dIdx}]: ${e}`));
          } else {
            documentos.push(dRow);
          }
        });
      }

      if (check.valid) {
        seenInstIds.add(instId);
        result.vehiculosInstituciones.push({
          table: 'pia_vehiculos_instituciones',
          index: seqIdx,
          recordId: instId,
          ref: row.siglas ? `${row.siglas} - ${row.nombre}` : row.nombre,
          row,
          children: { criterios, documentos }
        });
      } else {
        result.invalidRecords.push({
          table: 'pia_vehiculos_instituciones',
          index: seqIdx,
          recordId: instId,
          ref: row.nombre,
          errors: check.errors
        });
      }
    }

    const seenVehicleIds = new Set();
    const seenPlates = new Map();
    for (let i = 0; i < vehicles.length; i++) {
      seqIdx++;
      const v = vehicles[i];
      if (!v || typeof v !== 'object') {
        result.invalidRecords.push({ table: 'pia_vehiculos', index: seqIdx, recordId: null, ref: '', errors: ['Objeto de vehículo inválido.'] });
        continue;
      }

      const id = toIntOrNull(v.id ?? (i + 1));
      const plate = toStr(v.plate).trim();
      const row = {
        id,
        plate,
        plate_type: toStr(v.plateType).trim(),
        department: toStr(v.department).trim(),
        tipo_inst: toStr(v.tipoInst).trim(),
        sector: toStr(v.sector).trim(),
        authorized_use: toStr(v.authorizedUse).trim(),
        brand: toStr(v.brand).trim(),
        model: toStr(v.model).trim(),
        year: toIntOrNull(v.year),
        color: toStr(v.color).trim(),
        status: toStr(v.status, 'Activo').trim() || 'Activo',
        inactive_reason: toNullableStr(v.inactiveReason),
        last_update: toStr(v.lastUpdate).trim(),
        iscv_moroso: toBoolInt(v.iscvMoroso),
        multas: toIntOrNull(v.multas ?? 0)
      };

      const check = validateRowAgainstSpec('pia_vehiculos', row);
      if (seenVehicleIds.has(id)) {
        check.valid = false;
        check.errors.push(`ID de vehículo duplicado (${id}) dentro de 'vehiculos.json'.`);
      }

      const history = [];
      if (Array.isArray(v.history)) {
        v.history.forEach((h, hIdx) => {
          if (!h || typeof h !== 'object') return;
          const hRow = {
            vehiculo_id: id,
            fecha: toStr(h.date || row.last_update).trim(),
            status: toStr(h.status, 'Activo').trim(),
            multas: toIntOrNull(h.multas ?? 0),
            iscv_moroso: toBoolInt(h.iscvMoroso),
            orden: hIdx
          };
          const hCheck = validateRowAgainstSpec('pia_vehiculos_historial', hRow);
          if (!hCheck.valid) {
            check.valid = false;
            check.errors.push(...hCheck.errors.map(e => `history[${hIdx}]: ${e}`));
          } else {
            history.push(hRow);
          }
        });
      }

      if (check.valid) {
        seenVehicleIds.add(id);
        const firstPlateOwner = seenPlates.get(plate);
        if (firstPlateOwner !== undefined) {
          result.duplicateKeysDetected++;
        } else {
          seenPlates.set(plate, id);
        }
        result.validRecords.push({
          table: 'pia_vehiculos',
          index: seqIdx,
          recordId: id,
          ref: `${plate} · ${row.brand} ${row.model}`.trim(),
          row,
          duplicatePlateInJsonOf: firstPlateOwner ?? null,
          children: { history }
        });
      } else {
        result.invalidRecords.push({
          table: 'pia_vehiculos',
          index: seqIdx,
          recordId: id,
          ref: plate || row.department,
          errors: check.errors
        });
      }
    }

    result.totalSourceRecords = catInsts.length + vehicles.length;
    return result;
  }

  if (modDef.key === 'portal') {
    if (typeof rawJson !== 'object' || Array.isArray(rawJson)) {
      result.validStructure = false;
      result.structuralErrors.push("Se esperaba un objeto JSON en 'data_portal.json'.");
      return result;
    }
    result.totalSourceRecords = 1;
    const row = {
      id: 1,
      oficinas_probidad: toIntOrNull(rawJson.oficinasProbidad ?? 0),
      canales_denuncia: toIntOrNull(rawJson.canalesDenuncia ?? 0),
      denuncias_penales: toIntOrNull(rawJson.denunciasPenales ?? 0),
      plataformas_activas: toIntOrNull(rawJson.plataformasActivas ?? 0)
    };
    const check = validateRowAgainstSpec('pia_portal_metricas', row);
    if (check.valid) {
      result.validRecords.push({
        table: 'pia_portal_metricas',
        index: 1,
        recordId: 1,
        ref: 'Métricas Globales PIA',
        row
      });
    } else {
      result.invalidRecords.push({
        table: 'pia_portal_metricas',
        index: 1,
        recordId: 1,
        ref: 'Métricas Globales PIA',
        errors: check.errors
      });
    }
    return result;
  }

  result.validStructure = false;
  result.structuralErrors.push(`Módulo '${modDef.key}' no reconocido.`);
  return result;
}

export function validateJsonFilesAgainstSqlSpec({
  rootDir = ROOT_DIR,
  moduleKeys = null,
  includePortal = false
} = {}) {
  const catalog = includePortal ? [...FIVE_JSON_MODULES, PORTAL_OPTIONAL_MODULE] : [...FIVE_JSON_MODULES];
  const selected = Array.isArray(moduleKeys) && moduleKeys.length > 0
    ? catalog.filter(m => moduleKeys.includes(m.key))
    : catalog;

  const validations = [];
  for (const modDef of selected) {
    const absPath = path.join(rootDir, modDef.jsonRelativePath);
    if (!fs.existsSync(absPath)) {
      validations.push({
        module: modDef.key,
        label: modDef.label,
        jsonFile: modDef.jsonRelativePath,
        validStructure: false,
        structuralErrors: [`No existe el archivo fuente: ${modDef.jsonRelativePath}`],
        totalSourceRecords: 0,
        validRecords: [],
        invalidRecords: [],
        duplicateKeysDetected: 0,
        riesgoCiclos: [],
        riesgoFrecuentes: [],
        vehiculosInstituciones: []
      });
      continue;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    } catch (parseErr) {
      validations.push({
        module: modDef.key,
        label: modDef.label,
        jsonFile: modDef.jsonRelativePath,
        validStructure: false,
        structuralErrors: [`JSON malformado en '${modDef.jsonRelativePath}': ${parseErr.message}`],
        totalSourceRecords: 0,
        validRecords: [],
        invalidRecords: [],
        duplicateKeysDetected: 0,
        riesgoCiclos: [],
        riesgoFrecuentes: [],
        vehiculosInstituciones: []
      });
      continue;
    }

    validations.push(normalizeAndValidateModuleRecords(modDef, parsed));
  }
  return validations;
}

// Verificación viva contra INFORMATION_SCHEMA.COLUMNS de MySQL/MariaDB cuando hay conexión activa
async function verifyLiveDatabaseColumns(pool, databaseName, tableNames) {
  const missingColumns = [];
  for (const tbl of tableNames) {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [databaseName, tbl]
    );
    const colSet = new Set((cols || []).map(c => c.COLUMN_NAME));
    const expectedCols = Object.keys(SQL_TABLE_COLUMN_SPECS[tbl] || {});
    for (const expected of expectedCols) {
      if (!colSet.has(expected)) {
        missingColumns.push(`${tbl}.${expected}`);
      }
    }
  }
  return {
    ok: missingColumns.length === 0,
    missingColumns
  };
}

// ============================================================================
// 4. HELPERS DE INSERCIÓN MASIVA PARAMETRIZADA CON AISLAMIENTO POR SAVEPOINT
// ============================================================================

async function executeMultiRowInsertWithFallback({
  conn,
  table,
  columns,
  items,
  mapParams,
  moduleKey,
  logger,
  report
}) {
  if (!items || items.length === 0) return [];
  const insertedItems = [];
  const colList = columns.map(c => `\`${c}\``).join(', ');
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;

  const chunks = chunkArray(items, 50);
  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const spName = `sp_chunk_${moduleKey}_${cIdx}`;
    const sql = `INSERT INTO \`${table}\` (${colList}) VALUES ${chunk.map(() => rowPlaceholder).join(', ')}`;
    const flatParams = [];
    for (const item of chunk) {
      flatParams.push(...mapParams(item));
    }

    await conn.query(`SAVEPOINT \`${spName}\``);
    try {
      await conn.execute(sql, flatParams);
      await conn.query(`RELEASE SAVEPOINT \`${spName}\``);
      for (const item of chunk) {
        report.inserted++;
        insertedItems.push(item);
        logger.logRecord({
          module: moduleKey,
          table,
          index: item.index,
          recordId: item.recordId,
          ref: item.ref,
          status: 'INSERTED',
          message: `Registro insertado en '${table}' (lote masivo #${cIdx + 1}, ${chunk.length} filas).`
        });
      }
    } catch (chunkErr) {
      // Revertir únicamente este lote fallido y procesar fila por fila con SAVEPOINT
      // para identificar y registrar el error exacto por registro sin perder los registros válidos.
      await conn.query(`ROLLBACK TO SAVEPOINT \`${spName}\``);
      await conn.query(`RELEASE SAVEPOINT \`${spName}\``);
      logger.warn(`Lote #${cIdx + 1} en '${table}' requirió aislamiento individual por registro: ${chunkErr.message}`);

      const singleSql = `INSERT INTO \`${table}\` (${colList}) VALUES ${rowPlaceholder}`;
      for (const item of chunk) {
        const recSp = `sp_rec_${moduleKey}_${item.index}`;
        await conn.query(`SAVEPOINT \`${recSp}\``);
        try {
          await conn.execute(singleSql, mapParams(item));
          await conn.query(`RELEASE SAVEPOINT \`${recSp}\``);
          report.inserted++;
          insertedItems.push(item);
          logger.logRecord({
            module: moduleKey,
            table,
            index: item.index,
            recordId: item.recordId,
            ref: item.ref,
            status: 'INSERTED',
            message: `Registro insertado individualmente en '${table}' tras aislamiento de lote.`
          });
        } catch (recErr) {
          await conn.query(`ROLLBACK TO SAVEPOINT \`${recSp}\``);
          await conn.query(`RELEASE SAVEPOINT \`${recSp}\``);
          report.errors.push({
            table,
            index: item.index,
            recordId: item.recordId,
            ref: item.ref,
            code: recErr.code || 'SQL_ERROR',
            message: recErr.sqlMessage || recErr.message
          });
          logger.logRecord({
            module: moduleKey,
            table,
            index: item.index,
            recordId: item.recordId,
            ref: item.ref,
            status: 'ERROR',
            message: `Error SQL (${recErr.code || 'SQL_ERROR'}): ${recErr.sqlMessage || recErr.message}`
          });
        }
      }
    }
  }
  return insertedItems;
}

async function executeChildBulkInsert(conn, table, columns, childRows) {
  if (!childRows || childRows.length === 0) return 0;
  const colList = columns.map(c => `\`${c}\``).join(', ');
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
  let totalInserted = 0;

  for (const chunk of chunkArray(childRows, 100)) {
    const sql = `INSERT INTO \`${table}\` (${colList}) VALUES ${chunk.map(() => rowPlaceholder).join(', ')}`;
    const flatParams = [];
    for (const r of chunk) {
      for (const col of columns) {
        flatParams.push(r[col]);
      }
    }
    await conn.execute(sql, flatParams);
    totalInserted += chunk.length;
  }
  return totalInserted;
}

function createScriptBackup(selectedModules, rootDir = ROOT_DIR) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(3).toString('hex');
  const folderName = `cli_migration_json_to_sql_${stamp}_${rand}`;
  const folderPath = path.join(BACKUPS_DIR, folderName);
  fs.mkdirSync(folderPath, { recursive: true });

  for (const mod of selectedModules) {
    const src = path.join(rootDir, mod.jsonRelativePath);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(folderPath, `${mod.key}_${path.basename(src)}.bak`));
    }
  }
  return folderName;
}

// ============================================================================
// 5. MOTOR PRINCIPAL DE MIGRACIÓN MASIVA JSON -> SQL
// ============================================================================

export async function runBulkJsonToSqlMigration({
  dryRun = false,
  strict = false,
  initSchema = false,
  onConflict = 'skip',
  confirmOverwrite = false,
  modules = null,
  includePortal = false,
  rootDir = ROOT_DIR,
  logDir = DEFAULT_LOG_DIR,
  quiet = false,
  executedBy = 'cli-admin'
} = {}) {
  const conflictMode = onConflict === 'overwrite' ? 'overwrite' : 'skip';
  if (conflictMode === 'overwrite' && !confirmOverwrite && !dryRun) {
    const err = new Error('El modo --on-conflict=overwrite requiere confirmación explícita mediante --confirm-overwrite.');
    err.exitCode = 1;
    throw err;
  }

  const logger = new RecordLogger({ quiet });
  const startedAt = new Date().toISOString();

  logger.info('========================================================================');
  logger.info(' PIA - MIGRACIÓN MASIVA DE LOS ARCHIVOS JSON ACTUALES A BASE DE DATOS SQL');
  logger.info(` Modo ejecución : ${dryRun ? 'SIMULACIÓN Y VALIDACIÓN (--dry-run)' : 'INSERCIÓN MASIVA EN MYSQL/MARIADB'}`);
  logger.info(` Conflicto PK/UK: ${conflictMode.toUpperCase()}`);
  logger.info(` Directorio raíz: ${rootDir}`);
  logger.info('========================================================================');

  // 1. Validación completa de todos los archivos JSON contra la estructura SQL
  const validations = validateJsonFilesAgainstSqlSpec({
    rootDir,
    moduleKeys: modules,
    includePortal
  });

  const structuralFailures = validations.filter(v => !v.validStructure);
  const totalInvalidRecords = validations.reduce((acc, v) => acc + v.invalidRecords.length, 0);

  for (const v of validations) {
    logger.info(`[VALIDACIÓN] ${v.label} (${v.jsonFile}) -> origen=${v.totalSourceRecords}, válidos=${v.validRecords.length + v.riesgoCiclos.length + v.riesgoFrecuentes.length + v.vehiculosInstituciones.length}, errores=${v.invalidRecords.length}`);
    if (!v.validStructure) {
      for (const sErr of v.structuralErrors) {
        logger.logRecord({
          module: v.module,
          table: '-',
          index: 0,
          recordId: 'ARCHIVO',
          ref: v.jsonFile,
          status: 'ERROR',
          message: `Error estructural en archivo JSON: ${sErr}`
        });
      }
    }
    for (const inv of v.invalidRecords) {
      logger.logRecord({
        module: v.module,
        table: inv.table,
        index: inv.index,
        recordId: inv.recordId,
        ref: inv.ref,
        status: 'ERROR',
        message: `Error de validación contra estructura SQL: ${inv.errors.join(' | ')}`
      });
    }
  }

  if (strict && (structuralFailures.length > 0 || totalInvalidRecords > 0)) {
    throw new Error(`Modo estricto activado: se detectaron ${structuralFailures.length} archivos inválidos y ${totalInvalidRecords} registros con errores de validación.`);
  }

  // 2. Verificación de conexión SQL (y esquema vivo)
  let schemaStatus = null;
  let liveColumnCheck = { ok: false, missingColumns: [], checked: false };

  if (!dryRun || isSqlConfigured()) {
    if (initSchema && !dryRun && isSqlConfigured()) {
      logger.info('Inicializando estructura de tablas SQL desde sql/01_schema_mysql.sql...');
      await initializeDatabaseSchema();
    }
    schemaStatus = await inspectSchemaStatus();
    if (!dryRun) {
      if (!schemaStatus.connection?.connected) {
        throw new Error(schemaStatus.connection?.error || 'No se pudo establecer conexión con el servidor MySQL/MariaDB. Verifique las variables MYSQL_* en .env.');
      }
      if (!schemaStatus.connection?.databaseExists) {
        throw new Error(`La base de datos '${schemaStatus.connection?.database}' no existe en el servidor SQL. Ejecute primero --init-schema o sql/01_schema_mysql.sql.`);
      }
      const catalog = includePortal ? [...FIVE_JSON_MODULES, PORTAL_OPTIONAL_MODULE] : [...FIVE_JSON_MODULES];
      const targetMods = validations.map(v => catalog.find(c => c.key === v.module)).filter(Boolean);
      const missingModTables = targetMods.filter(m => !isModuleSqlReady(schemaStatus, m.key));
      if (missingModTables.length > 0) {
        throw new Error(`Faltan tablas SQL inicializadas para los módulos: ${missingModTables.map(m => m.key).join(', ')}. Ejecute --init-schema o sql/01_schema_mysql.sql.`);
      }

      const pool = getSqlPool();
      const allTables = targetMods.flatMap(m => m.tables);
      liveColumnCheck = {
        checked: true,
        ...(await verifyLiveDatabaseColumns(pool, getSqlEnvConfig().database, allTables))
      };
      if (!liveColumnCheck.ok) {
        throw new Error(`La estructura real de columnas SQL difiere del esquema esperado. Faltan columnas: ${liveColumnCheck.missingColumns.join(', ')}`);
      }
      logger.info(`Conexión SQL verificada (${schemaStatus.connection.engine} ${schemaStatus.connection.serverVersion}) y columnas de esquema validadas en '${schemaStatus.connection.database}'.`);
    }
  }

  const catalog = includePortal ? [...FIVE_JSON_MODULES, PORTAL_OPTIONAL_MODULE] : [...FIVE_JSON_MODULES];
  const activeModulesMeta = validations.map(v => catalog.find(c => c.key === v.module)).filter(Boolean);
  const backupFolder = !dryRun ? createScriptBackup(activeModulesMeta, rootDir) : null;

  const moduleReports = [];

  // 3. Si es --dry-run, registrar cada registro validado en el log y emitir reporte sin tocar SQL
  if (dryRun) {
    for (const v of validations) {
      const report = {
        module: v.module,
        label: v.label,
        jsonFile: v.jsonFile,
        sourceCount: v.totalSourceRecords,
        validated: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errorsCount: v.invalidRecords.length + v.structuralErrors.length
      };

      const logValidatedList = (list) => {
        for (const item of list) {
          if (item.duplicatePlateInJsonOf !== undefined && item.duplicatePlateInJsonOf !== null) {
            const actionMsg = conflictMode === 'overwrite'
              ? `Validado (placa '${item.row.plate}' ya vista en registro #${item.duplicatePlateInJsonOf}: se actualizaría en SQL).`
              : `Validado con conflicto de clave única uk_veh_plate (placa '${item.row.plate}' duplicada del ID ${item.duplicatePlateInJsonOf}: se omitiría en modo skip).`;
            logger.logRecord({
              module: v.module,
              table: item.table,
              index: item.index,
              recordId: item.recordId,
              ref: item.ref,
              status: conflictMode === 'overwrite' ? 'VALIDATED' : 'SKIPPED',
              message: actionMsg
            });
            if (conflictMode === 'skip') report.skipped++;
            else report.validated++;
          } else {
            report.validated++;
            logger.logRecord({
              module: v.module,
              table: item.table,
              index: item.index,
              recordId: item.recordId,
              ref: item.ref,
              status: 'VALIDATED',
              message: `Estructura y tipos SQL válidos para '${item.table}'.`
            });
          }
        }
      };

      logValidatedList(v.riesgoCiclos);
      logValidatedList(v.vehiculosInstituciones);
      logValidatedList(v.validRecords);
      logValidatedList(v.riesgoFrecuentes);

      moduleReports.push(report);
    }
  } else {
    // 4. Ejecución real contra MySQL/MariaDB con inserción masiva por lotes y transacciones por módulo
    for (const v of validations) {
      const report = {
        module: v.module,
        label: v.label,
        jsonFile: v.jsonFile,
        sourceCount: v.totalSourceRecords,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: v.invalidRecords.map(e => ({
          table: e.table,
          index: e.index,
          recordId: e.recordId,
          ref: e.ref,
          code: 'VALIDATION_ERROR',
          message: e.errors.join(' | ')
        })),
        errorsCount: 0
      };

      if (!v.validStructure) {
        report.errors.push(...v.structuralErrors.map(msg => ({
          table: '-',
          index: 0,
          recordId: 'ARCHIVO',
          ref: v.jsonFile,
          code: 'STRUCTURE_ERROR',
          message: msg
        })));
        report.errorsCount = report.errors.length;
        moduleReports.push(report);
        continue;
      }

      logger.info(`--- Iniciando inserción masiva del módulo '${v.label}' (${v.jsonFile}) ---`);

      await withTransaction(async (conn) => {
        if (v.module === 'canales') {
          const [existRows] = await conn.execute('SELECT id FROM pia_canales_integridad');
          const existSet = new Set(existRows.map(r => Number(r.id)));
          const toInsert = [];

          for (const item of v.validRecords) {
            if (existSet.has(item.row.id)) {
              if (conflictMode === 'skip') {
                report.skipped++;
                logger.logRecord({
                  module: 'canales',
                  table: 'pia_canales_integridad',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'SKIPPED',
                  message: `Registro existente (id=${item.recordId}); omitido por modo skip.`
                });
                continue;
              }
              const spUpd = `sp_upd_canales_${item.index}`;
              await conn.query(`SAVEPOINT \`${spUpd}\``);
              try {
                await conn.execute(
                  `UPDATE pia_canales_integridad SET
                    institucion = ?, tipo = ?, canales = ?, correo = ?, telefono = ?, formulario = ?,
                    tipocom = ?, otro = ?, direccion = ?, ubicacion = ?, horario = ?, protocolo_actuacion = ?
                   WHERE id = ?`,
                  [
                    item.row.institucion, item.row.tipo, item.row.canales, item.row.correo,
                    item.row.telefono, item.row.formulario, item.row.tipocom, item.row.otro,
                    item.row.direccion, item.row.ubicacion, item.row.horario, item.row.protocolo_actuacion,
                    item.row.id
                  ]
                );
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.updated++;
                logger.logRecord({
                  module: 'canales',
                  table: 'pia_canales_integridad',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'UPDATED',
                  message: 'Registro existente actualizado correctamente en SQL.'
                });
              } catch (err) {
                await conn.query(`ROLLBACK TO SAVEPOINT \`${spUpd}\``);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.errors.push({ table: 'pia_canales_integridad', index: item.index, recordId: item.recordId, ref: item.ref, code: err.code || 'SQL_ERROR', message: err.sqlMessage || err.message });
                logger.logRecord({ module: 'canales', table: 'pia_canales_integridad', index: item.index, recordId: item.recordId, ref: item.ref, status: 'ERROR', message: `Error actualizando: ${err.sqlMessage || err.message}` });
              }
            } else {
              toInsert.push(item);
            }
          }

          await executeMultiRowInsertWithFallback({
            conn,
            table: 'pia_canales_integridad',
            columns: ['id', 'institucion', 'tipo', 'canales', 'correo', 'telefono', 'formulario', 'tipocom', 'otro', 'direccion', 'ubicacion', 'horario', 'protocolo_actuacion'],
            items: toInsert,
            mapParams: it => [
              it.row.id, it.row.institucion, it.row.tipo, it.row.canales, it.row.correo,
              it.row.telefono, it.row.formulario, it.row.tipocom, it.row.otro,
              it.row.direccion, it.row.ubicacion, it.row.horario, it.row.protocolo_actuacion
            ],
            moduleKey: 'canales',
            logger,
            report
          });
        } else if (v.module === 'directorio') {
          const [existRows] = await conn.execute('SELECT id FROM pia_directorio_acceso');
          const existSet = new Set(existRows.map(r => Number(r.id)));
          const toInsert = [];

          for (const item of v.validRecords) {
            if (existSet.has(item.row.id)) {
              if (conflictMode === 'skip') {
                report.skipped++;
                logger.logRecord({
                  module: 'directorio',
                  table: 'pia_directorio_acceso',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'SKIPPED',
                  message: `Registro existente (id=${item.recordId}); omitido por modo skip.`
                });
                continue;
              }
              const spUpd = `sp_upd_dir_${item.index}`;
              await conn.query(`SAVEPOINT \`${spUpd}\``);
              try {
                await conn.execute(
                  `UPDATE pia_directorio_acceso SET
                    nombre_institucion = ?, siglas = ?, sector = ?, departamento = ?, correo = ?, telefono = ?,
                    direccion = ?, horario_atencion = ?, solicitud_en_linea = ?, informacion_publica_oficio = ?,
                    sitio_web = ?, latitud = ?, longitud = ?, ultima_actualizacion = ?
                   WHERE id = ?`,
                  [
                    item.row.nombre_institucion, item.row.siglas, item.row.sector, item.row.departamento,
                    item.row.correo, item.row.telefono, item.row.direccion, item.row.horario_atencion,
                    item.row.solicitud_en_linea, item.row.informacion_publica_oficio, item.row.sitio_web,
                    item.row.latitud, item.row.longitud, item.row.ultima_actualizacion, item.row.id
                  ]
                );
                await conn.execute('DELETE FROM pia_directorio_enlaces WHERE directorio_id = ?', [item.row.id]);
                await executeChildBulkInsert(conn, 'pia_directorio_enlaces', ['directorio_id', 'tipo_enlace', 'url', 'orden'], item.children.enlaces);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.updated++;
                logger.logRecord({
                  module: 'directorio',
                  table: 'pia_directorio_acceso',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'UPDATED',
                  message: `Registro y ${item.children.enlaces.length} enlaces actualizados en SQL.`
                });
              } catch (err) {
                await conn.query(`ROLLBACK TO SAVEPOINT \`${spUpd}\``);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.errors.push({ table: 'pia_directorio_acceso', index: item.index, recordId: item.recordId, ref: item.ref, code: err.code || 'SQL_ERROR', message: err.sqlMessage || err.message });
                logger.logRecord({ module: 'directorio', table: 'pia_directorio_acceso', index: item.index, recordId: item.recordId, ref: item.ref, status: 'ERROR', message: `Error actualizando: ${err.sqlMessage || err.message}` });
              }
            } else {
              toInsert.push(item);
            }
          }

          const insertedParents = await executeMultiRowInsertWithFallback({
            conn,
            table: 'pia_directorio_acceso',
            columns: ['id', 'nombre_institucion', 'siglas', 'sector', 'departamento', 'correo', 'telefono', 'direccion', 'horario_atencion', 'solicitud_en_linea', 'informacion_publica_oficio', 'sitio_web', 'latitud', 'longitud', 'ultima_actualizacion'],
            items: toInsert,
            mapParams: it => [
              it.row.id, it.row.nombre_institucion, it.row.siglas, it.row.sector, it.row.departamento,
              it.row.correo, it.row.telefono, it.row.direccion, it.row.horario_atencion,
              it.row.solicitud_en_linea, it.row.informacion_publica_oficio, it.row.sitio_web,
              it.row.latitud, it.row.longitud, it.row.ultima_actualizacion
            ],
            moduleKey: 'directorio',
            logger,
            report
          });

          const allChildLinks = insertedParents.flatMap(it => it.children.enlaces);
          if (allChildLinks.length > 0) {
            const countLinks = await executeChildBulkInsert(conn, 'pia_directorio_enlaces', ['directorio_id', 'tipo_enlace', 'url', 'orden'], allChildLinks);
            logger.info(`[directorio] Insertados masivamente ${countLinks} enlaces en 'pia_directorio_enlaces'.`);
          }
        } else if (v.module === 'tableros') {
          const [existRows] = await conn.execute('SELECT id FROM pia_tableros_gobierno');
          const existSet = new Set(existRows.map(r => Number(r.id)));
          const toInsert = [];

          for (const item of v.validRecords) {
            if (existSet.has(item.row.id)) {
              if (conflictMode === 'skip') {
                report.skipped++;
                logger.logRecord({
                  module: 'tableros',
                  table: 'pia_tableros_gobierno',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'SKIPPED',
                  message: `Registro existente (id=${item.recordId}); omitido por modo skip.`
                });
                continue;
              }
              const spUpd = `sp_upd_tab_${item.index}`;
              await conn.query(`SAVEPOINT \`${spUpd}\``);
              try {
                await conn.execute(
                  `UPDATE pia_tableros_gobierno SET
                    nombre_institucion = ?, siglas = ?, tipo_dependencia = ?, sector = ?, link_tablero = ?,
                    descripcion = ?, fecha_actualizacion = ?, estado = ?
                   WHERE id = ?`,
                  [
                    item.row.nombre_institucion, item.row.siglas, item.row.tipo_dependencia, item.row.sector,
                    item.row.link_tablero, item.row.descripcion, item.row.fecha_actualizacion, item.row.estado, item.row.id
                  ]
                );
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.updated++;
                logger.logRecord({
                  module: 'tableros',
                  table: 'pia_tableros_gobierno',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'UPDATED',
                  message: 'Tablero existente actualizado correctamente en SQL.'
                });
              } catch (err) {
                await conn.query(`ROLLBACK TO SAVEPOINT \`${spUpd}\``);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.errors.push({ table: 'pia_tableros_gobierno', index: item.index, recordId: item.recordId, ref: item.ref, code: err.code || 'SQL_ERROR', message: err.sqlMessage || err.message });
                logger.logRecord({ module: 'tableros', table: 'pia_tableros_gobierno', index: item.index, recordId: item.recordId, ref: item.ref, status: 'ERROR', message: `Error actualizando: ${err.sqlMessage || err.message}` });
              }
            } else {
              toInsert.push(item);
            }
          }

          await executeMultiRowInsertWithFallback({
            conn,
            table: 'pia_tableros_gobierno',
            columns: ['id', 'nombre_institucion', 'siglas', 'tipo_dependencia', 'sector', 'link_tablero', 'descripcion', 'fecha_actualizacion', 'estado'],
            items: toInsert,
            mapParams: it => [
              it.row.id, it.row.nombre_institucion, it.row.siglas, it.row.tipo_dependencia,
              it.row.sector, it.row.link_tablero, it.row.descripcion, it.row.fecha_actualizacion, it.row.estado
            ],
            moduleKey: 'tableros',
            logger,
            report
          });
        } else if (v.module === 'riesgo') {
          // 4a. Ciclos anuales (deben existir antes de FK de pia_riesgo_instituciones)
          const [existCycles] = await conn.execute('SELECT anio FROM pia_riesgo_ciclos');
          const cycleSet = new Set(existCycles.map(r => String(r.anio)));
          const cyclesToInsert = [];

          for (const c of v.riesgoCiclos) {
            if (cycleSet.has(c.row.anio)) {
              if (conflictMode === 'overwrite') {
                await conn.execute(
                  'UPDATE pia_riesgo_ciclos SET estado_recoleccion = ?, fecha_actualizacion = ?, ribbon_stats_json = ? WHERE anio = ?',
                  [c.row.estado_recoleccion, c.row.fecha_actualizacion, c.row.ribbon_stats_json, c.row.anio]
                );
                report.updated++;
                logger.logRecord({ module: 'riesgo', table: 'pia_riesgo_ciclos', index: c.index, recordId: c.recordId, ref: c.ref, status: 'UPDATED', message: 'Ciclo anual actualizado.' });
              } else {
                report.skipped++;
                logger.logRecord({ module: 'riesgo', table: 'pia_riesgo_ciclos', index: c.index, recordId: c.recordId, ref: c.ref, status: 'SKIPPED', message: 'Ciclo anual ya existente; omitido.' });
              }
            } else {
              cyclesToInsert.push(c);
            }
          }

          await executeMultiRowInsertWithFallback({
            conn,
            table: 'pia_riesgo_ciclos',
            columns: ['anio', 'estado_recoleccion', 'fecha_actualizacion', 'ribbon_stats_json'],
            items: cyclesToInsert,
            mapParams: it => [it.row.anio, it.row.estado_recoleccion, it.row.fecha_actualizacion, it.row.ribbon_stats_json],
            moduleKey: 'riesgo',
            logger,
            report
          });

          // 4b. Instituciones de riesgo por ciclo
          const [existInstRows] = await conn.execute('SELECT anio, id FROM pia_riesgo_instituciones');
          const instKeySet = new Set(existInstRows.map(r => `${r.anio}:${r.id}`));
          const instToInsert = [];

          for (const item of v.validRecords) {
            const key = `${item.row.anio}:${item.row.id}`;
            if (instKeySet.has(key)) {
              if (conflictMode === 'skip') {
                report.skipped++;
                logger.logRecord({
                  module: 'riesgo',
                  table: 'pia_riesgo_instituciones',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'SKIPPED',
                  message: `Institución existente en ciclo ${item.row.anio} (id=${item.row.id}); omitida.`
                });
                continue;
              }
              const spUpd = `sp_upd_riesgo_${item.index}`;
              await conn.query(`SAVEPOINT \`${spUpd}\``);
              try {
                await conn.execute(
                  `UPDATE pia_riesgo_instituciones SET
                    siglas = ?, nombre = ?, sector = ?, estado = ?, nivel = ?,
                    check_identificacion = ?, check_analisis = ?, check_presentacion = ?,
                    buenas_practicas = ?, verificacion_cgc = ?, fecha_actualizacion = ?
                   WHERE anio = ? AND id = ?`,
                  [
                    item.row.siglas, item.row.nombre, item.row.sector, item.row.estado, item.row.nivel,
                    item.row.check_identificacion, item.row.check_analisis, item.row.check_presentacion,
                    item.row.buenas_practicas, item.row.verificacion_cgc, item.row.fecha_actualizacion,
                    item.row.anio, item.row.id
                  ]
                );
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.updated++;
                logger.logRecord({
                  module: 'riesgo',
                  table: 'pia_riesgo_instituciones',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'UPDATED',
                  message: 'Institución actualizada en SQL.'
                });
              } catch (err) {
                await conn.query(`ROLLBACK TO SAVEPOINT \`${spUpd}\``);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.errors.push({ table: 'pia_riesgo_instituciones', index: item.index, recordId: item.recordId, ref: item.ref, code: err.code || 'SQL_ERROR', message: err.sqlMessage || err.message });
                logger.logRecord({ module: 'riesgo', table: 'pia_riesgo_instituciones', index: item.index, recordId: item.recordId, ref: item.ref, status: 'ERROR', message: `Error actualizando: ${err.sqlMessage || err.message}` });
              }
            } else {
              instToInsert.push(item);
            }
          }

          await executeMultiRowInsertWithFallback({
            conn,
            table: 'pia_riesgo_instituciones',
            columns: ['id', 'anio', 'siglas', 'nombre', 'sector', 'estado', 'nivel', 'check_identificacion', 'check_analisis', 'check_presentacion', 'buenas_practicas', 'verificacion_cgc', 'fecha_actualizacion'],
            items: instToInsert,
            mapParams: it => [
              it.row.id, it.row.anio, it.row.siglas, it.row.nombre, it.row.sector, it.row.estado, it.row.nivel,
              it.row.check_identificacion, it.row.check_analisis, it.row.check_presentacion,
              it.row.buenas_practicas, it.row.verificacion_cgc, it.row.fecha_actualizacion
            ],
            moduleKey: 'riesgo',
            logger,
            report
          });

          // 4c. Riesgos frecuentes
          if (v.riesgoFrecuentes.length > 0) {
            const [existFrec] = await conn.execute('SELECT COUNT(*) AS total FROM pia_riesgo_frecuentes');
            const totalFrec = Number(existFrec?.[0]?.total || 0);
            if (totalFrec === 0 || conflictMode === 'overwrite') {
              if (totalFrec > 0) {
                await conn.execute('DELETE FROM pia_riesgo_frecuentes');
              }
              await executeMultiRowInsertWithFallback({
                conn,
                table: 'pia_riesgo_frecuentes',
                columns: ['icono', 'texto', 'descripcion_breve', 'detalle_completo', 'fuente', 'categoria', 'orden'],
                items: v.riesgoFrecuentes,
                mapParams: it => [
                  it.row.icono, it.row.texto, it.row.descripcion_breve, it.row.detalle_completo,
                  it.row.fuente, it.row.categoria, it.row.orden
                ],
                moduleKey: 'riesgo',
                logger,
                report
              });
            } else {
              for (const f of v.riesgoFrecuentes) {
                report.skipped++;
                logger.logRecord({
                  module: 'riesgo',
                  table: 'pia_riesgo_frecuentes',
                  index: f.index,
                  recordId: f.recordId,
                  ref: f.ref,
                  status: 'SKIPPED',
                  message: `Catálogo de riesgos frecuentes ya poblado (${totalFrec} filas); omitido en modo skip.`
                });
              }
            }
          }
        } else if (v.module === 'vehiculos') {
          // 5a. Catálogo de instituciones vehiculares + criterios + documentos
          const [existCatRows] = await conn.execute('SELECT id FROM pia_vehiculos_instituciones');
          const existCatSet = new Set(existCatRows.map(r => String(r.id)));
          const catToInsert = [];

          for (const inst of v.vehiculosInstituciones) {
            if (existCatSet.has(inst.row.id)) {
              if (conflictMode === 'skip') {
                report.skipped++;
                logger.logRecord({
                  module: 'vehiculos',
                  table: 'pia_vehiculos_instituciones',
                  index: inst.index,
                  recordId: inst.recordId,
                  ref: inst.ref,
                  status: 'SKIPPED',
                  message: 'Institución de catálogo ya existe en SQL; omitida por modo skip.'
                });
                continue;
              }
              const spUpd = `sp_upd_vinst_${inst.index}`;
              await conn.query(`SAVEPOINT \`${spUpd}\``);
              try {
                await conn.execute(
                  'UPDATE pia_vehiculos_instituciones SET nombre = ?, siglas = ?, sector = ? WHERE id = ?',
                  [inst.row.nombre, inst.row.siglas, inst.row.sector, inst.row.id]
                );
                await conn.execute('DELETE FROM pia_vehiculos_institucion_criterios WHERE institucion_id = ?', [inst.row.id]);
                await conn.execute('DELETE FROM pia_vehiculos_institucion_documentos WHERE institucion_id = ?', [inst.row.id]);
                await executeChildBulkInsert(conn, 'pia_vehiculos_institucion_criterios', ['institucion_id', 'clave_criterio', 'label', 'cumple', 'doc_url', 'doc_nombre'], inst.children.criterios);
                await executeChildBulkInsert(conn, 'pia_vehiculos_institucion_documentos', ['institucion_id', 'tipo', 'titulo', 'url', 'orden'], inst.children.documentos);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.updated++;
                logger.logRecord({
                  module: 'vehiculos',
                  table: 'pia_vehiculos_instituciones',
                  index: inst.index,
                  recordId: inst.recordId,
                  ref: inst.ref,
                  status: 'UPDATED',
                  message: `Institución, ${inst.children.criterios.length} criterios y ${inst.children.documentos.length} documentos actualizados.`
                });
              } catch (err) {
                await conn.query(`ROLLBACK TO SAVEPOINT \`${spUpd}\``);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.errors.push({ table: 'pia_vehiculos_instituciones', index: inst.index, recordId: inst.recordId, ref: inst.ref, code: err.code || 'SQL_ERROR', message: err.sqlMessage || err.message });
                logger.logRecord({ module: 'vehiculos', table: 'pia_vehiculos_instituciones', index: inst.index, recordId: inst.recordId, ref: inst.ref, status: 'ERROR', message: `Error actualizando institución: ${err.sqlMessage || err.message}` });
              }
            } else {
              catToInsert.push(inst);
            }
          }

          const insertedInsts = await executeMultiRowInsertWithFallback({
            conn,
            table: 'pia_vehiculos_instituciones',
            columns: ['id', 'nombre', 'siglas', 'sector'],
            items: catToInsert,
            mapParams: it => [it.row.id, it.row.nombre, it.row.siglas, it.row.sector],
            moduleKey: 'vehiculos',
            logger,
            report
          });

          const allCriterios = insertedInsts.flatMap(it => it.children.criterios);
          const allDocs = insertedInsts.flatMap(it => it.children.documentos);
          if (allCriterios.length > 0) {
            const cCount = await executeChildBulkInsert(conn, 'pia_vehiculos_institucion_criterios', ['institucion_id', 'clave_criterio', 'label', 'cumple', 'doc_url', 'doc_nombre'], allCriterios);
            logger.info(`[vehiculos] Insertados masivamente ${cCount} criterios en 'pia_vehiculos_institucion_criterios'.`);
          }
          if (allDocs.length > 0) {
            const dCount = await executeChildBulkInsert(conn, 'pia_vehiculos_institucion_documentos', ['institucion_id', 'tipo', 'titulo', 'url', 'orden'], allDocs);
            logger.info(`[vehiculos] Insertados masivamente ${dCount} documentos en 'pia_vehiculos_institucion_documentos'.`);
          }

          // 5b. Flotilla de vehículos + historial (controlando UNIQUE KEY uk_veh_plate dentro del archivo y en SQL)
          const [existVehRows] = await conn.execute('SELECT id, plate FROM pia_vehiculos');
          const idToPlate = new Map();
          const plateToId = new Map();
          for (const r of existVehRows) {
            idToPlate.set(Number(r.id), String(r.plate));
            plateToId.set(String(r.plate), Number(r.id));
          }

          const vehToInsert = [];
          for (const item of v.validRecords) {
            const existingIdById = idToPlate.has(item.row.id) ? item.row.id : null;
            const existingIdByPlate = plateToId.get(item.row.plate) ?? null;
            const conflictId = existingIdById ?? existingIdByPlate;

            if (conflictId !== null) {
              if (conflictMode === 'skip') {
                report.skipped++;
                const reason = existingIdById !== null
                  ? `Registro existente en SQL por ID (${conflictId})`
                  : `Placa '${item.row.plate}' ya registrada bajo ID ${conflictId} (restricción única uk_veh_plate)`;
                logger.logRecord({
                  module: 'vehiculos',
                  table: 'pia_vehiculos',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'SKIPPED',
                  message: `${reason}; omitido por modo skip.`
                });
                continue;
              }
              const spUpd = `sp_upd_veh_${item.index}`;
              await conn.query(`SAVEPOINT \`${spUpd}\``);
              try {
                await conn.execute(
                  `UPDATE pia_vehiculos SET
                    plate = ?, plate_type = ?, department = ?, tipo_inst = ?, sector = ?, authorized_use = ?,
                    brand = ?, model = ?, year = ?, color = ?, status = ?, inactive_reason = ?,
                    last_update = ?, iscv_moroso = ?, multas = ?
                   WHERE id = ?`,
                  [
                    item.row.plate, item.row.plate_type, item.row.department, item.row.tipo_inst, item.row.sector,
                    item.row.authorized_use, item.row.brand, item.row.model, item.row.year, item.row.color,
                    item.row.status, item.row.inactive_reason, item.row.last_update, item.row.iscv_moroso,
                    item.row.multas, conflictId
                  ]
                );
                await conn.execute('DELETE FROM pia_vehiculos_historial WHERE vehiculo_id = ?', [conflictId]);
                const reassignedHistory = item.children.history.map(h => ({ ...h, vehiculo_id: conflictId }));
                await executeChildBulkInsert(conn, 'pia_vehiculos_historial', ['vehiculo_id', 'fecha', 'status', 'multas', 'iscv_moroso', 'orden'], reassignedHistory);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.updated++;
                logger.logRecord({
                  module: 'vehiculos',
                  table: 'pia_vehiculos',
                  index: item.index,
                  recordId: item.recordId,
                  ref: item.ref,
                  status: 'UPDATED',
                  message: `Vehículo (destino id=${conflictId}) e historial (${reassignedHistory.length} entradas) actualizados.`
                });
              } catch (err) {
                await conn.query(`ROLLBACK TO SAVEPOINT \`${spUpd}\``);
                await conn.query(`RELEASE SAVEPOINT \`${spUpd}\``);
                report.errors.push({ table: 'pia_vehiculos', index: item.index, recordId: item.recordId, ref: item.ref, code: err.code || 'SQL_ERROR', message: err.sqlMessage || err.message });
                logger.logRecord({ module: 'vehiculos', table: 'pia_vehiculos', index: item.index, recordId: item.recordId, ref: item.ref, status: 'ERROR', message: `Error actualizando vehículo: ${err.sqlMessage || err.message}` });
              }
            } else {
              // Reservar ID y placa en memoria para detectar duplicados dentro del mismo archivo antes del lote INSERT
              idToPlate.set(item.row.id, item.row.plate);
              plateToId.set(item.row.plate, item.row.id);
              vehToInsert.push(item);
            }
          }

          const insertedVehs = await executeMultiRowInsertWithFallback({
            conn,
            table: 'pia_vehiculos',
            columns: ['id', 'plate', 'plate_type', 'department', 'tipo_inst', 'sector', 'authorized_use', 'brand', 'model', 'year', 'color', 'status', 'inactive_reason', 'last_update', 'iscv_moroso', 'multas'],
            items: vehToInsert,
            mapParams: it => [
              it.row.id, it.row.plate, it.row.plate_type, it.row.department, it.row.tipo_inst, it.row.sector,
              it.row.authorized_use, it.row.brand, it.row.model, it.row.year, it.row.color,
              it.row.status, it.row.inactive_reason, it.row.last_update, it.row.iscv_moroso, it.row.multas
            ],
            moduleKey: 'vehiculos',
            logger,
            report
          });

          const allHist = insertedVehs.flatMap(it => it.children.history);
          if (allHist.length > 0) {
            const hCount = await executeChildBulkInsert(conn, 'pia_vehiculos_historial', ['vehiculo_id', 'fecha', 'status', 'multas', 'iscv_moroso', 'orden'], allHist);
            logger.info(`[vehiculos] Insertados masivamente ${hCount} registros históricos en 'pia_vehiculos_historial'.`);
          }
        } else if (v.module === 'portal') {
          const item = v.validRecords[0];
          if (item) {
            const [exist] = await conn.execute('SELECT id FROM pia_portal_metricas WHERE id = 1');
            if (exist.length > 0) {
              if (conflictMode === 'skip') {
                report.skipped++;
                logger.logRecord({ module: 'portal', table: 'pia_portal_metricas', index: 1, recordId: 1, ref: item.ref, status: 'SKIPPED', message: 'Registro ya existente (id=1); omitido.' });
              } else {
                await conn.execute(
                  'UPDATE pia_portal_metricas SET oficinas_probidad = ?, canales_denuncia = ?, denuncias_penales = ?, plataformas_activas = ? WHERE id = 1',
                  [item.row.oficinas_probidad, item.row.canales_denuncia, item.row.denuncias_penales, item.row.plataformas_activas]
                );
                report.updated++;
                logger.logRecord({ module: 'portal', table: 'pia_portal_metricas', index: 1, recordId: 1, ref: item.ref, status: 'UPDATED', message: 'Métricas del portal actualizadas.' });
              }
            } else {
              await executeMultiRowInsertWithFallback({
                conn,
                table: 'pia_portal_metricas',
                columns: ['id', 'oficinas_probidad', 'canales_denuncia', 'denuncias_penales', 'plataformas_activas'],
                items: [item],
                mapParams: it => [it.row.id, it.row.oficinas_probidad, it.row.canales_denuncia, it.row.denuncias_penales, it.row.plataformas_activas],
                moduleKey: 'portal',
                logger,
                report
              });
            }
          }
        }
      });

      report.errorsCount = report.errors.length;
      moduleReports.push(report);

      // Registrar evento por módulo en tabla SQL pia_storage_migrations (best-effort)
      try {
        const pool = getSqlPool();
        await pool.execute(
          `INSERT INTO pia_storage_migrations
            (direction, module_name, conflict_mode, inserted_count, updated_count, skipped_count, error_count, backup_ref, executed_by, details)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'json_to_sql',
            v.module,
            conflictMode,
            report.inserted,
            report.updated,
            report.skipped,
            report.errorsCount,
            backupFolder,
            executedBy,
            report.errorsCount > 0
              ? report.errors.slice(0, 5).map(e => `#${e.index}:${e.message}`).join(' | ')
              : 'Inserción masiva CLI completada sin errores'
          ]
        );
      } catch (_) {}
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = moduleReports.reduce(
    (acc, r) => ({
      totalSource: acc.totalSource + r.sourceCount,
      validated: acc.validated + (r.validated || 0),
      inserted: acc.inserted + (r.inserted || 0),
      updated: acc.updated + (r.updated || 0),
      skipped: acc.skipped + (r.skipped || 0),
      errors: acc.errors + (r.errorsCount || 0)
    }),
    { totalSource: 0, validated: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 }
  );

  // 5. Guardar archivos de bitácora detallada en disco (.log + .json)
  let logTextPath = null;
  let logJsonPath = null;
  if (logDir) {
    fs.mkdirSync(logDir, { recursive: true });
    const fileStamp = startedAt.replace(/[:.]/g, '-');
    logTextPath = path.join(logDir, `migration_${fileStamp}.log`);
    logJsonPath = path.join(logDir, `migration_${fileStamp}.json`);

    logger.info('========================================================================');
    logger.info(` RESUMEN FINAL -> Origen: ${summary.totalSource} | Validados: ${summary.validated} | Insertados: ${summary.inserted} | Actualizados: ${summary.updated} | Omitidos: ${summary.skipped} | Errores: ${summary.errors}`);
    logger.info(` Log texto   : ${logTextPath}`);
    logger.info(` Reporte JSON: ${logJsonPath}`);
    logger.info('========================================================================');

    fs.writeFileSync(logTextPath, logger.lines.join('\n') + '\n', 'utf8');
    fs.writeFileSync(
      logJsonPath,
      JSON.stringify(
        {
          startedAt,
          finishedAt,
          dryRun,
          onConflict: conflictMode,
          backupFolder,
          liveColumnCheck,
          summary,
          modules: moduleReports,
          recordLogs: logger.records
        },
        null,
        2
      ),
      'utf8'
    );
  }

  return {
    success: summary.errors === 0 && structuralFailures.length === 0,
    startedAt,
    finishedAt,
    dryRun,
    onConflict: conflictMode,
    backupFolder,
    liveColumnCheck,
    summary,
    modules: moduleReports,
    recordLogs: logger.records,
    logTextPath,
    logJsonPath
  };
}

// ============================================================================
// 6. INTERFAZ DE LÍNEA DE COMANDOS (CLI)
// ============================================================================

function parseCliArgs(argv) {
  const opts = {
    help: false,
    dryRun: false,
    strict: false,
    initSchema: false,
    onConflict: 'skip',
    confirmOverwrite: false,
    includePortal: false,
    quiet: false,
    modules: null,
    logDir: DEFAULT_LOG_DIR
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--dry-run' || arg === '--validate-only') opts.dryRun = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--init-schema') opts.initSchema = true;
    else if (arg === '--confirm-overwrite') opts.confirmOverwrite = true;
    else if (arg === '--include-portal') opts.includePortal = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--on-conflict=')) {
      opts.onConflict = arg.split('=')[1]?.trim() || 'skip';
    } else if (arg.startsWith('--modules=')) {
      opts.modules = arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--log-dir=')) {
      opts.logDir = path.resolve(arg.split('=')[1].trim());
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
Uso: node admin/scripts/migrate_json_to_sql.js [opciones]

Valida los cinco archivos JSON actuales del Portal PIA contra la estructura
de las tablas MySQL/MariaDB y realiza su inserción masiva por lotes con
bitácora detallada de éxito/omisión/error por cada registro.

Archivos JSON procesados por defecto:
  1. canales-por-la-integridad/data_directorio.json -> pia_canales_integridad
  2. directorio/data_acceso.json                    -> pia_directorio_acceso, pia_directorio_enlaces
  3. gobierno_en_numeros/data_tableros.json         -> pia_tableros_gobierno
  4. riesgo/datos.json                              -> pia_riesgo_ciclos, pia_riesgo_instituciones, pia_riesgo_frecuentes
  5. vehiculos/vehiculos.json                       -> pia_vehiculos_instituciones (+criterios/docs), pia_vehiculos, pia_vehiculos_historial

Opciones:
  --dry-run                Lee y valida los 5 JSON contra el esquema SQL y genera logs sin escribir en BD.
  --init-schema            Crea la BD y las 14 tablas desde sql/01_schema_mysql.sql si aún no existen.
  --on-conflict=skip       Omitir registros cuyo ID o clave única ya exista (por defecto).
  --on-conflict=overwrite  Actualizar registros existentes (requiere --confirm-overwrite).
  --confirm-overwrite      Confirmación obligatoria para sobrescribir datos existentes en SQL.
  --modules=a,b            Procesar solo módulos específicos (canales,directorio,tableros,riesgo,vehiculos,portal).
  --include-portal         Incluir también el sexto archivo data_portal.json -> pia_portal_metricas.
  --strict                 Detener la ejecución si algún registro falla la validación previa.
  --log-dir=RUTA           Directorio donde guardar los archivos .log y .json de bitácora.
  -h, --help               Muestra esta ayuda.
`);
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  runBulkJsonToSqlMigration(opts)
    .then(async (res) => {
      await closeSqlPool().catch(() => {});
      process.exit(res.success ? 0 : 1);
    })
    .catch(async (err) => {
      console.error(`\n[FATAL] ${err.message}`);
      await closeSqlPool().catch(() => {});
      process.exit(1);
    });
}
