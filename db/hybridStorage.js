// db/hybridStorage.js - Capa unificada de acceso a datos (JSON / SQL / HÍBRIDO)
// Garantiza una única fuente autoritativa de lectura y escritura por módulo.
import { normalizeModuleKey } from './storageConfig.js';
import {
  getSqlModuleRecords,
  createSqlModuleRecord,
  updateSqlModuleRecord,
  deleteSqlModuleRecord,
  fetchFullRiesgoDocument,
  fetchFullVehiculosDocument
} from './sqlRepository.js';

export function createHybridStorage({
  storageConfig,
  whitelistJsonMap,
  readJsonFile,
  computeFileHash,
  getJsonModuleRecords,
  saveJsonModuleRecords
}) {
  function getModuleSource(moduleName) {
    return storageConfig.resolveModuleSource(moduleName);
  }

  async function readModule(moduleName) {
    const source = getModuleSource(moduleName);
    if (source === 'sql') {
      const { records, etag } = await getSqlModuleRecords(moduleName);
      return { source: 'sql', records, etag };
    }

    const filePath = whitelistJsonMap[moduleName];
    if (!filePath) throw new Error(`Módulo '${moduleName}' no reconocido`);
    const etag = computeFileHash(filePath);
    const records = getJsonModuleRecords(moduleName);
    return { source: 'json', records, etag };
  }

  async function readRecordById(moduleName, id) {
    const { source, records, etag } = await readModule(moduleName);
    const item = records.find(r => String(r.id) === String(id));
    return { source, item: item || null, etag };
  }

  async function createRecord(moduleName, payload, user, expectedHash = null) {
    const source = getModuleSource(moduleName);
    if (source === 'sql') {
      const { record, newHash } = await createSqlModuleRecord(moduleName, payload, expectedHash);
      return {
        source: 'sql',
        record,
        newHash,
        backupCreated: 'Transacción SQL ACID'
      };
    }

    const records = getJsonModuleRecords(moduleName);
    const newId = records.length > 0 ? Math.max(...records.map(r => Number(r.id) || 0)) + 1 : 1;
    const newRecord = { id: newId, ...payload };
    records.push(newRecord);
    const result = saveJsonModuleRecords(moduleName, records, user, expectedHash);
    const updatedRecords = getJsonModuleRecords(moduleName);
    const saved = updatedRecords.find(r => String(r.id) === String(newId)) || newRecord;
    return {
      source: 'json',
      record: saved,
      newHash: result.newHash,
      backupCreated: result.backupCreated
    };
  }

  async function updateRecord(moduleName, id, payload, user, expectedHash = null) {
    const source = getModuleSource(moduleName);
    if (source === 'sql') {
      const res = await updateSqlModuleRecord(moduleName, id, payload, expectedHash);
      if (!res) return null;
      return {
        source: 'sql',
        record: res.record,
        newHash: res.newHash,
        backupCreated: 'Transacción SQL ACID'
      };
    }

    const records = getJsonModuleRecords(moduleName);
    const index = records.findIndex(r => String(r.id) === String(id));
    if (index === -1) return null;

    records[index] = { ...records[index], ...payload, id: Number(id) || id };
    const result = saveJsonModuleRecords(moduleName, records, user, expectedHash);
    const updatedRecords = getJsonModuleRecords(moduleName);
    const saved = updatedRecords.find(r => String(r.id) === String(id)) || records[index];
    return {
      source: 'json',
      record: saved,
      newHash: result.newHash,
      backupCreated: result.backupCreated
    };
  }

  async function deleteRecord(moduleName, id, user, expectedHash = null) {
    const source = getModuleSource(moduleName);
    if (source === 'sql') {
      const res = await deleteSqlModuleRecord(moduleName, id, expectedHash);
      if (!res) return null;
      return {
        source: 'sql',
        deleted: true,
        newHash: res.newHash,
        backupCreated: 'Transacción SQL ACID'
      };
    }

    const records = getJsonModuleRecords(moduleName);
    const index = records.findIndex(r => String(r.id) === String(id));
    if (index === -1) return null;

    records.splice(index, 1);
    const result = saveJsonModuleRecords(moduleName, records, user, expectedHash);
    return {
      source: 'json',
      deleted: true,
      newHash: result.newHash,
      backupCreated: result.backupCreated
    };
  }

  // Permite que las rutas públicas *.json respondan desde SQL cuando ese módulo está en SQL
  async function getPublicDocumentIfSql(moduleName) {
    const canonical = normalizeModuleKey(moduleName);
    const source = getModuleSource(canonical);
    if (source !== 'sql') return null;

    if (canonical === 'riesgo') {
      return await fetchFullRiesgoDocument();
    }
    if (canonical === 'vehiculos') {
      return await fetchFullVehiculosDocument();
    }
    if (canonical === 'portal') {
      const { records } = await getSqlModuleRecords('portal');
      const first = records[0] || {};
      const { id, ...portalDoc } = first;
      return portalDoc;
    }

    const { records } = await getSqlModuleRecords(canonical);
    return records;
  }

  function countJsonRecords(moduleKey) {
    const canonical = normalizeModuleKey(moduleKey);
    const filePath = whitelistJsonMap[canonical];
    if (!filePath) return 0;
    const raw = readJsonFile(filePath);
    if (!raw) return 0;

    if (canonical === 'riesgo') {
      if (raw.years && typeof raw.years === 'object') {
        return Object.values(raw.years).reduce(
          (acc, yr) => acc + (Array.isArray(yr?.instituciones) ? yr.instituciones.length : 0),
          0
        );
      }
      return 0;
    }
    if (canonical === 'vehiculos') {
      return Array.isArray(raw.vehicles) ? raw.vehicles.length : 0;
    }
    if (canonical === 'portal') {
      return raw && typeof raw === 'object' ? 1 : 0;
    }
    return Array.isArray(raw) ? raw.length : 0;
  }

  return {
    getModuleSource,
    readModule,
    readRecordById,
    createRecord,
    updateRecord,
    deleteRecord,
    getPublicDocumentIfSql,
    countJsonRecords
  };
}
