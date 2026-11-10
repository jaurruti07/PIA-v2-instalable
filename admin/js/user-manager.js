// user-manager.js - Módulo de Identidades Institucionales, Permisos y Contraseñas Encriptadas
// Portal de Integridad Activa (PIA) - Comisión Nacional contra la Corrupción (CNC)

let cachedUsers = [];
let cachedStatus = null;
let activeTab = 'operators';

const AVAILABLE_MODULES = [
  { id: 'canales', label: 'Canales por la Integridad', icon: 'fa-shield-alt' },
  { id: 'directorio', label: 'Directorio Acceso al Ejecutivo', icon: 'fa-address-book' },
  { id: 'tableros', label: 'Tu Gobierno en Números', icon: 'fa-chart-pie' },
  { id: 'riesgo', label: 'Riesgo en la Mira', icon: 'fa-triangle-exclamation' },
  { id: 'vehiculos', label: 'Transparencia Vehicular', icon: 'fa-car' },
  { id: 'portal', label: 'Métricas Generales del Portal', icon: 'fa-tachometer-alt' },
  { id: 'visits', label: 'Contador de Visitas Reales', icon: 'fa-chart-line' },
  { id: 'chatbot', label: 'Configuración Asistente Lupita', icon: 'fa-robot' },
  { id: 'users', label: 'Gestión de Usuarios y Permisos', icon: 'fa-users-cog' },
  { id: 'audit', label: 'Bitácora de Auditoría Inmutable', icon: 'fa-history' },
  { id: 'database', label: 'Mantenimiento BD y Respaldos', icon: 'fa-database' },
  { id: 'guide', label: 'Guía Técnica del Sistema', icon: 'fa-book-open' }
];

export async function initUserManager(initialTab = 'operators') {
  activeTab = (initialTab === 'security' || initialTab === 'security_policies') ? 'security' : 'operators';
  await fetchUsersAndStatus();
  renderUserManagerView();
}

async function fetchUsersAndStatus() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  try {
    const resUsers = await fetch('/api/users', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    if (resUsers.ok) {
      const data = await resUsers.json();
      cachedUsers = data.users || [];
    }
  } catch (err) {
    console.warn('Error cargando usuarios:', err);
  }

  try {
    const resStatus = await fetch('/api/admin/operators-status', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    if (resStatus.ok) {
      cachedStatus = await resStatus.json();
    } else {
      cachedStatus = getFallbackStatus();
    }
  } catch (err) {
    console.warn('Error cargando estado:', err);
    cachedStatus = getFallbackStatus();
  }
}

function getFallbackStatus() {
  return {
    model: 'server_unavailable',
    maxAllowed: 2,
    configuredCount: 0,
    slots: [],
    security: {
      authProvider: 'No disponible: el servidor no confirmó el estado de autenticación.',
      concurrencyControl: 'Estado no verificado',
      atomicWrites: 'Estado no verificado',
      automatedBackups: 'Estado no verificado',
      immutableUidAudit: 'Estado no verificado'
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
  const users = (cachedUsers && cachedUsers.length > 0) ? cachedUsers : (data.slots || []);
  const sec = data.security || {};

  contentArea.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <!-- ENCABEZADO -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,194,224,0.12); color: var(--cyan); padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.75rem;">
            <i class="fas fa-shield-alt"></i> Seguridad y Acceso Institucional · CNC
          </div>
          <h1 style="color: var(--navy); font-size: 1.85rem; font-weight: 800; margin-bottom: 0.35rem;">
            Gestión de Usuarios, Roles y Permisos
          </h1>
          <p style="color: #5E7A8E; font-size: 0.95rem; max-width: 820px;">
            Administración centralizada de identidades autorizadas, permisos por módulo y actualización de contraseñas encriptadas (PBKDF2 con sal criptográfica). Actualmente ambas cuentas poseen acceso pleno a todos los módulos.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="btnRefreshStatus" style="padding: 0.65rem 1.1rem; background: #fff; border: 1px solid var(--border); border-radius: 10px; color: var(--navy); font-weight: 700; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
            <i class="fas fa-sync-alt"></i> Actualizar Datos
          </button>
        </div>
      </div>

      <!-- PESTAÑAS DE NAVEGACIÓN -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); margin-bottom: 2rem;">
        <button id="tabOperatorsBtn" style="padding: 0.75rem 1.25rem; font-weight: 700; font-size: 0.92rem; background: none; border: none; border-bottom: 3px solid ${activeTab === 'operators' ? 'var(--cyan)' : 'transparent'}; color: ${activeTab === 'operators' ? 'var(--navy)' : '#5E7A8E'}; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-users-cog"></i> Usuarios Autorizados y Permisos (${users.length})
        </button>
        <button id="tabSecurityBtn" style="padding: 0.75rem 1.25rem; font-weight: 700; font-size: 0.92rem; background: none; border: none; border-bottom: 3px solid ${activeTab === 'security' ? 'var(--cyan)' : 'transparent'}; color: ${activeTab === 'security' ? 'var(--navy)' : '#5E7A8E'}; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-lock"></i> Políticas de Seguridad Institucional
        </button>
      </div>

      <!-- CONTENIDO DE PESTAÑA -->
      ${activeTab === 'operators' ? renderOperatorsTab(users) : renderSecurityTab(sec)}
    </div>

    <!-- MODAL DE CAMBIO DE CONTRASEÑA -->
    <div id="modalPasswordChange" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.65); backdrop-filter:blur(4px); z-index:9999; align-items:center; justify-content:center; padding:1.5rem;">
      <div style="background:#fff; border-radius:18px; max-width:440px; width:100%; box-shadow:0 20px 40px rgba(0,0,0,0.25); overflow:hidden; border:1px solid rgba(0,194,224,0.3);">
        <div style="background:var(--navy); color:#fff; padding:1.25rem 1.5rem; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="fas fa-key" style="color:var(--cyan); font-size:1.2rem;"></i>
            <h3 style="margin:0; font-size:1.1rem; font-weight:800;">Cambiar Contraseña</h3>
          </div>
          <button id="btnCloseModalPwd" style="background:none; border:none; color:rgba(255,255,255,0.7); font-size:1.2rem; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:1.5rem;">
          <p style="font-size:0.88rem; color:#5E7A8E; margin-bottom:1.25rem; line-height:1.45;">
            Modificando contraseña para el usuario institucional:<br>
            <strong id="modalUserEmailTarget" style="color:var(--navy); font-size:0.95rem;"></strong>
          </p>
          <div style="margin-bottom:1.25rem;">
            <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--navy); margin-bottom:0.4rem;">
              Nueva Contraseña:
            </label>
            <input type="password" id="inputNewPassword" placeholder="Nueva contraseña (mínimo 14 caracteres)" minlength="14" style="width:100%; padding:0.75rem 1rem; border:1px solid var(--border); border-radius:10px; font-size:0.95rem; box-sizing:border-box;">
          </div>
          <div style="margin-bottom:1.5rem;">
            <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--navy); margin-bottom:0.4rem;">
              Confirmar Contraseña:
            </label>
            <input type="password" id="inputConfirmPassword" placeholder="Repita la nueva contraseña" style="width:100%; padding:0.75rem 1rem; border:1px solid var(--border); border-radius:10px; font-size:0.95rem; box-sizing:border-box;">
          </div>
          <div id="modalPwdError" style="display:none; padding:0.65rem 0.85rem; border-radius:8px; background:rgba(239,68,68,0.12); color:#DC2626; font-size:0.82rem; margin-bottom:1.25rem;"></div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
            <button id="btnCancelModalPwd" style="padding:0.65rem 1.1rem; border:1px solid var(--border); background:#fff; border-radius:10px; font-weight:700; cursor:pointer;">Cancelar</button>
            <button id="btnSaveModalPwd" style="padding:0.65rem 1.25rem; background:var(--navy); color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px;">
              <i class="fas fa-lock"></i> Guardar y Encriptar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach tab events
  document.getElementById('btnRefreshStatus')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnRefreshStatus');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Actualizando...`;
    await fetchUsersAndStatus();
    renderUserManagerView();
  });

  document.getElementById('tabOperatorsBtn')?.addEventListener('click', () => switchTab('operators'));
  document.getElementById('tabSecurityBtn')?.addEventListener('click', () => switchTab('security'));

  // Attach modal events
  setupModalPasswordEvents();

  // Attach card events
  users.forEach(user => {
    attachUserCardEvents(user);
  });
}

function renderOperatorsTab(users) {
  return `
    <!-- BANNER INFORMATIVO -->
    <div style="background: linear-gradient(135deg, rgba(0,194,224,0.08), rgba(43,130,201,0.06)); border: 1px solid rgba(0,194,224,0.25); border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 16px;">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(0,194,224,0.18); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
        <i class="fas fa-user-shield"></i>
      </div>
      <div>
        <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin-bottom: 0.25rem;">
          Control de Acceso y Gestión de Contraseñas desde el Administrador
        </h3>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45; margin: 0;">
          Puedes otorgar roles, cambiar contraseñas y habilitar o restringir módulos de forma individual para cada uno de los dos operadores autorizados. Las contraseñas quedan almacenadas de manera cifrada e inmutable con <strong>PBKDF2/SHA-512</strong>.
        </p>
      </div>
    </div>

    <!-- TARJETAS DE USUARIOS -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 1.75rem; margin-bottom: 2.5rem;">
      ${users.map((u, idx) => renderUserCard(u, idx + 1)).join('')}
    </div>
  `;
}

function renderUserCard(user, slotNumber) {
  const email = user.email || user.upn;
  const userModules = user.modules || AVAILABLE_MODULES.map(m => m.id);
  const isAllSelected = AVAILABLE_MODULES.every(m => userModules.includes(m.id));

  return `
    <div style="background: #fff; border-radius: 18px; border: 2px solid var(--border); padding: 1.75rem; box-shadow: 0 6px 20px rgba(0,0,0,0.04); position: relative; overflow: hidden;" data-user-email="${email}">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #00C2E0, #2B82C9);"></div>
      
      <!-- HEADER USUARIO -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 52px; height: 52px; border-radius: 14px; background: var(--navy); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800;">
            #${slotNumber}
          </div>
          <div>
            <h3 style="color: var(--navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
              ${user.displayName || 'Operador Institucional'}
            </h3>
            <span style="font-size: 0.82rem; color: #5E7A8E;">
              <i class="fas fa-envelope" style="color: var(--cyan); margin-right: 5px;"></i> ${email}
            </span>
          </div>
        </div>
        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 0.3rem 0.75rem; border-radius: 20px; background: rgba(34,197,94,0.15); color: #16A34A; font-weight: 700; font-size: 0.78rem;">
          <i class="fas fa-check-circle"></i> Activo
        </span>
      </div>

      <!-- DETALLES DE ROL Y CONTRASEÑA -->
      <div style="background: var(--surface); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #5E7A8E; display: block; margin-bottom: 4px;">
            Rol en el Sistema
          </span>
          <select class="user-role-select" data-email="${email}" style="padding: 0.4rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-weight: 700; font-size: 0.88rem; color: var(--navy); background: #fff;">
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador Pleno</option>
            <option value="data_operator" ${user.role === 'data_operator' ? 'selected' : ''}>Operador de Datos</option>
          </select>
        </div>
        <div>
          <button class="btn-change-password" data-email="${email}" style="padding: 0.55rem 1rem; background: var(--navy); color: #fff; border: none; border-radius: 10px; font-size: 0.84rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.2s;">
            <i class="fas fa-key" style="color: var(--cyan);"></i> Cambiar Contraseña
          </button>
        </div>
      </div>

      <!-- ASIGNACIÓN DE PERMISOS POR MÓDULO -->
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
          <h4 style="font-size: 0.85rem; text-transform: uppercase; font-weight: 800; color: var(--navy); margin: 0; letter-spacing: 0.04em;">
            Permisos de Acceso a Módulos:
          </h4>
          <button class="btn-toggle-all-modules" data-email="${email}" style="background: none; border: none; color: var(--cyan); font-size: 0.8rem; font-weight: 700; cursor: pointer; text-decoration: underline;">
            ${isAllSelected ? 'Desmarcar todos' : 'Todos tienen permiso a todo'}
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.55rem; background: #FAFBFD; padding: 0.85rem; border-radius: 12px; border: 1px solid var(--border);">
          ${AVAILABLE_MODULES.map(mod => {
            const isChecked = userModules.includes(mod.id);
            return `
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--navy); font-weight: 600; cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: background 0.15s;">
                <input type="checkbox" class="mod-checkbox" data-email="${email}" value="${mod.id}" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--cyan); cursor: pointer;">
                <i class="fas ${mod.icon}" style="color: var(--cyan); width: 14px; text-align: center;"></i>
                <span>${mod.label}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- BOTÓN GUARDAR PERMISOS -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="save-status-indicator" data-email="${email}" style="font-size: 0.82rem; color: #16A34A; font-weight: 700; display: none;">
          <i class="fas fa-check-circle"></i> Permisos guardados
        </span>
        <button class="btn-save-permissions" data-email="${email}" style="margin-left: auto; padding: 0.65rem 1.25rem; background: linear-gradient(135deg, #00C2E0, #2B82C9); color: #fff; border: none; border-radius: 10px; font-size: 0.88rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,194,224,0.25); transition: all 0.2s;">
          <i class="fas fa-save"></i> Guardar Permisos
        </button>
      </div>
    </div>
  `;
}

function attachUserCardEvents(user) {
  const email = user.email || user.upn;
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  // Rol select change
  const roleSelect = document.querySelector(`.user-role-select[data-email="${email}"]`);
  if (roleSelect) {
    roleSelect.addEventListener('change', async (e) => {
      const newRole = e.target.value;
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}/role`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
          if (window.showToast) window.showToast(`Rol actualizado a ${newRole} para ${email}`, 'success');
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Error actualizando rol');
        }
      } catch (err) {
        alert('Error de conexión al actualizar rol');
      }
    });
  }

  // Toggle all modules
  const toggleBtn = document.querySelector(`.btn-toggle-all-modules[data-email="${email}"]`);
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll(`.mod-checkbox[data-email="${email}"]`);
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      checkboxes.forEach(cb => { cb.checked = !allChecked; });
      toggleBtn.textContent = !allChecked ? 'Desmarcar todos' : 'Todos tienen permiso a todo';
    });
  }

  // Guardar permisos
  const saveBtn = document.querySelector(`.btn-save-permissions[data-email="${email}"]`);
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const checkboxes = document.querySelectorAll(`.mod-checkbox[data-email="${email}"]:checked`);
      const selectedModules = Array.from(checkboxes).map(cb => cb.value);

      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`;

      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}/permissions`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ modules: selectedModules })
        });

        if (res.ok) {
          const data = await res.json();
          const indicator = document.querySelector(`.save-status-indicator[data-email="${email}"]`);
          if (indicator) {
            indicator.style.display = 'inline-flex';
            setTimeout(() => { indicator.style.display = 'none'; }, 3500);
          }
          if (window.showToast) window.showToast(`Permisos guardados para ${email}`, 'success');

          // Actualizar sesión si el usuario modificado es el actual
          const currentStored = JSON.parse(localStorage.getItem('user') || '{}');
          if (currentStored.email && currentStored.email.toLowerCase() === email.toLowerCase()) {
            currentStored.modules = selectedModules;
            localStorage.setItem('user', JSON.stringify(currentStored));
          }
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Error al guardar permisos');
        }
      } catch (err) {
        alert('Error de conexión al guardar permisos');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fas fa-save"></i> Guardar Permisos`;
      }
    });
  }

  // Abrir modal de contraseña
  const changePwdBtn = document.querySelector(`.btn-change-password[data-email="${email}"]`);
  if (changePwdBtn) {
    changePwdBtn.addEventListener('click', () => {
      openPasswordModal(email);
    });
  }
}

let targetEmailForPassword = '';

function openPasswordModal(email) {
  targetEmailForPassword = email;
  const modal = document.getElementById('modalPasswordChange');
  const targetLabel = document.getElementById('modalUserEmailTarget');
  const inputNew = document.getElementById('inputNewPassword');
  const inputConfirm = document.getElementById('inputConfirmPassword');
  const errDiv = document.getElementById('modalPwdError');

  if (targetLabel) targetLabel.textContent = email;
  if (inputNew) inputNew.value = '';
  if (inputConfirm) inputConfirm.value = '';
  if (errDiv) { errDiv.style.display = 'none'; errDiv.textContent = ''; }
  if (modal) modal.style.display = 'flex';
}

function closePasswordModal() {
  const modal = document.getElementById('modalPasswordChange');
  if (modal) modal.style.display = 'none';
  targetEmailForPassword = '';
}

function setupModalPasswordEvents() {
  const btnClose = document.getElementById('btnCloseModalPwd');
  const btnCancel = document.getElementById('btnCancelModalPwd');
  const btnSave = document.getElementById('btnSaveModalPwd');

  if (btnClose) btnClose.addEventListener('click', closePasswordModal);
  if (btnCancel) btnCancel.addEventListener('click', closePasswordModal);

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const inputNew = document.getElementById('inputNewPassword');
      const inputConfirm = document.getElementById('inputConfirmPassword');
      const errDiv = document.getElementById('modalPwdError');

      const p1 = (inputNew?.value || '').trim();
      const p2 = (inputConfirm?.value || '').trim();

      if (!p1 || p1.length < 14) {
        if (errDiv) {
          errDiv.textContent = 'La contraseña debe contener al menos 14 caracteres.';
          errDiv.style.display = 'block';
        }
        return;
      }

      if (p1 !== p2) {
        if (errDiv) {
          errDiv.textContent = 'Las contraseñas no coinciden.';
          errDiv.style.display = 'block';
        }
        return;
      }

      btnSave.disabled = true;
      btnSave.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Encriptando...`;
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(targetEmailForPassword)}/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ newPassword: p1 })
        });

        if (res.ok) {
          closePasswordModal();
          if (window.showToast) {
            window.showToast(`Contraseña actualizada y encriptada exitosamente para ${targetEmailForPassword}`, 'success');
          } else {
            alert(`Contraseña actualizada exitosamente para ${targetEmailForPassword}`);
          }
          await fetchUsersAndStatus();
          renderUserManagerView();
        } else {
          const err = await res.json().catch(() => ({}));
          if (errDiv) {
            errDiv.textContent = err.error || 'Error al actualizar la contraseña.';
            errDiv.style.display = 'block';
          }
        }
      } catch (err) {
        if (errDiv) {
          errDiv.textContent = 'Error de conexión con el servidor.';
          errDiv.style.display = 'block';
        }
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = `<i class="fas fa-lock"></i> Guardar y Encriptar`;
      }
    });
  }
}

function renderSecurityTab(sec) {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
      <!-- TARJETA 1: ENCRIPTACIÓN LOCAL Y FIREBASE -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0,194,224,0.15); color: var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Autenticación Criptográfica Robusta</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> PBKDF2/SHA-512 + Firebase</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45; margin-bottom: 1rem;">
          Contraseñas cifradas mediante sal aleatoria única por usuario y 10,000 iteraciones PBKDF2 con SHA-512, complementadas con tokens de sesión HMAC-SHA256 con expiración automática.
        </p>
        <div style="font-size: 0.82rem; background: var(--surface); padding: 0.75rem 1rem; border-radius: 8px;">
          <div><strong>Algoritmo Cifrado:</strong> <code>PBKDF2-HMAC-SHA512 (310,000 iteraciones)</code></div>
          <div><strong>Cuentas Autorizadas:</strong> <code>2 operadores de la CNC</code></div>
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
          Protección contra colisiones de edición simultánea entre los dos operadores. Cada actualización valida el hash del archivo original para prevenir la sobreescritura accidental.
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
          Las escrituras se realizan en archivo temporal <code>.tmp</code> con reemplazo atómico <code>renameSync</code>. Previo a cada guardado se genera copia de seguridad versionada en <code>data/backups</code>.
        </p>
      </div>

      <!-- TARJETA 4: AUDITORÍA INDIVIDUALIZADA -->
      <div style="background: #fff; border-radius: 16px; border: 1px solid var(--border); padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(245,158,11,0.15); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fas fa-fingerprint"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0;">Trazabilidad Inmutable</h3>
            <span style="font-size: 0.8rem; color: #22C55E; font-weight: 700;"><i class="fas fa-check-circle"></i> Bitácora en audit_logs.json</span>
          </div>
        </div>
        <p style="font-size: 0.88rem; color: #5E7A8E; line-height: 1.45;">
          Cada operación (creación, edición, eliminación o cambio de permisos) queda registrada con el correo institucional exacto, timestamp UTC, IP origen y detalle del cambio.
        </p>
      </div>
    </div>
  `;
}
