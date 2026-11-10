// app.js - Controlador principal del panel administrativo PIA
import { initDatabaseManager } from './database-manager.js';
import { initUserManager } from './user-manager.js';
import { initChatbotManager } from './chatbot-manager.js';
import { initTechnicalGuide } from './technical-guide.js';
import { validateModuleRecord } from './schema-validator.js';
import { loginWithFirebase, sendFirebasePasswordReset, verifyToken, logout as authLogout } from './auth.js';

// Session Inactivity Timer Configuration (30 minutos)
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
let inactivityTimer = null;

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    const token = localStorage.getItem('token');
    if (token) {
        inactivityTimer = setTimeout(() => {
            if (localStorage.getItem('token')) {
                logout('Expiración de sesión por inactividad (30 minutos de inactividad por motivos de seguridad).');
            }
        }, INACTIVITY_TIMEOUT_MS);
    }
}

// Escuchar eventos del usuario para reiniciar el temporizador de inactividad
['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
});

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar si hay alguna razón de cierre de sesión guardada
    const logoutReason = sessionStorage.getItem('logout_reason');
    if (logoutReason) {
        sessionStorage.removeItem('logout_reason');
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right: 6px; color: var(--orange);"></i> ${logoutReason}`;
            errorDiv.style.display = 'block';
        }
    }

    // Toggle para visualizar u ocultar contraseña
    const btnTogglePassword = document.getElementById('btnTogglePassword');
    const loginPasswordInput = document.getElementById('loginPassword');
    const iconTogglePassword = document.getElementById('iconTogglePassword');
    if (btnTogglePassword && loginPasswordInput && iconTogglePassword) {
        btnTogglePassword.addEventListener('click', () => {
            const isPassword = loginPasswordInput.type === 'password';
            loginPasswordInput.type = isPassword ? 'text' : 'password';
            iconTogglePassword.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }

    // Toggle para panel de recuperación de contraseña
    const btnToggleForgotView = document.getElementById('btnToggleForgotView');
    const forgotPasswordPanel = document.getElementById('forgotPasswordPanel');
    const btnCloseForgotPanel = document.getElementById('btnCloseForgotPanel');
    if (btnToggleForgotView && forgotPasswordPanel) {
        btnToggleForgotView.addEventListener('click', () => {
            const isHidden = forgotPasswordPanel.style.display === 'none' || !forgotPasswordPanel.style.display;
            forgotPasswordPanel.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                const emailVal = document.getElementById('loginEmail')?.value;
                if (emailVal && document.getElementById('resetEmail')) {
                    document.getElementById('resetEmail').value = emailVal;
                }
            }
        });
    }
    if (btnCloseForgotPanel && forgotPasswordPanel) {
        btnCloseForgotPanel.addEventListener('click', () => {
            forgotPasswordPanel.style.display = 'none';
        });
    }

    // Envío de restablecimiento de contraseña vía Firebase
    const btnSendPasswordReset = document.getElementById('btnSendPasswordReset');
    const resetFeedback = document.getElementById('resetFeedback');
    if (btnSendPasswordReset) {
        btnSendPasswordReset.addEventListener('click', async () => {
            const resetEmail = (document.getElementById('resetEmail')?.value || '').trim();
            if (!resetEmail) {
                if (resetFeedback) {
                    resetFeedback.style.display = 'block';
                    resetFeedback.style.background = 'rgba(239, 68, 68, 0.2)';
                    resetFeedback.style.color = '#fca5a5';
                    resetFeedback.textContent = 'Ingrese el correo institucional registrado.';
                }
                return;
            }
            btnSendPasswordReset.disabled = true;
            btnSendPasswordReset.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando enlace...';
            try {
                const res = await sendFirebasePasswordReset(resetEmail);
                if (resetFeedback) {
                    resetFeedback.style.display = 'block';
                    resetFeedback.style.background = 'rgba(34, 197, 94, 0.2)';
                    resetFeedback.style.color = '#86efac';
                    resetFeedback.textContent = res.message || 'Se ha enviado el enlace de restablecimiento a su correo.';
                }
            } catch (err) {
                if (resetFeedback) {
                    resetFeedback.style.display = 'block';
                    resetFeedback.style.background = 'rgba(239, 68, 68, 0.2)';
                    resetFeedback.style.color = '#fca5a5';
                    resetFeedback.textContent = err.message || 'Error al enviar enlace de restablecimiento.';
                }
            } finally {
                btnSendPasswordReset.disabled = false;
                btnSendPasswordReset.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Enlace de Restablecimiento';
            }
        });
    }

    // Inicio de Sesión Oficial con Firebase Auth
    const loginForm = document.getElementById('firebaseLoginForm');
    const btnLoginSubmit = document.getElementById('btnLoginSubmit');
    const errorDiv = document.getElementById('loginError');

    async function handleLoginSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }

        const emailInput = document.getElementById('loginEmail');
        const passInput = document.getElementById('loginPassword');
        const email = (emailInput?.value || '').trim();
        const password = (passInput?.value || '').trim();

        if (!email || !password) {
            if (errorDiv) {
                errorDiv.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i> Ingrese su correo institucional y su contraseña.';
                errorDiv.style.display = 'block';
            }
            return;
        }

        const originalBtnHtml = btnLoginSubmit ? btnLoginSubmit.innerHTML : '';
        if (btnLoginSubmit) {
            btnLoginSubmit.disabled = true;
            btnLoginSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
        }

        try {
            const { user } = await loginWithFirebase(email, password);
            showToast(`¡Bienvenido! Sesión iniciada como ${user.displayName || user.upn}`, 'success');
            showDashboard(user);
            resetInactivityTimer();
        } catch (err) {
            console.error('Login error:', err);
            if (errorDiv) {
                errorDiv.innerHTML = `<i class="fas fa-shield-alt" style="margin-right:6px;"></i> ${err.message || 'Error de autenticación'}`;
                errorDiv.style.display = 'block';
            }
            showToast(err.message || 'Acceso institucional denegado', 'error');
        } finally {
            if (btnLoginSubmit) {
                btnLoginSubmit.disabled = false;
                btnLoginSubmit.innerHTML = originalBtnHtml;
            }
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    if (btnLoginSubmit) {
        btnLoginSubmit.addEventListener('click', handleLoginSubmit);
    }

    // Verificar token guardado
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
        try {
            const { user } = await verifyToken(token);
            showDashboard(user);
            resetInactivityTimer();
        } catch (err) {
            console.warn('Sesión no válida o expirada:', err);
            showLogin();
        }
    } else {
        showLogin();
    }

    // Sidebar toggles & overlay for mobile
    const sidebar = document.getElementById('sidebar');
    const toggleMob = document.getElementById('sidebarToggleMobile');
    const closeMob = document.getElementById('sidebarCloseMobile');
    const overlay = document.getElementById('sidebarOverlay');

    function openMobileSidebar() {
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
    }

    function closeMobileSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    if (toggleMob) toggleMob.addEventListener('click', openMobileSidebar);
    if (closeMob) closeMob.addEventListener('click', closeMobileSidebar);
    if (overlay) overlay.addEventListener('click', closeMobileSidebar);

    // Delegation for nav buttons in sidebar
    document.querySelectorAll('[data-module]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mod = btn.dataset.module;
            if (mod) {
                navigateTo(mod);
                if (window.innerWidth <= 992) {
                    closeMobileSidebar();
                }
            }
        });
    });
});

// ============================
// MOSTRAR / OCULTAR PÁGINAS Y ROLES
// ============================

let currentUser = null;

const ROLE_LABELS = {
    data_operator: 'Operador(a) Institucional',
    superadmin: 'Operador(a) Institucional',
    module_editor: 'Operador(a) Institucional',
    reviewer: 'Revisor Institucional',
    viewer: 'Consulta'
};

function hasAccessToModule(moduleName) {
    if (!currentUser) return false;
    if (moduleName === 'dashboard') return true;
    if (moduleName === 'vehiculos' || moduleName === 'vehiculos_instituciones') return false;

    // Módulo de usuarios y roles
    if (moduleName === 'security' || moduleName === 'users' || moduleName === 'roles') {
        if (!currentUser.modules || currentUser.modules.includes('users') || currentUser.role === 'admin') {
            return true;
        }
        return false;
    }

    // Verificar si el módulo está en la lista asignada por el administrador
    if (Array.isArray(currentUser.modules) && currentUser.modules.length > 0) {
        return currentUser.modules.includes(moduleName);
    }
    return true;
}

function updateSidebarPermissions() {
    if (!currentUser) return;
    const userModules = currentUser.modules || [];
    const isAdmin = currentUser.role === 'admin';

    document.querySelectorAll('[data-module]').forEach(btn => {
        const mod = btn.dataset.module;
        const parent = btn.closest('li') || btn;

        if (mod === 'vehiculos') {
            parent.style.display = 'none';
        } else if (mod === 'dashboard') {
            parent.style.display = 'block';
        } else if (mod === 'security' || mod === 'users') {
            parent.style.display = (isAdmin || userModules.includes('users')) ? 'block' : 'none';
        } else {
            const hasPerm = isAdmin || userModules.length === 0 || userModules.includes(mod);
            parent.style.display = hasPerm ? 'block' : 'none';
        }
    });
}

function showLogin() {
    currentUser = null;
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    const loginContainer = document.getElementById('loginContainer');
    const mainLayout = document.getElementById('mainLayout');
    if (loginContainer) loginContainer.style.display = 'flex';
    if (mainLayout) mainLayout.style.display = 'none';
}

function showDashboard(user) {
    currentUser = user;
    if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('user', JSON.stringify(user));
    }

    const loginContainer = document.getElementById('loginContainer');
    const mainLayout = document.getElementById('mainLayout');
    if (loginContainer) loginContainer.style.display = 'none';
    if (mainLayout) mainLayout.style.display = 'grid';

    // Set institutional user info
    const emailDisplay = document.getElementById('userEmailDisplay');
    const roleDisplay = document.getElementById('userRoleDisplay');
    const userAvatar = document.getElementById('userAvatar');

    const name = user.displayName || user.upn || 'Operador Institucional';
    const email = user.upn || '';
    const operatorNumber = user.operatorIndex ? `Operador #${user.operatorIndex}` : 'Operador Autorizado';
    if (emailDisplay) emailDisplay.textContent = email ? `${name} (${email})` : name;
    if (roleDisplay) roleDisplay.textContent = `${ROLE_LABELS[user.role] || 'Operador Institucional'} · ${operatorNumber}`;
    if (userAvatar) userAvatar.textContent = user.operatorIndex ? String(user.operatorIndex) : name.charAt(0).toUpperCase();

    updateSidebarPermissions();

    // Default navigate
    navigateTo('dashboard');
}

window.logout = async function(reason) {
    await authLogout(reason);
};

window.navigateTo = async function(module) {
    if (!hasAccessToModule(module)) {
        showToast(`El módulo '${module}' ha sido sustituido en el modelo exclusivo de dos operadores.`, 'info');
        navigateTo('security');
        return;
    }

    // Highlight sidebar active state
    document.querySelectorAll('[data-module]').forEach(b => {
        if (b.dataset.module === module) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;

    if (module === 'dashboard') {
        renderDashboardView();
        await loadDashboardData();
        return;
    }

    if (module === 'database') {
        await initDatabaseManager();
        return;
    }

    if (module === 'users' || module === 'roles' || module === 'security') {
        await initUserManager('operators');
        return;
    }

    if (module === 'chatbot') {
        await initChatbotManager();
        return;
    }

    if (module === 'audit') {
        renderAuditView();
        await loadAuditData();
        return;
    }

    if (module === 'guide') {
        initTechnicalGuide();
        return;
    }

    if (module === 'visits') {
        renderVisitsView();
        await loadVisitsData();
        return;
    }

    // Dynamic CRUD Module (canales, directorio, tableros, riesgo, vehiculos, portal)
    renderCrudView(module);
    await fetchAndRenderTable(module);
};

// ============================
// DASHBOARD VIEW & DATA
// ============================

function renderDashboardView() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="page-header">
            <h1>Dashboard de Control</h1>
            <p>Métricas en tiempo real sincronizadas directamente con la base de datos JSON y accesos reales del portal</p>
        </div>
        <div id="statsGrid" class="indicators-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
            <div class="indicator-card" style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #5E7A8E; margin-bottom: 0.5rem;"><i class="fas fa-cubes"></i> Total Registros</div>
                <div style="font-size: 2rem; font-weight: 800; color: #0C1F30;" id="dashTotalRegs">...</div>
            </div>
            <div class="indicator-card" style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #5E7A8E; margin-bottom: 0.5rem;"><i class="fas fa-building"></i> Instituciones</div>
                <div style="font-size: 2rem; font-weight: 800; color: #1A5C8F;" id="dashTotalInst">...</div>
            </div>
            <div class="indicator-card" style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #5E7A8E; margin-bottom: 0.5rem;"><i class="fas fa-chart-bar"></i> Tableros de Gobierno</div>
                <div style="font-size: 2rem; font-weight: 800; color: #22C55E;" id="dashTotalTableros">...</div>
            </div>
            <div class="indicator-card" style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05); cursor: pointer; border-left: 4px solid #2B82C9;" onclick="navigateTo('visits')" title="Clic para ver desglose detallado de visitas">
                <div style="font-size: 0.85rem; color: #2B82C9; margin-bottom: 0.5rem; font-weight: 700;"><i class="fas fa-chart-line"></i> Visitas Totales Reales</div>
                <div style="font-size: 2rem; font-weight: 800; color: #05111F;" id="dashTotalVisits">...</div>
                <div style="font-size: 0.72rem; color: #5E7A8E; margin-top: 2px;">Clic para ver analítica &rarr;</div>
            </div>
            <div class="indicator-card" style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #5E7A8E; margin-bottom: 0.5rem;"><i class="fas fa-user-shield"></i> Modelo de Acceso</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #00C2E0;">2 Operadores</div>
            </div>
        </div>

        <!-- Fila de Visitas Reales y Gestión Rápida -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem; margin-bottom: 2rem;">
            <div style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3 style="color: #05111F; font-size: 1.15rem;"><i class="fas fa-chart-line" style="color:#2B82C9; margin-right:6px;"></i> Visitas Reales por Página</h3>
                    <button onclick="navigateTo('visits')" style="font-size:0.8rem; background:none; border:none; color:#2B82C9; font-weight:700; cursor:pointer;">Ver Analítica &rarr;</button>
                </div>
                <div id="dashVisitsMiniList" style="font-size: 0.9rem; color: #5E7A8E;">Cargando contador de visitas...</div>
            </div>
            <div style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3 style="color: #05111F; font-size: 1.15rem;"><i class="fas fa-history" style="color:#00C2E0; margin-right:6px;"></i> Bitácora de Actividad Reciente</h3>
                    <button onclick="navigateTo('audit')" style="font-size:0.8rem; background:none; border:none; color:#00C2E0; font-weight:700; cursor:pointer;">Ver Todo &rarr;</button>
                </div>
                <div id="activityList" style="font-size: 0.9rem; color: #5E7A8E;">Cargando actividad...</div>
            </div>
        </div>

        <!-- Módulos de Gestión Rápida -->
        <div style="background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 0.5rem; color: #05111F;"><i class="fas fa-tasks"></i> Gestión Rápida de Módulos Autorizados</h3>
            <p style="font-size: 0.9rem; color: #5E7A8E; margin-bottom: 1.25rem;">Selecciona cualquiera de los módulos activos para editar o consultar los datos oficiales en tiempo real.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                <button onclick="navigateTo('canales')" style="padding: 0.6rem 1rem; background: #00C2E0; color: #05111F; font-weight: 700; border-radius: 8px;"><i class="fas fa-comments"></i> Canales</button>
                <button onclick="navigateTo('directorio')" style="padding: 0.6rem 1rem; background: #1A5C8F; color: #fff; font-weight: 700; border-radius: 8px;"><i class="fas fa-address-book"></i> Directorio</button>
                <button onclick="navigateTo('tableros')" style="padding: 0.6rem 1rem; background: #22C55E; color: #fff; font-weight: 700; border-radius: 8px;"><i class="fas fa-chart-bar"></i> Tableros</button>
                <button onclick="navigateTo('riesgo')" style="padding: 0.6rem 1rem; background: #F97316; color: #fff; font-weight: 700; border-radius: 8px;"><i class="fas fa-bullseye"></i> Riesgos</button>
                <button onclick="navigateTo('visits')" style="padding: 0.6rem 1rem; background: #2B82C9; color: #fff; font-weight: 700; border-radius: 8px;"><i class="fas fa-chart-line"></i> Contador de Visitas</button>
                <button onclick="navigateTo('chatbot')" style="padding: 0.6rem 1rem; background: #8B5CF6; color: #fff; font-weight: 700; border-radius: 8px;"><i class="fas fa-robot"></i> Asistente Lupita</button>
                <button onclick="navigateTo('security')" style="padding: 0.6rem 1rem; background: #05111F; color: #00C2E0; border: 1px solid rgba(0,194,224,0.3); font-weight: 700; border-radius: 8px;"><i class="fas fa-user-shield"></i> Identidades y Seguridad</button>
                <button onclick="navigateTo('audit')" style="padding: 0.6rem 1rem; background: #163250; color: #fff; font-weight: 700; border-radius: 8px;"><i class="fas fa-shield-alt"></i> Bitácora de Auditoría</button>
                <button onclick="navigateTo('guide')" style="padding: 0.6rem 1rem; background: #05111F; color: #fff; border: 1px solid var(--border); font-weight: 700; border-radius: 8px;"><i class="fas fa-book-open"></i> Guía Técnica</button>
            </div>
        </div>
    `;
}

async function loadDashboardData() {
    try {
        const res = await fetch('/api/dashboard/stats', { headers: getHeaders() });
        const stats = await res.json();

        const dashRegs = document.getElementById('dashTotalRegs');
        const dashInst = document.getElementById('dashTotalInst');
        const dashTableros = document.getElementById('dashTotalTableros');
        const dashVehiculos = document.getElementById('dashTotalVehiculos');
        const dashVisits = document.getElementById('dashTotalVisits');

        if (dashRegs) dashRegs.textContent = stats.registros || 0;
        if (dashInst) dashInst.textContent = stats.instituciones || 0;
        if (dashTableros) dashTableros.textContent = stats.tableros || 0;
        if (dashVehiculos) dashVehiculos.textContent = stats.vehiculos || 0;
        if (dashVisits && stats.visitasTotales !== undefined) {
            dashVisits.textContent = Number(stats.visitasTotales).toLocaleString();
        }

        // Cargar desglose de visitas en el dashboard
        try {
            const vRes = await fetch('/api/admin/visits', { headers: getHeaders() });
            if (vRes.ok) {
                const vData = await vRes.json();
                if (dashVisits) dashVisits.textContent = (Number(vData.totalVisits) || 0).toLocaleString();
                const miniList = document.getElementById('dashVisitsMiniList');
                if (miniList && vData.pages) {
                    const pagesArr = Object.entries(vData.pages)
                        .sort((a, b) => (b[1].visits || 0) - (a[1].visits || 0))
                        .slice(0, 5);
                    const total = Number(vData.totalVisits) || 1;
                    miniList.innerHTML = pagesArr.map(([pathUrl, info]) => {
                        const count = Number(info.visits) || 0;
                        const pct = Math.round((count / total) * 100);
                        return `
                            <div style="padding: 0.55rem 0; border-bottom: 1px solid #E8EEF7; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <strong style="color: #05111F; font-size: 0.88rem;">${info.name}</strong>
                                    <code style="font-size:0.75rem; color:#5E7A8E; background:#F0F5FB; padding:1px 5px; border-radius:4px;">${pathUrl}</code>
                                </div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-weight:700; color:#1A5C8F;">${count.toLocaleString()}</span>
                                    <span style="font-size:0.75rem; color:#5E7A8E; background:#F0F5FB; padding:2px 6px; border-radius:10px;">${pct}%</span>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        } catch (e) {
            console.error('Error cargando mini visitas:', e);
        }

        const auditRes = await fetch('/api/dashboard/audit', { headers: getHeaders() });
        const audit = await auditRes.json();
        const activityList = document.getElementById('activityList');

        if (activityList) {
            if (!audit || audit.length === 0) {
                activityList.innerHTML = '<p>No hay actividad registrada aún.</p>';
            } else {
                activityList.innerHTML = audit.slice(0, 7).map(item => `
                    <div style="padding: 0.6rem 0; border-bottom: 1px solid #E8EEF7; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #05111F;">${item.user}</strong>: ${item.action} 
                            <span style="font-size: 0.75rem; background: #F0F5FB; padding: 2px 8px; border-radius: 12px; color: #1A5C8F;">${item.module}</span>
                        </div>
                        <span style="font-size: 0.75rem; color: #A8BFCC;">${formatDate(item.timestamp)}</span>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

// ============================
// CONTADOR REAL DE VISITAS
// ============================

let visitsDataCache = null;

function renderVisitsView() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h1 style="font-family: var(--font-head); font-size: 1.8rem; font-weight: 800; color: #05111F;">
                    <i class="fas fa-chart-line" style="color: #00C2E0; margin-right: 0.5rem;"></i>Contador y Analítica Real de Visitas
                </h1>
                <p style="color: #5E7A8E; font-size: 0.95rem;">Monitoreo en tiempo real de accesos ciudadanos a las páginas públicas del Portal de Integridad Activa (PIA).</p>
            </div>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button id="btnRefreshVisits" style="padding: 0.75rem 1.25rem; background: #00C2E0; color: #05111F; font-weight: 700; border-radius: 12px; border: none; cursor: pointer; transition: all 0.2s;">
                    <i class="fas fa-sync-alt"></i> Actualizar Métricas
                </button>
                <button id="btnExportVisitsJson" style="padding: 0.75rem 1.25rem; background: #05111F; color: #fff; font-weight: 600; border-radius: 12px; border: none; cursor: pointer;">
                    <i class="fas fa-file-download"></i> Exportar JSON
                </button>
                <button id="btnExportVisitsCsv" style="padding: 0.75rem 1.25rem; background: #1A5C8F; color: #fff; font-weight: 600; border-radius: 12px; border: none; cursor: pointer;">
                    <i class="fas fa-file-csv"></i> Exportar CSV
                </button>
            </div>
        </div>

        <!-- Indicadores Principales de Visitas -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
            <div style="background: #fff; padding: 1.3rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border-left: 4px solid #00C2E0;">
                <div style="font-size: 0.8rem; color: #5E7A8E; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;"><i class="fas fa-eye"></i> Visitas Totales Reales</div>
                <div id="statTotalVisits" style="font-size: 2.2rem; font-weight: 800; color: #05111F; margin-top: 0.3rem;">...</div>
                <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 0.25rem;">Accesos acumulados verificados</div>
            </div>
            <div style="background: #fff; padding: 1.3rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border-left: 4px solid #22C55E;">
                <div style="font-size: 0.8rem; color: #22C55E; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;"><i class="fas fa-calendar-day"></i> Visitas Hoy</div>
                <div id="statTodayVisits" style="font-size: 2.2rem; font-weight: 800; color: #22C55E; margin-top: 0.3rem;">...</div>
                <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 0.25rem;">Tráfico de la fecha actual</div>
            </div>
            <div style="background: #fff; padding: 1.3rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border-left: 4px solid #2B82C9;">
                <div style="font-size: 0.8rem; color: #2B82C9; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;"><i class="fas fa-crown"></i> Página Más Consultada</div>
                <div id="statTopPageName" style="font-size: 1.15rem; font-weight: 800; color: #0C1F30; margin-top: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">...</div>
                <div id="statTopPageVisits" style="font-size: 0.8rem; color: #5E7A8E; margin-top: 0.25rem;">...</div>
            </div>
            <div style="background: #fff; padding: 1.3rem; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border-left: 4px solid #F97316;">
                <div style="font-size: 0.8rem; color: #F97316; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;"><i class="fas fa-clock"></i> Último Acceso</div>
                <div id="statLastVisitTime" style="font-size: 1.05rem; font-weight: 700; color: #0C1F30; margin-top: 0.5rem;">...</div>
                <div id="statLastVisitPage" style="font-size: 0.75rem; color: #5E7A8E; margin-top: 0.25rem;">...</div>
            </div>
        </div>

        <!-- Desglose por Página Pública -->
        <div style="background: #fff; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(5,17,31,0.06); margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <h3 style="color: #05111F; font-size: 1.15rem; font-weight: 700;"><i class="fas fa-table" style="color: #00C2E0; margin-right: 6px;"></i> Desglose Detallado por Página Pública</h3>
                    <p style="font-size: 0.85rem; color: #5E7A8E; margin-top: 2px;">Recuento exacto de solicitudes atendidas por cada módulo del portal</p>
                </div>
                <span style="font-size: 0.78rem; background: rgba(0,194,224,0.1); color: #00889c; padding: 4px 12px; border-radius: 20px; font-weight: 700;">
                    <i class="fas fa-check-circle"></i> Datos Reales Verificados
                </span>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #F0F5FB; text-align: left; color: #0C1F30; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em;">
                            <th style="padding: 0.85rem 1rem; border-radius: 10px 0 0 10px;">Página / Módulo</th>
                            <th style="padding: 0.85rem 1rem;">Ruta Oficial</th>
                            <th style="padding: 0.85rem 1rem; text-align: center;">Visitas Reales</th>
                            <th style="padding: 0.85rem 1rem;">% Tráfico del Portal</th>
                            <th style="padding: 0.85rem 1rem;">Último Registro</th>
                            <th style="padding: 0.85rem 1rem; text-align: center; border-radius: 0 10px 10px 0;">Acción</th>
                        </tr>
                    </thead>
                    <tbody id="visitsPagesTableBody">
                        <tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: #5E7A8E;">Cargando métricas de páginas...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Registro Cronológico de Accesos Recientes -->
        <div style="background: #fff; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(5,17,31,0.06);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <h3 style="color: #05111F; font-size: 1.15rem; font-weight: 700;"><i class="fas fa-history" style="color: #1A5C8F; margin-right: 6px;"></i> Registro Cronológico de Accesos Recientes</h3>
                    <p style="font-size: 0.85rem; color: #5E7A8E; margin-top: 2px;">Trazabilidad con anonimización de IP conforme a directrices de privacidad</p>
                </div>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                    <thead>
                        <tr style="background: #F0F5FB; text-align: left; color: #0C1F30; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;">
                            <th style="padding: 0.75rem 1rem; border-radius: 8px 0 0 8px;">Fecha y Hora</th>
                            <th style="padding: 0.75rem 1rem;">Página Solicitada</th>
                            <th style="padding: 0.75rem 1rem;">Ruta</th>
                            <th style="padding: 0.75rem 1rem;">IP Anonimizada</th>
                            <th style="padding: 0.75rem 1rem; border-radius: 0 8px 8px 0;">Cliente / Agente</th>
                        </tr>
                    </thead>
                    <tbody id="visitsLogTableBody">
                        <tr><td colspan="5" style="padding: 1.5rem; text-align: center; color: #5E7A8E;">Cargando historial de accesos...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('btnRefreshVisits')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnRefreshVisits');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        btn.disabled = true;
        await loadVisitsData();
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Métricas';
        btn.disabled = false;
    });

    document.getElementById('btnExportVisitsJson')?.addEventListener('click', exportVisitsJson);
    document.getElementById('btnExportVisitsCsv')?.addEventListener('click', exportVisitsCsv);
}

async function loadVisitsData() {
    try {
        const res = await fetch('/api/admin/visits', { headers: getHeaders() });
        if (!res.ok) throw new Error('Error al consultar contador de visitas');
        const data = await res.json();
        visitsDataCache = data;

        const totalVisits = Number(data.totalVisits) || 0;
        const statTotal = document.getElementById('statTotalVisits');
        const statToday = document.getElementById('statTodayVisits');
        const statTopName = document.getElementById('statTopPageName');
        const statTopVisits = document.getElementById('statTopPageVisits');
        const statLastTime = document.getElementById('statLastVisitTime');
        const statLastPage = document.getElementById('statLastVisitPage');

        if (statTotal) statTotal.textContent = totalVisits.toLocaleString();
        if (statToday) statToday.textContent = (data.todayVisits || 0).toLocaleString();
        if (statTopName) statTopName.textContent = data.topPage?.name || 'Portal Principal';
        if (statTopVisits) statTopVisits.textContent = `${(data.topPage?.visits || 0).toLocaleString()} visitas`;

        const recent = data.recentVisits || [];
        if (recent.length > 0) {
            if (statLastTime) statLastTime.textContent = formatDate(recent[0].timestamp);
            if (statLastPage) statLastPage.textContent = `${recent[0].pageName || recent[0].path}`;
        } else {
            if (statLastTime) statLastTime.textContent = 'Sin registros recientes';
            if (statLastPage) statLastPage.textContent = '--';
        }

        // Renderizar tabla de páginas
        const tbodyPages = document.getElementById('visitsPagesTableBody');
        if (tbodyPages) {
            const pagesEntries = Object.entries(data.pages || {});
            if (pagesEntries.length === 0) {
                tbodyPages.innerHTML = '<tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: #5E7A8E;">Aún no hay visitas registradas.</td></tr>';
            } else {
                tbodyPages.innerHTML = pagesEntries
                    .sort((a, b) => (b[1].visits || 0) - (a[1].visits || 0))
                    .map(([pathUrl, info]) => {
                        const visits = Number(info.visits) || 0;
                        const pct = totalVisits > 0 ? Math.round((visits / totalVisits) * 100) : 0;
                        const lastTime = info.lastVisit ? formatDate(info.lastVisit) : 'Sin visitas aún';
                        return `
                            <tr style="border-bottom: 1px solid #E8EEF7;">
                                <td style="padding: 0.9rem 1rem;">
                                    <strong style="color: #05111F; font-size: 0.95rem;">${info.name || pathUrl}</strong>
                                </td>
                                <td style="padding: 0.9rem 1rem;">
                                    <code style="background: #F0F5FB; padding: 2px 8px; border-radius: 6px; color: #1A5C8F; font-size: 0.82rem;">${pathUrl}</code>
                                </td>
                                <td style="padding: 0.9rem 1rem; text-align: center;">
                                    <span style="font-weight: 800; font-size: 1.1rem; color: #0C1F30;">${visits.toLocaleString()}</span>
                                </td>
                                <td style="padding: 0.9rem 1rem;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="flex: 1; height: 8px; background: #E8EEF7; border-radius: 4px; overflow: hidden;">
                                            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #00C2E0, #1A5C8F); border-radius: 4px;"></div>
                                        </div>
                                        <span style="font-size: 0.8rem; font-weight: 700; color: #1A5C8F; min-width: 36px; text-align: right;">${pct}%</span>
                                    </div>
                                </td>
                                <td style="padding: 0.9rem 1rem; font-size: 0.82rem; color: #5E7A8E;">
                                    ${lastTime}
                                </td>
                                <td style="padding: 0.9rem 1rem; text-align: center;">
                                    <a href="${pathUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; background: rgba(0,194,224,0.12); color: #00889c; border-radius: 8px; text-decoration: none; font-size: 0.8rem; font-weight: 700; transition: all 0.2s;">
                                        <i class="fas fa-external-link-alt"></i> Ver Página
                                    </a>
                                </td>
                            </tr>
                        `;
                    }).join('');
            }
        }

        // Renderizar registro cronológico
        const tbodyLog = document.getElementById('visitsLogTableBody');
        if (tbodyLog) {
            if (recent.length === 0) {
                tbodyLog.innerHTML = '<tr><td colspan="5" style="padding: 1.5rem; text-align: center; color: #5E7A8E;">No hay accesos recientes registrados.</td></tr>';
            } else {
                tbodyLog.innerHTML = recent.map(item => `
                    <tr style="border-bottom: 1px solid #E8EEF7;">
                        <td style="padding: 0.75rem 1rem; color: #05111F; font-weight: 600; white-space: nowrap;">
                            ${formatDate(item.timestamp)}
                        </td>
                        <td style="padding: 0.75rem 1rem;">
                            <span style="font-weight: 700; color: #1A5C8F;">${item.pageName || item.path}</span>
                        </td>
                        <td style="padding: 0.75rem 1rem;">
                            <code style="background: #F0F5FB; padding: 2px 6px; border-radius: 4px; color: #5E7A8E; font-size: 0.8rem;">${item.path}</code>
                        </td>
                        <td style="padding: 0.75rem 1rem; color: #5E7A8E; font-family: monospace; font-size: 0.82rem;">
                            ${item.maskedIp || '***.***'}
                        </td>
                        <td style="padding: 0.75rem 1rem; color: #5E7A8E; font-size: 0.8rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.userAgent}">
                            ${item.userAgent || 'Navegador Web'}
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error al cargar datos de visitas:', err);
    }
}

function exportVisitsJson() {
    if (!visitsDataCache) return;
    const blob = new Blob([JSON.stringify(visitsDataCache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pia_contador_visitas_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportVisitsCsv() {
    if (!visitsDataCache || !visitsDataCache.pages) return;
    const rows = [
        ['Página', 'Ruta', 'Visitas', 'Última Visita']
    ];
    for (const [pathUrl, info] of Object.entries(visitsDataCache.pages)) {
        rows.push([
            `"${info.name || pathUrl}"`,
            `"${pathUrl}"`,
            info.visits || 0,
            `"${info.lastVisit || ''}"`
        ]);
    }
    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pia_contador_visitas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================
// BITÁCORA DE AUDITORÍA
// ============================

let auditLogsData = [];

function renderAuditView() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h1 style="font-family: var(--font-head); font-size: 1.8rem; font-weight: 800; color: #05111F;">
                    <i class="fas fa-shield-alt" style="color: #00C2E0; margin-right: 0.5rem;"></i>Bitácora de Auditoría y Seguridad
                </h1>
                <p style="color: #5E7A8E; font-size: 0.95rem;">Registro en tiempo real y persistente de todas las modificaciones de archivos de datos en el servidor.</p>
            </div>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button id="btnExportAuditJson" style="padding: 0.75rem 1.25rem; background: #05111F; color: #fff; font-weight: 600; border-radius: 12px; border: none; cursor: pointer;">
                    <i class="fas fa-file-download"></i> Exportar Auditoría JSON
                </button>
                <button id="btnExportAuditCsv" style="padding: 0.75rem 1.25rem; background: #1A5C8F; color: #fff; font-weight: 600; border-radius: 12px; border: none; cursor: pointer;">
                    <i class="fas fa-file-csv"></i> Exportar CSV
                </button>
            </div>
        </div>

        <!-- Indicadores de Auditoría -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
            <div style="background: #fff; padding: 1.2rem; border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
                <div style="font-size: 0.8rem; color: #5E7A8E; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Total Eventos</div>
                <div id="auditTotalEvents" style="font-size: 1.8rem; font-weight: 800; color: #05111F; margin-top: 0.3rem;">...</div>
            </div>
            <div style="background: #fff; padding: 1.2rem; border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
                <div style="font-size: 0.8rem; color: #22C55E; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Creaciones</div>
                <div id="auditTotalCreations" style="font-size: 1.8rem; font-weight: 800; color: #22C55E; margin-top: 0.3rem;">...</div>
            </div>
            <div style="background: #fff; padding: 1.2rem; border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
                <div style="font-size: 0.8rem; color: #F97316; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Modificaciones</div>
                <div id="auditTotalUpdates" style="font-size: 1.8rem; font-weight: 800; color: #F97316; margin-top: 0.3rem;">...</div>
            </div>
            <div style="background: #fff; padding: 1.2rem; border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
                <div style="font-size: 0.8rem; color: #EF4444; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Eliminaciones</div>
                <div id="auditTotalDeletions" style="font-size: 1.8rem; font-weight: 800; color: #EF4444; margin-top: 0.3rem;">...</div>
            </div>
        </div>

        <!-- Filtros y Tabla -->
        <div style="background: #fff; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(5,17,31,0.06);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; flex: 1;">
                    <input type="text" id="auditSearchInput" placeholder="Buscar por usuario, acción, detalle, ID..." style="padding: 0.6rem 1rem; width: 280px; border: 1px solid rgba(26,92,143,0.2); border-radius: 10px;" />
                    <select id="auditFilterAction" style="padding: 0.6rem 1rem; border: 1px solid rgba(26,92,143,0.2); border-radius: 10px; background: #fff;">
                        <option value="">Todas las acciones</option>
                        <option value="CREACIÓN">CREACIÓN</option>
                        <option value="ACTUALIZACIÓN">ACTUALIZACIÓN</option>
                        <option value="ELIMINACIÓN">ELIMINACIÓN</option>
                        <option value="EDICIÓN DIRECTA JSON">EDICIÓN DIRECTA JSON</option>
                        <option value="INICIO DE SESIÓN">INICIO DE SESIÓN</option>
                    </select>
                    <select id="auditFilterModule" style="padding: 0.6rem 1rem; border: 1px solid rgba(26,92,143,0.2); border-radius: 10px; background: #fff;">
                        <option value="">Todos los módulos</option>
                        <option value="canales">Canales</option>
                        <option value="directorio">Directorio</option>
                        <option value="tableros">Tableros</option>
                        <option value="riesgo">Riesgos</option>
                        <option value="vehiculos">Vehículos</option>
                        <option value="portal">Portal</option>
                        <option value="json-editor">Editor JSON</option>
                        <option value="auth">Autenticación</option>
                    </select>
                </div>
                <span id="auditRecordCount" style="font-size: 0.85rem; color: #5E7A8E; font-weight: 600;">0 eventos registrados</span>
            </div>

            <div style="overflow-x: auto; max-height: 600px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;" id="auditTable">
                    <thead>
                        <tr style="background: #F0F5FB; border-bottom: 2px solid rgba(26,92,143,0.14);">
                            <th style="padding: 0.85rem 1rem;">ID / Fecha</th>
                            <th style="padding: 0.85rem 1rem;">Usuario / IP</th>
                            <th style="padding: 0.85rem 1rem;">Acción</th>
                            <th style="padding: 0.85rem 1rem;">Módulo / Archivo</th>
                            <th style="padding: 0.85rem 1rem;">Detalles</th>
                            <th style="padding: 0.85rem 1rem; text-align: right;">Comparativa</th>
                        </tr>
                    </thead>
                    <tbody id="auditTableBody">
                        <tr><td colspan="6" style="padding: 2rem; text-align: center; color: #5E7A8E;">Cargando bitácora de auditoría...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal Detalles Auditoría (Diff) -->
        <div id="auditDetailModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.75); backdrop-filter:blur(8px); z-index:1000; align-items:center; justify-content:center; padding:1rem;">
            <div style="background:#fff; border-radius:20px; max-width:850px; width:100%; max-height:90vh; overflow-y:auto; padding:2rem; box-shadow:0 25px 60px rgba(0,0,0,0.4);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom: 1px solid #E8EEF7; padding-bottom: 1rem;">
                    <div>
                        <h3 id="auditModalTitle" style="font-family:var(--font-head); font-size:1.3rem; color:#05111F;">Detalle de Evento de Auditoría</h3>
                        <p id="auditModalSubtitle" style="font-size:0.85rem; color:#5E7A8E;"></p>
                    </div>
                    <button id="auditModalClose" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#5E7A8E;">&times;</button>
                </div>
                
                <div id="auditModalContent"></div>

                <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:2rem;">
                    <button id="auditModalCloseBtn" style="padding:0.75rem 1.5rem; background:#05111F; color:#fff; border-radius:10px; font-weight:700;">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('auditSearchInput')?.addEventListener('input', applyAuditFilters);
    document.getElementById('auditFilterAction')?.addEventListener('change', applyAuditFilters);
    document.getElementById('auditFilterModule')?.addEventListener('change', applyAuditFilters);
    document.getElementById('btnExportAuditJson')?.addEventListener('click', exportAuditJson);
    document.getElementById('btnExportAuditCsv')?.addEventListener('click', exportAuditCsv);
    document.getElementById('auditModalClose')?.addEventListener('click', closeAuditModal);
    document.getElementById('auditModalCloseBtn')?.addEventListener('click', closeAuditModal);
}

async function loadAuditData() {
    try {
        const tbody = document.getElementById('auditTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="skeleton-row"><td colspan="6" style="padding:1rem;"><div class="skeleton-loader" style="width:90%;"></div></td></tr>
                <tr class="skeleton-row"><td colspan="6" style="padding:1rem;"><div class="skeleton-loader" style="width:75%;"></div></td></tr>
                <tr class="skeleton-row"><td colspan="6" style="padding:1rem;"><div class="skeleton-loader" style="width:85%;"></div></td></tr>
            `;
        }
        const res = await fetch('/api/audit', { headers: getHeaders() });
        if (!res.ok) throw new Error('Error al obtener registros de auditoría');
        auditLogsData = await res.json();

        // Update indicators
        const totalEv = document.getElementById('auditTotalEvents');
        const totalCr = document.getElementById('auditTotalCreations');
        const totalUp = document.getElementById('auditTotalUpdates');
        const totalDel = document.getElementById('auditTotalDeletions');

        if (totalEv) totalEv.textContent = auditLogsData.length;
        if (totalCr) totalCr.textContent = auditLogsData.filter(a => a.action === 'CREACIÓN').length;
        if (totalUp) totalUp.textContent = auditLogsData.filter(a => a.action === 'ACTUALIZACIÓN' || a.action === 'EDICIÓN DIRECTA JSON').length;
        if (totalDel) totalDel.textContent = auditLogsData.filter(a => a.action === 'ELIMINACIÓN').length;

        renderAuditTableRows(auditLogsData);
    } catch (err) {
        showToast('Error cargando auditoría: ' + err.message, 'error');
    }
}

function renderAuditTableRows(logs) {
    const tbody = document.getElementById('auditTableBody');
    const countEl = document.getElementById('auditRecordCount');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${logs.length} eventos en bitácora`;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #5E7A8E;">No se encontraron eventos en la bitácora de auditoría.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(item => {
        let actionBadgeClass = 'background:#E8EEF7; color:#05111F;';
        if (item.action === 'CREACIÓN') actionBadgeClass = 'background:#DCFCE7; color:#15803D;';
        else if (item.action === 'ACTUALIZACIÓN') actionBadgeClass = 'background:#FFEDD5; color:#C2410C;';
        else if (item.action === 'ELIMINACIÓN') actionBadgeClass = 'background:#FEE2E2; color:#B91C1C;';
        else if (item.action === 'EDICIÓN DIRECTA JSON') actionBadgeClass = 'background:#E0F2FE; color:#0369A1;';
        else if (item.action === 'INICIO DE SESIÓN') actionBadgeClass = 'background:#F3E8FF; color:#6B21A8;';

        const hasDiff = item.previousValue !== null || item.newValue !== null;

        return `
            <tr style="border-bottom: 1px solid #E8EEF7;">
                <td style="padding: 0.85rem 1rem;">
                    <div style="font-weight: 700; color: #05111F;">#${item.id}</div>
                    <div style="font-size: 0.78rem; color: #5E7A8E;">${formatDate(item.timestamp)}</div>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <div style="font-weight: 600; color: #1A5C8F;"><i class="fas fa-user-circle"></i> ${item.user}</div>
                    <div style="font-size: 0.75rem; color: #A8BFCC;">${item.ip || '127.0.0.1'}</div>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <span style="font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; ${actionBadgeClass}">
                        ${item.action}
                    </span>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <div style="font-weight: 600; color: #0C1F30;">${capitalize(item.module)}</div>
                    <div style="font-size: 0.75rem; color: #5E7A8E; font-family: monospace;">${item.target || '-'}</div>
                </td>
                <td style="padding: 0.85rem 1rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.details || ''}">
                    ${item.details || '-'}
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    ${hasDiff ? `
                        <button onclick="window.viewAuditDetail(${item.id})" style="padding: 0.4rem 0.85rem; background: #00C2E0; color: #05111F; border-radius: 8px; font-weight: 700; font-size: 0.8rem; border: none; cursor: pointer;">
                            <i class="fas fa-exchange-alt"></i> Ver Cambios
                        </button>
                    ` : `
                        <span style="font-size: 0.8rem; color: #A8BFCC;">N/A</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function applyAuditFilters() {
    const query = document.getElementById('auditSearchInput')?.value.toLowerCase() || '';
    const actionFilter = document.getElementById('auditFilterAction')?.value || '';
    const moduleFilter = document.getElementById('auditFilterModule')?.value || '';

    const filtered = auditLogsData.filter(item => {
        const matchesQuery = !query || 
            String(item.id).includes(query) ||
            item.user.toLowerCase().includes(query) ||
            item.action.toLowerCase().includes(query) ||
            (item.details && item.details.toLowerCase().includes(query)) ||
            (item.target && item.target.toLowerCase().includes(query));

        const matchesAction = !actionFilter || item.action === actionFilter;
        const matchesModule = !moduleFilter || item.module === moduleFilter;

        return matchesQuery && matchesAction && matchesModule;
    });

    renderAuditTableRows(filtered);
}

window.viewAuditDetail = function(id) {
    const entry = auditLogsData.find(l => String(l.id) === String(id));
    if (!entry) return;

    const modal = document.getElementById('auditDetailModal');
    const title = document.getElementById('auditModalTitle');
    const subtitle = document.getElementById('auditModalSubtitle');
    const content = document.getElementById('auditModalContent');

    if (!modal || !content) return;

    title.textContent = `Evento #${entry.id} — ${entry.action}`;
    subtitle.textContent = `Realizado por ${entry.user} el ${formatDate(entry.timestamp)} | IP: ${entry.ip || '127.0.0.1'}`;

    const prevJson = entry.previousValue ? JSON.stringify(entry.previousValue, null, 2) : null;
    const newJson = entry.newValue ? JSON.stringify(entry.newValue, null, 2) : null;

    content.innerHTML = `
        <div style="background: #F0F5FB; padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.9rem;">
            <div><strong>Módulo:</strong> ${entry.module}</div>
            <div><strong>Archivo Objetivo:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 4px;">${entry.target}</code></div>
            <div><strong>Registro ID:</strong> ${entry.recordId || 'N/A'}</div>
            <div><strong>Detalles:</strong> ${entry.details || '-'}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
            <div>
                <h4 style="color: #EF4444; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-history"></i> Estado Previo (Antes)
                </h4>
                <div style="background: #1E293B; color: #F8FAFC; padding: 1rem; border-radius: 12px; font-family: monospace; font-size: 0.85rem; max-height: 380px; overflow-y: auto; border-left: 4px solid #EF4444;">
                    ${prevJson ? `<pre style="margin:0; white-space: pre-wrap;">${escapeHtml(prevJson)}</pre>` : '<span style="color:#94A3B8; italic;">Ninguno (Nuevo registro creado)</span>'}
                </div>
            </div>

            <div>
                <h4 style="color: #22C55E; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-check-circle"></i> Estado Nuevo (Después)
                </h4>
                <div style="background: #1E293B; color: #F8FAFC; padding: 1rem; border-radius: 12px; font-family: monospace; font-size: 0.85rem; max-height: 380px; overflow-y: auto; border-left: 4px solid #22C55E;">
                    ${newJson ? `<pre style="margin:0; white-space: pre-wrap;">${escapeHtml(newJson)}</pre>` : '<span style="color:#94A3B8; italic;">Ninguno (Registro eliminado)</span>'}
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

function closeAuditModal() {
    const modal = document.getElementById('auditDetailModal');
    if (modal) modal.style.display = 'none';
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function exportAuditJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogsData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bitacora_auditoria_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function exportAuditCsv() {
    if (!auditLogsData || auditLogsData.length === 0) {
        showToast('No hay datos de auditoría para exportar', 'info');
        return;
    }

    const headers = ['ID', 'Timestamp', 'Usuario', 'Accion', 'Modulo', 'Target', 'RecordID', 'Detalles', 'IP'];
    const rows = auditLogsData.map(item => [
        item.id,
        `"${item.timestamp}"`,
        `"${item.user}"`,
        `"${item.action}"`,
        `"${item.module}"`,
        `"${item.target}"`,
        `"${item.recordId || ''}"`,
        `"${(item.details || '').replace(/"/g, '""')}"`,
        `"${item.ip || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `bitacora_auditoria_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// ============================
// CRUD VISTA DINÁMICA
// ============================

let currentModule = '';
let currentModuleData = [];
window.adminCanalesAuditResults = { zeroChannels: [], contradictions: [] };

function runAdminCanalesAudit(data) {
    if (!Array.isArray(data) || currentModule !== 'canales') return;

    const zeroChannels = [];
    const contradictions = [];

    data.forEach((item, idx) => {
        const nombre = item.institucion || item.nombre_institucion || `Institución #${idx + 1}`;
        const tel = (item.telefono || '').toString().trim();
        const mail = (item.correo || '').toString().trim();
        const form = (item.formulario || (Array.isArray(item.enlaces_solicitud) && item.enlaces_solicitud[0]) || '').toString().trim();
        const dir = (item.direccion || item.ubicacion || '').toString().trim();
        const tipocom = (item.tipocom || '').toString().trim();
        const otro = (item.otro || '').toString().trim();

        let realCount = 0;
        if (tel) realCount++;
        if (mail) realCount++;
        if (form) realCount++;
        
        const hasPresencial = dir.length > 0 || (
            tipocom.toLowerCase().includes('presencial') ||
            tipocom.toLowerCase().includes('verbal') ||
            tipocom.toLowerCase().includes('escrita') ||
            tipocom.toLowerCase().includes('oficina') ||
            tipocom.toLowerCase().includes('unidad')
        );
        if (hasPresencial) realCount++;
        if (otro) realCount++;

        const declaredCanales = item.canales;
        const issues = [];

        // 1. Detectar 0 canales
        if (realCount === 0) {
            issues.push('0 canales de contacto o denuncia detectados.');
            zeroChannels.push({ nombre, index: idx, id: item.id, item });
        }

        // 2. Discrepancia entre canales declarados vs reales
        if (declaredCanales !== undefined && declaredCanales !== null && Number(declaredCanales) !== realCount) {
            issues.push(`Declaró ${declaredCanales} canales pero se identificaron ${realCount} vías de contacto registradas.`);
        }

        // 3. Inconsistencia de formato de correo
        if (mail && !mail.includes('@')) {
            issues.push(`Correo registrado con formato atípico ("${mail}").`);
        }

        // 4. Inconsistencia en teléfono (sin números)
        if (tel && !/\d/.test(tel)) {
            issues.push(`Teléfono registrado sin caracteres numéricos ("${tel}").`);
        }

        if (issues.length > 0) {
            contradictions.push({
                id: item.id !== undefined ? item.id : idx + 1,
                nombre,
                index: idx,
                declarado: declaredCanales,
                calculado: realCount,
                issues
            });
        }
    });

    window.adminCanalesAuditResults = { zeroChannels, contradictions };

    const banner = document.getElementById('canalesQualityAuditBanner');
    const countEl = document.getElementById('adminCanalesObsCount');

    if (banner) {
        if (contradictions.length > 0) {
            if (countEl) countEl.textContent = contradictions.length;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }
}

window.toggleAdminCanalesAuditModal = function(show) {
    const modal = document.getElementById('adminCanalesAuditModal');
    if (!modal) return;
    if (show) {
        const body = document.getElementById('adminCanalesAuditBody');
        const results = window.adminCanalesAuditResults || { contradictions: [] };
        const contradictions = results.contradictions || [];

        if (body) {
            let html = `
                <div style="margin-bottom:1.2rem; font-size:0.88rem; color:#5E7A8E; line-height:1.5;">
                    A continuación se detallan las instituciones de <strong>Canales por la Integridad</strong> que presentan observaciones técnicas de registro (discrepancias entre los canales declarados y las vías verificadas, o formatos de contacto atípicos):
                </div>
            `;

            if (contradictions.length === 0) {
                html += `
                    <div style="padding:1.5rem; background:#DCFCE7; border:1px solid #86EFAC; border-radius:12px; color:#15803D; display:flex; align-items:center; gap:0.75rem;">
                        <i class="fas fa-check-circle" style="font-size:1.3rem;"></i>
                        <div><strong>¡Excelente!</strong> No se detectaron inconsistencias de calidad ni discrepancias en los registros de canales.</div>
                    </div>
                `;
            } else {
                html += `<div style="display:flex; flex-direction:column; gap:0.85rem;">`;
                contradictions.forEach(item => {
                    html += `
                        <div style="background:#FFFDF5; border:1px solid #FDE68A; border-left:4px solid #F59E0B; border-radius:10px; padding:1rem; display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
                            <div style="flex:1; min-width:260px;">
                                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
                                    <span style="font-size:0.75rem; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:10px; font-weight:700;">#${item.id}</span>
                                    <strong style="color:#05111F; font-size:0.95rem;">${escapeHtml(item.nombre)}</strong>
                                </div>
                                <div style="font-size:0.82rem; color:#78350F; margin-top:0.35rem; display:flex; flex-direction:column; gap:0.25rem;">
                                    ${item.issues.map(iss => `<div><i class="fas fa-exclamation-circle" style="color:#F59E0B; margin-right:4px;"></i> ${escapeHtml(iss)}</div>`).join('')}
                                </div>
                            </div>
                            <button type="button" onclick="window.toggleAdminCanalesAuditModal(false); window.editRecord(${item.id})" style="padding:0.45rem 0.9rem; background:#00C2E0; color:#05111F; font-weight:700; border:none; border-radius:8px; cursor:pointer; font-size:0.8rem; display:inline-flex; align-items:center; gap:0.4rem; white-space:nowrap;">
                                <i class="fas fa-edit"></i> Corregir
                            </button>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            body.innerHTML = html;
        }
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
};

function renderCrudView(module) {
    currentModule = module;
    const contentArea = document.getElementById('contentArea');
    const moduleTitles = {
        canales: 'Canales por la Integridad',
        directorio: 'Directorio de Acceso al Ejecutivo',
        tableros: 'Tu Gobierno en Números (Tableros)',
        riesgo: 'Riesgo en la Mira',
        vehiculos: 'Transparencia Vehicular',
        vehiculos_instituciones: 'Criterios Evaluados (Instituciones)',
        portal: 'Métricas del Portal Principal'
    };

    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h1 style="font-family: var(--font-head); font-size: 1.8rem; font-weight: 800; color: #05111F;">
                    <i class="fas fa-edit" style="color: #00C2E0; margin-right: 0.5rem;"></i>${moduleTitles[module] || capitalize(module)}
                </h1>
                <p style="color: #5E7A8E; font-size: 0.95rem;">Los cambios guardados aquí actualizan automáticamente el archivo JSON de esta página y quedan registrados en la auditoría.</p>
            </div>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button class="btn-primary" id="btnNewRecord" style="padding: 0.75rem 1.25rem; background: #00C2E0; color: #05111F; font-weight: 700; border-radius: 12px; border: none; cursor: pointer;">
                    <i class="fas fa-plus"></i> Nuevo Registro
                </button>
                <button class="btn-secondary" id="btnExportJson" style="padding: 0.75rem 1.25rem; background: #163250; color: #fff; font-weight: 600; border-radius: 12px; border: none; cursor: pointer;">
                    <i class="fas fa-download"></i> Exportar JSON
                </button>
                <button class="btn-secondary" id="btnEditRaw" style="padding: 0.75rem 1.25rem; background: #05111F; color: #fff; font-weight: 600; border-radius: 12px; border: none; cursor: pointer;">
                    <i class="fas fa-code"></i> Editar JSON Completo
                </button>
            </div>
        </div>

        ${module === 'canales' ? `
        <!-- Auditoría de Calidad de Datos (Módulo Canales por la Integridad) -->
        <div id="canalesQualityAuditBanner" style="display:none; margin-bottom: 1.5rem; background: #FFFBEB; border: 1px solid #FCD34D; border-left: 5px solid #F59E0B; border-radius: 14px; padding: 1rem 1.4rem; box-shadow: 0 4px 12px rgba(245,158,11,0.08); align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.9rem; flex: 1; min-width: 280px;">
                <div style="width: 38px; height: 38px; border-radius: 50%; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
                    <i class="fas fa-triangle-exclamation"></i>
                </div>
                <div style="font-size: 0.92rem; color: #78350F; line-height: 1.4;">
                    <strong style="color: #92400E; font-size: 0.95rem;">Auditoría de Calidad de Datos:</strong>
                    Se detectaron <span id="adminCanalesObsCount" style="font-weight: 800; color: #B45309;">0</span> registros con observaciones (canales no reportados o discrepancias de datos).
                </div>
            </div>
            <button type="button" id="btnAdminCanalesAuditDetails" onclick="window.toggleAdminCanalesAuditModal(true)" style="padding: 0.55rem 1.15rem; background: #F59E0B; color: #FFF; font-weight: 700; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; box-shadow: 0 2px 6px rgba(245,158,11,0.25); transition: background 0.2s;">
                <i class="fas fa-list-check"></i> Ver Inconsistencias
            </button>
        </div>

        <!-- Modal de Auditoría de Canales (Admin) -->
        <div id="adminCanalesAuditModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.7); backdrop-filter:blur(8px); z-index:1100; align-items:center; justify-content:center; padding:1.5rem;" onclick="if(event.target===this) window.toggleAdminCanalesAuditModal(false)">
            <div style="background:#fff; border-radius:20px; max-width:720px; width:100%; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 25px 50px rgba(0,0,0,0.3); overflow:hidden;">
                <div style="padding:1.25rem 1.5rem; border-bottom:1px solid #E8EEF7; display:flex; align-items:center; justify-content:space-between; background:#FFFBEB;">
                    <h3 style="margin:0; font-family:var(--font-head); font-size:1.15rem; color:#92400E; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fas fa-clipboard-check" style="color:#D97706;"></i> Auditoría de Registro de Canales
                    </h3>
                    <button type="button" onclick="window.toggleAdminCanalesAuditModal(false)" style="background:none; border:none; color:#5E7A8E; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
                </div>
                <div id="adminCanalesAuditBody" style="padding:1.5rem; overflow-y:auto; flex:1;"></div>
                <div style="padding:1rem 1.5rem; border-top:1px solid #E8EEF7; display:flex; justify-content:space-between; align-items:center; background:#F8FAFC;">
                    <span style="font-size:0.8rem; color:#5E7A8E;"><i class="fas fa-info-circle"></i> Puedes corregir los campos haciendo clic en "Corregir" en cada institución.</span>
                    <button type="button" onclick="window.toggleAdminCanalesAuditModal(false)" style="padding:0.6rem 1.25rem; background:#163250; color:#fff; border-radius:8px; font-weight:600; border:none; cursor:pointer;">Cerrar</button>
                </div>
            </div>
        </div>
        ` : ''}

        <div style="background: #fff; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(5,17,31,0.06);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <input type="text" id="crudSearch" placeholder="Buscar registros..." style="padding: 0.6rem 1rem; width: 300px; border: 1px solid rgba(26,92,143,0.2); border-radius: 8px;" />
                <span id="recordCount" style="font-size: 0.85rem; color: #5E7A8E; font-weight: 600;">0 registros</span>
            </div>
            <div style="overflow-x: auto; max-height: 600px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;" id="crudTable">
                    <thead><tr style="background: #F0F5FB; border-bottom: 2px solid rgba(26,92,143,0.14);"><th>Cargando...</th></tr></thead>
                    <tbody><tr><td>Cargando datos...</td></tr></tbody>
                </table>
            </div>
        </div>

        <!-- Modal CRUD -->
        <div id="crudModal" style="display:none; position:fixed; inset:0; background:rgba(5,17,31,0.7); backdrop-filter:blur(8px); z-index:1000; align-items:center; justify-content:center; padding:1rem;">
            <div style="background:#fff; border-radius:20px; max-width:650px; width:100%; max-height:90vh; overflow-y:auto; padding:2rem; box-shadow:0 20px 50px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <h3 id="crudModalTitle" style="font-family:var(--font-head); font-size:1.4rem; color:#05111F;">Editar Registro</h3>
                    <button id="crudModalClose" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <form id="crudForm">
                    <div id="crudFormFields"></div>
                    <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:2rem;">
                        <button type="button" id="crudModalCancel" style="padding:0.75rem 1.5rem; background:#E8EEF7; color:#05111F; border-radius:10px; font-weight:600;">Cancelar</button>
                        <button type="submit" style="padding:0.75rem 1.5rem; background:#00C2E0; color:#05111F; border-radius:10px; font-weight:700;">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('btnNewRecord')?.addEventListener('click', () => openCrudModal());
    document.getElementById('btnExportJson')?.addEventListener('click', () => exportModuleJson());
    document.getElementById('btnEditRaw')?.addEventListener('click', () => navigateTo('database'));
    document.getElementById('crudSearch')?.addEventListener('input', (e) => filterTable(e.target.value));
    document.getElementById('crudModalClose')?.addEventListener('click', closeCrudModal);
    document.getElementById('crudModalCancel')?.addEventListener('click', closeCrudModal);
    document.getElementById('crudForm')?.addEventListener('submit', saveCrudRecord);
}

async function fetchAndRenderTable(module) {
    try {
        if (typeof window.renderSkeletonTable === 'function') {
            window.renderSkeletonTable('crudTable', 5, 5);
        }
        const res = await fetch(`${getApiBase()}/${module}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Error al cargar módulo');
        currentModuleData = await res.json();
        renderTableRows(currentModuleData);
    } catch (err) {
        showToast('Error cargando módulo: ' + err.message, 'error');
    }
}

function renderTableRows(data) {
    const table = document.getElementById('crudTable');
    const recordCount = document.getElementById('recordCount');
    if (!table) return;

    if (recordCount) recordCount.textContent = `${data.length} registros`;

    if (currentModule === 'canales') {
        runAdminCanalesAudit(currentModuleData && currentModuleData.length ? currentModuleData : data);
    }

    if (!data || data.length === 0) {
        table.innerHTML = `
            <thead><tr><th style="padding: 1rem;">Módulo</th></tr></thead>
            <tbody><tr><td style="padding: 2rem; text-align: center; color: #5E7A8E;">No hay registros en este módulo. Haz clic en "Nuevo Registro" para agregar uno.</td></tr></tbody>
        `;
        return;
    }

    if (currentModule === 'vehiculos_instituciones') {
        let headerHtml = `<tr style="background: #F0F5FB; border-bottom: 2px solid rgba(26,92,143,0.14);">
            <th style="padding: 0.85rem 1rem;">Institución</th>
            <th style="padding: 0.85rem 1rem;">Sector / Siglas</th>
            <th style="padding: 0.85rem 1rem;">Cumplimiento</th>
            <th style="padding: 0.85rem 1rem; text-align: right;">Acciones</th>
        </tr>`;
        let bodyHtml = data.map(row => {
            let passCount = 0;
            if (row.criterios) {
                Object.values(row.criterios).forEach(c => {
                    if (c && c.cumple) passCount++;
                });
            } else {
                passCount = 7;
            }
            return `<tr style="border-bottom: 1px solid #E8EEF7;">
                <td style="padding: 0.85rem 1rem; font-weight: 700; color: #1A5C8F;">${row.nombre || ''}</td>
                <td style="padding: 0.85rem 1rem;">${row.sector || ''} <br><small style="color:#5E7A8E;">${row.siglas || ''}</small></td>
                <td style="padding: 0.85rem 1rem;">${passCount}/7 Criterios Cumplidos</td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    <button onclick="window.editRecord('${row.nombre}')" style="padding: 0.4rem 0.75rem; background: #00C2E0; color: #05111F; border-radius: 6px; font-weight: 600; margin-right: 0.3rem;"><i class="fas fa-edit"></i></button>
                    <button onclick="window.deleteRecord('${row.nombre}')" style="padding: 0.4rem 0.75rem; background: #EF4444; color: #fff; border-radius: 6px; font-weight: 600;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
        table.innerHTML = `<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody>`;
        return;
    }

    if (currentModule === 'vehiculos') {
        let headerHtml = `<tr style="background: #F0F5FB; border-bottom: 2px solid rgba(26,92,143,0.14);">
            <th style="padding: 0.85rem 1rem;">ID</th>
            <th style="padding: 0.85rem 1rem;">Placa</th>
            <th style="padding: 0.85rem 1rem;">Institución / Sector</th>
            <th style="padding: 0.85rem 1rem;">Vehículo</th>
            <th style="padding: 0.85rem 1rem;">Uso Autorizado</th>
            <th style="padding: 0.85rem 1rem;">Estado</th>
            <th style="padding: 0.85rem 1rem;">ISCV / Multas</th>
            <th style="padding: 0.85rem 1rem; text-align: right;">Acciones</th>
        </tr>`;

        let bodyHtml = data.map(row => {
            const statusBg = row.status === 'Activo' ? 'background: #DCFCE7; color: #15803D;' : row.status === 'Mantenimiento' ? 'background: #FEF3C7; color: #92400E;' : 'background: #FEE2E2; color: #B91C1C;';
            return `<tr style="border-bottom: 1px solid #E8EEF7;">
                <td style="padding: 0.85rem 1rem; font-weight: 700; color: #1A5C8F;">#${row.id}</td>
                <td style="padding: 0.85rem 1rem; font-weight: 800; color: #00C2E0;">${row.plate || ''} <span style="font-size:0.75rem; color:#5E7A8E; font-weight:normal;">(${row.plateType || 'O'})</span></td>
                <td style="padding: 0.85rem 1rem;">
                    <strong style="color:#05111F;">${row.department || ''}</strong>
                    <br><small style="color:#5E7A8E;">${row.tipoInst || ''} · ${row.sector || ''}</small>
                </td>
                <td style="padding: 0.85rem 1rem;">${row.brand || ''} ${row.model || ''} (${row.color || ''}, ${row.year || ''})</td>
                <td style="padding: 0.85rem 1rem; color:#5E7A8E;">${row.authorizedUse || '-'}</td>
                <td style="padding: 0.85rem 1rem;">
                    <span style="padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; ${statusBg}">${row.status || 'Activo'}</span>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <span style="font-size:0.8rem; font-weight:600; color:${row.iscvMoroso ? '#B91C1C' : '#15803D'};">ISCV: ${row.iscvMoroso ? 'Moroso' : 'Al día'}</span><br>
                    <small style="color:#5E7A8E;">${row.multas || 0} multas</small>
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    <button onclick="window.editRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #00C2E0; color: #05111F; border-radius: 6px; font-weight: 600; margin-right: 0.3rem;"><i class="fas fa-edit"></i></button>
                    <button onclick="window.deleteRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #EF4444; color: #fff; border-radius: 6px; font-weight: 600;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
        table.innerHTML = `<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody>`;
        return;
    }

    if (currentModule === 'canales') {
        let headerHtml = `<tr style="background: #F0F5FB; border-bottom: 2px solid rgba(26,92,143,0.14);">
            <th style="padding: 0.85rem 1rem;">ID</th>
            <th style="padding: 0.85rem 1rem;">Institución / Clasificación</th>
            <th style="padding: 0.85rem 1rem;">Canales Activos</th>
            <th style="padding: 0.85rem 1rem;">Contacto de Probidad</th>
            <th style="padding: 0.85rem 1rem;">Formulario Web / Protocolo</th>
            <th style="padding: 0.85rem 1rem; text-align: right;">Acciones</th>
        </tr>`;

        let bodyHtml = data.map(row => {
            const hasForm = row.formulario && String(row.formulario).startsWith('http');
            const hasProtocol = row['Protocolo de actuación'] === true;
            const obsItem = (window.adminCanalesAuditResults?.contradictions || []).find(c => String(c.id) === String(row.id));

            return `<tr style="border-bottom: 1px solid #E8EEF7; ${obsItem ? 'background: rgba(254, 243, 199, 0.25);' : ''}">
                <td style="padding: 0.85rem 1rem; font-weight: 700; color: #1A5C8F;">#${row.id}</td>
                <td style="padding: 0.85rem 1rem;">
                    <strong style="color:#05111F; font-size: 0.92rem;">${escapeHtml(row.institucion || '')}</strong>
                    ${obsItem ? `<span title="${escapeHtml(obsItem.issues.join(' | '))}" style="cursor:help; margin-left:6px; color:#D97706; font-size:0.85rem;"><i class="fas fa-exclamation-triangle"></i></span>` : ''}
                    <br><span style="font-size:0.75rem; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:10px; font-weight:700;">${escapeHtml(row.tipo || 'Ministerios')}</span>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <span style="font-size:0.85rem; font-weight:800; color:#00C2E0; background:#E0F7FA; padding:4px 10px; border-radius:12px;">
                        <i class="fas fa-headset" style="margin-right:4px;"></i> ${row.canales || 1} Canales
                    </span>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    ${row.correo ? `<div style="font-size:0.83rem; color:#1A5C8F;"><i class="fas fa-envelope" style="margin-right:4px;"></i> ${escapeHtml(row.correo)}</div>` : '<div style="font-size:0.8rem; color:#A8BFCC;">Sin correo</div>'}
                    ${row.telefono ? `<div style="font-size:0.78rem; color:#5E7A8E;"><i class="fas fa-phone" style="margin-right:4px;"></i> ${escapeHtml(row.telefono)}</div>` : ''}
                </td>
                <td style="padding: 0.85rem 1rem;">
                    ${hasForm ? `<a href="${escapeHtml(row.formulario)}" target="_blank" style="display:inline-block; font-size:0.78rem; color:#0369A1; background:#E0F2FE; padding:3px 8px; border-radius:6px; font-weight:600; text-decoration:none; margin-bottom:4px;"><i class="fas fa-external-link-alt" style="margin-right:4px;"></i> Abrir Formulario</a><br>` : '<span style="font-size:0.78rem; color:#A8BFCC;">Sin formulario web</span><br>'}
                    <span style="font-size:0.75rem; font-weight:700; color:${hasProtocol ? '#15803D' : '#92400E'};">
                        <i class="fas ${hasProtocol ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="margin-right:3px;"></i>
                        Protocolo: ${hasProtocol ? 'Sí' : 'En proceso'}
                    </span>
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    <button onclick="window.editRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #00C2E0; color: #05111F; border-radius: 6px; font-weight: 600; margin-right: 0.3rem;" title="Editar canal"><i class="fas fa-edit"></i></button>
                    <button onclick="window.deleteRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #EF4444; color: #fff; border-radius: 6px; font-weight: 600;" title="Eliminar canal"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        table.innerHTML = `<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody>`;
        return;
    }

    if (currentModule === 'tableros') {
        let headerHtml = `<tr style="background: #F0F5FB; border-bottom: 2px solid rgba(26,92,143,0.14);">
            <th style="padding: 0.85rem 1rem;">ID</th>
            <th style="padding: 0.85rem 1rem;">Institución / Siglas</th>
            <th style="padding: 0.85rem 1rem;">Tipo / Sector</th>
            <th style="padding: 0.85rem 1rem;">Enlace Tablero</th>
            <th style="padding: 0.85rem 1rem;">Estado / Actualización</th>
            <th style="padding: 0.85rem 1rem; text-align: right;">Acciones</th>
        </tr>`;

        let bodyHtml = data.map(row => {
            const hasLink = row.link_tablero && String(row.link_tablero).startsWith('http');
            const estadoBg = row.estado === 'Disponible' ? 'background: #DCFCE7; color: #15803D;' : 'background: #FEF3C7; color: #92400E;';

            return `<tr style="border-bottom: 1px solid #E8EEF7;">
                <td style="padding: 0.85rem 1rem; font-weight: 700; color: #1A5C8F;">#${row.id}</td>
                <td style="padding: 0.85rem 1rem;">
                    <strong style="color:#05111F; font-size: 0.92rem;">${escapeHtml(row.nombre_institucion || '')}</strong>
                    ${row.siglas ? `<span style="font-size:0.75rem; color:#5E7A8E; font-weight:bold; margin-left:4px;">(${escapeHtml(row.siglas)})</span>` : ''}
                    ${row.descripcion ? `<div style="font-size:0.78rem; color:#5E7A8E; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(row.descripcion)}">${escapeHtml(row.descripcion)}</div>` : ''}
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <div style="font-size:0.85rem; font-weight:600; color:#1A5C8F;">${escapeHtml(row.tipo_dependencia || 'Ministerio')}</div>
                    <small style="color:#5E7A8E;">${escapeHtml(row.sector || '')}</small>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    ${hasLink ? `<a href="${escapeHtml(row.link_tablero)}" target="_blank" style="display:inline-block; font-size:0.8rem; color:#0369A1; background:#E0F2FE; padding:4px 10px; border-radius:6px; font-weight:700; text-decoration:none;"><i class="fas fa-chart-line" style="margin-right:4px;"></i> Ver Tablero</a>` : '<span style="font-size:0.8rem; color:#A8BFCC;">Sin URL</span>'}
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <span style="padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; ${estadoBg}">${escapeHtml(row.estado || 'Disponible')}</span>
                    <div style="font-size:0.75rem; color:#5E7A8E; margin-top:2px;">Act.: ${escapeHtml(String(row.fecha_actualizacion || '2026'))}</div>
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    <button onclick="window.editRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #00C2E0; color: #05111F; border-radius: 6px; font-weight: 600; margin-right: 0.3rem;" title="Editar tablero"><i class="fas fa-edit"></i></button>
                    <button onclick="window.deleteRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #EF4444; color: #fff; border-radius: 6px; font-weight: 600;" title="Eliminar tablero"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        table.innerHTML = `<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody>`;
        return;
    }

    const keys = Object.keys(data[0]);
    const displayKeys = keys.filter(k => k !== 'id').slice(0, 5);

    let headerHtml = `<tr style="background: #F0F5FB; border-bottom: 2px solid rgba(26,92,143,0.14);">
        <th style="padding: 0.85rem 1rem;">ID</th>
        ${displayKeys.map(k => `<th style="padding: 0.85rem 1rem;">${capitalize(k)}</th>`).join('')}
        <th style="padding: 0.85rem 1rem; text-align: right;">Acciones</th>
    </tr>`;

    let bodyHtml = data.map(row => {
        return `<tr style="border-bottom: 1px solid #E8EEF7;">
            <td style="padding: 0.85rem 1rem; font-weight: 700; color: #1A5C8F;">#${row.id}</td>
            ${displayKeys.map(k => {
                let val = row[k];
                if (typeof val === 'boolean') val = val ? '✅ Sí' : '❌ No';
                if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                if (val && String(val).length > 40) val = String(val).substring(0, 40) + '...';
                return `<td style="padding: 0.85rem 1rem;">${val !== undefined ? val : ''}</td>`;
            }).join('')}
            <td style="padding: 0.85rem 1rem; text-align: right;">
                <button onclick="window.editRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #00C2E0; color: #05111F; border-radius: 6px; font-weight: 600; margin-right: 0.3rem;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteRecord(${row.id})" style="padding: 0.4rem 0.75rem; background: #EF4444; color: #fff; border-radius: 6px; font-weight: 600;"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');

    table.innerHTML = `<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody>`;
}

function filterTable(query) {
    if (!query) {
        renderTableRows(currentModuleData);
        return;
    }
    const q = query.toLowerCase();
    const filtered = currentModuleData.filter(row => {
        return Object.values(row).some(v => String(v).toLowerCase().includes(q));
    });
    renderTableRows(filtered);
}

// Global Edit/Delete Functions
let editingRecordId = null;

window.editRecord = function(id) {
    editingRecordId = id;
    const record = currentModuleData.find(r => String(r.id) === String(id));
    if (!record) return;
    openCrudModal(record);
};

window.deleteRecord = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este registro? Esta acción actualizará el archivo JSON y registrará el cambio en la bitácora.')) return;
    try {
        const res = await fetch(`${getApiBase()}/${currentModule}/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Error al eliminar');
        showToast('Registro eliminado y auditado correctamente', 'success');
        await fetchAndRenderTable(currentModule);
    } catch (err) {
        showToast(err.message, 'error');
    }
};

function openCrudModal(record = null) {
    editingRecordId = record ? record.id : null;
    const modal = document.getElementById('crudModal');
    const title = document.getElementById('crudModalTitle');
    const fieldsContainer = document.getElementById('crudFormFields');

    if (!modal || !fieldsContainer) return;

    title.textContent = record ? `Editar Registro #${record.id}` : 'Nuevo Registro';

    if (currentModule === 'vehiculos') {
        fieldsContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Número de Placa</label>
                    <input type="text" name="plate" value="${record?.plate || ''}" placeholder="Ej. O-123ABC" required style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Tipo de Placa</label>
                    <select name="plateType" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="O" ${record?.plateType === 'O' ? 'selected' : ''}>Oficial (O)</option>
                        <option value="P" ${record?.plateType === 'P' ? 'selected' : ''}>Particular (P)</option>
                        <option value="TC" ${record?.plateType === 'TC' ? 'selected' : ''}>Comercial / Carga (TC)</option>
                        <option value="A" ${record?.plateType === 'A' ? 'selected' : ''}>Alquiler (A)</option>
                        <option value="M" ${record?.plateType === 'M' ? 'selected' : ''}>Motocicleta / Municipal (M)</option>
                        <option value="C" ${record?.plateType === 'C' ? 'selected' : ''}>Cuerpo Diplomático (C)</option>
                        <option value="G" ${record?.plateType === 'G' ? 'selected' : ''}>Gobernación (G)</option>
                        <option value="E" ${record?.plateType === 'E' ? 'selected' : ''}>Especial (E)</option>
                        <option value="S" ${record?.plateType === 'S' ? 'selected' : ''}>Secretaría (S)</option>
                        <option value="D" ${record?.plateType === 'D' ? 'selected' : ''}>Dependencia (D)</option>
                    </select>
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.6rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">Información de la Institución</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Institución (Departamento / Nombre)</label>
                    <input type="text" name="department" value="${record?.department || ''}" placeholder="Ej. Ministerio de Finanzas Públicas" required style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Tipo dependencia</label>
                    <select name="tipoInst" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="Ministerio" ${record?.tipoInst === 'Ministerio' ? 'selected' : ''}>Ministerio</option>
                        <option value="Secretaría" ${record?.tipoInst === 'Secretaría' ? 'selected' : ''}>Secretaría</option>
                        <option value="Gobernación" ${record?.tipoInst === 'Gobernación' ? 'selected' : ''}>Gobernación</option>
                        <option value="Presidencia" ${record?.tipoInst === 'Presidencia' ? 'selected' : ''}>Presidencia</option>
                        <option value="Empresa" ${record?.tipoInst === 'Empresa' ? 'selected' : ''}>Empresa</option>
                        <option value="Autoridad" ${record?.tipoInst === 'Autoridad' ? 'selected' : ''}>Autoridad</option>
                    </select>
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Sector</label>
                <select name="sector" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                    <option value="Ministerios" ${record?.sector === 'Ministerios' ? 'selected' : ''}>Ministerios</option>
                    <option value="Secretarías" ${record?.sector === 'Secretarías' ? 'selected' : ''}>Secretarías</option>
                    <option value="Gobernaciones" ${record?.sector === 'Gobernaciones' ? 'selected' : ''}>Gobernaciones</option>
                    <option value="Presidencia" ${record?.sector === 'Presidencia' ? 'selected' : ''}>Presidencia</option>
                    <option value="Otras dependencias" ${record?.sector === 'Otras dependencias' ? 'selected' : ''}>Otras dependencias</option>
                    <option value="Entidades descentralizadas" ${record?.sector === 'Entidades descentralizadas' ? 'selected' : ''}>Entidades descentralizadas</option>
                </select>
            </div>

            <h4 style="margin: 1.2rem 0 0.6rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">Detalles del Vehículo</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Marca</label>
                    <input type="text" name="brand" value="${record?.brand || ''}" placeholder="Ej. Toyota" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Modelo</label>
                    <input type="text" name="model" value="${record?.model || ''}" placeholder="Ej. Hilux" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Color</label>
                    <input type="text" name="color" value="${record?.color || ''}" placeholder="Ej. Azul" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Año</label>
                    <input type="number" name="year" value="${record?.year || 2022}" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.6rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">Uso, Estado y Cumplimiento</h4>
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Uso Autorizado</label>
                <input type="text" name="authorizedUse" value="${record?.authorizedUse || ''}" placeholder="Ej. Trámites oficiales" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Estado Operativo</label>
                    <select name="status" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="Activo" ${record?.status === 'Activo' ? 'selected' : ''}>Activo</option>
                        <option value="Mantenimiento" ${record?.status === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
                        <option value="Inactivo" ${record?.status === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Estado ISCV</label>
                    <select name="iscvMoroso" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="false" ${!record?.iscvMoroso ? 'selected' : ''}>Al día (Cumple)</option>
                        <option value="true" ${record?.iscvMoroso ? 'selected' : ''}>Moroso</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Número de Multas</label>
                    <input type="number" name="multas" value="${record?.multas !== undefined ? record.multas : 0}" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Observaciones / Motivo Inactividad</label>
                <input type="text" name="inactiveReason" value="${record?.inactiveReason || ''}" placeholder="Ej. Vehículo en reparación mayor" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
            </div>
        `;
        modal.style.display = 'flex';
        return;
    }

    if (currentModule === 'vehiculos_instituciones') {
        const c = record?.criterios || {};
        
        fieldsContainer.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Institución</label>
                <input type="text" name="nombre" value="${record?.nombre || ''}" required style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" ${record ? 'readonly' : ''} />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Siglas</label>
                    <input type="text" name="siglas" value="${record?.siglas || ''}" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Sector</label>
                    <select name="sector" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="Ministerios" ${record?.sector === 'Ministerios' ? 'selected' : ''}>Ministerios</option>
                        <option value="Secretarías" ${record?.sector === 'Secretarías' ? 'selected' : ''}>Secretarías</option>
                        <option value="Gobernaciones" ${record?.sector === 'Gobernaciones' ? 'selected' : ''}>Gobernaciones</option>
                        <option value="Presidencia" ${record?.sector === 'Presidencia' ? 'selected' : ''}>Presidencia</option>
                        <option value="Otras dependencias" ${record?.sector === 'Otras dependencias' ? 'selected' : ''}>Otras dependencias</option>
                        <option value="Entidades descentralizadas" ${record?.sector === 'Entidades descentralizadas' ? 'selected' : ''}>Entidades descentralizadas</option>
                    </select>
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.6rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">Criterios de Cumplimiento</h4>
            ${['procedimiento_asignacion', 'registro_interno', 'publicacion_registro', 'canal_auditoria', 'identificacion_logotipo', 'disposicion_excepcional', 'justificacion_seguridad'].map(critKey => {
                const critData = c[critKey] || { cumple: true, estado: 'cumple' };
                return `
                <div style="margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #E8EEF7; border-radius: 6px;">
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem; text-transform: capitalize;">${critKey.replace(/_/g, ' ')}</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <select name="crit_${critKey}_cumple" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                                <option value="true" ${critData.cumple === true ? 'selected' : ''}>Sí cumple (o aplica)</option>
                                <option value="false" ${critData.cumple === false ? 'selected' : ''}>No cumple / En proceso</option>
                            </select>
                        </div>
                        <div>
                            <select name="crit_${critKey}_estado" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                                <option value="cumple" ${critData.estado === 'cumple' || critData.cumple === true ? 'selected' : ''}>Cumple</option>
                                <option value="proceso" ${critData.estado === 'proceso' ? 'selected' : ''}>En Proceso</option>
                                <option value="nocumple" ${critData.estado === 'nocumple' || (critData.cumple === false && critData.estado !== 'proceso') ? 'selected' : ''}>No Cumple</option>
                            </select>
                        </div>
                    </div>
                    <div style="margin-top: 0.5rem;">
                        <input type="text" name="crit_${critKey}_docUrl" value="${critData.docUrl || ''}" placeholder="URL del Documento de Respaldo" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                    </div>
                </div>
                `;
            }).join('')}
        `;
        modal.style.display = 'flex';
        return;
    }

    if (currentModule === 'directorio') {
        const solLinks = Array.isArray(record?.enlaces_solicitud) ? record.enlaces_solicitud : [];
        const ofiLinks = Array.isArray(record?.enlaces_oficio) ? record.enlaces_oficio : [];

        let solInputsHtml = '';
        for (let i = 0; i < 5; i++) {
            solInputsHtml += `
                <div style="margin-bottom: 0.5rem;">
                    <input type="url" name="enlace_solicitud_${i+1}" value="${solLinks[i] || ''}" placeholder="Ej. https://institucion.gob.gt/solicitud-${i+1}" style="width: 100%; padding: 0.55rem; border: 1px solid #A8BFCC; border-radius: 6px; font-size: 0.88rem;" />
                </div>
            `;
        }

        let ofiInputsHtml = '';
        for (let i = 0; i < 5; i++) {
            ofiInputsHtml += `
                <div style="margin-bottom: 0.5rem;">
                    <input type="url" name="enlace_oficio_${i+1}" value="${ofiLinks[i] || ''}" placeholder="Ej. https://institucion.gob.gt/oficio-${i+1}" style="width: 100%; padding: 0.55rem; border: 1px solid #A8BFCC; border-radius: 6px; font-size: 0.88rem;" />
                </div>
            `;
        }

        fieldsContainer.innerHTML = `
            <h4 style="margin: 0 0 0.8rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">Datos Generales de la Institución</h4>
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Nombre de la Institución</label>
                <input type="text" name="nombre_institucion" value="${record?.nombre_institucion || ''}" placeholder="Ej. Ministerio de Finanzas Públicas" required style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Siglas</label>
                    <input type="text" name="siglas" value="${record?.siglas || ''}" placeholder="Ej. MINFIN" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Tipo dependencia / Sector</label>
                    <input type="text" name="sector" value="${record?.sector || ''}" placeholder="Ej. MINISTERIO, SECRETARÍA" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Correo Electrónico (UIP)</label>
                    <input type="email" name="correo" value="${record?.correo || ''}" placeholder="Ej. uip@minfin.gob.gt" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Teléfono</label>
                    <input type="text" name="telefono" value="${record?.telefono || ''}" placeholder="Ej. 2374-3000 ext. 100" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Departamento</label>
                    <input type="text" name="departamento" value="${record?.departamento || 'Guatemala'}" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Sitio Web Institucional</label>
                    <input type="url" name="sitio_web" value="${record?.sitio_web || ''}" placeholder="https://www.minfin.gob.gt" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Dirección Física</label>
                <input type="text" name="direccion" value="${record?.direccion || ''}" placeholder="Ej. 8a Avenida 20-87 Zona 1, Ciudad de Guatemala" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
            </div>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">Horario de Atención</label>
                <input type="text" name="horario_atencion" value="${record?.horario_atencion || 'Lunes a viernes de 08:00 a 16:00 hrs.'}" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
            </div>

            <h4 style="margin: 1.2rem 0 0.8rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">Acceso a la Información (Hasta 5 enlaces directos)</h4>

            <!-- Solicitud en línea -->
            <div style="background: #F4F8FA; border: 1px solid #D1E0E8; border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                    <label style="font-weight: 700; color: #0C1F30; display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" name="solicitud_en_linea" ${record?.solicitud_en_linea ? 'checked' : ''} style="width: 18px; height: 18px;" />
                        ¿Posee Solicitud de Información en Línea?
                    </label>
                </div>
                <div style="font-size: 0.82rem; color: #5E7A8E; margin-bottom: 0.6rem;">
                    <strong>Enlaces directos a Solicitud de Información (Máx. 5 enlaces):</strong>
                </div>
                ${solInputsHtml}
            </div>

            <!-- Información pública de oficio -->
            <div style="background: #F4F8FA; border: 1px solid #D1E0E8; border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                    <label style="font-weight: 700; color: #0C1F30; display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" name="informacion_publica_oficio" ${record?.informacion_publica_oficio ? 'checked' : ''} style="width: 18px; height: 18px;" />
                        ¿Posee Información Pública de Oficio?
                    </label>
                </div>
                <div style="font-size: 0.82rem; color: #5E7A8E; margin-bottom: 0.6rem;">
                    <strong>Enlaces directos a Información Pública de Oficio (Máx. 5 enlaces):</strong>
                </div>
                ${ofiInputsHtml}
            </div>
        `;
        modal.style.display = 'flex';
        return;
    }

    if (currentModule === 'canales') {
        const defaultInstList = [
            { name: "Ministerio de Agricultura, Ganadería y Alimentación - MAGA", tipo: "Ministerios", correo: "alerta.probidad@maga.gob.gt", tel: "2354-4125", dir: "7a Avenida 12-90, edificio Monja Blanca, Zona 13, Ciudad de Guatemala", web: "https://apps.maga.gob.gt/denuncias/Formularios/Index" },
            { name: "Ministerio de Economía - MINECO", tipo: "Ministerios", correo: "oficinadeprobidad@mineco.gob.gt", tel: "2412-0200 Ext 1306", dir: "8ª Avenida 10-43, Zona 1, 3er. nivel, Ciudad de Guatemala", web: "https://www.mineco.gob.gt" },
            { name: "Ministerio de Comunicaciones, Infraestructura y Vivienda - MICIVI", tipo: "Ministerios", correo: "civdenuncias@civ.gob.gt", tel: "1514", dir: "8a avenida y 15 calle, zona 13, Ciudad de Guatemala", web: "https://www.civ.gob.gt" },
            { name: "Ministerio de Cultura y Deportes - MICUDE", tipo: "Ministerios", correo: "unidadprobidad@mcd.gob.gt", tel: "3029-8081", dir: "3ª Avenida y 11 Calle, Zona 1, Palacio Nacional de la Cultura, Ciudad de Guatemala", web: "https://mcd.gob.gt" },
            { name: "Ministerio de la Defensa Nacional - MINDEF", tipo: "Ministerios", correo: "denuncias.probidad@mindef.gob.gt", tel: "2232-4125", dir: "Avenida Reforma 1-45, Zona 10, Ciudad de Guatemala", web: "https://www.mindef.gob.gt" },
            { name: "Ministerio de Desarrollo Social - MIDES", tipo: "Ministerios", correo: "probidad@mides.gob.gt", tel: "2300-5400", dir: "5a Avenida 8-78, Zona 9, Ciudad de Guatemala", web: "https://mides.gob.gt" },
            { name: "Ministerio de Educación - MINEDUC", tipo: "Ministerios", correo: "denuncias.probidad@mineduc.gob.gt", tel: "1503", dir: "6ª Calle 1-36, Zona 10, Ciudad de Guatemala", web: "https://www.mineduc.gob.gt" },
            { name: "Ministerio de Energía y Minas - MEM", tipo: "Ministerios", correo: "unidad.probidad@mem.gob.gt", tel: "2419-6300", dir: "Diagonal 17, 29-78, Zona 11, Ciudad de Guatemala", web: "https://mem.gob.gt" },
            { name: "Ministerio de Finanzas Públicas - MINFIN", tipo: "Ministerios", correo: "probidad@minfin.gob.gt", tel: "2374-3000", dir: "8a Avenida 20-87, Zona 1, Ciudad de Guatemala", web: "https://www.minfin.gob.gt" },
            { name: "Ministerio de Gobernación - MINGOB", tipo: "Ministerios", correo: "probidad@mingob.gob.gt", tel: "110 / 1531", dir: "6ª Avenida 13-71, Zona 1, Ciudad de Guatemala", web: "https://mingob.gob.gt" },
            { name: "Ministerio de Relaciones Exteriores - MINEX", tipo: "Ministerios", correo: "probidad@minex.gob.gt", tel: "2410-0000", dir: "2ª Avenida 4-17, Zona 10, Ciudad de Guatemala", web: "https://minex.gob.gt" },
            { name: "Ministerio de Salud Pública y Asistencia Social - MSPAS", tipo: "Ministerios", correo: "probidad@mspas.gob.gt", tel: "2444-7474", dir: "6ª Avenida 3-45, Zona 11, Ciudad de Guatemala", web: "https://mspas.gob.gt" },
            { name: "Ministerio de Trabajo y Previsión Social - MINTRAB", tipo: "Ministerios", correo: "probidad@mintrabajo.gob.gt", tel: "1511", dir: "7ª Avenida 3-33, Zona 9, Edificio Torre Empresarial, Ciudad de Guatemala", web: "https://mintrabajo.gob.gt" },
            { name: "Secretaría General de la Presidencia - SGP", tipo: "Secretarías", correo: "probidad@sgp.gob.gt", tel: "2269-8000", dir: "6ª Avenida y 6ª Calle, Zona 1, Palacio Nacional, Ciudad de Guatemala", web: "https://sgp.gob.gt" },
            { name: "Secretaría de Planificación y Programación de la Presidencia - SEGEPLAN", tipo: "Secretarías", correo: "probidad@segeplan.gob.gt", tel: "2504-4444", dir: "9a Calle 10-44, Zona 1, Ciudad de Guatemala", web: "https://segeplan.gob.gt" },
            { name: "Comisión Nacional contra la Corrupción - CNC", tipo: "Presidencia", correo: "denuncias@cnc.gob.gt", tel: "2269-8000", dir: "Casa Presidencial, Zona 1, Ciudad de Guatemala", web: "https://cnc.gob.gt" },
            { name: "Superintendencia de Administración Tributaria - SAT", tipo: "Entidades descentralizadas", correo: "denuncias@sat.gob.gt", tel: "1570", dir: "7a Avenida 3-73, Zona 9, Edificio Torre SAT, Ciudad de Guatemala", web: "https://sat.gob.gt" }
        ];

        let catalogOptionsHtml = defaultInstList.map((inst, idx) => `
            <option value="${idx}">${inst.name} (${inst.tipo})</option>
        `).join('');

        fieldsContainer.innerHTML = `
            <div style="background: #F0F7FF; border-left: 4px solid #00C2E0; padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                    <i class="fas fa-info-circle" style="color: #00C2E0; font-size: 1.25rem; margin-top: 2px;"></i>
                    <div style="font-size: 0.88rem; color: #0C1F30; line-height: 1.45;">
                        <strong>Módulo de Canales por la Integridad:</strong><br>
                        Registre y actualice los canales de recepción de denuncias y probidad de las instituciones del Ejecutivo.
                        Utilice el selector de <em>Datos Sombra</em> para auto-completar la información base del catálogo institucional.
                    </div>
                </div>
            </div>

            <div style="background: #FAFDFE; border: 1px dashed #A8BFCC; padding: 0.9rem 1rem; border-radius: 10px; margin-bottom: 1.25rem;">
                <label style="display: block; font-weight: 700; color: #1A5C8F; margin-bottom: 0.4rem; font-size: 0.9rem;">
                    <i class="fas fa-magic" style="color: #00C2E0; margin-right: 4px;"></i> Autocompletar con Datos Sombra del Catálogo
                </label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="canalesCatalogSelector" style="flex: 1; padding: 0.55rem; border: 1px solid #A8BFCC; border-radius: 8px; font-size: 0.88rem; background: #fff;">
                        <option value="">-- Seleccionar institución del catálogo para auto-rellenar --</option>
                        ${catalogOptionsHtml}
                    </select>
                    <button type="button" id="btnApplyCanalesCatalog" style="padding: 0.55rem 1rem; background: #1A5C8F; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.85rem; whitespace: nowrap;">
                        Aplicar
                    </button>
                </div>
                <div style="font-size: 0.78rem; color: #5E7A8E; margin-top: 0.3rem;">
                    * Al aplicar, se completarán los campos de correo oficial, teléfono, tipo, dirección y horario con datos oficiales sugeridos.
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.8rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">
                <i class="fas fa-building" style="margin-right: 6px;"></i> Identificación Institucional
            </h4>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                    Nombre Oficial de la Institución <span style="color: #EF4444;">*</span>
                </label>
                <input type="text" id="canales_institucion" name="institucion" value="${escapeHtml(record?.institucion || '')}" placeholder="Ej. Ministerio de Finanzas Públicas - MINFIN" required style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                <div style="font-size: 0.78rem; color: #5E7A8E; margin-top: 3px;">
                    <i class="fas fa-font"></i> Nombre oficial completo, pudiendo incluir siglas al final (ej. MINECO).
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Tipo de Entidad / Clasificación
                    </label>
                    <select id="canales_tipo" name="tipo" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="Ministerios" ${record?.tipo === 'Ministerios' ? 'selected' : ''}>Ministerios</option>
                        <option value="Secretarías" ${record?.tipo === 'Secretarías' ? 'selected' : ''}>Secretarías</option>
                        <option value="Gobernaciones" ${record?.tipo === 'Gobernaciones' ? 'selected' : ''}>Gobernaciones</option>
                        <option value="Presidencia" ${record?.tipo === 'Presidencia' ? 'selected' : ''}>Presidencia</option>
                        <option value="Entidades descentralizadas" ${record?.tipo === 'Entidades descentralizadas' ? 'selected' : ''}>Entidades Descentralizadas</option>
                        <option value="Otras dependencias" ${record?.tipo === 'Otras dependencias' ? 'selected' : ''}>Otras dependencias</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Total de Canales Habilitados (Auto/Manual)
                    </label>
                    <input type="number" id="canales_canales" name="canales" value="${record?.canales !== undefined ? record.canales : 4}" min="1" max="10" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                    <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 3px;">Calculado automáticamente según vías activas (correo, PBX, formulario web, presencial).</div>
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.8rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">
                <i class="fas fa-headset" style="margin-right: 6px;"></i> Canales Directos de Denuncia y Probidad
            </h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Correo de Denuncias / Probidad
                    </label>
                    <input type="email" id="canales_correo" name="correo" value="${escapeHtml(record?.correo || '')}" placeholder="Ej. alerta.probidad@maga.gob.gt" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                    <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 3px;">Se recomienda correo oficial con dominio <code>@gob.gt</code>.</div>
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Teléfono / PBX de Atención
                    </label>
                    <input type="text" id="canales_telefono" name="telefono" value="${escapeHtml(record?.telefono || '')}" placeholder="Ej. 2354-4125 Ext. 104 o PBX 1514" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                    <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 3px;">Número directo o PBX habilitado para denuncias.</div>
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                    Formulario Web de Denuncias en Línea (URL Directa)
                </label>
                <input type="url" id="canales_formulario" name="formulario" value="${escapeHtml(record?.formulario || '')}" placeholder="Ej. https://apps.maga.gob.gt/denuncias/Formularios/Index" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 3px;">Enlace seguro comenzando con <code>https://</code>.</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Modalidad / Tipo de Comunicación
                    </label>
                    <select id="canales_tipocom" name="tipocom" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="Verbal y escrita" ${record?.tipocom === 'Verbal y escrita' ? 'selected' : ''}>Verbal y escrita</option>
                        <option value="Escrita" ${record?.tipocom === 'Escrita' ? 'selected' : ''}>Escrita</option>
                        <option value="Digital y telefónica" ${record?.tipocom === 'Digital y telefónica' ? 'selected' : ''}>Digital y telefónica</option>
                        <option value="Verbal, escrita y digital" ${record?.tipocom === 'Verbal, escrita y digital' ? 'selected' : ''}>Verbal, escrita y digital</option>
                        <option value="Electrónica" ${record?.tipocom === 'Electrónica' ? 'selected' : ''}>Electrónica</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Otros Canales / Especificaciones
                    </label>
                    <input type="text" id="canales_otro" name="otro" value="${escapeHtml(record?.otro || '')}" placeholder="Ej. Buzón físico institucional, App móvil" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>

            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 0.85rem; border-radius: 8px; margin-bottom: 1rem;">
                <label style="display: flex; align-items: center; gap: 0.6rem; font-weight: 700; color: #0C1F30; cursor: pointer;">
                    <input type="checkbox" id="canales_protocolo" name="Protocolo de actuación" ${record && record['Protocolo de actuación'] === false ? '' : 'checked'} style="width: 18px; height: 18px;" />
                    ¿Cuenta con Protocolo de Actuación Institucionalizado?
                </label>
                <div style="font-size: 0.78rem; color: #5E7A8E; margin-top: 4px; margin-left: 28px;">
                    Indica si la entidad dispone de un procedimiento formal aprobado para tramitar e investigar alertas de corrupción e infracciones administrativas.
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.8rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">
                <i class="fas fa-map-marker-alt" style="margin-right: 6px;"></i> Sede Física y Atención Presencial
            </h4>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                    Dirección Física de la Unidad de Probidad / Sede Central
                </label>
                <input type="text" id="canales_direccion" name="direccion" value="${escapeHtml(record?.direccion || '')}" placeholder="Ej. 7a Avenida 12-90, edificio Monja Blanca, Zona 13, Ciudad de Guatemala" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Ubicación Geográfica
                    </label>
                    <input type="text" id="canales_ubicacion" name="ubicacion" value="${escapeHtml(record?.ubicacion || '')}" placeholder="Ej. Ciudad de Guatemala, Guatemala" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Horario de Atención Presencial
                    </label>
                    <input type="text" id="canales_horario" name="horario" value="${escapeHtml(record?.horario || 'Lunes a viernes, de 08:00 a 16:30 horas')}" placeholder="Ej. Lunes a viernes, de 08:00 a 16:30 horas" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        document.getElementById('btnApplyCanalesCatalog')?.addEventListener('click', () => {
            const selIdx = document.getElementById('canalesCatalogSelector')?.value;
            if (selIdx === '' || selIdx === undefined) {
                showToast('Seleccione una institución del catálogo primero.', 'info');
                return;
            }
            const item = defaultInstList[Number(selIdx)];
            if (item) {
                document.getElementById('canales_institucion').value = item.name;
                document.getElementById('canales_tipo').value = item.tipo;
                document.getElementById('canales_correo').value = item.correo;
                document.getElementById('canales_telefono').value = item.tel;
                document.getElementById('canales_direccion').value = item.dir;
                document.getElementById('canales_ubicacion').value = "Ciudad de Guatemala, Guatemala";
                if (item.web && item.web.includes('http')) {
                    document.getElementById('canales_formulario').value = item.web;
                }
                showToast(`Datos sombra de '${item.name}' aplicados exitosamente.`, 'success');
            }
        });

        return;
    }

    if (currentModule === 'tableros') {
        const defaultInstList = [
            { name: "Vicepresidencia de la República", siglas: "VICE", tipo: "Vicepresidencia", sector: "Presidencia", link: "https://www.vicepresidencia.gob.gt/", desc: "Tablero de rendición de cuentas e indicadores de gestión estratégica de la Vicepresidencia de la República." },
            { name: "Ministerio de Agricultura, Ganadería y Alimentación", siglas: "MAGA", tipo: "Ministerio", sector: "Agricultura", link: "https://www.maga.gob.gt/", desc: "Tablero de ejecuciones presupuestarias, metas agrícolas y programas de apoyo a la agricultura familiar." },
            { name: "Ministerio de Ambiente y Recursos Naturales", siglas: "MARN", tipo: "Ministerio", sector: "Ambiente", link: "https://www.marn.gob.gt/", desc: "Tablero de proyectos ambientales, licencias y monitoreo de recursos naturales." },
            { name: "Ministerio de Comunicaciones, Infraestructura y Vivienda", siglas: "CIV", tipo: "Ministerio", sector: "Infraestructura", link: "https://www.civ.gob.gt/", desc: "Tablero de ejecución de obra pública, conservación vial e infraestructura nacional." },
            { name: "Ministerio de Cultura y Deportes", siglas: "MICUDE", tipo: "Ministerio", sector: "Cultura", link: "https://mcd.gob.gt/", desc: "Tablero numérico de desarrollo cultural, parques nacionales y proyectos deportivos." },
            { name: "Ministerio de la Defensa Nacional", siglas: "MINDEF", tipo: "Ministerio", sector: "Defensa", link: "https://www.mindef.gob.gt/", desc: "Tablero de rendición de cuentas en seguridad nacional y apoyo a la ciudadanía." },
            { name: "Ministerio de Desarrollo Social", siglas: "MIDES", tipo: "Ministerio", sector: "Desarrollo Social", link: "https://mides.gob.gt/", desc: "Tablero de programas sociales, comedores sociales y transferencias monetarias condicionadas." },
            { name: "Ministerio de Economía", siglas: "MINECO", tipo: "Ministerio", sector: "Economía", link: "https://www.mineco.gob.gt/", desc: "Tablero de atracción de inversiones, apoyo a MIPYMES y comercio exterior." },
            { name: "Ministerio de Educación", siglas: "MINEDUC", tipo: "Ministerio", sector: "Educación", link: "https://www.mineduc.gob.gt/", desc: "Tablero de cobertura educativa, remozamiento de escuelas y programas de alimentación escolar." },
            { name: "Ministerio de Energía y Minas", siglas: "MEM", tipo: "Ministerio", sector: "Energía", link: "https://mem.gob.gt/", desc: "Tablero de electrificación rural, licencias mineras y matriz energética." },
            { name: "Ministerio de Finanzas Públicas", siglas: "MINFIN", tipo: "Ministerio", sector: "Finanzas", link: "https://www.minfin.gob.gt/", desc: "Tablero portal de transparencia fiscal, ejecución presupuestaria general y deuda pública." },
            { name: "Ministerio de Gobernación", siglas: "MINGOB", tipo: "Ministerio", sector: "Gobernación", link: "https://mingob.gob.gt/", desc: "Tablero de estadísticas de seguridad ciudadana, incidencia criminal y fortalecimiento policial." },
            { name: "Ministerio de Relaciones Exteriores", siglas: "MINEX", tipo: "Ministerio", sector: "Relaciones Exteriores", link: "https://minex.gob.gt/", desc: "Tablero de atención consular, servicios para la diáspora y diplomacia comercial." },
            { name: "Ministerio de Salud Pública y Asistencia Social", siglas: "MSPAS", tipo: "Ministerio", sector: "Salud", link: "https://mspas.gob.gt/", desc: "Tablero de abastecimiento de medicamentos, red hospitalaria e indicadores sanitarios." },
            { name: "Ministerio de Trabajo y Previsión Social", siglas: "MINTRAB", tipo: "Ministerio", sector: "Trabajo", link: "https://mintrabajo.gob.gt/", desc: "Tablero de empleo, programa de aporte al adulto mayor e inspecciones laborales." },
            { name: "Secretaría de Planificación y Programación de la Presidencia", siglas: "SEGEPLAN", tipo: "Secretaría", sector: "Presidencia", link: "https://segeplan.gob.gt/", desc: "Tablero de seguimiento al Plan Nacional de Desarrollo y prioridades presidenciales." },
            { name: "Superintendencia de Administración Tributaria", siglas: "SAT", tipo: "Entidad Descentralizada", sector: "Finanzas", link: "https://sat.gob.gt/", desc: "Tablero de recaudación tributaria, facilitación del comercio y metas fiscales." }
        ];

        let catalogOptionsHtml = defaultInstList.map((inst, idx) => `
            <option value="${idx}">${inst.name} (${inst.siglas})</option>
        `).join('');

        fieldsContainer.innerHTML = `
            <div style="background: #F0F9FF; border-left: 4px solid #22C55E; padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                    <i class="fas fa-chart-bar" style="color: #22C55E; font-size: 1.25rem; margin-top: 2px;"></i>
                    <div style="font-size: 0.88rem; color: #0C1F30; line-height: 1.45;">
                        <strong>Módulo Tu Gobierno en Números (Tableros de Rendición de Cuentas):</strong><br>
                        Registre y enlace los tableros interactivos de datos abiertos de las instituciones públicas.
                        Complete los campos con la información sugerida en los <em>datos sombra</em>.
                    </div>
                </div>
            </div>

            <div style="background: #FAFDFE; border: 1px dashed #A8BFCC; padding: 0.9rem 1rem; border-radius: 10px; margin-bottom: 1.25rem;">
                <label style="display: block; font-weight: 700; color: #1A5C8F; margin-bottom: 0.4rem; font-size: 0.9rem;">
                    <i class="fas fa-magic" style="color: #22C55E; margin-right: 4px;"></i> Autocompletar con Datos Sombra Institucionales
                </label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="tablerosCatalogSelector" style="flex: 1; padding: 0.55rem; border: 1px solid #A8BFCC; border-radius: 8px; font-size: 0.88rem; background: #fff;">
                        <option value="">-- Seleccionar institución sugerida --</option>
                        ${catalogOptionsHtml}
                    </select>
                    <button type="button" id="btnApplyTablerosCatalog" style="padding: 0.55rem 1rem; background: #1A5C8F; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.85rem; whitespace: nowrap;">
                        Aplicar
                    </button>
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.8rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">
                <i class="fas fa-building" style="margin-right: 6px;"></i> Datos de la Institución
            </h4>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                    Nombre Completo de la Institución <span style="color: #EF4444;">*</span>
                </label>
                <input type="text" id="tableros_nombre" name="nombre_institucion" value="${escapeHtml(record?.nombre_institucion || '')}" placeholder="Ej. Ministerio de Finanzas Públicas" required style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Siglas Institucionales
                    </label>
                    <input type="text" id="tableros_siglas" name="siglas" value="${escapeHtml(record?.siglas || '')}" placeholder="Ej. MINFIN, MAGA, SAT" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Tipo de Dependencia
                    </label>
                    <select id="tableros_tipo" name="tipo_dependencia" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="Ministerio" ${record?.tipo_dependencia === 'Ministerio' ? 'selected' : ''}>Ministerio</option>
                        <option value="Secretaría" ${record?.tipo_dependencia === 'Secretaría' ? 'selected' : ''}>Secretaría</option>
                        <option value="Gobernación" ${record?.tipo_dependencia === 'Gobernación' ? 'selected' : ''}>Gobernación</option>
                        <option value="Presidencia" ${record?.tipo_dependencia === 'Presidencia' ? 'selected' : ''}>Presidencia</option>
                        <option value="Vicepresidencia" ${record?.tipo_dependencia === 'Vicepresidencia' ? 'selected' : ''}>Vicepresidencia</option>
                        <option value="Entidad Descentralizada" ${record?.tipo_dependencia === 'Entidad Descentralizada' ? 'selected' : ''}>Entidad Descentralizada</option>
                        <option value="Empresa Pública" ${record?.tipo_dependencia === 'Empresa Pública' ? 'selected' : ''}>Empresa Pública</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Sector / Eje Temático
                    </label>
                    <input type="text" id="tableros_sector" name="sector" value="${escapeHtml(record?.sector || '')}" placeholder="Ej. Finanzas, Agricultura, Salud" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>

            <h4 style="margin: 1.2rem 0 0.8rem; color: #1A5C8F; border-bottom: 1px solid #E8EEF7; padding-bottom: 0.3rem;">
                <i class="fas fa-link" style="margin-right: 6px;"></i> Enlace del Tablero y Descripción Informativa
            </h4>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                    URL del Tablero Interactivo / Portal Numérico <span style="color: #EF4444;">*</span>
                </label>
                <input type="url" id="tableros_link" name="link_tablero" value="${escapeHtml(record?.link_tablero || '')}" placeholder="Ej. https://www.minfin.gob.gt/transparencia-fiscal" required style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 3px;">Debe iniciar obligatoriamente con <code>https://</code>.</div>
            </div>

            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                    Descripción Breve del Contenido del Tablero <span style="color: #EF4444;">*</span>
                </label>
                <textarea id="tableros_desc" name="descripcion" rows="3" required placeholder="Ej. Tablero interactivo de rendición de cuentas, ejecución presupuestaria general, prioridades presidenciales e indicadores clave..." style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px; font-family: inherit;">${escapeHtml(record?.descripcion || '')}</textarea>
                <div style="font-size: 0.75rem; color: #5E7A8E; margin-top: 3px;">Explique brevemente a la ciudadanía qué información podrá visualizar en este tablero.</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Estado de Disponibilidad del Tablero <span style="color: #EF4444;">*</span>
                    </label>
                    <select id="tableros_estado" name="estado" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;">
                        <option value="Disponible" ${record?.estado === 'Disponible' || !record?.estado ? 'selected' : ''}>Disponible (En línea)</option>
                        <option value="En proceso" ${record?.estado === 'En proceso' ? 'selected' : ''}>En Proceso de Integración</option>
                        <option value="En actualización" ${record?.estado === 'En actualización' ? 'selected' : ''}>En Actualización Periódica</option>
                        <option value="En revisión" ${record?.estado === 'En revisión' ? 'selected' : ''}>En Revisión Técnica</option>
                        <option value="No disponible" ${record?.estado === 'No disponible' ? 'selected' : ''}>No Disponible Temporariamente</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.3rem;">
                        Fecha / Año de Última Actualización
                    </label>
                    <input type="text" id="tableros_fecha" name="fecha_actualizacion" value="${escapeHtml(record?.fecha_actualizacion || new Date().getFullYear().toString())}" placeholder="Ej. 2026 o 2026-08-11" style="width: 100%; padding: 0.65rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        document.getElementById('btnApplyTablerosCatalog')?.addEventListener('click', () => {
            const selIdx = document.getElementById('tablerosCatalogSelector')?.value;
            if (selIdx === '' || selIdx === undefined) {
                showToast('Seleccione una institución del catálogo sugerido.', 'info');
                return;
            }
            const item = defaultInstList[Number(selIdx)];
            if (item) {
                document.getElementById('tableros_nombre').value = item.name;
                document.getElementById('tableros_siglas').value = item.siglas;
                document.getElementById('tableros_tipo').value = item.tipo;
                document.getElementById('tableros_sector').value = item.sector;
                document.getElementById('tableros_link').value = item.link;
                document.getElementById('tableros_desc').value = item.desc;
                showToast(`Datos sombra de '${item.name}' aplicados exitosamente.`, 'success');
            }
        });

        return;
    }

    const schemaSource = record || (currentModuleData.length > 0 ? currentModuleData[0] : { nombre: '', descripcion: '' });

    let fieldsHtml = '';
    for (const [key, val] of Object.entries(schemaSource)) {
        if (key === 'id') continue;
        const currentVal = record ? record[key] : '';
        const isBool = typeof val === 'boolean';
        const isObj = typeof val === 'object' && val !== null;

        if (isBool) {
            fieldsHtml += `
                <div style="margin-bottom: 1.2rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; color: #0C1F30;">
                        <input type="checkbox" name="${key}" ${currentVal ? 'checked' : ''} style="width: 18px; height: 18px;" />
                        ${capitalize(key)}
                    </label>
                </div>
            `;
        } else if (isObj) {
            fieldsHtml += `
                <div style="margin-bottom: 1.2rem;">
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">${capitalize(key)} (JSON/Objeto)</label>
                    <textarea name="${key}" rows="4" style="width: 100%; padding: 0.75rem; border: 1px solid #A8BFCC; border-radius: 8px; font-family: monospace;">${JSON.stringify(currentVal || val, null, 2)}</textarea>
                </div>
            `;
        } else {
            fieldsHtml += `
                <div style="margin-bottom: 1.2rem;">
                    <label style="display: block; font-weight: 600; color: #0C1F30; margin-bottom: 0.4rem;">${capitalize(key)}</label>
                    <input type="text" name="${key}" value="${currentVal !== undefined ? currentVal : ''}" style="width: 100%; padding: 0.75rem; border: 1px solid #A8BFCC; border-radius: 8px;" />
                </div>
            `;
        }
    }

    fieldsContainer.innerHTML = fieldsHtml;
    modal.style.display = 'flex';
}

function closeCrudModal() {
    const modal = document.getElementById('crudModal');
    if (modal) modal.style.display = 'none';
    editingRecordId = null;
}

async function saveCrudRecord(e) {
    e.preventDefault();
    const form = document.getElementById('crudForm');
    if (!form) return;

    if (currentModule === 'vehiculos_instituciones') {
        const getVal = (name) => form.querySelector(`[name="${name}"]`)?.value || '';
        
        const recordObj = {
            nombre: getVal('nombre'),
            siglas: getVal('siglas'),
            sector: getVal('sector'),
            criterios: {}
        };

        const validation = validateModuleRecord('vehiculos_instituciones', recordObj);
        if (!validation.isValid) {
            showToast(`Validación del Esquema: ${validation.errors.join(' | ')}`, 'error');
            return;
        }

        ['procedimiento_asignacion', 'registro_interno', 'publicacion_registro', 'canal_auditoria', 'identificacion_logotipo', 'disposicion_excepcional', 'justificacion_seguridad'].forEach(critKey => {
            const cumpleVal = getVal(`crit_${critKey}_cumple`) === 'true';
            const estadoVal = getVal(`crit_${critKey}_estado`);
            recordObj.criterios[critKey] = {
                label: critKey.replace(/_/g, ' '),
                cumple: cumpleVal,
                estado: estadoVal,
                docUrl: getVal(`crit_${critKey}_docUrl`) || null
            };
        });

        try {
            let url = `${getApiBase()}/vehiculos_instituciones`;
            let method = 'POST';

            if (editingRecordId) {
                url += `/${encodeURIComponent(editingRecordId)}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(recordObj)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al guardar');
            }

            showToast('Criterios institucionales actualizados', 'success');
            closeCrudModal();
            await fetchAndRenderTable('vehiculos_instituciones');
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    if (currentModule === 'vehiculos') {
        const getVal = (name) => form.querySelector(`[name="${name}"]`)?.value || '';

        const recordObj = {
            plate: getVal('plate'),
            plateType: getVal('plateType') || 'O',
            department: getVal('department'),
            tipoInst: getVal('tipoInst') || 'Ministerio',
            sector: getVal('sector') || 'Ministerios',
            authorizedUse: getVal('authorizedUse'),
            brand: getVal('brand'),
            model: getVal('model'),
            year: Number(getVal('year') || 2024),
            color: getVal('color'),
            status: getVal('status') || 'Activo',
            inactiveReason: getVal('inactiveReason') || null,
            lastUpdate: new Date().toISOString(),
            iscvMoroso: getVal('iscvMoroso') === 'true',
            multas: Number(getVal('multas') || 0)
        };

        const validation = validateModuleRecord('vehiculos', recordObj);
        if (!validation.isValid) {
            showToast(`Error de Validación: ${validation.errors.join(' | ')}`, 'error');
            return;
        }

        try {
            let url = `${getApiBase()}/vehiculos`;
            let method = 'POST';

            if (editingRecordId) {
                url += `/${editingRecordId}`;
                method = 'PUT';
                recordObj.id = Number(editingRecordId);
            }

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(recordObj)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al guardar');
            }

            showToast(editingRecordId ? 'Vehículo actualizado y guardado en bitácora' : 'Vehículo registrado y guardado en bitácora', 'success');
            closeCrudModal();
            await fetchAndRenderTable('vehiculos');
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    if (currentModule === 'directorio') {
        const getVal = (name) => form.querySelector(`[name="${name}"]`)?.value?.trim() || '';

        const solLinks = [];
        for (let i = 1; i <= 5; i++) {
            const val = getVal(`enlace_solicitud_${i}`);
            if (val) solLinks.push(val);
        }

        const ofiLinks = [];
        for (let i = 1; i <= 5; i++) {
            const val = getVal(`enlace_oficio_${i}`);
            if (val) ofiLinks.push(val);
        }

        const hasSolCheck = form.querySelector('[name="solicitud_en_linea"]')?.checked || false;
        const hasOfiCheck = form.querySelector('[name="informacion_publica_oficio"]')?.checked || false;

        const recordObj = {
            nombre_institucion: getVal('nombre_institucion'),
            siglas: getVal('siglas'),
            sector: getVal('sector'),
            departamento: getVal('departamento') || 'Guatemala',
            correo: getVal('correo'),
            telefono: getVal('telefono'),
            direccion: getVal('direccion'),
            horario_atencion: getVal('horario_atencion'),
            sitio_web: getVal('sitio_web'),
            solicitud_en_linea: hasSolCheck || solLinks.length > 0,
            informacion_publica_oficio: hasOfiCheck || ofiLinks.length > 0,
            enlaces_solicitud: solLinks,
            enlaces_oficio: ofiLinks,
            ultima_actualizacion: new Date().toISOString().split('T')[0]
        };

        const validation = validateModuleRecord('directorio', recordObj);
        if (!validation.isValid) {
            showToast(`Error de Validación: ${validation.errors.join(' | ')}`, 'error');
            return;
        }

        try {
            let url = `${getApiBase()}/directorio`;
            let method = 'POST';

            if (editingRecordId) {
                url += `/${editingRecordId}`;
                method = 'PUT';
                recordObj.id = Number(editingRecordId);
            }

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(recordObj)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al guardar');
            }

            showToast(editingRecordId ? 'Institución actualizada y guardada en bitácora' : 'Institución registrada y guardada en bitácora', 'success');
            closeCrudModal();
            await fetchAndRenderTable('directorio');
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    if (currentModule === 'canales') {
        const getVal = (name) => form.querySelector(`[name="${name}"]`)?.value?.trim() || '';
        const getCheck = (name) => form.querySelector(`[name="${name}"]`)?.checked || false;

        let activeChannels = 0;
        if (getVal('correo')) activeChannels++;
        if (getVal('telefono')) activeChannels++;
        if (getVal('formulario')) activeChannels++;
        if (getVal('direccion')) activeChannels++;
        if (getVal('otro')) activeChannels++;
        const manualCanales = Number(getVal('canales'));
        const canalesCount = manualCanales > 0 ? manualCanales : Math.max(1, activeChannels);

        const recordObj = {
            institucion: getVal('institucion'),
            tipo: getVal('tipo') || 'Ministerios',
            canales: canalesCount,
            correo: getVal('correo'),
            telefono: getVal('telefono'),
            formulario: getVal('formulario'),
            tipocom: getVal('tipocom') || 'Verbal y escrita',
            otro: getVal('otro'),
            direccion: getVal('direccion'),
            ubicacion: getVal('ubicacion') || getVal('direccion'),
            horario: getVal('horario') || 'Lunes a viernes, de 08:00 a 16:30 horas',
            'Protocolo de actuación': getCheck('Protocolo de actuación')
        };

        const validation = validateModuleRecord('canales', recordObj);
        if (!validation.isValid) {
            showToast(`Error de Validación: ${validation.errors.join(' | ')}`, 'error');
            return;
        }

        try {
            let url = `${getApiBase()}/canales`;
            let method = 'POST';

            if (editingRecordId) {
                url += `/${editingRecordId}`;
                method = 'PUT';
                recordObj.id = Number(editingRecordId);
            }

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(recordObj)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al guardar');
            }

            showToast(editingRecordId ? 'Canal de integridad actualizado y auditado' : 'Canal de integridad registrado y auditado', 'success');
            closeCrudModal();
            await fetchAndRenderTable('canales');
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    if (currentModule === 'tableros') {
        const getVal = (name) => form.querySelector(`[name="${name}"]`)?.value?.trim() || '';

        const recordObj = {
            nombre_institucion: getVal('nombre_institucion'),
            siglas: getVal('siglas'),
            tipo_dependencia: getVal('tipo_dependencia') || 'Ministerio',
            sector: getVal('sector') || 'Presidencia',
            link_tablero: getVal('link_tablero'),
            descripcion: getVal('descripcion'),
            fecha_actualizacion: getVal('fecha_actualizacion') || new Date().getFullYear().toString(),
            estado: getVal('estado') || 'Disponible'
        };

        const validation = validateModuleRecord('tableros', recordObj);
        if (!validation.isValid) {
            showToast(`Error de Validación: ${validation.errors.join(' | ')}`, 'error');
            return;
        }

        try {
            let url = `${getApiBase()}/tableros`;
            let method = 'POST';

            if (editingRecordId) {
                url += `/${editingRecordId}`;
                method = 'PUT';
                recordObj.id = Number(editingRecordId);
            }

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(recordObj)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al guardar');
            }

            showToast(editingRecordId ? 'Tablero de gobierno actualizado y auditado' : 'Tablero de gobierno registrado y auditado', 'success');
            closeCrudModal();
            await fetchAndRenderTable('tableros');
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    const bodyObj = {};

    form.querySelectorAll('[name]').forEach(input => {
        const name = input.getAttribute('name');
        if (input.type === 'checkbox') {
            bodyObj[name] = input.checked;
        } else if (input.tagName.toLowerCase() === 'textarea') {
            try {
                bodyObj[name] = JSON.parse(input.value);
            } catch {
                bodyObj[name] = input.value;
            }
        } else {
            const val = input.value;
            bodyObj[name] = !isNaN(val) && val.trim() !== '' ? Number(val) : val;
        }
    });

    const validation = validateModuleRecord(currentModule, bodyObj);
    if (!validation.isValid) {
        showToast(`Error de Validación: ${validation.errors.join(' | ')}`, 'error');
        return;
    }

    try {
        let url = `${getApiBase()}/${currentModule}`;
        let method = 'POST';

        if (editingRecordId) {
            url += `/${editingRecordId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method,
            headers: getHeaders(),
            body: JSON.stringify(bodyObj)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al guardar');
        }

        showToast(editingRecordId ? 'Registro actualizado y guardado en bitácora' : 'Registro creado y guardado en bitácora', 'success');
        closeCrudModal();
        await fetchAndRenderTable(currentModule);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function exportModuleJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentModuleData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentModule}_pia_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}
