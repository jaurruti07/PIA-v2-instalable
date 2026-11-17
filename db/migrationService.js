// db/migrationService.js - Migración controlada JSON <-> SQL con validación, respaldo previo y prevención de duplicados
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { withTransaction, getSqlPool } from './sqlClient.js';
import { inspectSchemaStatus, isModuleSqlReady } from './schemaInit.js';
import { CONFIGURABLE_MODULES, normalizeModuleKey } from './storageConfig.js';
import {
  computeCanalesCount,
  fetchFullRiesgoDocument,
  fetchFullVehiculosDocument,
  getSqlModuleRecords
} from './sqlRepository.js';

function toBool(v) {
  return Boolean(v === true || v === 1 || v === '1' || v === 'true');
}

function toStr(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function toNullableStr(v) {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function validateJsonDataset(moduleKey, rawData) {
  const errors = [];
  if (rawData === null || rawData === undefined) {
    errors.push(`Archivo JSON para '${moduleKey}' vacío o ilegible.`);
    return errors;
  }

  if (moduleKey === 'canales' || moduleKey === 'directorio' || moduleKey === 'tableros') {
    if (!Array.isArray(rawData)) {
      errors.push(`El JSON de '${moduleKey}' debe ser un arreglo de registros.`);
    }
  } else if (moduleKey === 'riesgo') {
    if (typeof rawData !== 'object' || !rawData.years || typeof rawData.years !== 'object') {
      errors.push("El JSON de 'riesgo' debe contener el objeto 'years'.");
    }
  } else if (moduleKey === 'vehiculos') {
    if (typeof rawData !== 'object' || !Array.isArray(rawData.vehicles)) {
      errors.push("El JSON de 'vehiculos' debe contener el arreglo 'vehicles'.");
    }
  } else if (moduleKey === 'portal') {
    if (typeof rawData !== 'object' || Array.isArray(rawData)) {
      errors.push("El JSON de 'portal' debe ser un objeto de métricas.");
    }
  }
  return errors;
}

function createPreMigrationSnapshot({ backupsDir, direction, selectedModules, whitelistJsonMap, sqlSnapshots = {} }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(3).toString('hex');
  const folderName = `migration_${direction}_${stamp}_${rand}`;
  const folderPath = path.join(backupsDir, folderName);
  fs.mkdirSync(folderPath, { recursive: true });

  for (const mod of selectedModules) {
    const srcJson = whitelistJsonMap[mod];
    if (srcJson && fs.existsSync(srcJson)) {
      fs.copyFileSync(srcJson, path.join(folderPath, `${mod}_${path.basename(srcJson)}.bak`));
    }
    if (sqlSnapshots[mod] !== undefined) {
      fs.writeFileSync(
        path.join(folderPath, `sql_before_${mod}.json`),
        JSON.stringify(sqlSnapshots[mod], null, 2),
        'utf8'
      );
    }
  }

  return folderName;
}

async function recordMigrationInSql({ direction, moduleName, conflictMode, inserted, updated, skipped, errorCount, backupRef, executedBy, details }) {
  try {
    const pool = getSqlPool();
    await pool.execute(
      `INSERT INTO pia_storage_migrations
        (direction, module_name, conflict_mode, inserted_count, updated_count, skipped_count, error_count, backup_ref, executed_by, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [direction, moduleName, conflictMode, inserted, updated, skipped, errorCount, backupRef, executedBy, details]
    );
  } catch (_) {
    // Registro secundario best-effort: la bitácora principal audit_logs.json siempre registra el evento
  }
}

export async function importJsonToSql({
  modules = null,
  conflictMode = 'skip',
  confirmOverwrite = false,
  executedBy = 'admin',
  backupsDir,
  whitelistJsonMap,
  readJsonFile
}) {
  const mode = conflictMode === 'overwrite' ? 'overwrite' : 'skip';
  if (mode === 'overwrite' && confirmOverwrite !== true) {
    const err = new Error('Sobrescribir registros existentes en SQL requiere confirmación explícita del administrador.');
    err.statusCode = 400;
    throw err;
  }

  const allModuleKeys = CONFIGURABLE_MODULES.map(m => m.key);
  const selectedModules = Array.isArray(modules) && modules.length > 0
    ? [...new Set(modules.map(normalizeModuleKey).filter(m => allModuleKeys.includes(m)))]
    : allModuleKeys;

  if (selectedModules.length === 0) {
    const err = new Error('Debe seleccionar al menos un módulo válido para importar.');
    err.statusCode = 400;
    throw err;
  }

  const schemaStatus = await inspectSchemaStatus();
  if (!schemaStatus.connection?.connected) {
    const err = new Error(schemaStatus.connection?.error || 'No existe conexión activa con MySQL/MariaDB.');
    err.statusCode = 503;
    throw err;
  }

  for (const mod of selectedModules) {
    if (!isModuleSqlReady(schemaStatus, mod)) {
      const err = new Error(`Las tablas SQL requeridas para el módulo '${mod}' aún no han sido inicializadas.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // 1. Leer y validar todos los JSON antes de abrir transacciones
  const jsonDatasets = {};
  const validationErrors = [];
  for (const mod of selectedModules) {
    const filePath = whitelistJsonMap[mod];
    const data = readJsonFile(filePath);
    const errs = validateJsonDataset(mod, data);
    if (errs.length > 0) validationErrors.push(...errs);
    jsonDatasets[mod] = data;
  }

  if (validationErrors.length > 0) {
    const err = new Error(`Validación previa fallida: ${validationErrors.join(' ')}`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Capturar estado SQL previo para respaldo
  const sqlSnapshots = {};
  for (const mod of selectedModules) {
    try {
      if (mod === 'riesgo') sqlSnapshots[mod] = await fetchFullRiesgoDocument();
      else if (mod === 'vehiculos') sqlSnapshots[mod] = await fetchFullVehiculosDocument();
      else sqlSnapshots[mod] = (await getSqlModuleRecords(mod)).records;
    } catch (_) {
      sqlSnapshots[mod] = null;
    }
  }

  const backupFolder = createPreMigrationSnapshot({
    backupsDir,
    direction: 'json_to_sql',
    selectedModules,
    whitelistJsonMap,
    sqlSnapshots
  });

  // 3. Ejecutar importación transaccional por módulo con control de duplicados
  const moduleReports = [];

  for (const mod of selectedModules) {
    const report = {
      module: mod,
      sourceCount: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    try {
      await withTransaction(async (conn) => {
        if (mod === 'canales') {
          const items = jsonDatasets.canales;
          report.sourceCount = items.length;
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx] || {};
            const id = toInt(item.id, idx + 1);
            const [exist] = await conn.execute('SELECT id FROM pia_canales_integridad WHERE id = ?', [id]);
            const canalesCount = toInt(item.canales, computeCanalesCount(item));
            const proto = toBool(item['Protocolo de actuación']) ? 1 : 0;

            if (exist.length > 0) {
              if (mode === 'skip') {
                report.skipped++;
                continue;
              }
              await conn.execute(
                `UPDATE pia_canales_integridad SET
                  institucion = ?, tipo = ?, canales = ?, correo = ?, telefono = ?, formulario = ?,
                  tipocom = ?, otro = ?, direccion = ?, ubicacion = ?, horario = ?, protocolo_actuacion = ?
                 WHERE id = ?`,
                [
                  toStr(item.institucion), toStr(item.tipo), canalesCount, toStr(item.correo),
                  toStr(item.telefono), toStr(item.formulario), toStr(item.tipocom), toStr(item.otro),
                  toStr(item.direccion), toStr(item.ubicacion), toStr(item.horario), proto, id
                ]
              );
              report.updated++;
            } else {
              await conn.execute(
                `INSERT INTO pia_canales_integridad
                  (id, institucion, tipo, canales, correo, telefono, formulario, tipocom, otro, direccion, ubicacion, horario, protocolo_actuacion)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id, toStr(item.institucion), toStr(item.tipo), canalesCount, toStr(item.correo),
                  toStr(item.telefono), toStr(item.formulario), toStr(item.tipocom), toStr(item.otro),
                  toStr(item.direccion), toStr(item.ubicacion), toStr(item.horario), proto
                ]
              );
              report.inserted++;
            }
          }
        } else if (mod === 'directorio') {
          const items = jsonDatasets.directorio;
          report.sourceCount = items.length;
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx] || {};
            const id = toInt(item.id, idx + 1);
            const [exist] = await conn.execute('SELECT id FROM pia_directorio_acceso WHERE id = ?', [id]);
            if (exist.length > 0) {
              if (mode === 'skip') {
                report.skipped++;
                continue;
              }
              await conn.execute(
                `UPDATE pia_directorio_acceso SET
                  nombre_institucion = ?, siglas = ?, sector = ?, departamento = ?, correo = ?, telefono = ?,
                  direccion = ?, horario_atencion = ?, solicitud_en_linea = ?, informacion_publica_oficio = ?,
                  sitio_web = ?, latitud = ?, longitud = ?, ultima_actualizacion = ?
                 WHERE id = ?`,
                [
                  toStr(item.nombre_institucion), toStr(item.siglas), toStr(item.sector), toStr(item.departamento),
                  toStr(item.correo), toStr(item.telefono), toStr(item.direccion), toStr(item.horario_atencion),
                  toBool(item.solicitud_en_linea) ? 1 : 0, toBool(item.informacion_publica_oficio) ? 1 : 0,
                  toStr(item.sitio_web), toFloat(item.latitud, 0), toFloat(item.longitud, 0),
                  toStr(item.ultima_actualizacion), id
                ]
              );
              await conn.execute('DELETE FROM pia_directorio_enlaces WHERE directorio_id = ?', [id]);
              report.updated++;
            } else {
              await conn.execute(
                `INSERT INTO pia_directorio_acceso
                  (id, nombre_institucion, siglas, sector, departamento, correo, telefono, direccion, horario_atencion, solicitud_en_linea, informacion_publica_oficio, sitio_web, latitud, longitud, ultima_actualizacion)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id, toStr(item.nombre_institucion), toStr(item.siglas), toStr(item.sector), toStr(item.departamento),
                  toStr(item.correo), toStr(item.telefono), toStr(item.direccion), toStr(item.horario_atencion),
                  toBool(item.solicitud_en_linea) ? 1 : 0, toBool(item.informacion_publica_oficio) ? 1 : 0,
                  toStr(item.sitio_web), toFloat(item.latitud, 0), toFloat(item.longitud, 0),
                  toStr(item.ultima_actualizacion)
                ]
              );
              report.inserted++;
            }

            if (Array.isArray(item.enlaces_solicitud)) {
              for (let i = 0; i < item.enlaces_solicitud.length; i++) {
                const url = toStr(item.enlaces_solicitud[i]).trim();
                if (url) {
                  await conn.execute(
                    'INSERT INTO pia_directorio_enlaces (directorio_id, tipo_enlace, url, orden) VALUES (?, ?, ?, ?)',
                    [id, 'solicitud', url, i]
                  );
                }
              }
            }
            if (Array.isArray(item.enlaces_oficio)) {
              for (let i = 0; i < item.enlaces_oficio.length; i++) {
                const url = toStr(item.enlaces_oficio[i]).trim();
                if (url) {
                  await conn.execute(
                    'INSERT INTO pia_directorio_enlaces (directorio_id, tipo_enlace, url, orden) VALUES (?, ?, ?, ?)',
                    [id, 'oficio', url, i]
                  );
                }
              }
            }
          }
        } else if (mod === 'tableros') {
          const items = jsonDatasets.tableros;
          report.sourceCount = items.length;
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx] || {};
            const id = toInt(item.id, idx + 1);
            const [exist] = await conn.execute('SELECT id FROM pia_tableros_gobierno WHERE id = ?', [id]);
            if (exist.length > 0) {
              if (mode === 'skip') {
                report.skipped++;
                continue;
              }
              await conn.execute(
                `UPDATE pia_tableros_gobierno SET
                  nombre_institucion = ?, siglas = ?, tipo_dependencia = ?, sector = ?, link_tablero = ?,
                  descripcion = ?, fecha_actualizacion = ?, estado = ?
                 WHERE id = ?`,
                [
                  toStr(item.nombre_institucion), toStr(item.siglas), toStr(item.tipo_dependencia), toStr(item.sector),
                  toStr(item.link_tablero), toStr(item.descripcion), toStr(item.fecha_actualizacion),
                  toStr(item.estado, 'Disponible'), id
                ]
              );
              report.updated++;
            } else {
              await conn.execute(
                `INSERT INTO pia_tableros_gobierno
                  (id, nombre_institucion, siglas, tipo_dependencia, sector, link_tablero, descripcion, fecha_actualizacion, estado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id, toStr(item.nombre_institucion), toStr(item.siglas), toStr(item.tipo_dependencia), toStr(item.sector),
                  toStr(item.link_tablero), toStr(item.descripcion), toStr(item.fecha_actualizacion),
                  toStr(item.estado, 'Disponible')
                ]
              );
              report.inserted++;
            }
          }
        } else if (mod === 'riesgo') {
          const doc = jsonDatasets.riesgo;
          const years = doc.years || {};
          for (const [anio, yData] of Object.entries(years)) {
            const ribbonJson = JSON.stringify(Array.isArray(yData?.ribbonStats) ? yData.ribbonStats : []);
            const [existCycle] = await conn.execute('SELECT anio FROM pia_riesgo_ciclos WHERE anio = ?', [anio]);
            if (existCycle.length === 0) {
              await conn.execute(
                'INSERT INTO pia_riesgo_ciclos (anio, estado_recoleccion, fecha_actualizacion, ribbon_stats_json) VALUES (?, ?, ?, ?)',
                [anio, toStr(yData?.estadoRecoleccion, 'activo'), toStr(yData?.fechaActualizacion), ribbonJson]
              );
            } else if (mode === 'overwrite') {
              await conn.execute(
                'UPDATE pia_riesgo_ciclos SET estado_recoleccion = ?, fecha_actualizacion = ?, ribbon_stats_json = ? WHERE anio = ?',
                [toStr(yData?.estadoRecoleccion, 'activo'), toStr(yData?.fechaActualizacion), ribbonJson, anio]
              );
            }

            const insts = Array.isArray(yData?.instituciones) ? yData.instituciones : [];
            report.sourceCount += insts.length;
            for (let idx = 0; idx < insts.length; idx++) {
              const inst = insts[idx] || {};
              const id = toInt(inst.id, idx + 1);
              const checks = inst.checks || {};
              const [existInst] = await conn.execute(
                'SELECT pk_id FROM pia_riesgo_instituciones WHERE anio = ? AND id = ?',
                [anio, id]
              );
              if (existInst.length > 0) {
                if (mode === 'skip') {
                  report.skipped++;
                  continue;
                }
                await conn.execute(
                  `UPDATE pia_riesgo_instituciones SET
                    siglas = ?, nombre = ?, sector = ?, estado = ?, nivel = ?,
                    check_identificacion = ?, check_analisis = ?, check_presentacion = ?,
                    buenas_practicas = ?, verificacion_cgc = ?, fecha_actualizacion = ?
                   WHERE anio = ? AND id = ?`,
                  [
                    toStr(inst.siglas), toStr(inst.nombre), toStr(inst.sector), toStr(inst.estado), toStr(inst.nivel),
                    toBool(checks.identificacion) ? 1 : 0, toBool(checks.analisis) ? 1 : 0, toBool(checks.presentacion) ? 1 : 0,
                    toBool(inst.buenasPracticas) ? 1 : 0, toStr(inst.verificacionCGC), toStr(inst.fechaActualizacion),
                    anio, id
                  ]
                );
                report.updated++;
              } else {
                await conn.execute(
                  `INSERT INTO pia_riesgo_instituciones
                    (id, anio, siglas, nombre, sector, estado, nivel, check_identificacion, check_analisis, check_presentacion, buenas_practicas, verificacion_cgc, fecha_actualizacion)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    id, anio, toStr(inst.siglas), toStr(inst.nombre), toStr(inst.sector), toStr(inst.estado), toStr(inst.nivel),
                    toBool(checks.identificacion) ? 1 : 0, toBool(checks.analisis) ? 1 : 0, toBool(checks.presentacion) ? 1 : 0,
                    toBool(inst.buenasPracticas) ? 1 : 0, toStr(inst.verificacionCGC), toStr(inst.fechaActualizacion)
                  ]
                );
                report.inserted++;
              }
            }
          }

          if (Array.isArray(doc.riesgosFrecuentes)) {
            const [existFrec] = await conn.execute('SELECT COUNT(*) AS total FROM pia_riesgo_frecuentes');
            const frecCount = Number(existFrec?.[0]?.total || 0);
            if (frecCount === 0 || mode === 'overwrite') {
              await conn.execute('DELETE FROM pia_riesgo_frecuentes');
              for (let i = 0; i < doc.riesgosFrecuentes.length; i++) {
                const f = doc.riesgosFrecuentes[i] || {};
                await conn.execute(
                  `INSERT INTO pia_riesgo_frecuentes (icono, texto, descripcion_breve, detalle_completo, fuente, categoria, orden)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [toStr(f.icono), toStr(f.texto), toStr(f.descripcionBreve), toStr(f.detalleCompleto), toStr(f.fuente), toStr(f.categoria), i]
                );
              }
            }
          }
        } else if (mod === 'vehiculos') {
          const doc = jsonDatasets.vehiculos;
          const catInsts = Array.isArray(doc.catalogInstituciones) ? doc.catalogInstituciones : [];
          const vehicles = Array.isArray(doc.vehicles) ? doc.vehicles : [];
          report.sourceCount = catInsts.length + vehicles.length;

          for (const inst of catInsts) {
            const instId = toStr(inst.id || inst.nombre).trim().slice(0, 191);
            if (!instId) continue;
            const [existInst] = await conn.execute('SELECT id FROM pia_vehiculos_instituciones WHERE id = ?', [instId]);
            if (existInst.length > 0) {
              if (mode === 'skip') {
                report.skipped++;
                continue;
              }
              await conn.execute(
                'UPDATE pia_vehiculos_instituciones SET nombre = ?, siglas = ?, sector = ? WHERE id = ?',
                [toStr(inst.nombre, instId), toStr(inst.siglas), toStr(inst.sector), instId]
              );
              await conn.execute('DELETE FROM pia_vehiculos_institucion_criterios WHERE institucion_id = ?', [instId]);
              await conn.execute('DELETE FROM pia_vehiculos_institucion_documentos WHERE institucion_id = ?', [instId]);
              report.updated++;
            } else {
              await conn.execute(
                'INSERT INTO pia_vehiculos_instituciones (id, nombre, siglas, sector) VALUES (?, ?, ?, ?)',
                [instId, toStr(inst.nombre, instId), toStr(inst.siglas), toStr(inst.sector)]
              );
              report.inserted++;
            }

            if (inst.criterios && typeof inst.criterios === 'object') {
              for (const [clave, val] of Object.entries(inst.criterios)) {
                if (!val || typeof val !== 'object') continue;
                await conn.execute(
                  'INSERT INTO pia_vehiculos_institucion_criterios (institucion_id, clave_criterio, label, cumple, doc_url, doc_nombre) VALUES (?, ?, ?, ?, ?, ?)',
                  [instId, clave, toStr(val.label), toBool(val.cumple) ? 1 : 0, toNullableStr(val.docUrl), toStr(val.docNombre)]
                );
              }
            }
            if (Array.isArray(inst.documentosPublicos)) {
              for (let i = 0; i < inst.documentosPublicos.length; i++) {
                const d = inst.documentosPublicos[i] || {};
                await conn.execute(
                  'INSERT INTO pia_vehiculos_institucion_documentos (institucion_id, tipo, titulo, url, orden) VALUES (?, ?, ?, ?, ?)',
                  [instId, toStr(d.tipo), toStr(d.titulo), toStr(d.url), i]
                );
              }
            }
          }

          for (let idx = 0; idx < vehicles.length; idx++) {
            const v = vehicles[idx] || {};
            const vid = toInt(v.id, idx + 1);
            const plate = toStr(v.plate).trim();
            const [existVeh] = await conn.execute(
              'SELECT id FROM pia_vehiculos WHERE id = ? OR plate = ? LIMIT 1',
              [vid, plate]
            );
            let targetVehId = vid;
            if (existVeh.length > 0) {
              targetVehId = existVeh[0].id;
              if (mode === 'skip') {
                report.skipped++;
                continue;
              }
              await conn.execute(
                `UPDATE pia_vehiculos SET
                  plate = ?, plate_type = ?, department = ?, tipo_inst = ?, sector = ?, authorized_use = ?,
                  brand = ?, model = ?, year = ?, color = ?, status = ?, inactive_reason = ?,
                  last_update = ?, iscv_moroso = ?, multas = ?
                 WHERE id = ?`,
                [
                  plate, toStr(v.plateType), toStr(v.department), toStr(v.tipoInst), toStr(v.sector),
                  toStr(v.authorizedUse), toStr(v.brand), toStr(v.model),
                  v.year !== undefined && v.year !== null ? toInt(v.year) : null,
                  toStr(v.color), toStr(v.status, 'Activo'), toNullableStr(v.inactiveReason),
                  toStr(v.lastUpdate), toBool(v.iscvMoroso) ? 1 : 0, toInt(v.multas, 0), targetVehId
                ]
              );
              await conn.execute('DELETE FROM pia_vehiculos_historial WHERE vehiculo_id = ?', [targetVehId]);
              report.updated++;
            } else {
              await conn.execute(
                `INSERT INTO pia_vehiculos
                  (id, plate, plate_type, department, tipo_inst, sector, authorized_use, brand, model, year, color, status, inactive_reason, last_update, iscv_moroso, multas)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  vid, plate, toStr(v.plateType), toStr(v.department), toStr(v.tipoInst), toStr(v.sector),
                  toStr(v.authorizedUse), toStr(v.brand), toStr(v.model),
                  v.year !== undefined && v.year !== null ? toInt(v.year) : null,
                  toStr(v.color), toStr(v.status, 'Activo'), toNullableStr(v.inactiveReason),
                  toStr(v.lastUpdate), toBool(v.iscvMoroso) ? 1 : 0, toInt(v.multas, 0)
                ]
              );
              report.inserted++;
            }

            if (Array.isArray(v.history)) {
              for (let i = 0; i < v.history.length; i++) {
                const h = v.history[i] || {};
                await conn.execute(
                  'INSERT INTO pia_vehiculos_historial (vehiculo_id, fecha, status, multas, iscv_moroso, orden) VALUES (?, ?, ?, ?, ?, ?)',
                  [targetVehId, toStr(h.date), toStr(h.status, 'Activo'), toInt(h.multas, 0), toBool(h.iscvMoroso) ? 1 : 0, i]
                );
              }
            }
          }
        } else if (mod === 'portal') {
          const p = jsonDatasets.portal || {};
          report.sourceCount = 1;
          const [exist] = await conn.execute('SELECT id FROM pia_portal_metricas WHERE id = 1');
          if (exist.length > 0) {
            if (mode === 'skip') {
              report.skipped = 1;
            } else {
              await conn.execute(
                'UPDATE pia_portal_metricas SET oficinas_probidad = ?, canales_denuncia = ?, denuncias_penales = ?, plataformas_activas = ? WHERE id = 1',
                [toInt(p.oficinasProbidad, 0), toInt(p.canalesDenuncia, 0), toInt(p.denunciasPenales, 0), toInt(p.plataformasActivas, 0)]
              );
              report.updated = 1;
            }
          } else {
            await conn.execute(
              'INSERT INTO pia_portal_metricas (id, oficinas_probidad, canales_denuncia, denuncias_penales, plataformas_activas) VALUES (1, ?, ?, ?, ?)',
              [toInt(p.oficinasProbidad, 0), toInt(p.canalesDenuncia, 0), toInt(p.denunciasPenales, 0), toInt(p.plataformasActivas, 0)]
            );
            report.inserted = 1;
          }
        }
      });
    } catch (err) {
      report.errors.push(err.message);
    }

    await recordMigrationInSql({
      direction: 'json_to_sql',
      moduleName: mod,
      conflictMode: mode,
      inserted: report.inserted,
      updated: report.updated,
      skipped: report.skipped,
      errorCount: report.errors.length,
      backupRef: backupFolder,
      executedBy,
      details: report.errors.length > 0 ? report.errors.join(' | ') : 'Importación completada sin errores'
    });

    moduleReports.push(report);
  }

  const summary = moduleReports.reduce(
    (acc, r) => ({
      totalSource: acc.totalSource + r.sourceCount,
      inserted: acc.inserted + r.inserted,
      updated: acc.updated + r.updated,
      skipped: acc.skipped + r.skipped,
      errors: acc.errors + r.errors.length
    }),
    { totalSource: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 }
  );

  return {
    success: summary.errors === 0,
    direction: 'json_to_sql',
    conflictMode: mode,
    backupFolder,
    summary,
    modules: moduleReports
  };
}

export async function exportSqlToJson({
  modules = null,
  exportMode = 'download',
  confirmOverwrite = false,
  executedBy = 'admin',
  backupsDir,
  whitelistJsonMap,
  atomicWriteJson
}) {
  const mode = exportMode === 'write_disk' ? 'write_disk' : 'download';
  if (mode === 'write_disk' && confirmOverwrite !== true) {
    const err = new Error('Sobrescribir los archivos JSON locales desde SQL requiere confirmación explícita del administrador.');
    err.statusCode = 400;
    throw err;
  }

  const allModuleKeys = CONFIGURABLE_MODULES.map(m => m.key);
  const selectedModules = Array.isArray(modules) && modules.length > 0
    ? [...new Set(modules.map(normalizeModuleKey).filter(m => allModuleKeys.includes(m)))]
    : allModuleKeys;

  if (selectedModules.length === 0) {
    const err = new Error('Debe seleccionar al menos un módulo válido para exportar.');
    err.statusCode = 400;
    throw err;
  }

  const schemaStatus = await inspectSchemaStatus();
  if (!schemaStatus.connection?.connected) {
    const err = new Error(schemaStatus.connection?.error || 'No existe conexión activa con MySQL/MariaDB.');
    err.statusCode = 503;
    throw err;
  }

  for (const mod of selectedModules) {
    if (!isModuleSqlReady(schemaStatus, mod)) {
      const err = new Error(`Las tablas SQL del módulo '${mod}' aún no existen.`);
      err.statusCode = 400;
      throw err;
    }
  }

  const backupFolder = mode === 'write_disk'
    ? createPreMigrationSnapshot({
        backupsDir,
        direction: 'sql_to_json',
        selectedModules,
        whitelistJsonMap
      })
    : null;

  const exportedFiles = {};
  const moduleReports = [];

  for (const mod of selectedModules) {
    const report = {
      module: mod,
      exportedCount: 0,
      writtenToDisk: false,
      backupCreated: null,
      errors: []
    };

    try {
      let payload = null;
      let count = 0;

      if (mod === 'riesgo') {
        payload = await fetchFullRiesgoDocument();
        count = Object.values(payload.years || {}).reduce(
          (acc, yr) => acc + (Array.isArray(yr?.instituciones) ? yr.instituciones.length : 0),
          0
        );
      } else if (mod === 'vehiculos') {
        payload = await fetchFullVehiculosDocument();
        count = (payload.vehicles || []).length;
      } else if (mod === 'portal') {
        const { records } = await getSqlModuleRecords('portal');
        const first = records[0] || {};
        const { id, ...portalObj } = first;
        payload = portalObj;
        count = 1;
      } else {
        const { records } = await getSqlModuleRecords(mod);
        payload = records;
        count = records.length;
      }

      const errs = validateJsonDataset(mod, payload);
      if (errs.length > 0) {
        throw new Error(errs.join(' '));
      }

      const targetPath = whitelistJsonMap[mod];
      const fileName = path.basename(targetPath);

      if (mode === 'write_disk') {
        const writeRes = atomicWriteJson(targetPath, payload, null, executedBy);
        report.writtenToDisk = true;
        report.backupCreated = writeRes.backupCreated;
      }

      exportedFiles[mod] = {
        fileName,
        count,
        data: payload
      };
      report.exportedCount = count;
    } catch (err) {
      report.errors.push(err.message);
    }

    await recordMigrationInSql({
      direction: 'sql_to_json',
      moduleName: mod,
      conflictMode: mode,
      inserted: report.exportedCount,
      updated: report.writtenToDisk ? 1 : 0,
      skipped: 0,
      errorCount: report.errors.length,
      backupRef: report.backupCreated || backupFolder,
      executedBy,
      details: report.errors.length > 0 ? report.errors.join(' | ') : `Exportación (${mode}) completada`
    });

    moduleReports.push(report);
  }

  const summary = moduleReports.reduce(
    (acc, r) => ({
      exportedRecords: acc.exportedRecords + r.exportedCount,
      writtenFiles: acc.writtenFiles + (r.writtenToDisk ? 1 : 0),
      errors: acc.errors + r.errors.length
    }),
    { exportedRecords: 0, writtenFiles: 0, errors: 0 }
  );

  return {
    success: summary.errors === 0,
    direction: 'sql_to_json',
    exportMode: mode,
    backupFolder,
    summary,
    modules: moduleReports,
    files: mode === 'download' ? exportedFiles : undefined
  };
}
