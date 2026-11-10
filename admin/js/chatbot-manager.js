/* ============================================================
   ADMIN CHATBOT MANAGER - JS MODULE
   ============================================================ */

function getAdminHeaders(extra = {}) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return {
        ...extra,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

export async function initChatbotManager() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h1 style="font-family: var(--font-head); font-size: 1.6rem; color: var(--navy); display: flex; align-items: center; gap: 10px; margin: 0;">
                    <img src="/img/asistenteVirtual2.png" alt="Asistente Lupita" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" /> Asistente Virtual Lupita & Base de Conocimiento
                </h1>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin: 4px 0 0 0;">
                    Gestión centralizada del Chatbot Inteligente, monitoreo de métricas, entrenamiento de conocimientos y parámetros de Gemini LLM.
                </p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button id="btnRefreshChatbotData" class="btn-primary" style="padding: 0.5rem 1rem; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-sync-alt"></i> Actualizar Datos
                </button>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; overflow-x: auto;">
            <button class="cb-tab-btn active" data-tab="stats" style="padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 3px solid var(--cyan); font-weight: 700; color: var(--navy); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-chart-line"></i> Métricas y Estadísticas
            </button>
            <button class="cb-tab-btn" data-tab="knowledge" style="padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: 600; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-book-open"></i> Base de Conocimiento (<span id="cbKbBadge">0</span>)
            </button>
            <button class="cb-tab-btn" data-tab="logs" style="padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: 600; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-comments"></i> Historial de Conversaciones
            </button>
            <button class="cb-tab-btn" data-tab="settings" style="padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: 600; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-sliders-h"></i> Configuración de la IA
            </button>
        </div>

        <!-- TAB CONTENT PANELS -->
        <div id="cbTabStats" class="cb-tab-panel" style="display: block;"></div>
        <div id="cbTabKnowledge" class="cb-tab-panel" style="display: none;"></div>
        <div id="cbTabLogs" class="cb-tab-panel" style="display: none;"></div>
        <div id="cbTabSettings" class="cb-tab-panel" style="display: none;"></div>
    `;

    attachTabSwitchers();
    document.getElementById('btnRefreshChatbotData').addEventListener('click', loadAllChatbotData);

    await loadAllChatbotData();
}

function attachTabSwitchers() {
    const tabs = document.querySelectorAll('.cb-tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-muted)';
                t.style.fontWeight = '600';
            });
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--cyan)';
            tab.style.color = 'var(--navy)';
            tab.style.fontWeight = '700';

            const targetTab = tab.dataset.tab;
            document.querySelectorAll('.cb-tab-panel').forEach(p => p.style.display = 'none');
            if (targetTab === 'stats') document.getElementById('cbTabStats').style.display = 'block';
            if (targetTab === 'knowledge') document.getElementById('cbTabKnowledge').style.display = 'block';
            if (targetTab === 'logs') document.getElementById('cbTabLogs').style.display = 'block';
            if (targetTab === 'settings') document.getElementById('cbTabSettings').style.display = 'block';
        });
    });
}

async function loadAllChatbotData() {
    await Promise.all([
        loadStatsTab(),
        loadKnowledgeTab(),
        loadLogsTab(),
        loadSettingsTab()
    ]);
}

// -------------------------------------------------------------
// TAB 1: METRICS & STATS
// -------------------------------------------------------------
async function loadStatsTab() {
    const container = document.getElementById('cbTabStats');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/chatbot/stats', { headers: getAdminHeaders() });
        const stats = await res.json();

        const totalConversations = stats.totalConversations || 0;
        const avgTime = stats.avgResponseTimeMs || 0;
        const satRate = stats.satisfactionRate || 95;
        const unansweredCount = (stats.unansweredQueries || []).length;

        let dailyBarsHTML = '';
        if (stats.dailyStats && stats.dailyStats.length > 0) {
            const maxVal = Math.max(...stats.dailyStats.map(d => d.count || 1));
            dailyBarsHTML = stats.dailyStats.map(d => {
                const heightPct = Math.round(((d.count || 0) / maxVal) * 100);
                return `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--navy);">${d.count}</span>
                        <div style="width: 100%; max-width: 36px; height: 120px; background: rgba(0,194,224,0.1); border-radius: 8px 8px 0 0; display: flex; align-items: flex-end; overflow: hidden;">
                            <div style="width: 100%; height: ${Math.max(heightPct, 10)}%; background: linear-gradient(180deg, var(--cyan) 0%, var(--blue) 100%); border-radius: 6px 6px 0 0;"></div>
                        </div>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">${d.date.slice(5)}</span>
                    </div>
                `;
            }).join('');
        }

        let frequentRowsHTML = (stats.frequentQueries || []).map((fq, idx) => `
            <tr>
                <td style="font-weight: 700; color: var(--cyan); text-align: center;">#${idx + 1}</td>
                <td style="font-weight: 600;">${escapeHTML(fq.query)}</td>
                <td style="text-align: right;"><span class="badge" style="background: rgba(0,194,224,0.15); color: var(--blue); font-weight: 700;">${fq.count} veces</span></td>
            </tr>
        `).join('');

        let unansweredRowsHTML = (stats.unansweredQueries || []).map(uq => `
            <tr>
                <td style="font-weight: 600; color: #DC2626;">${escapeHTML(uq.query)}</td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(uq.date).toLocaleDateString()}</td>
                <td style="text-align: right;">
                    <button class="btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="window.PIA_CHATBOT_ADMIN.addUnansweredToKb('${escapeHTML(uq.query).replace(/'/g, "\\'")}')">
                        <i class="fas fa-plus-circle"></i> Agregar a Conocimiento
                    </button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <!-- Top Metric Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="padding: 1.25rem; border-left: 4px solid var(--cyan);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Total Conversaciones</span>
                        <i class="fas fa-comments" style="color: var(--cyan); font-size: 1.3rem;"></i>
                    </div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: var(--navy); margin-top: 8px;">${totalConversations}</div>
                    <span style="font-size: 0.75rem; color: var(--green);"><i class="fas fa-arrow-up"></i> Consultas atendidas en vivo</span>
                </div>

                <div class="card" style="padding: 1.25rem; border-left: 4px solid var(--blue);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Tiempo Prom. Respuesta</span>
                        <i class="fas fa-bolt" style="color: var(--blue); font-size: 1.3rem;"></i>
                    </div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: var(--navy); margin-top: 8px;">${avgTime} ms</div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Generación en tiempo real</span>
                </div>

                <div class="card" style="padding: 1.25rem; border-left: 4px solid #10B981;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Índice de Satisfacción</span>
                        <i class="fas fa-smile" style="color: #10B981; font-size: 1.3rem;"></i>
                    </div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: var(--navy); margin-top: 8px;">${satRate}%</div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-thumbs-up"></i> Basado en valoraciones de usuarios</span>
                </div>

                <div class="card" style="padding: 1.25rem; border-left: 4px solid #EF4444;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Consultas Sin Coincidencia</span>
                        <i class="fas fa-question-circle" style="color: #EF4444; font-size: 1.3rem;"></i>
                    </div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: var(--navy); margin-top: 8px;">${unansweredCount}</div>
                    <span style="font-size: 0.75rem; color: #EF4444;">Oportunidades de entrenamiento</span>
                </div>
            </div>

            <!-- Daily Chart Section -->
            <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--navy); margin-top: 0; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-chart-bar" style="color: var(--cyan);"></i> Volumen Diario de Consultas
                </h3>
                <div style="display: flex; items-align: flex-end; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border);">
                    ${dailyBarsHTML || '<p style="color: var(--text-muted);">No hay datos suficientes para graficar todavía.</p>'}
                </div>
            </div>

            <!-- Tables Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.5rem;">
                <!-- Frequent Queries -->
                <div class="card" style="padding: 1.25rem;">
                    <h3 style="font-size: 1rem; font-weight: 700; color: var(--navy); margin-top: 0; margin-bottom: 1rem;">
                        <i class="fas fa-fire" style="color: #F5A623;"></i> Preguntas Más Frecuentes
                    </h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px;">#</th>
                                    <th>Pregunta / Tema</th>
                                    <th style="text-align: right;">Frecuencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${frequentRowsHTML || '<tr><td colspan="3" style="text-align:center;">No hay preguntas registradas.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Unanswered Queries -->
                <div class="card" style="padding: 1.25rem;">
                    <h3 style="font-size: 1rem; font-weight: 700; color: var(--navy); margin-top: 0; margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i> Consultas Sin Respuesta Específica
                    </h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Consulta del Usuario</th>
                                    <th>Fecha</th>
                                    <th style="text-align: right;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${unansweredRowsHTML || '<tr><td colspan="3" style="text-align:center; color: var(--green);">¡Excelente! No hay consultas pendientes sin coincidencia.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Error loading chatbot stats:', e);
    }
}

// -------------------------------------------------------------
// TAB 2: KNOWLEDGE BASE (ENTRENAMIENTO)
// -------------------------------------------------------------
let cachedKnowledge = [];

async function loadKnowledgeTab() {
    const container = document.getElementById('cbTabKnowledge');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/chatbot/knowledge', { headers: getAdminHeaders() });
        cachedKnowledge = await res.json();

        const badge = document.getElementById('cbKbBadge');
        if (badge) badge.textContent = cachedKnowledge.length;

        renderKnowledgeList(cachedKnowledge);
    } catch (e) {
        console.error('Error loading chatbot knowledge:', e);
    }
}

function renderKnowledgeList(items) {
    const container = document.getElementById('cbTabKnowledge');
    if (!container) return;

    const rowsHTML = items.map(item => `
        <tr>
            <td style="font-weight: 700; color: var(--navy);">${escapeHTML(item.title)}</td>
            <td><span class="badge" style="background: rgba(26,92,143,0.1); color: var(--blue); font-weight: 700;">${escapeHTML(item.category || 'General')}</span></td>
            <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.85rem; color: var(--text-muted);">${escapeHTML(item.content)}</td>
            <td style="font-size: 0.8rem;">${(item.keywords || []).map(k => `<code style="font-size: 0.72rem; padding: 2px 4px; background: #E2E8F0; border-radius: 4px; margin-right: 3px;">${escapeHTML(k)}</code>`).join('')}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button class="btn-action edit" onclick="window.PIA_CHATBOT_ADMIN.editKbItem('${item.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn-action delete" onclick="window.PIA_CHATBOT_ADMIN.deleteKbItem('${item.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="card" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 0.75rem; flex: 1; max-width: 500px;">
                    <input type="text" id="kbSearchInput" class="form-control" placeholder="Buscar en la base de conocimiento..." style="flex: 1;" oninput="window.PIA_CHATBOT_ADMIN.filterKnowledge(this.value)">
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-primary" onclick="window.PIA_CHATBOT_ADMIN.openAddKbModal()" style="padding: 0.5rem 1rem;">
                        <i class="fas fa-plus"></i> Nuevo Artículo
                    </button>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Título / Documento</th>
                            <th>Categoría</th>
                            <th>Contenido Resumido</th>
                            <th>Palabras Clave</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML || '<tr><td colspan="5" style="text-align:center;">No hay artículos en la base de conocimiento.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// TAB 3: CONVERSATION LOGS
// -------------------------------------------------------------
async function loadLogsTab() {
    const container = document.getElementById('cbTabLogs');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/chatbot/conversations', { headers: getAdminHeaders() });
        const logs = await res.json();

        const rowsHTML = logs.map(log => `
            <tr>
                <td style="font-size: 0.8rem; font-family: monospace; color: var(--text-muted);">${escapeHTML(log.sessionId || log.id)}</td>
                <td style="font-size: 0.8rem;">${new Date(log.timestamp).toLocaleString()}</td>
                <td style="font-weight: 600; color: var(--navy); max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHTML(log.userMessage)}</td>
                <td style="max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-size: 0.85rem; color: var(--text-muted);">${escapeHTML(log.botResponse)}</td>
                <td style="font-size: 0.8rem; font-weight: 700; color: var(--blue);">${log.responseTimeMs || 0} ms</td>
                <td>
                    ${log.rating === 'like' ? '<span style="color:#10B981;"><i class="fas fa-thumbs-up"></i> Útil</span>' :
                      log.rating === 'dislike' ? '<span style="color:#EF4444;"><i class="fas fa-thumbs-down"></i> No útil</span>' :
                      '<span style="color: var(--text-muted);">-</span>'}
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="card" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--navy); margin: 0;">Historial Reciente de Consultas</h3>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">${logs.length} registros cargados</span>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID Sesión</th>
                                <th>Fecha / Hora</th>
                                <th>Consulta Usuario</th>
                                <th>Respuesta Asistente</th>
                                <th>Tiempo</th>
                                <th>Valoración</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML || '<tr><td colspan="6" style="text-align:center;">No hay registros de conversaciones guardados.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Error loading chatbot logs:', e);
    }
}

// -------------------------------------------------------------
// TAB 4: SETTINGS (PARÁMETROS DE IA)
// -------------------------------------------------------------
async function loadSettingsTab() {
    const container = document.getElementById('cbTabSettings');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/chatbot/settings', { headers: getAdminHeaders() });
        const settings = await res.json();

        container.innerHTML = `
            <div class="card" style="padding: 1.5rem; max-width: 800px;">
                <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--navy); margin-top: 0; margin-bottom: 1.25rem;">
                    <i class="fas fa-sliders-h" style="color: var(--cyan);"></i> Parámetros del Modelo Gemini LLM
                </h3>

                <form id="cbSettingsForm">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                        <div>
                            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">Modelo de Lenguaje</label>
                            <select id="cbSettingModel" class="form-control">
                                <option value="gemini-3.6-flash" ${settings.model === 'gemini-3.6-flash' ? 'selected' : ''}>gemini-3.6-flash (Recomendado - Ultra Rápido)</option>
                                <option value="gemini-3.1-pro-preview" ${settings.model === 'gemini-3.1-pro-preview' ? 'selected' : ''}>gemini-3.1-pro-preview (Razonamiento Complejo)</option>
                                <option value="gemini-3.1-flash-lite" ${settings.model === 'gemini-3.1-flash-lite' ? 'selected' : ''}>gemini-3.1-flash-lite (Respuesta Ligera)</option>
                            </select>
                        </div>

                        <div>
                            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">Temperatura (${settings.temperature})</label>
                            <input type="range" id="cbSettingTemp" min="0" max="1" step="0.1" value="${settings.temperature}" class="form-control" oninput="document.getElementById('tempVal').textContent = this.value">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Valor actual: <strong id="tempVal">${settings.temperature}</strong> (Valores bajos = Respuestas más precisas e institucionales)</span>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.25rem;">
                        <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">Instrucción del Sistema (System Prompt)</label>
                        <textarea id="cbSettingPrompt" class="form-control" rows="5" style="font-size: 0.88rem; font-family: monospace;">${escapeHTML(settings.systemPrompt)}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                        <div>
                            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">Tokens Máximos de Salida</label>
                            <input type="number" id="cbSettingMaxTokens" class="form-control" value="${settings.maxTokens || 1024}" min="256" max="2048">
                        </div>

                        <div>
                            <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">Estado del Asistente</label>
                            <select id="cbSettingEnabled" class="form-control">
                                <option value="true" ${settings.enabled ? 'selected' : ''}>🟢 Activo - Disponible en el Portal Público</option>
                                <option value="false" ${!settings.enabled ? 'selected' : ''}>🔴 Inactivo - Desactivado para Mantenimiento</option>
                            </select>
                        </div>
                    </div>

                    <div style="text-align: right; border-top: 1px solid var(--border); padding-top: 1rem;">
                        <button type="submit" class="btn-primary" style="padding: 0.6rem 1.5rem; font-weight: 700;">
                            <i class="fas fa-save"></i> Guardar Configuración
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('cbSettingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const model = document.getElementById('cbSettingModel').value;
            const temperature = parseFloat(document.getElementById('cbSettingTemp').value);
            const systemPrompt = document.getElementById('cbSettingPrompt').value.trim();
            const maxTokens = parseInt(document.getElementById('cbSettingMaxTokens').value, 10);
            const enabled = document.getElementById('cbSettingEnabled').value === 'true';

            try {
                const updateRes = await fetch('/api/admin/chatbot/settings', {
                    method: 'PUT',
                    headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ model, temperature, systemPrompt, maxTokens, enabled })
                });

                if (updateRes.ok) {
                    showToast('¡Configuración del Asistente IA actualizada con éxito!', 'success');
                } else {
                    showToast('Error al guardar configuración', 'error');
                }
            } catch (err) {
                console.error('Error saving chatbot settings:', err);
                showToast('Error de conexión', 'error');
            }
        });
    } catch (e) {
        console.error('Error loading chatbot settings:', e);
    }
}

// -------------------------------------------------------------
// KNOWLEDGE BASE MODAL & ACTIONS
// -------------------------------------------------------------
function openAddKbModal(prefillQuery = '') {
    const modalHTML = `
        <div id="kbModal" style="position: fixed; inset: 0; background: rgba(5,17,31,0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;">
            <div class="card" style="width: 100%; max-width: 600px; padding: 1.5rem; background: var(--surface);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--navy); margin: 0;">Agregar Artículo a la Base de Conocimiento</h3>
                    <button onclick="document.getElementById('kbModal').remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">&times;</button>
                </div>

                <form id="addKbForm">
                    <div style="margin-bottom: 1rem;">
                        <label class="form-label" style="font-weight: 700;">Título / Tema</label>
                        <input type="text" id="kbModalTitle" class="form-control" required value="${escapeHTML(prefillQuery)}">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label class="form-label" style="font-weight: 700;">Categoría</label>
                            <select id="kbModalCategory" class="form-control">
                                <option value="General">General</option>
                                <option value="Denuncias">Denuncias</option>
                                <option value="Probidad">Probidad</option>
                                <option value="Directorio">Directorio</option>
                                <option value="Estadísticas">Estadísticas</option>
                                <option value="Riesgos">Riesgos</option>
                                <option value="Vehículos">Vehículos</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 700;">Enlace Interno (Ruta)</label>
                            <input type="text" id="kbModalLink" class="form-control" value="/" placeholder="/canales-por-la-integridad/">
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem;">
                        <label class="form-label" style="font-weight: 700;">Contenido Explicativo / Respuesta</label>
                        <textarea id="kbModalContent" class="form-control" rows="4" required placeholder="Redacte la explicación oficial que el bot entregará a los usuarios..."></textarea>
                    </div>

                    <div style="margin-bottom: 1.25rem;">
                        <label class="form-label" style="font-weight: 700;">Palabras Clave (Separadas por coma)</label>
                        <input type="text" id="kbModalKeywords" class="form-control" placeholder="denuncia, tramite, pasos, corrupcion" value="${escapeHTML(prefillQuery)}">
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('kbModal').remove()">Cancelar</button>
                        <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar Artículo</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const existing = document.getElementById('kbModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('addKbForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('kbModalTitle').value;
        const category = document.getElementById('kbModalCategory').value;
        const link = document.getElementById('kbModalLink').value;
        const content = document.getElementById('kbModalContent').value;
        const keywords = document.getElementById('kbModalKeywords').value;

        try {
            const saveRes = await fetch('/api/admin/chatbot/knowledge', {
                method: 'POST',
                headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ title, category, link, content, keywords })
            });

            if (saveRes.ok) {
                showToast('Artículo guardado en la Base de Conocimiento', 'success');
                document.getElementById('kbModal').remove();
                await loadKnowledgeTab();
            } else {
                showToast('Error al guardar el artículo', 'error');
            }
        } catch (err) {
            console.error('Error adding knowledge item:', err);
            showToast('Error de red', 'error');
        }
    });
}

async function deleteKbItem(id) {
    if (!confirm('¿Está seguro de eliminar este artículo de la base de conocimiento del chatbot?')) return;
    try {
        const res = await fetch(`/api/admin/chatbot/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getAdminHeaders() });
        if (res.ok) {
            showToast('Artículo eliminado de la base de conocimiento', 'info');
            await loadKnowledgeTab();
        }
    } catch (e) {
        console.error('Error deleting KB item:', e);
    }
}

function filterKnowledge(query) {
    const q = query.toLowerCase();
    const filtered = cachedKnowledge.filter(k =>
        k.title.toLowerCase().includes(q) ||
        k.content.toLowerCase().includes(q) ||
        (k.category || '').toLowerCase().includes(q) ||
        (k.keywords || []).some(kw => kw.toLowerCase().includes(q))
    );
    renderKnowledgeList(filtered);
}

function escapeHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Global scope bindings for inline onclicks
window.PIA_CHATBOT_ADMIN = {
    openAddKbModal,
    addUnansweredToKb: (q) => {
        const tabs = document.querySelectorAll('.cb-tab-btn');
        tabs.forEach(t => {
            if (t.dataset.tab === 'knowledge') t.click();
        });
        openAddKbModal(q);
    },
    deleteKbItem,
    filterKnowledge,
    editKbItem: (id) => {
        const item = cachedKnowledge.find(k => k.id === id);
        if (item) {
            openAddKbModal(item.title);
            // Pre-fill fields
            setTimeout(() => {
                if (document.getElementById('kbModalCategory')) document.getElementById('kbModalCategory').value = item.category || 'General';
                if (document.getElementById('kbModalLink')) document.getElementById('kbModalLink').value = item.link || '/';
                if (document.getElementById('kbModalContent')) document.getElementById('kbModalContent').value = item.content || '';
                if (document.getElementById('kbModalKeywords')) document.getElementById('kbModalKeywords').value = (item.keywords || []).join(', ');
            }, 100);
        }
    }
};
