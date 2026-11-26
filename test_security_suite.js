// test_security_suite.js - Batería de Pruebas Automatizadas de Seguridad y Regresión Institucional
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_URL = 'http://127.0.0.1:3000';

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, details = '') {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    console.log(`  ✅ [PASSED] ${name}`);
  } else {
    results.failed++;
    console.error(`  ❌ [FAILED] ${name}: ${details}`);
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log(' INICIANDO BATERÍA DE PRUEBAS DE SEGURIDAD Y REGRESIÓN PIA');
  console.log('=============================================================\n');

  // Test 1: Rechazo de operaciones administrativas mutativas sin token
  try {
    const resPostModule = await fetch(`${BASE_URL}/api/canales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Test Inseguro' })
    });
    recordTest('1.1 Rechazo de POST /api/canales sin autenticación (401)', resPostModule.status === 401);

    const resPutModule = await fetch(`${BASE_URL}/api/canales/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Modificación no autorizada' })
    });
    recordTest('1.2 Rechazo de PUT /api/canales/1 sin autenticación (401)', resPutModule.status === 401);

    const resDeleteModule = await fetch(`${BASE_URL}/api/canales/1`, {
      method: 'DELETE'
    });
    recordTest('1.3 Rechazo de DELETE /api/canales/1 sin autenticación (401)', resDeleteModule.status === 401);

    const resRawJson = await fetch(`${BASE_URL}/api/raw-json?path=canales`);
    recordTest('1.4 Rechazo de GET /api/raw-json sin autenticación (401)', resRawJson.status === 401);

    const resPostRawJson = await fetch(`${BASE_URL}/api/raw-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'canales', data: [] })
    });
    recordTest('1.5 Rechazo de POST /api/raw-json sin autenticación (401)', resPostRawJson.status === 401);

    const resUsers = await fetch(`${BASE_URL}/api/users`);
    recordTest('1.6 Rechazo de GET /api/users sin autenticación (401)', resUsers.status === 401);

    const resAudit = await fetch(`${BASE_URL}/api/audit`);
    recordTest('1.7 Rechazo de GET /api/audit sin autenticación (401)', resAudit.status === 401);
  } catch (err) {
    recordTest('1. Pruebas sin autenticación', false, err.message);
  }

  // Test 2: Rechazo de tokens inválidos o malformados
  try {
    const resBadToken = await fetch(`${BASE_URL}/api/canales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token-falso-invalido-123'
      },
      body: JSON.stringify({ institucion: 'Hack' })
    });
    recordTest('2.1 Rechazo de Bearer token aleatorio / falso (401)', resBadToken.status === 401);
  } catch (err) {
    recordTest('2. Rechazo de tokens falsos', false, err.message);
  }

  // Test 3: Verificación de eliminación total de contraseñas maestras y tokens bypass
  try {
    const resBackdoorToken = await fetch(`${BASE_URL}/api/canales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer pia-admin-valid-token-detector25'
      },
      body: JSON.stringify({ institucion: 'Bypass' })
    });
    recordTest('3.1 Token backdoor pia-admin-valid-token-detector25 bloqueado (401)', resBackdoorToken.status === 401);

    // Intentar endpoint de login legacy si quedara alguno
    const resLegacyLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    recordTest('3.2 Credenciales maestras admin123 no admitidas (404 o 401)', resLegacyLogin.status === 404 || resLegacyLogin.status === 401);
  } catch (err) {
    recordTest('3. Eliminación de backdoors', false, err.message);
  }

  // Test 4: Bloqueo estricto de Path Traversal en archivos JSON
  try {
    // Intentar acceder a un archivo arbitrario con token falso (debe rebotar en 401 o 403)
    const resPathTraversal = await fetch(`${BASE_URL}/api/raw-json?path=../../etc/passwd`);
    recordTest('4.1 Path Traversal bloqueado en raw-json (401 o 403)', resPathTraversal.status === 401 || resPathTraversal.status === 403);
  } catch (err) {
    recordTest('4. Path Traversal bloqueado', false, err.message);
  }

  // Test 5: Protección de configuración y conocimiento del Asistente Lupita
  try {
    const resKbPost = await fetch(`${BASE_URL}/api/chatbot/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hack', content: 'Inyección no autorizada' })
    });
    recordTest('5.1 Bloqueo de adición de conocimiento sin credenciales (401)', resKbPost.status === 401);

    const resKbDelete = await fetch(`${BASE_URL}/api/chatbot/knowledge/kb_1`, {
      method: 'DELETE'
    });
    recordTest('5.2 Bloqueo de eliminación de conocimiento sin credenciales (401)', resKbDelete.status === 401);

    const resSettingsPut = await fetch(`${BASE_URL}/api/chatbot/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false })
    });
    recordTest('5.3 Bloqueo de alteración de configuración de IA sin credenciales (401)', resSettingsPut.status === 401);
  } catch (err) {
    recordTest('5. Protección del Asistente Lupita', false, err.message);
  }

  // Test 6: Funcionamiento del Asistente Público Lupita y Fallback
  try {
    const resChat = await fetch(`${BASE_URL}/api/chatbot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '¿Cómo presento una denuncia por corrupción?' })
    });
    const chatData = await resChat.json();
    const chatPassed = resChat.status === 200 && chatData.text && chatData.text.length > 20;
    recordTest('6.1 Consulta ciudadana a Lupita responde con información oficial', chatPassed, chatPassed ? '' : JSON.stringify(chatData));

    const resConfig = await fetch(`${BASE_URL}/api/chatbot/config`);
    const configData = await resConfig.json();
    recordTest('6.2 Endpoint público de configuración de Lupita activo', resConfig.status === 200 && Array.isArray(configData.faqs));
  } catch (err) {
    recordTest('6. Asistente Lupita público', false, err.message);
  }

  // Test 7: Verificación de persistencia, copias de respaldo y escrituras atómicas
  try {
    const backupsDir = path.join(process.cwd(), 'data', 'backups');
    const backupsExist = fs.existsSync(backupsDir);
    recordTest('7.1 Carpeta de respaldos automáticos /data/backups/ inicializada', backupsExist);

    const usersRolesFile = path.join(process.cwd(), 'data', 'users_roles.json');
    const rolesFileExist = fs.existsSync(usersRolesFile);
    recordTest('7.2 Archivo protegido /data/users_roles.json inicializado fuera de wwwroot', rolesFileExist);
  } catch (err) {
    recordTest('7. Persistencia y respaldos', false, err.message);
  }

  // Test 8: Módulos públicos existentes responden correctamente
  try {
    const resCanales = await fetch(`${BASE_URL}/api/canales`);
    const dataCanales = await resCanales.json();
    recordTest('8.1 Lectura pública de /api/canales (200 OK con registros)', resCanales.status === 200 && Array.isArray(dataCanales) && dataCanales.length > 0);

    const resDirectorio = await fetch(`${BASE_URL}/api/directorio`);
    const dataDirectorio = await resDirectorio.json();
    recordTest('8.2 Lectura pública de /api/directorio (200 OK con registros)', resDirectorio.status === 200 && Array.isArray(dataDirectorio) && dataDirectorio.length > 0);

    const resTableros = await fetch(`${BASE_URL}/api/tableros`);
    const dataTableros = await resTableros.json();
    recordTest('8.3 Lectura pública de /api/tableros (200 OK con registros)', resTableros.status === 200 && Array.isArray(dataTableros) && dataTableros.length > 0);

    const resRiesgo = await fetch(`${BASE_URL}/api/riesgo`);
    const dataRiesgo = await resRiesgo.json();
    recordTest('8.4 Lectura pública de /api/riesgo (200 OK con registros)', resRiesgo.status === 200 && Array.isArray(dataRiesgo) && dataRiesgo.length > 0);

    const resVehiculos = await fetch(`${BASE_URL}/api/vehiculos`);
    const dataVehiculos = await resVehiculos.json();
    recordTest('8.5 Lectura pública de /api/vehiculos (200 OK con registros)', resVehiculos.status === 200 && Array.isArray(dataVehiculos) && dataVehiculos.length > 0);
  } catch (err) {
    recordTest('8. Módulos públicos', false, err.message);
  }

  // Test 9: Ausencia de secretos y configuración institucional en frontend
  try {
    const resEntraConfig = await fetch(`${BASE_URL}/api/auth/entra-config`);
    const entraConfig = await resEntraConfig.json();
    const noSecretExposed = !entraConfig.clientSecret && !entraConfig.secret && !entraConfig.GEMINI_API_KEY;
    recordTest('9.1 Ningún secreto o clave privada expuesta en endpoint /api/auth/entra-config', noSecretExposed);
  } catch (err) {
    recordTest('9. Protección de secretos', false, err.message);
  }

  // Test 10: Gestión dinámica de usuarios, encriptación PBKDF2 y protección de cuentas base
  try {
    const resLoginAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const adminData = await resLoginAdmin.json();
    const adminToken = adminData.token;

    // 10.1 Crear nuevo usuario dinámico
    const testEmail = 'auditoria_ci@cnc.gob.gt';
    const resCreateUser = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        email: testEmail,
        displayName: 'Auditoría Control Interno CNC',
        role: 'data_operator',
        permissions: ['directorio', 'canales'],
        password: 'ControlInterno2026!'
      })
    });
    recordTest('10.1 Creación de nuevo usuario con permisos y encriptación (201 Created)', resCreateUser.status === 201);

    // 10.2 Autenticación con el nuevo usuario
    const resLoginNewUser = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'ControlInterno2026!' })
    });
    const newUserData = await resLoginNewUser.json();
    recordTest('10.2 Autenticación del nuevo usuario con contraseña encriptada (200 OK)', resLoginNewUser.status === 200 && newUserData.user && newUserData.user.email === testEmail);

    // 10.3 Protección de cuentas base seed contra eliminación
    const resDeleteSeed = await fetch(`${BASE_URL}/api/admin/users/apoyogi@cnc.gob.gt`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    recordTest('10.3 Bloqueo de eliminación de cuentas base institucionales protegidas (403 Forbidden)', resDeleteSeed.status === 403);

    // 10.4 Eliminación del usuario creado
    const resDeleteNew = await fetch(`${BASE_URL}/api/admin/users/${testEmail}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    recordTest('10.4 Eliminación autorizada de usuario creado (200 OK)', resDeleteNew.status === 200);
  } catch (err) {
    recordTest('10. Gestión dinámica de usuarios y permisos', false, err.message);
  }

  // Test 11: Arquitectura Híbrida JSON + SQL, Seguridad de Endpoints y Mappers
  try {
    // 11.1 Bloqueo sin autenticación en endpoints de almacenamiento
    const resStorageNoAuth = await fetch(`${BASE_URL}/api/admin/storage/status`);
    recordTest('11.1 Bloqueo de GET /api/admin/storage/status sin autenticación (401)', resStorageNoAuth.status === 401);

    const resInitNoAuth = await fetch(`${BASE_URL}/api/admin/storage/sql/init`, { method: 'POST' });
    recordTest('11.2 Bloqueo de POST /api/admin/storage/sql/init sin autenticación (401)', resInitNoAuth.status === 401);

    const resLoginAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const { token: adminToken } = await resLoginAdmin.json();

    // 11.3 Consulta autorizada de estado de almacenamiento (sin exposición de credenciales SQL)
    const resStatus = await fetch(`${BASE_URL}/api/admin/storage/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const statusData = await resStatus.json();
    const rawStatusStr = JSON.stringify(statusData);
    const hasNoSecrets = !rawStatusStr.includes('MYSQL_PASSWORD') && !statusData?.schema?.connection?.password;
    const validStructure = resStatus.status === 200 &&
      statusData?.config?.mode === 'json' &&
      Array.isArray(statusData?.modules) && statusData.modules.length === 6 &&
      Array.isArray(statusData?.schema?.tables) && statusData.schema.tables.length === 18 &&
      hasNoSecrets;
    recordTest('11.3 Consulta autorizada de /api/admin/storage/status sin credenciales expuestas (200 OK)', validStructure);

    // 11.4 Control de permisos: operador sin permiso 'database' recibe 403 Forbidden
    const limitedEmail = 'operador_limitado_sql@cnc.gob.gt';
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        email: limitedEmail,
        displayName: 'Operador Limitado Test',
        role: 'data_operator',
        modules: ['canales'],
        password: 'TestSqlPermiso2026!'
      })
    });
    const resLoginLimited = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: limitedEmail, password: 'TestSqlPermiso2026!' })
    });
    const { token: limitedToken } = await resLoginLimited.json();

    const resStorageForbidden = await fetch(`${BASE_URL}/api/admin/storage/status`, {
      headers: { 'Authorization': `Bearer ${limitedToken}` }
    });
    recordTest('11.4 Bloqueo a operador sin permiso database en /api/admin/storage/status (403)', resStorageForbidden.status === 403);

    await fetch(`${BASE_URL}/api/admin/users/${limitedEmail}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    // 11.5 Rechazo controlado de modo SQL cuando no hay servidor MySQL activo + raw-json autorizado vs traversal
    const resEnableSqlWithoutDb = await fetch(`${BASE_URL}/api/admin/storage/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ mode: 'sql' })
    });
    recordTest('11.5 Rechazo controlado al activar modo SQL sin tablas/conexión activa (400)', resEnableSqlWithoutDb.status === 400);

    const resRawOk = await fetch(`${BASE_URL}/api/raw-json?path=${encodeURIComponent('/data_portal.json')}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const resRawTraversal = await fetch(`${BASE_URL}/api/raw-json?path=${encodeURIComponent('../../package.json')}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    recordTest('11.6 Editor JSON autorizado funciona en lista blanca (200) y bloquea traversal (403)', resRawOk.status === 200 && resRawTraversal.status === 403);

    // 11.7 Validación de DDL SQL y mappers fieles a los archivos JSON reales
    const { parseSchemaStatements } = await import('./db/schemaInit.js');
    const { mapCanalRowToJson, mapDirectorioRowToJson, mapRiesgoInstRowToJson, mapVehiculoRowToJson } = await import('./db/sqlRepository.js');
    const sqlRaw = fs.readFileSync(path.join(process.cwd(), 'sql', '01_schema_mysql.sql'), 'utf8');
    const stmts = parseSchemaStatements(sqlRaw);

    const canalMapped = mapCanalRowToJson({
      id: 1, institucion: 'MAGA', tipo: 'Ministerios', canales: 4,
      correo: 'a@maga.gob.gt', telefono: '2354-4125', formulario: 'https://x',
      tipocom: 'Escrita', otro: '', direccion: 'Z13', ubicacion: 'Z13', horario: '8-16',
      protocolo_actuacion: 1
    });
    const dirMapped = mapDirectorioRowToJson(
      { id: 1, nombre_institucion: 'VICE', siglas: 'VICE', solicitud_en_linea: 1, informacion_publica_oficio: 1, latitud: 14.6, longitud: -90.5 },
      [{ tipo_enlace: 'solicitud', url: 'https://s1' }, { tipo_enlace: 'oficio', url: 'https://o1' }]
    );
    const riesgoMapped = mapRiesgoInstRowToJson({
      id: 1, siglas: 'MAGA', nombre: 'MAGA', sector: 'Ministerios', estado: 'cumple', nivel: 'Avanzado',
      check_identificacion: 1, check_analisis: 1, check_presentacion: 1, buenas_practicas: 0, verificacion_cgc: '', fecha_actualizacion: '2026-05-29'
    });
    const vehMapped = mapVehiculoRowToJson(
      { id: 101, plate: 'O-123ABC', iscv_moroso: 1, multas: 2 },
      [{ fecha: '2025-01-01', status: 'Activo', multas: 0, iscv_moroso: 0 }]
    );

    const mappersOk = stmts.length === 18 &&
      canalMapped['Protocolo de actuación'] === true &&
      dirMapped.enlaces_solicitud[0] === 'https://s1' &&
      dirMapped.enlaces_oficio[0] === 'https://o1' &&
      riesgoMapped.checks.identificacion === true &&
      vehMapped.iscvMoroso === true &&
      vehMapped.history.length === 1;
    recordTest('11.7 Script DDL (18 tablas) y mappers SQL<->JSON validados sin pérdida de campos', mappersOk);

    // 11.8 Endpoint seguro de guía de instalación y script SQL en módulo de almacenamiento
    const resAssetsNoAuth = await fetch(`${BASE_URL}/api/admin/storage/install-assets`);
    const resAssetsAuth = await fetch(`${BASE_URL}/api/admin/storage/install-assets`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const assetsData = await resAssetsAuth.json().catch(() => ({}));
    const assetsOk = resAssetsNoAuth.status === 401 &&
      resAssetsAuth.status === 200 &&
      assetsData.success === true &&
      assetsData.tableCount === 18 &&
      typeof assetsData.sqlScript === 'string' &&
      assetsData.sqlScript.includes('CREATE TABLE IF NOT EXISTS `pia_canales_integridad`') &&
      typeof assetsData.sqlSeedScript === 'string' &&
      assetsData.sqlSeedScript.includes('pia_modules_ui_kpis') &&
      typeof assetsData.envTemplate === 'string' &&
      assetsData.envTemplate.includes('PIA_STORAGE_MODE=json') &&
      !assetsData.envTemplate.includes('MYSQL_PASSWORD=CONTRASEÑA_REAL') &&
      typeof assetsData.deployPs1 === 'string' &&
      assetsData.deployPs1.includes('PIA_DATA_DIR') &&
      typeof assetsData.deployLinuxSh === 'string' &&
      assetsData.deployLinuxSh.includes('init_pia_config.js') &&
      typeof assetsData.webConfig === 'string' &&
      assetsData.webConfig.includes('ReverseProxyToNodeService') &&
      typeof assetsData.guideMarkdown === 'string' &&
      assetsData.guideMarkdown.includes('URL Rewrite') &&
      typeof assetsData.migrateScript === 'string' &&
      assetsData.migrateScript.includes('FIVE_JSON_MODULES') &&
      typeof assetsData.initConfigScript === 'string' &&
      assetsData.initConfigScript.includes('runInitialConfigSetup');
    recordTest('11.8 Guía de instalación, scripts (SQL 18 tablas, semilla, init_pia_config, migración CLI, PowerShell, Linux, web.config) servidos de forma segura (200 / 401)', assetsOk);

    // 11.9 Scripts CLI (admin/scripts/*): bloqueados en web público y validación masiva + check inicial
    const resCliPublic = await fetch(`${BASE_URL}/admin/scripts/migrate_json_to_sql.js`);
    const resInitCliPublic = await fetch(`${BASE_URL}/admin/scripts/init_pia_config.js`);
    const { runBulkJsonToSqlMigration } = await import('./admin/scripts/migrate_json_to_sql.js');
    const { runInitialConfigSetup } = await import('./admin/scripts/init_pia_config.js');
    const dryRunRes = await runBulkJsonToSqlMigration({
      dryRun: true,
      quiet: true,
      logDir: null
    });
    const initCheckRes = await runInitialConfigSetup({
      checkOnly: true,
      quiet: true
    });
    const cliMigrationOk = resCliPublic.status === 403 &&
      resInitCliPublic.status === 403 &&
      dryRunRes.success === true &&
      dryRunRes.modules.length === 5 &&
      dryRunRes.summary.errors === 0 &&
      dryRunRes.summary.validated > 0 &&
      Array.isArray(dryRunRes.recordLogs) &&
      dryRunRes.recordLogs.length === dryRunRes.summary.totalSource &&
      initCheckRes.success === true;
    recordTest('11.9 Scripts CLI admin/scripts protegidos (403), validación masiva de los 5 JSON y check de configuración inicial OK', cliMigrationOk);

    // 11.10 Módulo admin/database-manager.js: protegido en HTTP público (403), endpoints seguros sin credenciales y validación .env
    const resDbManagerPublic = await fetch(`${BASE_URL}/admin/database-manager.js`);
    const resConnNoAuth = await fetch(`${BASE_URL}/api/admin/storage/connection`);
    const resConnAuth = await fetch(`${BASE_URL}/api/admin/storage/connection`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const connData = await resConnAuth.json().catch(() => ({}));
    const resReloadNoAuth = await fetch(`${BASE_URL}/api/admin/storage/sql/reload-env`, { method: 'POST' });
    const resReloadAuth = await fetch(`${BASE_URL}/api/admin/storage/sql/reload-env`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const reloadData = await resReloadAuth.json().catch(() => ({}));

    const { validateMysqlEnvConfig, getSanitizedConnectionConfig } = await import('./admin/database-manager.js');
    const validSample = validateMysqlEnvConfig({
      host: '127.0.0.1',
      port: 3306,
      user: 'pia_app_user',
      password: 'secret_value',
      database: 'pia_db',
      sslEnabled: false,
      connectionLimit: 10
    });
    const invalidSample = validateMysqlEnvConfig({
      host: '',
      port: 99999,
      user: '',
      database: 'pia-db;DROP',
      connectionLimit: 0
    });
    const sanitizedCfg = getSanitizedConnectionConfig();
    const dbManagerRaw = JSON.stringify({ connData, reloadData, sanitizedCfg });
    const dbManagerOk = resDbManagerPublic.status === 403 &&
      resConnNoAuth.status === 401 &&
      resConnAuth.status === 200 &&
      connData.success === true &&
      resReloadNoAuth.status === 401 &&
      resReloadAuth.status === 200 &&
      reloadData.success === true &&
      validSample.valid === true &&
      invalidSample.valid === false &&
      invalidSample.errors.length >= 4 &&
      !dbManagerRaw.includes('MYSQL_PASSWORD') &&
      !dbManagerRaw.includes('secret_value') &&
      !connData?.connection?.password &&
      !connData?.envConfig?.connection?.password;
    recordTest('11.10 Módulo admin/database-manager.js protegido (403), endpoints .env seguros (200/401) y validación sin exponer secretos', dbManagerOk);
  } catch (err) {
    recordTest('11. Arquitectura Híbrida JSON + SQL', false, err.message);
  }

  // Test 12: Configuración de Visibilidad Pública de Canales por la Integridad (Protocolos y Dashboard CNC)
  try {
    const resPubCfg = await fetch(`${BASE_URL}/api/canales/config`);
    const pubCfg = await resPubCfg.json().catch(() => ({}));
    const pubCfgOk = resPubCfg.status === 200 &&
      typeof pubCfg.showProtocolos === 'boolean' &&
      typeof pubCfg.showDashboardCnc === 'boolean';
    recordTest('12.1 Consulta pública GET /api/canales/config retorna banderas booleanas seguras (200)', pubCfgOk);

    const resAdminCfgNoAuth = await fetch(`${BASE_URL}/api/admin/canales/config`);
    const resPutCfgNoAuth = await fetch(`${BASE_URL}/api/admin/canales/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showProtocolos: true })
    });
    recordTest('12.2 Bloqueo sin autenticación en GET/PUT /api/admin/canales/config (401)', resAdminCfgNoAuth.status === 401 && resPutCfgNoAuth.status === 401);

    const resLoginAdminCfg = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const { token: cfgAdminToken } = await resLoginAdminCfg.json();

    const resBadType = await fetch(`${BASE_URL}/api/admin/canales/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfgAdminToken}` },
      body: JSON.stringify({ showProtocolos: 'yes' })
    });
    recordTest('12.3 Validación estricta de tipos booleanos en PUT /api/admin/canales/config (400)', resBadType.status === 400);

    const initialProt = Boolean(pubCfg.showProtocolos);
    const initialDash = Boolean(pubCfg.showDashboardCnc);

    const resEnable = await fetch(`${BASE_URL}/api/admin/canales/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfgAdminToken}` },
      body: JSON.stringify({ showProtocolos: true, showDashboardCnc: true })
    });
    const enableData = await resEnable.json().catch(() => ({}));
    const resPubAfter = await fetch(`${BASE_URL}/api/canales/config`);
    const pubAfter = await resPubAfter.json().catch(() => ({}));

    // Restaurar estado original
    await fetch(`${BASE_URL}/api/admin/canales/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfgAdminToken}` },
      body: JSON.stringify({ showProtocolos: initialProt, showDashboardCnc: initialDash })
    });

    const toggleOk = resEnable.status === 200 &&
      enableData.success === true &&
      pubAfter.showProtocolos === true &&
      pubAfter.showDashboardCnc === true;
    recordTest('12.4 Activación y restauración segura de Protocolos y Dashboard CNC desde Admin API (200)', toggleOk);
  } catch (err) {
    recordTest('12. Configuración de Visibilidad de Canales', false, err.message);
  }

  // Test 13: Métricas Dinámicas del Portal Principal (CRUD, íconos, texto inferior y carrusel)
  try {
    const resPubMetrics = await fetch(`${BASE_URL}/api/portal/metricas`);
    const pubMetrics = await resPubMetrics.json().catch(() => ({}));
    const pubMetricsOk = resPubMetrics.status === 200 &&
      Array.isArray(pubMetrics.metricas) &&
      pubMetrics.metricas.length >= 4 &&
      typeof pubMetrics.carouselActive === 'boolean';
    recordTest('13.1 Consulta pública GET /api/portal/metricas retorna arreglo normalizado de métricas (200)', pubMetricsOk);

    const resAdminGetNoAuth = await fetch(`${BASE_URL}/api/admin/portal/metricas`);
    const resAdminPostNoAuth = await fetch(`${BASE_URL}/api/admin/portal/metricas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 10, titulo: 'Test', icono: 'fas fa-star' })
    });
    const resAdminPutNoAuth = await fetch(`${BASE_URL}/api/admin/portal/metricas/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 99 })
    });
    const resAdminDelNoAuth = await fetch(`${BASE_URL}/api/admin/portal/metricas/1`, { method: 'DELETE' });
    recordTest(
      '13.2 Bloqueo sin autenticación en GET/POST/PUT/DELETE /api/admin/portal/metricas (401)',
      resAdminGetNoAuth.status === 401 &&
      resAdminPostNoAuth.status === 401 &&
      resAdminPutNoAuth.status === 401 &&
      resAdminDelNoAuth.status === 401
    );

    const resLoginPortal = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const { token: portalToken } = await resLoginPortal.json();

    const resBadMetric = await fetch(`${BASE_URL}/api/admin/portal/metricas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${portalToken}` },
      body: JSON.stringify({ valor: -5, titulo: 'A', icono: 'bad<script>icon' })
    });
    recordTest('13.3 Validación estricta de valor numérico e ícono FontAwesome en POST /api/admin/portal/metricas (400)', resBadMetric.status === 400);

    // Crear 5ta métrica para validar activación automática de carrusel (>4), editar su ícono y texto inferior, y eliminarla
    const resCreateMetric = await fetch(`${BASE_URL}/api/admin/portal/metricas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${portalToken}` },
      body: JSON.stringify({
        valor: 120,
        sufijo: '+',
        titulo: 'Capacitaciones Institucionales',
        descripcion: 'Talleres realizados en prevención',
        icono: 'fas fa-award',
        activo: true
      })
    });
    const createdData = await resCreateMetric.json().catch(() => ({}));
    const newId = createdData?.metric?.id;

    const resUpdateMetric = newId ? await fetch(`${BASE_URL}/api/admin/portal/metricas/${newId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${portalToken}` },
      body: JSON.stringify({
        valor: 135,
        descripcion: 'Servidores públicos capacitados en integridad',
        icono: 'fas fa-shield-alt'
      })
    }) : null;
    const updatedData = resUpdateMetric ? await resUpdateMetric.json().catch(() => ({})) : {};

    const resPubCarousel = await fetch(`${BASE_URL}/api/portal/metricas`);
    const pubCarousel = await resPubCarousel.json().catch(() => ({}));

    const resDeleteMetric = newId ? await fetch(`${BASE_URL}/api/admin/portal/metricas/${newId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${portalToken}` }
    }) : null;

    const crudPortalOk = resCreateMetric.status === 201 &&
      Boolean(newId) &&
      resUpdateMetric?.status === 200 &&
      updatedData?.metric?.valor === 135 &&
      updatedData?.metric?.icono === 'fas fa-shield-alt' &&
      updatedData?.metric?.descripcion === 'Servidores públicos capacitados en integridad' &&
      pubCarousel.carouselActive === true &&
      pubCarousel.totalActivas >= 5 &&
      resDeleteMetric?.status === 200;

    recordTest('13.4 Creación, edición (valor, texto inferior e ícono), activación de carrusel (>4) y eliminación de métrica del portal (201/200)', crudPortalOk);
  } catch (err) {
    recordTest('13. Métricas Dinámicas del Portal Principal', false, err.message);
  }

  // Test 14: KPIs e Imágenes de Fondo por Módulo + Portal (RBAC, validación de archivos binarios, URLs y CRUD)
  try {
    const resPubUi = await fetch(`${BASE_URL}/api/ui/directorio`);
    const pubUiData = await resPubUi.json().catch(() => ({}));
    const pubUiOk = resPubUi.status === 200 &&
      pubUiData.module === 'directorio' &&
      Array.isArray(pubUiData.kpis) &&
      pubUiData.kpis.length >= 1 &&
      Array.isArray(pubUiData.backgrounds) &&
      pubUiData.backgrounds.length >= 1 &&
      typeof pubUiData.carouselActive === 'boolean';
    recordTest('14.1 Consulta pública GET /api/ui/:module retorna KPIs y fondos normalizados (200)', pubUiOk);

    const resUiNoAuthGet = await fetch(`${BASE_URL}/api/admin/ui/directorio`);
    const resUiNoAuthPost = await fetch(`${BASE_URL}/api/admin/ui/directorio/kpis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: 'Sin Auth', valor: '10', icono: 'fas fa-star' })
    });
    const resUiNoAuthBg = await fetch(`${BASE_URL}/api/admin/ui/directorio/backgrounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '/img/wallpaperdirectorio.jpg', titulo: 'Sin Auth' })
    });
    const resUiNoAuthUpload = await fetch(`${BASE_URL}/api/admin/ui/backgrounds/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'x.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' })
    });
    recordTest(
      '14.2 Bloqueo sin autenticación en endpoints admin de KPIs, fondos y carga de imágenes (401)',
      resUiNoAuthGet.status === 401 &&
      resUiNoAuthPost.status === 401 &&
      resUiNoAuthBg.status === 401 &&
      resUiNoAuthUpload.status === 401
    );

    const resLoginUi = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const { token: uiToken } = await resLoginUi.json();

    // Rechazar SVG / firma mágica falsa / javascript: URL / path traversal
    const svgBase64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    const resSvgUpload = await fetch(`${BASE_URL}/api/admin/ui/backgrounds/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiToken}` },
      body: JSON.stringify({ filename: 'xss.svg', dataUrl: `data:image/svg+xml;base64,${svgBase64}` })
    });
    const fakePngBase64 = Buffer.from('NOT_A_REAL_PNG_FILE').toString('base64');
    const resFakeMagicUpload = await fetch(`${BASE_URL}/api/admin/ui/backgrounds/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiToken}` },
      body: JSON.stringify({ filename: 'fake.png', dataUrl: `data:image/png;base64,${fakePngBase64}` })
    });
    const resBadBgUrl = await fetch(`${BASE_URL}/api/admin/ui/portal/backgrounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiToken}` },
      body: JSON.stringify({ url: 'javascript:alert(1)', titulo: 'Bad XSS' })
    });
    const resTraversalDel = await fetch(`${BASE_URL}/api/admin/ui/backgrounds/upload/..%2F..%2Fserver.js`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${uiToken}` }
    });
    recordTest(
      '14.3 Rechazo estricto de SVG, firma mágica inválida, URL insegura y Path Traversal en fondos (400)',
      resSvgUpload.status === 400 &&
      resFakeMagicUpload.status === 400 &&
      resBadBgUrl.status === 400 &&
      resTraversalDel.status === 400
    );

    // Flujo completo autenticado: subir PNG válido 1x1 -> agregar fondo -> agregar KPI en vehiculos (4 KPIs => carouselActive true) -> actualizar -> eliminar y limpiar
    const valid1x1PngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const resUploadPng = await fetch(`${BASE_URL}/api/admin/ui/backgrounds/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiToken}` },
      body: JSON.stringify({ filename: 'test_ui_bg.png', dataUrl: `data:image/png;base64,${valid1x1PngBase64}` })
    });
    const uploadedBg = await resUploadPng.json().catch(() => ({}));
    const uploadedFilename = uploadedBg?.filename;
    const uploadedUrl = uploadedBg?.url;

    const resAddBg = uploadedUrl ? await fetch(`${BASE_URL}/api/admin/ui/vehiculos/backgrounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiToken}` },
      body: JSON.stringify({ url: uploadedUrl, titulo: 'Fondo Prueba QA', activo: true })
    }) : null;
    const addedBg = resAddBg ? await resAddBg.json().catch(() => ({})) : {};
    const addedBgId = addedBg?.background?.id;

    const resAddKpi = await fetch(`${BASE_URL}/api/admin/ui/vehiculos/kpis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiToken}` },
      body: JSON.stringify({
        modoValor: 'manual',
        valor: '98',
        sufijo: '%',
        titulo: 'Cumplimiento QA',
        descripcion: 'Indicador de prueba agregado dinámicamente',
        icono: 'fas fa-car',
        activo: true
      })
    });
    const addedKpiData = await resAddKpi.json().catch(() => ({}));
    const addedKpiId = addedKpiData?.kpi?.id;

    const resEditKpi = addedKpiId ? await fetch(`${BASE_URL}/api/admin/ui/vehiculos/kpis/${addedKpiId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiToken}` },
      body: JSON.stringify({
        titulo: 'Cumplimiento QA Editado',
        icono: 'fas fa-shield-alt',
        descripcion: 'Texto actualizado en módulo'
      })
    }) : null;
    const editedKpiData = resEditKpi ? await resEditKpi.json().catch(() => ({})) : {};

    const resCheckVehPub = await fetch(`${BASE_URL}/api/ui/vehiculos`);
    const vehPubData = await resCheckVehPub.json().catch(() => ({}));

    // Limpieza completa de artefactos de prueba
    const resDelKpi = addedKpiId ? await fetch(`${BASE_URL}/api/admin/ui/vehiculos/kpis/${addedKpiId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${uiToken}` }
    }) : null;
    const resDelBg = addedBgId ? await fetch(`${BASE_URL}/api/admin/ui/vehiculos/backgrounds/${addedBgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${uiToken}` }
    }) : null;
    const resDelFile = uploadedFilename ? await fetch(`${BASE_URL}/api/admin/ui/backgrounds/upload/${encodeURIComponent(uploadedFilename)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${uiToken}` }
    }) : null;

    const fullModuleUiOk = resUploadPng.status === 201 &&
      Boolean(uploadedUrl) &&
      resAddBg?.status === 201 &&
      resAddKpi.status === 201 &&
      resEditKpi?.status === 200 &&
      editedKpiData?.kpi?.titulo === 'Cumplimiento QA Editado' &&
      vehPubData.backgrounds?.some(b => b.url === uploadedUrl) &&
      vehPubData.kpis?.some(k => k.titulo === 'Cumplimiento QA Editado') &&
      resDelKpi?.status === 200 &&
      resDelBg?.status === 200 &&
      resDelFile?.status === 200;

    recordTest('14.4 Subida PNG segura, alta/consulta de fondo por módulo y CRUD completo de KPIs por módulo con limpieza (201/200)', fullModuleUiOk);
  } catch (err) {
    recordTest('14. KPIs e Imágenes de Fondo por Módulo + Portal', false, err.message);
  }

  // Test 15: Administración de textos estáticos del portal principal (RBAC, XSS/validación, ETag OCC, persistencia y reset)
  try {
    const resPubTexts = await fetch(`${BASE_URL}/api/portal/texts`);
    const pubTextsData = await resPubTexts.json().catch(() => ({}));
    const pubTextsOk = resPubTexts.status === 200 &&
      pubTextsData.success === true &&
      pubTextsData.texts &&
      typeof pubTextsData.texts['hero.title_highlight'] === 'string' &&
      typeof pubTextsData.texts['footer.copyright'] === 'string';
    recordTest('15.1 Consulta pública GET /api/portal/texts retorna catálogo normalizado (200)', pubTextsOk);

    const resTextsNoAuthGet = await fetch(`${BASE_URL}/api/admin/portal/texts`);
    const resTextsNoAuthPut = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { 'hero.title_prefix': 'Portal' } })
    });
    const resTextsNoAuthReset = await fetch(`${BASE_URL}/api/admin/portal/texts/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'all' })
    });
    recordTest(
      '15.2 Bloqueo sin autenticación en GET/PUT /api/admin/portal/texts y POST /reset (401)',
      resTextsNoAuthGet.status === 401 &&
      resTextsNoAuthPut.status === 401 &&
      resTextsNoAuthReset.status === 401
    );

    const resLoginTextsAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const { token: textsAdminToken } = await resLoginTextsAdmin.json();

    // Operador sin permiso 'portal' recibe 403 Forbidden
    const restrictedTextsEmail = 'operador_sin_portal_textos@cnc.gob.gt';
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
      body: JSON.stringify({
        email: restrictedTextsEmail,
        displayName: 'Operador Sin Portal Test',
        role: 'data_operator',
        modules: ['canales'],
        password: 'TestPortalTexts2026!'
      })
    });
    const resLoginRestricted = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: restrictedTextsEmail, password: 'TestPortalTexts2026!' })
    });
    const { token: restrictedTextsToken } = await resLoginRestricted.json();

    const resRestrictedGet = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      headers: { 'Authorization': `Bearer ${restrictedTextsToken}` }
    });
    const resRestrictedPut = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${restrictedTextsToken}` },
      body: JSON.stringify({ updates: { 'hero.title_prefix': 'Prueba' } })
    });
    const resRestrictedReset = await fetch(`${BASE_URL}/api/admin/portal/texts/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${restrictedTextsToken}` },
      body: JSON.stringify({ scope: 'key', key: 'hero.title_prefix' })
    });

    await fetch(`${BASE_URL}/api/admin/users/${encodeURIComponent(restrictedTextsEmail)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${textsAdminToken}` }
    });

    recordTest(
      '15.3 Operador sin permiso "portal" bloqueado en endpoints admin de textos (403 Forbidden)',
      resRestrictedGet.status === 403 &&
      resRestrictedPut.status === 403 &&
      resRestrictedReset.status === 403
    );

    // Validación estricta de claves desconocidas, HTML/script, javascript: y vacío
    const resBadScript = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
      body: JSON.stringify({ updates: { 'hero.subtitle': '<script>alert(1)</script>' } })
    });
    const resBadImg = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
      body: JSON.stringify({ updates: { 'hero.subtitle': '<img src=x onerror=alert(1)>' } })
    });
    const resBadJsProto = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
      body: JSON.stringify({ updates: { 'hero.subtitle': 'javascript:alert(1)' } })
    });
    const resBadKey = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
      body: JSON.stringify({ updates: { 'clave.inexistente': 'Valor' } })
    });
    const resBadEmpty = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
      body: JSON.stringify({ updates: { 'hero.title_prefix': '   ' } })
    });
    recordTest(
      '15.4 Rechazo estricto de HTML/script, javascript:, clave fuera de catálogo y valor vacío (400)',
      resBadScript.status === 400 &&
      resBadImg.status === 400 &&
      resBadJsProto.status === 400 &&
      resBadKey.status === 400 &&
      resBadEmpty.status === 400
    );

    // Flujo completo: respaldar overrides previos, obtener ETag, probar 409 con ETag obsoleto, actualizar texto, verificar en GET admin + GET público, probar reset y restaurar overrides previos
    const resSnapBeforePortal = await fetch(`${BASE_URL}/api/admin/texts/export-bundle`, {
      headers: { 'Authorization': `Bearer ${textsAdminToken}` }
    });
    const snapBeforePortalData = await resSnapBeforePortal.json().catch(() => ({}));
    const savedPortalSnapshot = snapBeforePortalData.modules?.portal || { overrides: {} };

    let fullTextsFlowOk = false;
    try {
      const resAdminGetTexts = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
        headers: { 'Authorization': `Bearer ${textsAdminToken}` }
      });
      const validEtag = resAdminGetTexts.headers.get('ETag');
      const adminTextsData = await resAdminGetTexts.json().catch(() => ({}));

      const resStaleEtag = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${textsAdminToken}`,
          'If-Match': `"${'0'.repeat(64)}"`
        },
        body: JSON.stringify({ updates: { 'hero.eyebrow': 'Prueba conflicto ETag' } })
      });

      const testEyebrowValue = 'Transparencia Activa — Guatemala QA 2026';
      const resSaveText = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${textsAdminToken}`,
          ...(validEtag ? { 'If-Match': validEtag } : {})
        },
        body: JSON.stringify({ updates: { 'hero.eyebrow': testEyebrowValue } })
      });
      const saveTextData = await resSaveText.json().catch(() => ({}));

      const resPubAfterSave = await fetch(`${BASE_URL}/api/portal/texts`);
      const pubAfterSave = await resPubAfterSave.json().catch(() => ({}));

      const resAdminAfterSave = await fetch(`${BASE_URL}/api/admin/portal/texts`, {
        headers: { 'Authorization': `Bearer ${textsAdminToken}` }
      });
      const adminAfterSave = await resAdminAfterSave.json().catch(() => ({}));

      const resResetAll = await fetch(`${BASE_URL}/api/admin/portal/texts/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
        body: JSON.stringify({ scope: 'all' })
      });
      const resetAllData = await resResetAll.json().catch(() => ({}));

      const resPubAfterReset = await fetch(`${BASE_URL}/api/portal/texts`);
      const pubAfterReset = await resPubAfterReset.json().catch(() => ({}));

      fullTextsFlowOk = resAdminGetTexts.status === 200 &&
        Array.isArray(adminTextsData.items) &&
        adminTextsData.items.length >= 100 &&
        resStaleEtag.status === 409 &&
        resSaveText.status === 200 &&
        saveTextData.success === true &&
        pubAfterSave.texts?.['hero.eyebrow'] === testEyebrowValue &&
        adminAfterSave.texts?.['hero.eyebrow'] === testEyebrowValue &&
        resResetAll.status === 200 &&
        resetAllData.stats?.modified === 0 &&
        pubAfterReset.modifiedKeys?.length === 0;
    } finally {
      // Restaurar las ediciones reales previas del portal para preservar cambios editoriales
      if (resSnapBeforePortal.status === 200) {
        const resRestorePortal = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${textsAdminToken}` },
          body: JSON.stringify({ mode: 'replace', modules: { portal: savedPortalSnapshot } })
        });
        if (resRestorePortal.status !== 200) {
          fullTextsFlowOk = false;
        }
      }
    }

    recordTest('15.5 Control de concurrencia ETag (409), guardado, reflejo público, reset y preservación (200)', fullTextsFlowOk);
  } catch (err) {
    recordTest('15. Administración de textos estáticos del portal principal', false, err.message);
  }

  // Test 16: Administración de textos estáticos por módulo (directorio, tableros, canales, riesgo)
  try {
    const modSamples = [
      { mod: 'directorio', sampleKey: 'hero.eyebrow', sampleVal: 'Directorio QA 2026' },
      { mod: 'tableros', sampleKey: 'hero.eyebrow', sampleVal: 'Tableros QA 2026' },
      { mod: 'canales', sampleKey: 'hero.eyebrow', sampleVal: 'Canales QA 2026' },
      { mod: 'riesgo', sampleKey: 'hero.eyebrow', sampleVal: 'Riesgo QA 2026' }
    ];

    let allPublicOk = true;
    for (const { mod, sampleKey } of modSamples) {
      const r = await fetch(`${BASE_URL}/api/module-texts/${mod}`);
      const d = await r.json().catch(() => ({}));
      if (r.status !== 200 || d.success !== true || d.module !== mod || typeof d.texts?.[sampleKey] !== 'string') {
        allPublicOk = false;
      }
    }
    const rBadMod = await fetch(`${BASE_URL}/api/module-texts/inexistente`);
    recordTest('16.1 Consulta pública GET /api/module-texts/:module válida para los 4 módulos y 404 en inválido', allPublicOk && rBadMod.status === 404);

    // 16.2 Bloqueo 401 sin autenticación
    const rNoAuthCat = await fetch(`${BASE_URL}/api/admin/module-texts/catalog`);
    const rNoAuthGet = await fetch(`${BASE_URL}/api/admin/module-texts/directorio`);
    const rNoAuthPut = await fetch(`${BASE_URL}/api/admin/module-texts/canales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { 'hero.eyebrow': 'Prueba' } })
    });
    const rNoAuthReset = await fetch(`${BASE_URL}/api/admin/module-texts/riesgo/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'all' })
    });
    recordTest(
      '16.2 Bloqueo sin autenticación en endpoints admin de textos por módulo (401)',
      rNoAuthCat.status === 401 && rNoAuthGet.status === 401 && rNoAuthPut.status === 401 && rNoAuthReset.status === 401
    );

    const resLoginModAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const { token: modAdminToken } = await resLoginModAdmin.json();

    // 16.3 RBAC por módulo: operador restringido solo a ['directorio'] bloqueado en tableros/canales/riesgo
    const restrictedModEmail = 'operador_solo_directorio_textos@cnc.gob.gt';
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modAdminToken}` },
      body: JSON.stringify({
        email: restrictedModEmail,
        displayName: 'Operador Solo Directorio Test',
        role: 'data_operator',
        modules: ['directorio'],
        password: 'TestModTexts2026!'
      })
    });
    const resLoginModRestricted = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: restrictedModEmail, password: 'TestModTexts2026!' })
    });
    const { token: restrictedModToken } = await resLoginModRestricted.json();

    const rCatRestricted = await fetch(`${BASE_URL}/api/admin/module-texts/catalog`, {
      headers: { 'Authorization': `Bearer ${restrictedModToken}` }
    });
    const dCatRestricted = await rCatRestricted.json().catch(() => ({}));
    const rAllowDir = await fetch(`${BASE_URL}/api/admin/module-texts/directorio`, {
      headers: { 'Authorization': `Bearer ${restrictedModToken}` }
    });
    const rDenyTab = await fetch(`${BASE_URL}/api/admin/module-texts/tableros`, {
      headers: { 'Authorization': `Bearer ${restrictedModToken}` }
    });
    const rDenyCan = await fetch(`${BASE_URL}/api/admin/module-texts/canales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${restrictedModToken}` },
      body: JSON.stringify({ updates: { 'hero.eyebrow': 'No autorizado' } })
    });
    const rDenyRie = await fetch(`${BASE_URL}/api/admin/module-texts/riesgo/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${restrictedModToken}` },
      body: JSON.stringify({ scope: 'all' })
    });

    await fetch(`${BASE_URL}/api/admin/users/${encodeURIComponent(restrictedModEmail)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${modAdminToken}` }
    });

    const catRestrictedOk = rCatRestricted.status === 200 &&
      Array.isArray(dCatRestricted.modules) &&
      dCatRestricted.modules.length === 1 &&
      dCatRestricted.modules[0].key === 'directorio';

    recordTest(
      '16.3 RBAC granular por módulo: operador con permiso únicamente en directorio bloqueado en los otros 3 (403)',
      catRestrictedOk && rAllowDir.status === 200 && rDenyTab.status === 403 && rDenyCan.status === 403 && rDenyRie.status === 403
    );

    // 16.4 Validación estricta XSS / HTML / clave inválida / vacío
    const rModScript = await fetch(`${BASE_URL}/api/admin/module-texts/tableros`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modAdminToken}` },
      body: JSON.stringify({ updates: { 'hero.sub': '<script>alert(1)</script>' } })
    });
    const rModJs = await fetch(`${BASE_URL}/api/admin/module-texts/canales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modAdminToken}` },
      body: JSON.stringify({ updates: { 'hero.sub': 'javascript:void(0)' } })
    });
    const rModUnknownKey = await fetch(`${BASE_URL}/api/admin/module-texts/riesgo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modAdminToken}` },
      body: JSON.stringify({ updates: { 'clave.no.existe': 'Valor' } })
    });
    const rModEmpty = await fetch(`${BASE_URL}/api/admin/module-texts/directorio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modAdminToken}` },
      body: JSON.stringify({ updates: { 'hero.eyebrow': '   ' } })
    });
    recordTest(
      '16.4 Rechazo estricto de script, javascript:, clave inválida y texto vacío en textos por módulo (400)',
      rModScript.status === 400 && rModJs.status === 400 && rModUnknownKey.status === 400 && rModEmpty.status === 400
    );

    // 16.5 Respaldo previo, ETag OCC (409), guardado PUT, reflejo público GET, reset y restauración fiel en los 4 módulos
    const resSnapBeforeMods = await fetch(`${BASE_URL}/api/admin/texts/export-bundle`, {
      headers: { 'Authorization': `Bearer ${modAdminToken}` }
    });
    const snapBeforeModsData = await resSnapBeforeMods.json().catch(() => ({}));
    const savedModsSnapshot = {
      directorio: snapBeforeModsData.modules?.directorio || { overrides: {} },
      tableros: snapBeforeModsData.modules?.tableros || { overrides: {} },
      canales: snapBeforeModsData.modules?.canales || { overrides: {} },
      riesgo: snapBeforeModsData.modules?.riesgo || { overrides: {} }
    };

    let allFlowsOk = true;
    try {
      for (const { mod, sampleKey, sampleVal } of modSamples) {
        const rGet = await fetch(`${BASE_URL}/api/admin/module-texts/${mod}`, {
          headers: { 'Authorization': `Bearer ${modAdminToken}` }
        });
        const etag = rGet.headers.get('ETag');
        const getData = await rGet.json().catch(() => ({}));

        const rStale = await fetch(`${BASE_URL}/api/admin/module-texts/${mod}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${modAdminToken}`,
            'If-Match': `"${'0'.repeat(64)}"`
          },
          body: JSON.stringify({ updates: { [sampleKey]: 'Conflicto QA' } })
        });

        const rPut = await fetch(`${BASE_URL}/api/admin/module-texts/${mod}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${modAdminToken}`,
            ...(etag ? { 'If-Match': etag } : {})
          },
          body: JSON.stringify({ updates: { [sampleKey]: sampleVal } })
        });
        const putData = await rPut.json().catch(() => ({}));

        const rPub = await fetch(`${BASE_URL}/api/module-texts/${mod}`);
        const pubData = await rPub.json().catch(() => ({}));

        const rReset = await fetch(`${BASE_URL}/api/admin/module-texts/${mod}/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modAdminToken}` },
          body: JSON.stringify({ scope: 'all' })
        });
        const resetData = await rReset.json().catch(() => ({}));

        const rPubAfterReset = await fetch(`${BASE_URL}/api/module-texts/${mod}`);
        const pubAfterResetData = await rPubAfterReset.json().catch(() => ({}));

        if (
          rGet.status !== 200 ||
          !Array.isArray(getData.items) ||
          getData.items.length < 40 ||
          rStale.status !== 409 ||
          rPut.status !== 200 ||
          putData.success !== true ||
          pubData.texts?.[sampleKey] !== sampleVal ||
          rReset.status !== 200 ||
          resetData.stats?.modified !== 0 ||
          pubAfterResetData.modifiedKeys?.length !== 0
        ) {
          allFlowsOk = false;
        }
      }
    } finally {
      if (resSnapBeforeMods.status === 200) {
        const resRestoreMods = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modAdminToken}` },
          body: JSON.stringify({ mode: 'replace', modules: savedModsSnapshot })
        });
        if (resRestoreMods.status !== 200) {
          allFlowsOk = false;
        }
      }
    }
    recordTest('16.5 Control ETag (409), guardado, reflejo público, reset y preservación en los 4 módulos (200)', allFlowsOk);
  } catch (err) {
    recordTest('16. Administración de textos estáticos por módulo', false, err.message);
  }

  // Test 17: Preservación consolidada de textos, sincronización nube (Firestore) y respaldo JSON
  try {
    // 17.1 Configuración pública de Firebase incluye firestoreDatabaseId
    const resFbCfg = await fetch(`${BASE_URL}/api/auth/firebase-config`);
    const fbCfgData = await resFbCfg.json().catch(() => ({}));
    recordTest(
      '17.1 GET /api/auth/firebase-config expone projectId y firestoreDatabaseId',
      resFbCfg.status === 200 &&
      Boolean(fbCfgData.projectId) &&
      Boolean(fbCfgData.apiKey) &&
      typeof fbCfgData.firestoreDatabaseId === 'string' &&
      fbCfgData.firestoreDatabaseId.length > 0
    );

    // 17.2 Bloqueo 401 sin autenticación en export-bundle, import-bundle y sync-from-cloud
    const rNoAuthExp = await fetch(`${BASE_URL}/api/admin/texts/export-bundle`);
    const rNoAuthImp = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'merge', modules: { portal: { overrides: {} } } })
    });
    const rNoAuthSync = await fetch(`${BASE_URL}/api/admin/texts/sync-from-cloud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'all', mode: 'replace' })
    });
    recordTest(
      '17.2 Bloqueo sin autenticación (401) en export-bundle, import-bundle y sync-from-cloud',
      rNoAuthExp.status === 401 && rNoAuthImp.status === 401 && rNoAuthSync.status === 401
    );

    const resLoginSyncAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deteccionydenuncia@cnc.gob.gt', password: '12345' })
    });
    const { token: syncAdminToken } = await resLoginSyncAdmin.json();

    // 17.3 Validación estricta de XSS/claves/módulo + RBAC por módulo en import-bundle + preservación íntegra en export/import
    const rBadXssBundle = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${syncAdminToken}` },
      body: JSON.stringify({
        mode: 'merge',
        modules: { portal: { overrides: { 'hero.subtitle': '<script>alert(1)</script>' } } }
      })
    });
    const rBadModBundle = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${syncAdminToken}` },
      body: JSON.stringify({
        mode: 'merge',
        modules: { modulo_falso: { overrides: { 'hero.eyebrow': 'X' } } }
      })
    });
    const rBadKeyBundle = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${syncAdminToken}` },
      body: JSON.stringify({
        mode: 'merge',
        modules: { portal: { overrides: { 'clave.inexistente': 'Valor' } } }
      })
    });

    // RBAC en import-bundle para operador restringido solo a 'canales'
    const rbacSyncEmail = 'operador_sync_rbac@cnc.gob.gt';
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${syncAdminToken}` },
      body: JSON.stringify({
        email: rbacSyncEmail,
        displayName: 'Operador Sync RBAC Test',
        role: 'data_operator',
        modules: ['canales'],
        password: 'TestSyncRbac2026!'
      })
    });
    const resLoginSyncRestricted = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rbacSyncEmail, password: 'TestSyncRbac2026!' })
    });
    const { token: syncRestrictedToken } = await resLoginSyncRestricted.json();

    const rRbacDenyImport = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${syncRestrictedToken}` },
      body: JSON.stringify({
        mode: 'merge',
        modules: { portal: { overrides: { 'hero.eyebrow': 'No autorizado' } } }
      })
    });
    await fetch(`${BASE_URL}/api/admin/users/${encodeURIComponent(rbacSyncEmail)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${syncAdminToken}` }
    });

    // Exportar instantánea real, probar re-importación idempotente y verificar endpoint sync-from-cloud
    const rExportReal = await fetch(`${BASE_URL}/api/admin/texts/export-bundle`, {
      headers: { 'Authorization': `Bearer ${syncAdminToken}` }
    });
    const exportRealData = await rExportReal.json().catch(() => ({}));

    const rImportRoundtrip = await fetch(`${BASE_URL}/api/admin/texts/import-bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${syncAdminToken}` },
      body: JSON.stringify({ mode: 'replace', modules: exportRealData.modules || {} })
    });
    const importRoundtripData = await rImportRoundtrip.json().catch(() => ({}));

    const rSyncCloudCall = await fetch(`${BASE_URL}/api/admin/texts/sync-from-cloud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${syncAdminToken}` },
      body: JSON.stringify({ module: 'portal', mode: 'merge' })
    });
    const syncCloudData = await rSyncCloudCall.json().catch(() => ({}));

    recordTest(
      '17.3 Validación XSS/claves/RBAC (400/403) y respaldo/importación/sincronización nube íntegra (200)',
      rBadXssBundle.status === 400 &&
      rBadModBundle.status === 400 &&
      rBadKeyBundle.status === 400 &&
      rRbacDenyImport.status === 403 &&
      rExportReal.status === 200 &&
      exportRealData.success === true &&
      Boolean(exportRealData.modules?.portal) &&
      rImportRoundtrip.status === 200 &&
      importRoundtripData.success === true &&
      rSyncCloudCall.status === 200 &&
      syncCloudData.success === true
    );
  } catch (err) {
    recordTest('17. Preservación consolidada de textos y sincronización nube', false, err.message);
  }

  console.log('\n=============================================================');
  console.log(` RESUMEN DE PRUEBAS: ${results.passed} SUPERADAS / ${results.failed} FALLIDAS`);
  console.log('=============================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
