/* ============================================================
   PIA CHATBOT INTELIGENTE - FRONTEND CLIENT
   ============================================================ */

(function () {
    'use strict';

    // State Variables
    let isOpen = false;
    let isDark = false;
    let sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    let conversationHistory = [];
    let isWaitingResponse = false;

    // DOM Elements
    let triggerBtn, chatWindow, messagesContainer, textareaInput, sendBtn;

    // Initialize Chatbot Widget on DOM Ready
    function initChatbot() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', initChatbot);
            return;
        }
        if (document.getElementById('piaChatbotWindow')) return; // Avoid duplicate

        // Append CSS link
        if (!document.querySelector('link[href*="pia-chatbot.css"]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = '/css/pia-chatbot.css';
            document.head.appendChild(css);
        }

        // Render HTML markup
        renderChatbotHTML();

        // Query DOM elements
        triggerBtn = document.getElementById('piaChatbotTrigger');
        chatWindow = document.getElementById('piaChatbotWindow');
        messagesContainer = document.getElementById('piaCbMessages');
        textareaInput = document.getElementById('piaCbTextarea');
        sendBtn = document.getElementById('piaCbSendBtn');

        // Check stored theme
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            isDark = true;
            chatWindow.classList.add('dark');
        }

        // Load Stored Session History
        loadLocalHistory();

        // Attach Event Listeners
        attachEventListeners();

        // Render Initial Suggestions
        renderSuggestionChips([
            "¿Cómo presento una denuncia anónima?",
            "¿Dónde veo el directorio de ministros?",
            "Verificar placa de vehículo oficial",
            "Estadísticas del Gobierno en Números"
        ]);
    }

    function renderChatbotHTML() {
        const triggerMarkup = `
            <button id="piaChatbotTrigger" class="pia-chatbot-trigger" aria-label="Abrir Asistente Virtual Lupita" title="Lupita - Asistente Virtual IA">
                <div class="pia-chatbot-trigger-icon">
                    <img src="/img/asistenteVirtual2.png" alt="Asistente Virtual Lupita" class="pia-assistant-icon" />
                    <span class="pia-chatbot-pulse"></span>
                </div>
                <div class="pia-chatbot-trigger-text">
                    <span class="pia-chatbot-trigger-title">Lupita</span>
                    <span class="pia-chatbot-trigger-sub">Asistente Virtual IA</span>
                </div>
            </button>
        `;

        const windowMarkup = `
            <div id="piaChatbotWindow" class="pia-chatbot-window" role="dialog" aria-labelledby="piaCbHeaderTitle" aria-hidden="true">
                <!-- Header -->
                <div class="pia-cb-header">
                    <div class="pia-cb-header-brand">
                        <div class="pia-cb-avatar">
                            <img src="/img/asistenteVirtual2.png" alt="Asistente Virtual Lupita" class="pia-assistant-icon" />
                        </div>
                        <div class="pia-cb-title-box">
                            <h2 id="piaCbHeaderTitle" class="pia-cb-title">Lupita · Asistente Virtual</h2>
                            <span class="pia-cb-status">
                                <span class="pia-cb-status-dot"></span> En línea · Transparencia e Integridad
                            </span>
                        </div>
                    </div>
                    <div class="pia-cb-header-actions">
                        <button class="pia-cb-action-btn" id="piaCbThemeBtn" title="Cambiar tema claro/oscuro">
                            <i class="fas fa-moon"></i>
                        </button>
                        <button class="pia-cb-action-btn" id="piaCbExportBtn" title="Descargar conversación (TXT)">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="pia-cb-action-btn" id="piaCbResetBtn" title="Reiniciar conversación">
                            <i class="fas fa-rotate-right"></i>
                        </button>
                        <button class="pia-cb-action-btn" id="piaCbCloseBtn" title="Cerrar chat">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- Suggestions Bar -->
                <div class="pia-cb-suggestions-bar" id="piaCbSuggestions">
                    <!-- Dynamic Suggestion Chips -->
                </div>

                <!-- Messages Body -->
                <div class="pia-cb-messages" id="piaCbMessages" role="log" aria-live="polite">
                    <!-- Welcome Message -->
                    <div class="pia-cb-msg bot">
                        <div class="pia-cb-bubble">
                            👋 ¡Hola! Soy <strong>Lupita</strong>, la asistente virtual oficial del <strong>Portal de Integridad Activa (PIA)</strong> de Guatemala.<br><br>
                            Puedo guiarte para presentar denuncias por corrupción, consultar el directorio de funcionarios públicos, revisar la asignación de vehículos oficiales con Transparencia Vehicular y entender los tableros estadísticos.<br><br>
                            ¿En qué puedo ayudarte hoy?
                        </div>
                        <span class="pia-cb-timestamp">${getCurrentTimeString()}</span>
                    </div>
                </div>

                <!-- Footer Input Area -->
                <div class="pia-cb-footer">
                    <div class="pia-cb-input-wrapper">
                        <textarea id="piaCbTextarea" class="pia-cb-textarea" rows="1" placeholder="Escribe tu consulta aquí..." aria-label="Escribe tu consulta para la asistente virtual Lupita"></textarea>
                        <button id="piaCbSendBtn" class="pia-cb-send-btn" aria-label="Enviar mensaje">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="pia-cb-disclaimer">
                        <i class="fas fa-lock" style="color: #00C2E0; margin-right: 3px;"></i> Información oficial verificada del Gobierno de Guatemala.
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.id = 'piaChatbotWrapper';
        wrapper.innerHTML = triggerMarkup + windowMarkup;
        document.body.appendChild(wrapper);
    }

    function attachEventListeners() {
        triggerBtn.addEventListener('click', toggleChatbot);
        document.getElementById('piaCbCloseBtn').addEventListener('click', closeChatbot);

        document.getElementById('piaCbThemeBtn').addEventListener('click', () => {
            isDark = !isDark;
            chatWindow.classList.toggle('dark', isDark);
            const icon = document.querySelector('#piaCbThemeBtn i');
            if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        });

        document.getElementById('piaCbResetBtn').addEventListener('click', resetConversation);
        document.getElementById('piaCbExportBtn').addEventListener('click', exportConversationTXT);

        sendBtn.addEventListener('click', handleUserSendMessage);

        textareaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleUserSendMessage();
            }
        });

        // Auto height for textarea
        textareaInput.addEventListener('input', () => {
            textareaInput.style.height = 'auto';
            textareaInput.style.height = Math.min(textareaInput.scrollHeight, 80) + 'px';
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeChatbot();
            }
        });
    }

    function toggleChatbot() {
        if (isOpen) closeChatbot();
        else openChatbot();
    }

    function openChatbot() {
        isOpen = true;
        chatWindow.classList.add('open');
        chatWindow.setAttribute('aria-hidden', 'false');
        textareaInput.focus();
    }

    function closeChatbot() {
        isOpen = false;
        chatWindow.classList.remove('open');
        chatWindow.setAttribute('aria-hidden', 'true');
    }

    async function fetchConfig() {
        renderSuggestionChips([
            "¿Cómo presento una denuncia anónima?",
            "¿Dónde veo el directorio de ministros?",
            "Verificar placa de vehículo oficial",
            "Estadísticas del Gobierno en Números"
        ]);
    }

    function renderSuggestionChips(faqs) {
        const chipsContainer = document.getElementById('piaCbSuggestions');
        if (!chipsContainer) return;
        chipsContainer.innerHTML = '';

        faqs.forEach(faq => {
            const chip = document.createElement('button');
            chip.className = 'pia-cb-chip';
            chip.innerHTML = `<i class="fas fa-lightbulb" style="color: #F5A623;"></i> ${escapeHTML(faq)}`;
            chip.addEventListener('click', () => {
                textareaInput.value = faq;
                handleUserSendMessage();
            });
            chipsContainer.appendChild(chip);
        });
    }

    /**
     * Fallback heurístico client-side (espejo del generateFallbackResponse del backend).
     * Se usa cuando /api/chatbot/chat no está disponible (hosting estático, Gemini caído, etc.).
     * No expone claves ni depende de autenticación.
     */
    function generateClientFallbackResponse(query) {
        const q = (query || '').toLowerCase();

        if (q.includes('denunci') || q.includes('soborno') || q.includes('corrupc') || q.includes('anónim') || q.includes('anonim')) {
            return `Para presentar una denuncia por irregularidades o actos de corrupción, accede a la sección **Canales por la Integridad**. Puedes hacerlo de forma 100% confidencial o anónima.\n\n👉 [Ir al formulario de denuncias](/canales-por-la-integridad/)`;
        }
        if (q.includes('directorio') || q.includes('ministr') || q.includes('funcionario') || q.includes('autoridad') || q.includes('probidad')) {
            return `Puedes consultar el directorio de autoridades y encargados de probidad en nuestro módulo oficial.\n\n👉 [Consultar Directorio Ejecutivo](/directorio/)`;
        }
        if (q.includes('vehicul') || q.includes('carro') || q.includes('placa') || q.includes('automóvil') || q.includes('automovil')) {
            return `En **Transparencia Vehicular** puedes buscar cualquier vehículo oficial del Estado por placa para verificar su asignación e informar uso indebido.\n\n👉 [Ingresar a Transparencia Vehicular](/vehiculos/)`;
        }
        if (q.includes('estadist') || q.includes('numero') || q.includes('números') || q.includes('cifra') || q.includes('gobierno en números')) {
            return `En **Tu Gobierno en Números** encontrarás datos actualizados sobre oficinas de probidad, canales de denuncia y denuncias penales planteadas.\n\n👉 [Ver Gobierno en Números](/gobierno_en_numeros/)`;
        }
        if (q.includes('riesgo') || q.includes('gestión de riesgo') || q.includes('gestion de riesgo')) {
            return `En el módulo de **Gestión de Riesgos** puedes consultar información sobre identificación y mitigación de riesgos de integridad.\n\n👉 [Ir a Gestión de Riesgos](/riesgo/)`;
        }
        if (q.includes('hola') || q.includes('buenos') || q.includes('buenas') || q.includes('saludos')) {
            return `¡Hola! Soy **Lupita**, la Asistente Virtual del Portal de Integridad Activa (PIA). Puedo orientarte sobre denuncias, directorio de funcionarios, transparencia vehicular y estadísticas del Gobierno de Guatemala.\n\n¿En qué puedo ayudarte?`;
        }

        return `Gracias por tu consulta al Portal de Integridad Activa (PIA). Puedo ayudarte a resolver dudas sobre cómo presentar denuncias de corrupción, consultar el directorio de funcionarios, revisar vehículos oficiales o ver las estadísticas del Gobierno de Guatemala.\n\n¿Deseas orientación sobre alguna de estas secciones?`;
    }

    function applyFallbackResponse(userText) {
        const fallbackText = generateClientFallbackResponse(userText);
        const messageId = 'local_' + Date.now();
        appendMessage('bot', fallbackText, messageId, null);
        conversationHistory.push({ role: 'model', text: fallbackText });
        saveLocalHistory();
    }

    async function handleUserSendMessage() {
        if (isWaitingResponse) return;
        const text = textareaInput.value.trim();
        if (!text) return;

        // Clear input
        textareaInput.value = '';
        textareaInput.style.height = 'auto';

        // Add User Message to UI & History
        appendMessage('user', text);
        conversationHistory.push({ role: 'user', text });
        saveLocalHistory();

        // Show Typing Indicator
        showTypingIndicator();
        isWaitingResponse = true;

        try {
            const response = await fetch('/api/chatbot/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: conversationHistory,
                    sessionId
                })
            });

            removeTypingIndicator();
            isWaitingResponse = false;

            if (response.ok) {
                const data = await response.json();
                appendMessage('bot', data.text, data.messageId, data.references);
                conversationHistory.push({ role: 'model', text: data.text });
                saveLocalHistory();

                if (data.suggestedFollowUps && data.suggestedFollowUps.length > 0) {
                    renderSuggestionChips(data.suggestedFollowUps);
                }
            } else {
                // API respondió con error (rate-limit, Gemini caído, etc.) → fallback local
                console.warn('API chatbot no disponible o error HTTP, activando fallback client-side');
                applyFallbackResponse(text);
            }
        } catch (err) {
            // Sin servidor (Firebase estático, red caída, etc.) → fallback local
            removeTypingIndicator();
            isWaitingResponse = false;
            console.warn('Error de red o API no alcanzable, activando fallback client-side:', err.message || err);
            applyFallbackResponse(text);
        }
    }

    function appendMessage(sender, text, messageId = null, references = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `pia-cb-msg ${sender}`;

        const formattedText = formatMarkdown(text);
        let html = `<div class="pia-cb-bubble">${formattedText}`;

        if (references && references.length > 0) {
            html += `<div style="margin-top: 10px; border-top: 1px dashed rgba(0,194,224,0.3); padding-top: 6px; font-size: 0.78rem; opacity: 0.9;"><strong>Referencias Oficiales:</strong><br>`;
            references.forEach(ref => {
                html += `<a href="${ref.link}" class="pia-cb-link-btn" style="margin-right: 6px;"><i class="fas fa-external-link-alt"></i> ${escapeHTML(ref.title)}</a>`;
            });
            html += `</div>`;
        }

        html += `</div>`;
        html += `<span class="pia-cb-timestamp">${getCurrentTimeString()}</span>`;

        if (sender === 'bot' && messageId) {
            html += `
                <div class="pia-cb-msg-actions">
                    <button class="pia-cb-msg-btn" onclick="window.PIA_CHATBOT.copyMessageText(this)" title="Copiar respuesta">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                    <button class="pia-cb-msg-btn" onclick="window.PIA_CHATBOT.rateMessage('${messageId}', 'like', this)" title="Útil 👍">
                        <i class="fas fa-thumbs-up"></i>
                    </button>
                    <button class="pia-cb-msg-btn" onclick="window.PIA_CHATBOT.rateMessage('${messageId}', 'dislike', this)" title="No útil 👎">
                        <i class="fas fa-thumbs-down"></i>
                    </button>
                </div>
            `;
        }

        msgDiv.innerHTML = html;
        messagesContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'piaCbTyping';
        typingDiv.className = 'pia-cb-msg bot';
        typingDiv.innerHTML = `
            <div class="pia-cb-typing">
                <span class="pia-cb-dot"></span>
                <span class="pia-cb-dot"></span>
                <span class="pia-cb-dot"></span>
                <span style="font-size: 0.75rem; color: #00C2E0; font-weight: 600; margin-left: 6px;">Lupita está escribiendo...</span>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const typingDiv = document.getElementById('piaCbTyping');
        if (typingDiv) typingDiv.remove();
    }

    function resetConversation() {
        if (confirm('¿Desea reiniciar la conversación y borrar el historial actual?')) {
            conversationHistory = [];
            localStorage.removeItem('pia_chatbot_history');
            messagesContainer.innerHTML = `
                <div class="pia-cb-msg bot">
                    <div class="pia-cb-bubble">
                        🔄 Conversación reiniciada.<br>
                        ¡Hola! Soy <strong>Lupita</strong>, ¿en qué puedo ayudarte sobre el Portal de Integridad Activa?
                    </div>
                    <span class="pia-cb-timestamp">${getCurrentTimeString()}</span>
                </div>
            `;
            renderSuggestionChips([
                "¿Cómo presento una denuncia anónima?",
                "¿Dónde veo el directorio de ministros?",
                "Verificar placa de vehículo oficial",
                "Estadísticas del Gobierno en Números"
            ]);
        }
    }

    function exportConversationTXT() {
        if (conversationHistory.length === 0) {
            alert('No hay mensajes en el historial para exportar.');
            return;
        }

        let content = `====================================================\n`;
        content += `TRANSCRIPCIÓN DE CHAT - ASISTENTE VIRTUAL LUPITA\n`;
        content += `Gobierno de Guatemala - Portal de Integridad Activa\n`;
        content += `Fecha: ${new Date().toLocaleString('es-GT')}\n`;
        content += `ID de Sesión: ${sessionId}\n`;
        content += `====================================================\n\n`;

        conversationHistory.forEach((msg, idx) => {
            const role = msg.role === 'user' ? 'CIUDADANO' : 'ASISTENTE PIA';
            content += `[${role}]:\n${msg.text}\n\n----------------------------------------------------\n`;
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Conversacion_PIA_IA_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function rateMessage(messageId, rating, btnEl) {
        fetch('/api/chatbot/rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId, rating })
        }).catch(err => console.error('Error rating message:', err));

        if (btnEl) {
            const parent = btnEl.parentElement;
            if (parent) {
                parent.querySelectorAll('.pia-cb-msg-btn').forEach(b => {
                    b.classList.remove('active-like', 'active-dislike');
                });
            }
            if (rating === 'like') btnEl.classList.add('active-like');
            if (rating === 'dislike') btnEl.classList.add('active-dislike');
        }
    }

    function copyMessageText(btnEl) {
        const bubble = btnEl.closest('.pia-cb-msg')?.querySelector('.pia-cb-bubble');
        if (bubble) {
            const textToCopy = bubble.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                btnEl.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                setTimeout(() => {
                    btnEl.innerHTML = '<i class="fas fa-copy"></i> Copiar';
                }, 2000);
            });
        }
    }

    function loadLocalHistory() {
        try {
            const stored = localStorage.getItem('pia_chatbot_history');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    conversationHistory = parsed;
                    parsed.forEach(msg => {
                        appendMessage(msg.role === 'user' ? 'user' : 'bot', msg.text);
                    });
                }
            }
        } catch (e) {
            console.error('Error loading chatbot history:', e);
        }
    }

    function saveLocalHistory() {
        try {
            localStorage.setItem('pia_chatbot_history', JSON.stringify(conversationHistory.slice(-20)));
        } catch (e) {
            console.error('Error saving chatbot history:', e);
        }
    }

    function formatMarkdown(text) {
        if (!text) return '';
        let str = escapeHTML(text);

        // Bold **text**
        str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic *text*
        str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Bullet points
        str = str.replace(/^\s*[-•]\s+(.*)$/g, '• $1<br>');
        // Links [Label](url)
        str = str.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_self">$1</a>');
        // New lines
        str = str.replace(/\n/g, '<br>');

        return str;
    }

    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getCurrentTimeString() {
        const d = new Date();
        return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    }

    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Expose global methods for onclick handlers
    window.PIA_CHATBOT = {
        rateMessage,
        copyMessageText,
        toggleChatbot,
        openChatbot,
        closeChatbot
    };

    // Auto init on DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbot);
    } else {
        initChatbot();
    }
})();