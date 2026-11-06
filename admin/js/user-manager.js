// user-manager.js - Módulo de Identidades Institucionales y Políticas de Seguridad
// Portal de Integridad Activa (PIA) - Modelo Exclusivo para DOS Operadores

let cachedStatus = null;
let activeTab = 'operators';

export async function initUserManager(initialTab = 'operators') {
  activeTab = (initialTab === 'security' || initialTab === 'security_policies') ? 'security' : 'operators';
  await fetchOperatorsStatus();
  renderUserManagerView();
}

async function fetchOperatorsStatus() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/operators-status', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    if (res.ok) {
      cachedStatus = await res.json();
    } else {
      cachedStatus = getFallbackStatus();
    }
  } catch (err) {
    console.warn('Error al consultar estado de operadores:', err);
    cachedStatus = getFallbackStatus();
  }
}

function getFallbackStatus() {
  return {
    model: 'two_operators_exclusive',
    maxAllowed: 2,
    configuredCount: 0,
    slots: [
      {
        slot: 1,
        configured: false,
        displayName: 'Dirección de Apoyo en la Gestión de Irregularidades - DAGI',
        upn: 'deteccionydenuncia@cnc.gob.gt',
        uidMasked: 'Pendiente de primer ingreso por el operador',
        source: 'authorized_operators.json / Firebase Auth',
        role: 'data_operator',
        status: 'pending_first_login'
      },
      {
        slot: 2,
        configured: false,
        displayName: 'Apoyo GI (CNC)',
        upn: 'apoyogi@cnc.gob.gt',
        uidMasked: 'Pendiente de primer ingreso por el operador',
        source: 'authorized_operators.json / Firebase Auth',
        role: 'data_operator',
        status: 'pending_first_login'
      }
    ],
    security: {
      authProvider: 'Firebase Authentication (Email/Contraseña + Backend JWKS Verification)',
      projectId: 'pia-portal-integridad',
      concurrencyControl: 'SHA-256 ETag Optimistic Concurrency Activo',
      atomicWrites: 'Activo (.tmp + rename atómico)',
      automatedBackups: 'Activo (rotación de versiones en /data/backups)',
      immutableUidAudit: 'Activo (registro individualizado en audit_logs.json y Firestore)',
      browserUserCreationDisabled: true,
      geminiLupita: {
        model: 'gemini-3.6-flash',
        configured: true,
        proxyActive: true,
        rateLimit: '15 peticiones / minuto por IP',
        heuristicFallback: 'Activo'
      }
    }
  };
}

function switchTab(tab) {
  activeTab = tab;
  renderUserManagerView();
}

export function renderUserManagerView() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;

  const data = cachedStatus || getFallbackStatus();
  const slots = data.slots || [];
  const sec = data.security || {};

  contentArea.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <!-- ENCABEZADO -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,194,224,0.12); color: var(--cyan); padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.75rem;">
            <i class="fas fa-shield-alt"></i> Seguridad Institucional · Etapa 3
          </div>
          <h1 style="color: var(--navy); font-size: 1.85rem; font-weight: 800; margin-bottom: 0.35rem;">
            Identidades Institucionales y Seguridad
          </h1>
          <p style="color: #5E7A8E; font-size: 0.95rem; max-width: 760px;">
            Arquitectura de control cerrada para exactamente <strong>dos identidades operativas autorizadas</strong> de Microsoft Entra ID. Sin formularios de creación en navegador ni contraseñas locales.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="btnRefreshStatus" style="padding: 0.65rem 1.1rem; background: #fff; border: 1px solid var(--border); border-radius: 10px; color: var(--navy); font-weight: 700; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
            <i class="fas fa-sync-alt"></i> Actualizar Estado
          </button>
        </div>
      </div>

      <!-- PESTAÑAS DE NAVEGACIÓN -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); margin-bottom: 2rem;">
        <button id="tabOperatorsBtn" style="padding: 0.75rem 1.25rem; font-weight: 700; font-size: 0.92rem; background: none; border: none; border-bottom: 3px solid ${activeTab === 'operators' ? 'var(--cyan)' : 'transparent'}; color: ${activeTab === 'operators' ? 'var(--navy)' : '#5E7A8E'}; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-user-check"></i> Dos Identidades Autorizadas (${data.configuredCount || 0}/2)
        </button>
        <button id="tabSecurityBtn" style="padding: 0.75rem 1.25rem; font-weight: 700; font-size: 0.92rem; background: none; border: none; border-bottom: 3px solid ${activeTab === 'security' ? 'var(--cyan)' : 'transparent'}; color: ${activeTab === 'security' ? 'var(--navy)' : '#5E7A8E'}; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-lock"></i> Políticas de Seguridad Institucional
        </button>
      </div>

      <!-- CONTENIDO DE PESTAÑA -->
      ${activeTab === 'operators' ? renderOperatorsTab(slots) : renderSecurityTab(sec)}
    </div>
  `;

  // Event Listeners
  const btnRefresh = document.getElementById('btnRefreshStatus');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Actualizando...`;
      await fetchOperatorsStatus();
      renderUserManagerView();
    });
  }

  const tabOperatorsBtn = document.getElementById('tabOperatorsBtn');
  if (tabOperatorsBtn) {
    tabOperatorsBtn.addEventListener('click', () => switchTab('operators'));
  }

  const tabSecurityBtn = document.getElementById('tabSecurityBtn');
  if (tabSecurityBtn) {
    tabSecurityBtn.addEventListener('click', () => switchTab('security'));
  }
}

function renderOperatorsTab(slots) {
  return `
    <!-- BANNER DE POLÍTICA INSTITUCIONAL -->
    <div style="background: linear-gradient(135deg, rgba(0,194,224,0.08), rgba(43,130,201,0.06)); border: 1px solid rgba(0,194,224,0.25); border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 16px;">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(0,194,224,0.18); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
        <i class="fas fa-user-lock"></i>
      </div>
      <div>
        <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin-bottom: 0.25rem;">
          Modelo de Acceso Cerrado a Dos Identidades Operativas
        </h3>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45; margin: 0;">
          Para garantizar la máxima seguridad y simplicidad operativa, el módulo administrativo está restringido exclusivamente a dos personas autorizadas mediante su <strong>identificador inmutable (UID)</strong> emitido por Firebase Authentication. No existen cuentas creadas en el navegador ni credenciales compartidas.
        </p>
      </div>
    </div>

    <!-- TARJETAS DE LOS DOS OPERADORES -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.75rem; margin-bottom: 2.5rem;">
      ${slots.map(op => renderOperatorCard(op)).join('')}
    </div>

    <!-- GUÍA DE ADMINISTRACIÓN DE IDENTIDADES PARA TI -->
    <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
      <h3 style="color: var(--navy); font-size: 1.1rem; font-weight: 800; margin-bottom: 1rem; display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-server" style="color: var(--cyan);"></i> Administración Segura de Operadores (Firebase Auth)
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; font-size: 0.9rem; color: #5E7A8E;">
        <div style="background: var(--surface); padding: 1.25rem; border-radius: 12px; border-left: 4px solid var(--cyan);">
          <strong style="color: var(--navy); display: block; margin-bottom: 0.5rem;"><i class="fas fa-key"></i> 1. Cuentas Oficiales Restringidas</strong>
          El acceso está limitado estrictamente a:
          <code style="display: block; background: #0C1F30; color: #00C2E0; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem; font-size: 0.82rem;">
            deteccionydenuncia@cnc.gob.gt<br>
            apoyogi@cnc.gob.gt
          </code>
        </div>
        <div style="background: var(--surface); padding: 1.25rem; border-radius: 12px; border-left: 4px solid #22C55E;">
          <strong style="color: var(--navy); display: block; margin-bottom: 0.5rem;"><i class="fas fa-id-badge"></i> 2. Identificador Inmutable (UID)</strong>
          La autorización se valida criptográficamente contra el UID emitido por Firebase Authentication mediante claves públicas JWKS de Google en el backend de Node.js.
        </div>
        <div style="background: var(--surface); padding: 1.25rem; border-radius: 12px; border-left: 4px solid #F59E0B;">
          <strong style="color: var(--navy); display: block; margin-bottom: 0.5rem;"><i class="fas fa-ban"></i> 3. Cero Registro en Navegador</strong>
          El registro público está totalmente deshabilitado. Ningún usuario externo puede crear cuentas, alterar roles ni modificar permisos desde el cliente.
        </div>
      </div>
    </div>
  `;
}

function renderOperatorCard(op) {
  const isConfigured = op.configured && (op.status === 'active' || op.status === 'configured');
  const statusBadge = isConfigured
    ? `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 0.3rem 0.75rem; border-radius: 20px; background: rgba(34,197,94,0.15); color: #16A34A; font-weight: 700; font-size: 0.78rem;"><i class="fas fa-check-circle"></i> Configurado Activo</span>`
    : `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 0.3rem 0.75rem; border-radius: 20px; background: rgba(245,158,11,0.15); color: #D97706; font-weight: 700; font-size: 0.78rem;"><i class="fas fa-clock"></i> Pendiente Primer Ingreso</span>`;

  return `
    <div style="background: #fff; border-radius: 18px; border: 2px solid ${isConfigured ? 'rgba(34,197,94,0.3)' : 'var(--border)'}; padding: 1.75rem; box-shadow: 0 6px 20px rgba(0,0,0,0.04); position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${isConfigured ? 'linear-gradient(90deg, #22C55E, #00C2E0)' : '#CBD5E1'};"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 52px; height: 52px; border-radius: 14px; background: var(--navy); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800;">
            #${op.slot}
          </div>
          <div>
            <h3 style="color: var(--navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
              ${op.displayName}
            </h3>
            <span style="font-size: 0.8rem; color: #5E7A8E;">
              Identidad Operativa Institucional Slot #${op.slot}
            </span>
          </div>
        </div>
        ${statusBadge}
      </div>

      <div style="background: var(--surface); border-radius: 12px; padding: 1rem 1.2rem; margin-bottom: 1.25rem;">
        <div style="margin-bottom: 0.65rem;">
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #5E7A8E; display: block; margin-bottom: 2px;">
            Identificador Inmutable (UID Firebase Auth)
          </span>
          <code style="font-size: 0.88rem; color: var(--navy); font-weight: 700; word-break: break-all;">
            ${op.uidMasked || op.oidMasked || 'Pendiente de primer ingreso por el operador'}
          </code>
        </div>
        <div style="margin-bottom: 0.65rem;">
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #5E7A8E; display: block; margin-bottom: 2px;">
            Correo Institucional Autorizado
          </span>
          <span style="font-size: 0.88rem; color: var(--navy);">
            <i class="fas fa-envelope" style="color: var(--cyan); margin-right: 6px;"></i> ${op.email || op.upn}
          </span>
        </div>
        <div>
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #5E7A8E; display: block; margin-bottom: 2px;">
            Origen de Configuración
          </span>
          <span style="font-size: 0.82rem; color: #5E7A8E;">
            <i class="fas fa-sliders-h" style="margin-right: 6px;"></i> ${op.source}
          </span>
        </div>
        ${op.notes ? `
        <div style="margin-top: 0.65rem; padding: 0.45rem 0.65rem; background: rgba(245,158,11,0.08); border-left: 3px solid #F59E0B; border-radius: 6px; font-size: 0.78rem; color: #92400E; line-height: 1.4;">
          <i class="fas fa-info-circle" style="margin-right: 4px;"></i> <strong>Nota:</strong> ${op.notes}
        </div>` : ''}
      </div>

      <div>
        <h4 style="font-size: 0.82rem; text-transform: uppercase; font-weight: 800; color: var(--navy); margin-bottom: 0.6rem; letter-spacing: 0.05em;">
          Facultades Operativas y Alcance Pleno:
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
          <span style="padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(0,194,224,0.1); color: var(--navy); font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check" style="color: var(--cyan);"></i> Canales x Integridad</span>
          <span style="padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(0,194,224,0.1); color: var(--navy); font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check" style="color: var(--cyan);"></i> Directorio Ejecutivo</span>
          <span style="padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(0,194,224,0.1); color: var(--navy); font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check" style="color: var(--cyan);"></i> Tu Gobierno en Números</span>
          <span style="padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(0,194,224,0.1); color: var(--navy); font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check" style="color: var(--cyan);"></i> Riesgo en la Mira</span>
          <span style="padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(0,194,224,0.1); color: var(--navy); font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check" style="color: var(--cyan);"></i> Métricas Portal</span>
          <span style="padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(0,194,224,0.1); color: var(--navy); font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check" style="color: var(--cyan);"></i> Asistente Lupita</span>
          <span style="padding: 0.25rem 0.6rem; border-radius: 6px; background: rgba(0,194,224,0.1); color: var(--navy); font-size: 0.78rem; font-weight: 600;"><i class="fas fa-check" style="color: var(--cyan);"></i> Bitácora de Auditoría</span>
        </div>
      </div>
    </div>
  `;
}

function renderSecurityTab(sec) {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
      <!-- TARJETA 1: FIREBASE AUTH -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0,194,224,0.15); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Autenticación Firebase Auth</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> Email/Password + JWKS Backend</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45; margin-bottom: 1rem;">
          Validación criptográfica RS256 en backend con llaves públicas oficiales de Google (JWKS). Se verifica de forma estricta: firma digital, expiración, emisor, audiencia y UID inmutable del operador.
        </p>
        <div style="font-size: 0.82rem; background: var(--surface); padding: 0.75rem 1rem; border-radius: 8px;">
          <div><strong>Proyecto Firebase:</strong> <code>${sec.projectId || 'pia-portal-integridad'}</code></div>
          <div><strong>Proveedor:</strong> <code>Email / Contraseña institucional</code></div>
        </div>
      </div>

      <!-- TARJETA 2: CONTROL DE CONCURRENCIA -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(34,197,94,0.15); color: #22C55E; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-exchange-alt"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Control de Concurrencia Optimista</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> Hash SHA-256 ETag Activo</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45;">
          Protección contra colisiones de edición simultánea entre los dos operadores. Cada actualización valida el hash del archivo original; si la otra persona modificó el registro primero, el sistema previene la sobreescritura y solicita recarga.
        </p>
      </div>

      <!-- TARJETA 3: RESPALDOS ATÓMICOS -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0,194,224,0.15); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-history"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Escritura Atómica y Respaldos</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> Rotación a 30 Versiones</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45;">
          Las escrituras se realizan en archivo temporal <code>.tmp</code> con reemplazo atómico <code>renameSync</code> para evitar archivos JSON corruptos ante caídas. Previo a cada guardado se genera copia de seguridad versionada en <code>C:\\PIA_Data\\backups</code>.
        </p>
      </div>

      <!-- TARJETA 4: AUDITORÍA INDIVIDUALIZADA -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(245,158,11,0.15); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-fingerprint"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Trazabilidad por UID Inmutable</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> Bitácora Individualizada</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45;">
          Cada operación (creación, edición, eliminación, conocimiento de Lupita o respaldo) queda registrada con el <code>userUid</code> exacto de Firebase, timestamp UTC, IP origen y archivo modificado, garantizando responsabilidad individual no repudiable.
        </p>
      </div>

      <!-- TARJETA 5: LUPITA (GEMINI API) -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(168,85,247,0.15); color: #A855F7; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-robot"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Asistente Virtual Lupita (Gemini)</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> Proxy Seguro + Rate Limit</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45; margin-bottom: 0.75rem;">
          Proxy backend en Node.js mediante SDK oficial <code>@google/genai</code>. Clave <code>GEMINI_API_KEY</code> nunca expuesta en el cliente. Incluye rate limit (15 req/min por IP), sanitización de entrada y fallback heurístico en contingencias.
        </p>
        <div style="font-size: 0.82rem; background: var(--surface); padding: 0.5rem 0.75rem; border-radius: 6px;">
          <strong>Modelo:</strong> gemini-2.5-flash · <strong>Fallback Heurístico:</strong> Activo
        </div>
      </div>

      <!-- TARJETA 6: BLINDAJE NAVEGADOR -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(239,68,68,0.15); color: #EF4444; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-ban"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Eliminación de Superficie de Ataque</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> Cero Gestión Local</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45;">
          Se eliminaron todos los formularios de creación de usuarios en el navegador, backdoors y roles no institucionales. Las rutas <code>/api/users</code> responden 403 Forbidden a cualquier intento de modificación desde cliente web.
        </p>
      </div>
    </div>
  `;
}
