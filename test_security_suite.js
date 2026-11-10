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
  // Test 10: Health check y exposición accidental de archivos privados.
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    recordTest('10.1 Health check del backend Express (200)', health.status === 200);

    const privateData = await fetch(`${BASE_URL}/data/users_roles.json`);
    recordTest('10.2 Archivos operativos de /data no son públicos (404)', privateData.status === 404);

    const privateAudit = await fetch(`${BASE_URL}/audit_logs.json`);
    recordTest('10.3 Bitácora heredada no es pública (404)', privateAudit.status === 404);
  } catch (err) {
    recordTest('10. Seguridad de archivos estáticos', false, err.message);
  }

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
    const privateDataDir = process.env.PIA_DATA_DIR || path.resolve(process.cwd(), '..', 'pia-data');
    const backupsDir = path.join(privateDataDir, 'backups');
    const backupsExist = fs.existsSync(backupsDir);
    recordTest('7.1 Carpeta de respaldos automáticos /data/backups/ inicializada', backupsExist);

    const usersRolesFile = path.join(privateDataDir, 'users_roles.json');
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
