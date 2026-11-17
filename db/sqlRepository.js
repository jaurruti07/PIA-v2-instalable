// db/sqlRepository.js - Repositorio SQL parametrizado (MySQL/MariaDB) con transacciones y ETag OCC
import crypto from 'crypto';
import { getSqlPool, withTransaction } from './sqlClient.js';
import { normalizeModuleKey } from './storageConfig.js';

export function computeCanalesCount(item) {
  let count = 0;
  if (item.telefono && String(item.telefono).trim()) count++;
  if (item.correo && String(item.correo).trim()) count++;
  if (item.formulario && String(item.formulario).trim()) count++;
  const dirStr = String(item.direccion || item.ubicacion || '');
  const tipocom = String(item.tipocom || '');
  const hasPresencial = dirStr.trim().length > 0 || (
    tipocom.toLowerCase().includes('presencial') ||
    tipocom.toLowerCase().includes('oficina')
  );
  if (hasPresencial) count++;
  if (item.otro && String(item.otro).trim()) count++;
  return count > 0 ? count : 1;
}

function cleanEtag(etag) {
  if (!etag) return null;
  return String(etag).replace(/^W\//i, '').replace(/["']/g, '').trim();
}

export function computeDatasetHash(data) {
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

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

// ============================================================================
// MAPPERS SQL ROW <-> JSON OFICIAL (Conservación estricta de campos)
// ============================================================================

export function mapCanalRowToJson(row) {
  return {
    id: Number(row.id),
    institucion: toStr(row.institucion),
    tipo: toStr(row.tipo),
    canales: Number(row.canales) || 1,
    correo: toStr(row.correo),
    telefono: toStr(row.telefono),
    formulario: toStr(row.formulario),
    tipocom: toStr(row.tipocom),
    otro: toStr(row.otro),
    direccion: toStr(row.direccion),
    ubicacion: toStr(row.ubicacion),
    horario: toStr(row.horario),
    'Protocolo de actuación': toBool(row.protocolo_actuacion)
  };
}

export function mapDirectorioRowToJson(row, enlaces = []) {
  const solicitud = [];
  const oficio = [];
  for (const e of enlaces) {
    if (e.tipo_enlace === 'solicitud') solicitud.push(e.url);
    else if (e.tipo_enlace === 'oficio') oficio.push(e.url);
  }
  return {
    id: Number(row.id),
    nombre_institucion: toStr(row.nombre_institucion),
    siglas: toStr(row.siglas),
    sector: toStr(row.sector),
    departamento: toStr(row.departamento),
    correo: toStr(row.correo),
    telefono: toStr(row.telefono),
    direccion: toStr(row.direccion),
    horario_atencion: toStr(row.horario_atencion),
    solicitud_en_linea: toBool(row.solicitud_en_linea),
    informacion_publica_oficio: toBool(row.informacion_publica_oficio),
    sitio_web: toStr(row.sitio_web),
    latitud: Number(row.latitud) || 0,
    longitud: Number(row.longitud) || 0,
    ultima_actualizacion: toStr(row.ultima_actualizacion),
    enlaces_solicitud: solicitud,
    enlaces_oficio: oficio
  };
}

export function mapTableroRowToJson(row) {
  return {
    id: Number(row.id),
    nombre_institucion: toStr(row.nombre_institucion),
    siglas: toStr(row.siglas),
    tipo_dependencia: toStr(row.tipo_dependencia),
    sector: toStr(row.sector),
    link_tablero: toStr(row.link_tablero),
    descripcion: toStr(row.descripcion),
    fecha_actualizacion: toStr(row.fecha_actualizacion),
    estado: toStr(row.estado, 'Disponible')
  };
}

export function mapRiesgoInstRowToJson(row) {
  return {
    id: Number(row.id),
    siglas: toStr(row.siglas),
    nombre: toStr(row.nombre),
    sector: toStr(row.sector),
    estado: toStr(row.estado),
    nivel: toStr(row.nivel),
    checks: {
      identificacion: toBool(row.check_identificacion),
      analisis: toBool(row.check_analisis),
      presentacion: toBool(row.check_presentacion)
    },
    buenasPracticas: toBool(row.buenas_practicas),
    verificacionCGC: toStr(row.verificacion_cgc),
    fechaActualizacion: toStr(row.fecha_actualizacion)
  };
}

export function mapVehiculoRowToJson(row, historyRows = []) {
  return {
    id: Number(row.id),
    plate: toStr(row.plate),
    plateType: toStr(row.plate_type),
    department: toStr(row.department),
    tipoInst: toStr(row.tipo_inst),
    sector: toStr(row.sector),
    authorizedUse: toStr(row.authorized_use),
    brand: toStr(row.brand),
    model: toStr(row.model),
    year: row.year !== null && row.year !== undefined ? Number(row.year) : null,
    color: toStr(row.color),
    status: toStr(row.status, 'Activo'),
    inactiveReason: row.inactive_reason || null,
    lastUpdate: toStr(row.last_update),
    iscvMoroso: toBool(row.iscv_moroso),
    multas: Number(row.multas) || 0,
    history: historyRows.map(h => ({
      date: toStr(h.fecha),
      status: toStr(h.status),
      multas: Number(h.multas) || 0,
      iscvMoroso: toBool(h.iscv_moroso)
    }))
  };
}

export function mapVehiculoInstRowToJson(row, criteriosRows = [], docRows = []) {
  const criterios = {};
  for (const c of criteriosRows) {
    criterios[c.clave_criterio] = {
      label: toStr(c.label),
      cumple: toBool(c.cumple),
      docUrl: c.doc_url || null,
      docNombre: toStr(c.doc_nombre)
    };
  }
  const documentosPublicos = docRows.map(d => ({
    tipo: toStr(d.tipo),
    titulo: toStr(d.titulo),
    url: toStr(d.url)
  }));
  return {
    id: toStr(row.id || row.nombre),
    nombre: toStr(row.nombre),
    siglas: toStr(row.siglas),
    sector: toStr(row.sector),
    criterios,
    documentosPublicos
  };
}

// ============================================================================
// LECTURA DE MÓDULOS Y DOCUMENTOS COMPLETOS EN SQL
// ============================================================================

async function fetchCanalesAll(connOrPool) {
  const [rows] = await connOrPool.execute(
    'SELECT id, institucion, tipo, canales, correo, telefono, formulario, tipocom, otro, direccion, ubicacion, horario, protocolo_actuacion FROM pia_canales_integridad ORDER BY id ASC'
  );
  return rows.map(mapCanalRowToJson);
}

async function fetchDirectorioAll(connOrPool) {
  const [rows] = await connOrPool.execute(
    'SELECT id, nombre_institucion, siglas, sector, departamento, correo, telefono, direccion, horario_atencion, solicitud_en_linea, informacion_publica_oficio, sitio_web, latitud, longitud, ultima_actualizacion FROM pia_directorio_acceso ORDER BY id ASC'
  );
  const [enlacesRows] = await connOrPool.execute(
    'SELECT directorio_id, tipo_enlace, url, orden FROM pia_directorio_enlaces ORDER BY directorio_id ASC, orden ASC, id ASC'
  );
  const enlacesMap = new Map();
  for (const e of enlacesRows) {
    if (!enlacesMap.has(e.directorio_id)) enlacesMap.set(e.directorio_id, []);
    enlacesMap.get(e.directorio_id).push(e);
  }
  return rows.map(r => mapDirectorioRowToJson(r, enlacesMap.get(r.id) || []));
}

async function fetchTablerosAll(connOrPool) {
  const [rows] = await connOrPool.execute(
    'SELECT id, nombre_institucion, siglas, tipo_dependencia, sector, link_tablero, descripcion, fecha_actualizacion, estado FROM pia_tableros_gobierno ORDER BY id ASC'
  );
  return rows.map(mapTableroRowToJson);
}

async function fetchRiesgoAnioAll(connOrPool, anio = '2025') {
  const [rows] = await connOrPool.execute(
    'SELECT id, anio, siglas, nombre, sector, estado, nivel, check_identificacion, check_analisis, check_presentacion, buenas_practicas, verificacion_cgc, fecha_actualizacion FROM pia_riesgo_instituciones WHERE anio = ? ORDER BY id ASC',
    [String(anio)]
  );
  return rows.map(mapRiesgoInstRowToJson);
}

export async function fetchFullRiesgoDocument(connOrPool = null) {
  const db = connOrPool || getSqlPool();
  const [ciclos] = await db.execute(
    'SELECT anio, estado_recoleccion, fecha_actualizacion, ribbon_stats_json FROM pia_riesgo_ciclos ORDER BY anio ASC'
  );
  const [insts] = await db.execute(
    'SELECT id, anio, siglas, nombre, sector, estado, nivel, check_identificacion, check_analisis, check_presentacion, buenas_practicas, verificacion_cgc, fecha_actualizacion FROM pia_riesgo_instituciones ORDER BY anio ASC, id ASC'
  );
  const [frecuentes] = await db.execute(
    'SELECT icono, texto, descripcion_breve, detalle_completo, fuente, categoria FROM pia_riesgo_frecuentes ORDER BY orden ASC, id ASC'
  );

  const years = {};
  for (const c of ciclos) {
    let ribbonStats = [];
    try {
      ribbonStats = c.ribbon_stats_json ? JSON.parse(c.ribbon_stats_json) : [];
    } catch (_) {
      ribbonStats = [];
    }
    years[c.anio] = {
      estadoRecoleccion: toStr(c.estado_recoleccion, 'activo'),
      fechaActualizacion: toStr(c.fecha_actualizacion),
      ribbonStats: Array.isArray(ribbonStats) ? ribbonStats : [],
      instituciones: []
    };
  }

  for (const row of insts) {
    if (!years[row.anio]) {
      years[row.anio] = {
        estadoRecoleccion: 'activo',
        fechaActualizacion: '',
        ribbonStats: [],
        instituciones: []
      };
    }
    years[row.anio].instituciones.push(mapRiesgoInstRowToJson(row));
  }

  const riesgosFrecuentes = frecuentes.map(f => ({
    icono: toStr(f.icono),
    texto: toStr(f.texto),
    descripcionBreve: toStr(f.descripcion_breve),
    detalleCompleto: toStr(f.detalle_completo),
    fuente: toStr(f.fuente),
    categoria: toStr(f.categoria)
  }));

  return { years, riesgosFrecuentes };
}

async function fetchVehiculosInstitucionesAll(connOrPool) {
  const [instRows] = await connOrPool.execute(
    'SELECT id, nombre, siglas, sector FROM pia_vehiculos_instituciones ORDER BY nombre ASC'
  );
  const [critRows] = await connOrPool.execute(
    'SELECT institucion_id, clave_criterio, label, cumple, doc_url, doc_nombre FROM pia_vehiculos_institucion_criterios ORDER BY id ASC'
  );
  const [docRows] = await connOrPool.execute(
    'SELECT institucion_id, tipo, titulo, url, orden FROM pia_vehiculos_institucion_documentos ORDER BY institucion_id ASC, orden ASC, id ASC'
  );

  const critMap = new Map();
  for (const c of critRows) {
    if (!critMap.has(c.institucion_id)) critMap.set(c.institucion_id, []);
    critMap.get(c.institucion_id).push(c);
  }
  const docMap = new Map();
  for (const d of docRows) {
    if (!docMap.has(d.institucion_id)) docMap.set(d.institucion_id, []);
    docMap.get(d.institucion_id).push(d);
  }

  return instRows.map(r => mapVehiculoInstRowToJson(r, critMap.get(r.id) || [], docMap.get(r.id) || []));
}

async function fetchVehiculosAll(connOrPool) {
  const [rows] = await connOrPool.execute(
    'SELECT id, plate, plate_type, department, tipo_inst, sector, authorized_use, brand, model, year, color, status, inactive_reason, last_update, iscv_moroso, multas FROM pia_vehiculos ORDER BY id ASC'
  );
  const [histRows] = await connOrPool.execute(
    'SELECT vehiculo_id, fecha, status, multas, iscv_moroso, orden FROM pia_vehiculos_historial ORDER BY vehiculo_id ASC, orden ASC, id ASC'
  );
  const histMap = new Map();
  for (const h of histRows) {
    if (!histMap.has(h.vehiculo_id)) histMap.set(h.vehiculo_id, []);
    histMap.get(h.vehiculo_id).push(h);
  }
  return rows.map(r => mapVehiculoRowToJson(r, histMap.get(r.id) || []));
}

export async function fetchFullVehiculosDocument(connOrPool = null) {
  const db = connOrPool || getSqlPool();
  const [catalogInstituciones, vehicles] = await Promise.all([
    fetchVehiculosInstitucionesAll(db),
    fetchVehiculosAll(db)
  ]);
  return { catalogInstituciones, vehicles };
}

async function fetchPortalRecords(connOrPool) {
  const [rows] = await connOrPool.execute(
    'SELECT id, oficinas_probidad, canales_denuncia, denuncias_penales, plataformas_activas FROM pia_portal_metricas ORDER BY id ASC LIMIT 1'
  );
  if (!rows || rows.length === 0) {
    return [{
      id: 1,
      oficinasProbidad: 0,
      canalesDenuncia: 0,
      denunciasPenales: 0,
      plataformasActivas: 0
    }];
  }
  const r = rows[0];
  return [{
    id: Number(r.id) || 1,
    oficinasProbidad: Number(r.oficinas_probidad) || 0,
    canalesDenuncia: Number(r.canales_denuncia) || 0,
    denunciasPenales: Number(r.denuncias_penales) || 0,
    plataformasActivas: Number(r.plataformas_activas) || 0
  }];
}

export async function getSqlModuleRecords(moduleName) {
  const pool = getSqlPool();
  const m = String(moduleName || '').trim().toLowerCase();
  const canonical = normalizeModuleKey(m);

  if (m === 'vehiculos_instituciones') {
    const records = await fetchVehiculosInstitucionesAll(pool);
    return { records, etag: computeDatasetHash(records) };
  }

  let records = [];
  if (canonical === 'canales') records = await fetchCanalesAll(pool);
  else if (canonical === 'directorio') records = await fetchDirectorioAll(pool);
  else if (canonical === 'tableros') records = await fetchTablerosAll(pool);
  else if (canonical === 'riesgo') records = await fetchRiesgoAnioAll(pool, '2025');
  else if (canonical === 'vehiculos') records = await fetchVehiculosAll(pool);
  else if (canonical === 'portal') records = await fetchPortalRecords(pool);
  else throw new Error(`Módulo SQL '${moduleName}' no reconocido.`);

  return { records, etag: computeDatasetHash(records) };
}

async function assertSqlEtagMatches(moduleName, expectedHash) {
  const cleanExpected = cleanEtag(expectedHash);
  if (cleanExpected && cleanExpected !== '*' && /^[a-f0-9]{64}$/i.test(cleanExpected)) {
    const { etag } = await getSqlModuleRecords(moduleName);
    if (etag && etag !== cleanExpected) {
      const err = new Error('Conflicto de concurrencia: El registro en SQL fue modificado por otra persona operadora. Recargue los datos.');
      err.code = 'CONCURRENCY_CONFLICT';
      throw err;
    }
  }
}

// ============================================================================
// OPERACIONES TRANSACCIONALES CREATE / UPDATE / DELETE EN SQL
// ============================================================================

async function insertDirectorioEnlaces(conn, directorioId, enlacesSolicitud = [], enlacesOficio = []) {
  if (Array.isArray(enlacesSolicitud)) {
    for (let i = 0; i < enlacesSolicitud.length; i++) {
      const url = toStr(enlacesSolicitud[i]).trim();
      if (url) {
        await conn.execute(
          'INSERT INTO pia_directorio_enlaces (directorio_id, tipo_enlace, url, orden) VALUES (?, ?, ?, ?)',
          [directorioId, 'solicitud', url, i]
        );
      }
    }
  }
  if (Array.isArray(enlacesOficio)) {
    for (let i = 0; i < enlacesOficio.length; i++) {
      const url = toStr(enlacesOficio[i]).trim();
      if (url) {
        await conn.execute(
          'INSERT INTO pia_directorio_enlaces (directorio_id, tipo_enlace, url, orden) VALUES (?, ?, ?, ?)',
          [directorioId, 'oficio', url, i]
        );
      }
    }
  }
}

async function insertVehiculoChildren(conn, vehiculoId, history = []) {
  if (!Array.isArray(history)) return;
  for (let i = 0; i < history.length; i++) {
    const h = history[i] || {};
    await conn.execute(
      'INSERT INTO pia_vehiculos_historial (vehiculo_id, fecha, status, multas, iscv_moroso, orden) VALUES (?, ?, ?, ?, ?, ?)',
      [vehiculoId, toStr(h.date), toStr(h.status, 'Activo'), toInt(h.multas, 0), toBool(h.iscvMoroso) ? 1 : 0, i]
    );
  }
}

async function insertVehiculoInstChildren(conn, instId, criterios = {}, documentosPublicos = []) {
  if (criterios && typeof criterios === 'object') {
    for (const [clave, val] of Object.entries(criterios)) {
      if (!val || typeof val !== 'object') continue;
      await conn.execute(
        'INSERT INTO pia_vehiculos_institucion_criterios (institucion_id, clave_criterio, label, cumple, doc_url, doc_nombre) VALUES (?, ?, ?, ?, ?, ?)',
        [instId, clave, toStr(val.label), toBool(val.cumple) ? 1 : 0, toNullableStr(val.docUrl), toStr(val.docNombre)]
      );
    }
  }
  if (Array.isArray(documentosPublicos)) {
    for (let i = 0; i < documentosPublicos.length; i++) {
      const doc = documentosPublicos[i] || {};
      await conn.execute(
        'INSERT INTO pia_vehiculos_institucion_documentos (institucion_id, tipo, titulo, url, orden) VALUES (?, ?, ?, ?, ?)',
        [instId, toStr(doc.tipo), toStr(doc.titulo), toStr(doc.url), i]
      );
    }
  }
}

export async function createSqlModuleRecord(moduleName, payload, expectedHash = null) {
  await assertSqlEtagMatches(moduleName, expectedHash);
  const m = String(moduleName || '').trim().toLowerCase();
  const canonical = normalizeModuleKey(m);

  const createdRecord = await withTransaction(async (conn) => {
    if (canonical === 'canales') {
      const body = { ...payload };
      const canalesCount = computeCanalesCount(body);
      const protocolo = toBool(body['Protocolo de actuación']) ? 1 : 0;
      const [res] = await conn.execute(
        `INSERT INTO pia_canales_integridad
          (institucion, tipo, canales, correo, telefono, formulario, tipocom, otro, direccion, ubicacion, horario, protocolo_actuacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          toStr(body.institucion),
          toStr(body.tipo),
          canalesCount,
          toStr(body.correo),
          toStr(body.telefono),
          toStr(body.formulario),
          toStr(body.tipocom),
          toStr(body.otro),
          toStr(body.direccion),
          toStr(body.ubicacion),
          toStr(body.horario),
          protocolo
        ]
      );
      const [rows] = await conn.execute('SELECT * FROM pia_canales_integridad WHERE id = ?', [res.insertId]);
      return mapCanalRowToJson(rows[0]);
    }

    if (canonical === 'directorio') {
      const body = payload || {};
      const [res] = await conn.execute(
        `INSERT INTO pia_directorio_acceso
          (nombre_institucion, siglas, sector, departamento, correo, telefono, direccion, horario_atencion, solicitud_en_linea, informacion_publica_oficio, sitio_web, latitud, longitud, ultima_actualizacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          toStr(body.nombre_institucion),
          toStr(body.siglas),
          toStr(body.sector),
          toStr(body.departamento),
          toStr(body.correo),
          toStr(body.telefono),
          toStr(body.direccion),
          toStr(body.horario_atencion),
          toBool(body.solicitud_en_linea) ? 1 : 0,
          toBool(body.informacion_publica_oficio) ? 1 : 0,
          toStr(body.sitio_web),
          toFloat(body.latitud, 0),
          toFloat(body.longitud, 0),
          toStr(body.ultima_actualizacion, new Date().toISOString().slice(0, 10))
        ]
      );
      await insertDirectorioEnlaces(conn, res.insertId, body.enlaces_solicitud, body.enlaces_oficio);
      const [rows] = await conn.execute('SELECT * FROM pia_directorio_acceso WHERE id = ?', [res.insertId]);
      const [enlaces] = await conn.execute(
        'SELECT directorio_id, tipo_enlace, url, orden FROM pia_directorio_enlaces WHERE directorio_id = ? ORDER BY orden ASC',
        [res.insertId]
      );
      return mapDirectorioRowToJson(rows[0], enlaces);
    }

    if (canonical === 'tableros') {
      const body = payload || {};
      const [res] = await conn.execute(
        `INSERT INTO pia_tableros_gobierno
          (nombre_institucion, siglas, tipo_dependencia, sector, link_tablero, descripcion, fecha_actualizacion, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          toStr(body.nombre_institucion),
          toStr(body.siglas),
          toStr(body.tipo_dependencia),
          toStr(body.sector),
          toStr(body.link_tablero),
          toStr(body.descripcion),
          toStr(body.fecha_actualizacion, String(new Date().getFullYear())),
          toStr(body.estado, 'Disponible')
        ]
      );
      const [rows] = await conn.execute('SELECT * FROM pia_tableros_gobierno WHERE id = ?', [res.insertId]);
      return mapTableroRowToJson(rows[0]);
    }

    if (canonical === 'riesgo') {
      const body = payload || {};
      const anio = toStr(body.anio, '2025');
      await conn.execute(
        'INSERT IGNORE INTO pia_riesgo_ciclos (anio, estado_recoleccion, fecha_actualizacion, ribbon_stats_json) VALUES (?, ?, ?, ?)',
        [anio, 'activo', new Date().toISOString().slice(0, 10), '[]']
      );
      const [maxRows] = await conn.execute(
        'SELECT COALESCE(MAX(id), 0) AS maxId FROM pia_riesgo_instituciones WHERE anio = ?',
        [anio]
      );
      const nextId = Number(body.id) || (Number(maxRows[0]?.maxId || 0) + 1);
      const checks = body.checks || {};
      await conn.execute(
        `INSERT INTO pia_riesgo_instituciones
          (id, anio, siglas, nombre, sector, estado, nivel, check_identificacion, check_analisis, check_presentacion, buenas_practicas, verificacion_cgc, fecha_actualizacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nextId,
          anio,
          toStr(body.siglas),
          toStr(body.nombre),
          toStr(body.sector),
          toStr(body.estado, 'en_proceso'),
          toStr(body.nivel, 'Inicial'),
          toBool(checks.identificacion) ? 1 : 0,
          toBool(checks.analisis) ? 1 : 0,
          toBool(checks.presentacion) ? 1 : 0,
          toBool(body.buenasPracticas) ? 1 : 0,
          toStr(body.verificacionCGC),
          toStr(body.fechaActualizacion, new Date().toISOString().slice(0, 10))
        ]
      );
      const [rows] = await conn.execute(
        'SELECT * FROM pia_riesgo_instituciones WHERE anio = ? AND id = ?',
        [anio, nextId]
      );
      return mapRiesgoInstRowToJson(rows[0]);
    }

    if (m === 'vehiculos_instituciones') {
      const body = payload || {};
      const instId = toStr(body.id || body.nombre).trim();
      if (!instId) throw new Error('El identificador o nombre de la institución es obligatorio.');
      await conn.execute(
        'INSERT INTO pia_vehiculos_instituciones (id, nombre, siglas, sector) VALUES (?, ?, ?, ?)',
        [instId, toStr(body.nombre, instId), toStr(body.siglas), toStr(body.sector)]
      );
      await insertVehiculoInstChildren(conn, instId, body.criterios, body.documentosPublicos);
      const list = await fetchVehiculosInstitucionesAll(conn);
      return list.find(x => x.id === instId);
    }

    if (canonical === 'vehiculos') {
      const body = payload || {};
      const [res] = await conn.execute(
        `INSERT INTO pia_vehiculos
          (plate, plate_type, department, tipo_inst, sector, authorized_use, brand, model, year, color, status, inactive_reason, last_update, iscv_moroso, multas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          toStr(body.plate),
          toStr(body.plateType),
          toStr(body.department),
          toStr(body.tipoInst),
          toStr(body.sector),
          toStr(body.authorizedUse),
          toStr(body.brand),
          toStr(body.model),
          body.year !== undefined && body.year !== null && body.year !== '' ? toInt(body.year) : null,
          toStr(body.color),
          toStr(body.status, 'Activo'),
          toNullableStr(body.inactiveReason),
          toStr(body.lastUpdate, new Date().toISOString()),
          toBool(body.iscvMoroso) ? 1 : 0,
          toInt(body.multas, 0)
        ]
      );
      await insertVehiculoChildren(conn, res.insertId, body.history);
      const list = await fetchVehiculosAll(conn);
      return list.find(x => x.id === res.insertId);
    }

    if (canonical === 'portal') {
      const body = payload || {};
      await conn.execute(
        `INSERT INTO pia_portal_metricas (id, oficinas_probidad, canales_denuncia, denuncias_penales, plataformas_activas)
         VALUES (1, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           oficinas_probidad = VALUES(oficinas_probidad),
           canales_denuncia = VALUES(canales_denuncia),
           denuncias_penales = VALUES(denuncias_penales),
           plataformas_activas = VALUES(plataformas_activas)`,
        [
          toInt(body.oficinasProbidad, 0),
          toInt(body.canalesDenuncia, 0),
          toInt(body.denunciasPenales, 0),
          toInt(body.plataformasActivas, 0)
        ]
      );
      const rows = await fetchPortalRecords(conn);
      return rows[0];
    }

    throw new Error(`Módulo SQL '${moduleName}' no soportado para creación.`);
  });

  const { etag } = await getSqlModuleRecords(moduleName);
  return { record: createdRecord, newHash: etag };
}

export async function updateSqlModuleRecord(moduleName, id, payload, expectedHash = null) {
  await assertSqlEtagMatches(moduleName, expectedHash);
  const m = String(moduleName || '').trim().toLowerCase();
  const canonical = normalizeModuleKey(m);

  const updatedRecord = await withTransaction(async (conn) => {
    if (canonical === 'canales') {
      const numId = toInt(id);
      const [existing] = await conn.execute('SELECT * FROM pia_canales_integridad WHERE id = ?', [numId]);
      if (!existing || existing.length === 0) return null;
      const merged = { ...mapCanalRowToJson(existing[0]), ...payload, id: numId };
      merged.canales = computeCanalesCount(merged);
      await conn.execute(
        `UPDATE pia_canales_integridad SET
          institucion = ?, tipo = ?, canales = ?, correo = ?, telefono = ?, formulario = ?,
          tipocom = ?, otro = ?, direccion = ?, ubicacion = ?, horario = ?, protocolo_actuacion = ?
         WHERE id = ?`,
        [
          toStr(merged.institucion),
          toStr(merged.tipo),
          merged.canales,
          toStr(merged.correo),
          toStr(merged.telefono),
          toStr(merged.formulario),
          toStr(merged.tipocom),
          toStr(merged.otro),
          toStr(merged.direccion),
          toStr(merged.ubicacion),
          toStr(merged.horario),
          toBool(merged['Protocolo de actuación']) ? 1 : 0,
          numId
        ]
      );
      const [rows] = await conn.execute('SELECT * FROM pia_canales_integridad WHERE id = ?', [numId]);
      return mapCanalRowToJson(rows[0]);
    }

    if (canonical === 'directorio') {
      const numId = toInt(id);
      const [existing] = await conn.execute('SELECT * FROM pia_directorio_acceso WHERE id = ?', [numId]);
      if (!existing || existing.length === 0) return null;
      const [oldEnlaces] = await conn.execute(
        'SELECT directorio_id, tipo_enlace, url, orden FROM pia_directorio_enlaces WHERE directorio_id = ? ORDER BY orden ASC',
        [numId]
      );
      const merged = { ...mapDirectorioRowToJson(existing[0], oldEnlaces), ...payload, id: numId };
      await conn.execute(
        `UPDATE pia_directorio_acceso SET
          nombre_institucion = ?, siglas = ?, sector = ?, departamento = ?, correo = ?, telefono = ?,
          direccion = ?, horario_atencion = ?, solicitud_en_linea = ?, informacion_publica_oficio = ?,
          sitio_web = ?, latitud = ?, longitud = ?, ultima_actualizacion = ?
         WHERE id = ?`,
        [
          toStr(merged.nombre_institucion),
          toStr(merged.siglas),
          toStr(merged.sector),
          toStr(merged.departamento),
          toStr(merged.correo),
          toStr(merged.telefono),
          toStr(merged.direccion),
          toStr(merged.horario_atencion),
          toBool(merged.solicitud_en_linea) ? 1 : 0,
          toBool(merged.informacion_publica_oficio) ? 1 : 0,
          toStr(merged.sitio_web),
          toFloat(merged.latitud, 0),
          toFloat(merged.longitud, 0),
          toStr(merged.ultima_actualizacion),
          numId
        ]
      );
      await conn.execute('DELETE FROM pia_directorio_enlaces WHERE directorio_id = ?', [numId]);
      await insertDirectorioEnlaces(conn, numId, merged.enlaces_solicitud, merged.enlaces_oficio);
      const [rows] = await conn.execute('SELECT * FROM pia_directorio_acceso WHERE id = ?', [numId]);
      const [newEnlaces] = await conn.execute(
        'SELECT directorio_id, tipo_enlace, url, orden FROM pia_directorio_enlaces WHERE directorio_id = ? ORDER BY orden ASC',
        [numId]
      );
      return mapDirectorioRowToJson(rows[0], newEnlaces);
    }

    if (canonical === 'tableros') {
      const numId = toInt(id);
      const [existing] = await conn.execute('SELECT * FROM pia_tableros_gobierno WHERE id = ?', [numId]);
      if (!existing || existing.length === 0) return null;
      const merged = { ...mapTableroRowToJson(existing[0]), ...payload, id: numId };
      await conn.execute(
        `UPDATE pia_tableros_gobierno SET
          nombre_institucion = ?, siglas = ?, tipo_dependencia = ?, sector = ?, link_tablero = ?,
          descripcion = ?, fecha_actualizacion = ?, estado = ?
         WHERE id = ?`,
        [
          toStr(merged.nombre_institucion),
          toStr(merged.siglas),
          toStr(merged.tipo_dependencia),
          toStr(merged.sector),
          toStr(merged.link_tablero),
          toStr(merged.descripcion),
          toStr(merged.fecha_actualizacion),
          toStr(merged.estado, 'Disponible'),
          numId
        ]
      );
      const [rows] = await conn.execute('SELECT * FROM pia_tableros_gobierno WHERE id = ?', [numId]);
      return mapTableroRowToJson(rows[0]);
    }

    if (canonical === 'riesgo') {
      const numId = toInt(id);
      const anio = toStr(payload?.anio, '2025');
      const [existing] = await conn.execute(
        'SELECT * FROM pia_riesgo_instituciones WHERE anio = ? AND id = ?',
        [anio, numId]
      );
      if (!existing || existing.length === 0) return null;
      const current = mapRiesgoInstRowToJson(existing[0]);
      const merged = {
        ...current,
        ...payload,
        id: numId,
        checks: { ...current.checks, ...(payload?.checks || {}) }
      };
      await conn.execute(
        `UPDATE pia_riesgo_instituciones SET
          siglas = ?, nombre = ?, sector = ?, estado = ?, nivel = ?,
          check_identificacion = ?, check_analisis = ?, check_presentacion = ?,
          buenas_practicas = ?, verificacion_cgc = ?, fecha_actualizacion = ?
         WHERE anio = ? AND id = ?`,
        [
          toStr(merged.siglas),
          toStr(merged.nombre),
          toStr(merged.sector),
          toStr(merged.estado),
          toStr(merged.nivel),
          toBool(merged.checks.identificacion) ? 1 : 0,
          toBool(merged.checks.analisis) ? 1 : 0,
          toBool(merged.checks.presentacion) ? 1 : 0,
          toBool(merged.buenasPracticas) ? 1 : 0,
          toStr(merged.verificacionCGC),
          toStr(merged.fechaActualizacion),
          anio,
          numId
        ]
      );
      const [rows] = await conn.execute(
        'SELECT * FROM pia_riesgo_instituciones WHERE anio = ? AND id = ?',
        [anio, numId]
      );
      return mapRiesgoInstRowToJson(rows[0]);
    }

    if (m === 'vehiculos_instituciones') {
      const strId = String(id);
      const [existing] = await conn.execute(
        'SELECT * FROM pia_vehiculos_instituciones WHERE id = ? OR nombre = ? LIMIT 1',
        [strId, strId]
      );
      if (!existing || existing.length === 0) return null;
      const realId = existing[0].id;
      const all = await fetchVehiculosInstitucionesAll(conn);
      const current = all.find(x => x.id === realId);
      const merged = { ...current, ...payload, id: realId };
      await conn.execute(
        'UPDATE pia_vehiculos_instituciones SET nombre = ?, siglas = ?, sector = ? WHERE id = ?',
        [toStr(merged.nombre), toStr(merged.siglas), toStr(merged.sector), realId]
      );
      if (payload.criterios !== undefined || payload.documentosPublicos !== undefined) {
        await conn.execute('DELETE FROM pia_vehiculos_institucion_criterios WHERE institucion_id = ?', [realId]);
        await conn.execute('DELETE FROM pia_vehiculos_institucion_documentos WHERE institucion_id = ?', [realId]);
        await insertVehiculoInstChildren(conn, realId, merged.criterios, merged.documentosPublicos);
      }
      const after = await fetchVehiculosInstitucionesAll(conn);
      return after.find(x => x.id === realId);
    }

    if (canonical === 'vehiculos') {
      const numId = toInt(id);
      const [existing] = await conn.execute('SELECT * FROM pia_vehiculos WHERE id = ?', [numId]);
      if (!existing || existing.length === 0) return null;
      const [hist] = await conn.execute(
        'SELECT vehiculo_id, fecha, status, multas, iscv_moroso, orden FROM pia_vehiculos_historial WHERE vehiculo_id = ? ORDER BY orden ASC',
        [numId]
      );
      const merged = { ...mapVehiculoRowToJson(existing[0], hist), ...payload, id: numId };
      await conn.execute(
        `UPDATE pia_vehiculos SET
          plate = ?, plate_type = ?, department = ?, tipo_inst = ?, sector = ?, authorized_use = ?,
          brand = ?, model = ?, year = ?, color = ?, status = ?, inactive_reason = ?,
          last_update = ?, iscv_moroso = ?, multas = ?
         WHERE id = ?`,
        [
          toStr(merged.plate),
          toStr(merged.plateType),
          toStr(merged.department),
          toStr(merged.tipoInst),
          toStr(merged.sector),
          toStr(merged.authorizedUse),
          toStr(merged.brand),
          toStr(merged.model),
          merged.year !== undefined && merged.year !== null && merged.year !== '' ? toInt(merged.year) : null,
          toStr(merged.color),
          toStr(merged.status, 'Activo'),
          toNullableStr(merged.inactiveReason),
          toStr(merged.lastUpdate),
          toBool(merged.iscvMoroso) ? 1 : 0,
          toInt(merged.multas, 0),
          numId
        ]
      );
      if (Array.isArray(payload.history)) {
        await conn.execute('DELETE FROM pia_vehiculos_historial WHERE vehiculo_id = ?', [numId]);
        await insertVehiculoChildren(conn, numId, merged.history);
      }
      const list = await fetchVehiculosAll(conn);
      return list.find(x => x.id === numId);
    }

    if (canonical === 'portal') {
      const currentList = await fetchPortalRecords(conn);
      const current = currentList[0];
      const merged = { ...current, ...payload, id: 1 };
      await conn.execute(
        `INSERT INTO pia_portal_metricas (id, oficinas_probidad, canales_denuncia, denuncias_penales, plataformas_activas)
         VALUES (1, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           oficinas_probidad = VALUES(oficinas_probidad),
           canales_denuncia = VALUES(canales_denuncia),
           denuncias_penales = VALUES(denuncias_penales),
           plataformas_activas = VALUES(plataformas_activas)`,
        [
          toInt(merged.oficinasProbidad, 0),
          toInt(merged.canalesDenuncia, 0),
          toInt(merged.denunciasPenales, 0),
          toInt(merged.plataformasActivas, 0)
        ]
      );
      const rows = await fetchPortalRecords(conn);
      return rows[0];
    }

    return null;
  });

  if (!updatedRecord) return null;
  const { etag } = await getSqlModuleRecords(moduleName);
  return { record: updatedRecord, newHash: etag };
}

export async function deleteSqlModuleRecord(moduleName, id, expectedHash = null) {
  await assertSqlEtagMatches(moduleName, expectedHash);
  const m = String(moduleName || '').trim().toLowerCase();
  const canonical = normalizeModuleKey(m);

  const deleted = await withTransaction(async (conn) => {
    if (canonical === 'canales') {
      const [res] = await conn.execute('DELETE FROM pia_canales_integridad WHERE id = ?', [toInt(id)]);
      return res.affectedRows > 0;
    }
    if (canonical === 'directorio') {
      const [res] = await conn.execute('DELETE FROM pia_directorio_acceso WHERE id = ?', [toInt(id)]);
      return res.affectedRows > 0;
    }
    if (canonical === 'tableros') {
      const [res] = await conn.execute('DELETE FROM pia_tableros_gobierno WHERE id = ?', [toInt(id)]);
      return res.affectedRows > 0;
    }
    if (canonical === 'riesgo') {
      const [res] = await conn.execute(
        'DELETE FROM pia_riesgo_instituciones WHERE anio = ? AND id = ?',
        ['2025', toInt(id)]
      );
      return res.affectedRows > 0;
    }
    if (m === 'vehiculos_instituciones') {
      const [res] = await conn.execute(
        'DELETE FROM pia_vehiculos_instituciones WHERE id = ? OR nombre = ?',
        [String(id), String(id)]
      );
      return res.affectedRows > 0;
    }
    if (canonical === 'vehiculos') {
      const [res] = await conn.execute('DELETE FROM pia_vehiculos WHERE id = ?', [toInt(id)]);
      return res.affectedRows > 0;
    }
    return false;
  });

  if (!deleted) return null;
  const { etag } = await getSqlModuleRecords(moduleName);
  return { deleted: true, newHash: etag };
}
