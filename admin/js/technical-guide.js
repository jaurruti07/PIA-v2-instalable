// technical-guide.js - Módulo de Guía Técnica para Desarrolladores y Administradores del PIA

export function initTechnicalGuide() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <!-- HEADER DE NAVEGACIÓN TÉCNICA -->
        <div class="page-header" style="margin-bottom: 1.75rem; background: #fff; padding: 1.75rem 2rem; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); box-shadow: 0 4px 20px rgba(5,17,31,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="display: inline-flex; align-items: center; gap: 8px; padding: 0.35rem 0.85rem; background: rgba(0, 194, 224, 0.12); color: var(--blue-bright, #2B82C9); border: 1px solid rgba(0, 194, 224, 0.3); border-radius: 50px; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.75rem;">
                        <i class="fas fa-code"></i> Documentación de Desarrollo & Arquitectura
                    </div>
                    <h1 style="font-family: var(--font-head); font-size: 1.8rem; font-weight: 800; color: var(--navy, #05111F); margin: 0 0 0.4rem 0;">
                        Guía Técnica del Sistema PIA
                    </h1>
                    <p style="color: var(--text-muted, #5E7A8E); font-size: 0.95rem; margin: 0; max-width: 820px; line-height: 1.5;">
                        Manual de arquitectura, stack tecnológico, endpoints de API REST, motores de datos JSON, matriz de seguridad, integración de IA (Lupita) y guía de mantenimiento para administradores y desarrolladores.
                    </p>
                </div>
                
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    <button id="btnGoToServerInstallGuide" class="btn-guide-action" style="padding: 0.65rem 1.1rem; background: var(--cyan, #00C2E0); color: var(--navy, #05111F); border: none; border-radius: 12px; font-weight: 800; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-server"></i> Scripts e Instalación en Servidor
                    </button>
                    <button id="btnPrintGuide" class="btn-guide-action" style="padding: 0.65rem 1.1rem; background: var(--surface, #F0F5FB); color: var(--navy, #05111F); border: 1px solid var(--border); border-radius: 12px; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-print" style="color: var(--blue-bright);"></i> Imprimir / PDF
                    </button>
                    <button id="btnCopySysInfo" class="btn-guide-action" style="padding: 0.65rem 1.1rem; background: var(--navy, #05111F); color: #fff; border: none; border-radius: 12px; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-copy" style="color: var(--cyan);"></i> Copiar Ficha Técnica
                    </button>
                </div>
            </div>

            <!-- BUSCADOR INTERACTIVO & FILTROS DE CATEGORÍA -->
            <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 1rem;">
                <div style="position: relative; width: 100%;">
                    <i class="fas fa-search" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.95rem;"></i>
                    <input type="text" id="guideSearchInput" placeholder="Buscar en la guía técnica (ej. 'mysql', 'deploy-iis', 'web.config', 'Lupita', 'backup', 'hybrid', 'etag')..." style="width: 100%; padding: 0.8rem 1rem 0.8rem 2.75rem; background: var(--surface, #F0F5FB); border: 1px solid var(--border); border-radius: 12px; font-size: 0.92rem; color: var(--text-main); font-family: var(--font-body); transition: all 0.2s;">
                </div>

                <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.25rem; scrollbar-width: thin;" id="guideTabContainer">
                    <button class="guide-tab-btn active" data-category="all"><i class="fas fa-th-large"></i> Todo (Visión General)</button>
                    <button class="guide-tab-btn" data-category="arch"><i class="fas fa-cubes"></i> Arquitectura & Stack</button>
                    <button class="guide-tab-btn" data-category="structure"><i class="fas fa-folder-tree"></i> Estructura de Proyecto</button>
                    <button class="guide-tab-btn" data-category="json"><i class="fas fa-database"></i> Almacenamiento Híbrido JSON + SQL</button>
                    <button class="guide-tab-btn" data-category="api"><i class="fas fa-plug"></i> Catálogo API REST</button>
                    <button class="guide-tab-btn" data-category="security"><i class="fas fa-shield-alt"></i> Seguridad & RBAC</button>
                    <button class="guide-tab-btn" data-category="ai"><i class="fas fa-robot"></i> Asistente Lupita (IA)</button>
                    <button class="guide-tab-btn" data-category="push"><i class="fas fa-bell"></i> Push & Service Worker</button>
                    <button class="guide-tab-btn" data-category="deploy"><i class="fas fa-server"></i> Despliegue & Backups</button>
                </div>
            </div>
        </div>

        <!-- RESUMEN EJECUTIVO Y ESTADO DE COMPONENTES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; margin-bottom: 1.75rem;">
            <div style="background: #fff; padding: 1.25rem 1.5rem; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem;">
                    <i class="fab fa-node-js" style="color: #68a063; margin-right: 4px;"></i> Entorno de Ejecución
                </div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--navy);">Node.js LTS 18-22+ ESM</div>
                <div style="font-size: 0.8rem; color: #22C55E; font-weight: 600; margin-top: 0.25rem;"><i class="fas fa-check-circle"></i> Express 4.19 · Puerto 3000</div>
            </div>

            <div style="background: #fff; padding: 1.25rem 1.5rem; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem;">
                    <i class="fas fa-database" style="color: var(--blue-bright); margin-right: 4px;"></i> Motor de Datos Híbrido
                </div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--navy);">JSON + MySQL/MariaDB</div>
                <div style="font-size: 0.8rem; color: #22C55E; font-weight: 600; margin-top: 0.25rem;"><i class="fas fa-lock"></i> 3 Modalidades · 14 Tablas SQL</div>
            </div>

            <div style="background: #fff; padding: 1.25rem 1.5rem; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem;">
                    <i class="fas fa-brain" style="color: #8b5cf6; margin-right: 4px;"></i> IA Generativa (Lupita)
                </div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--navy);">@google/genai</div>
                <div style="font-size: 0.8rem; color: #22C55E; font-weight: 600; margin-top: 0.25rem;"><i class="fas fa-check-circle"></i> Gemini 2.5 + Fallback Local</div>
            </div>

            <div style="background: #fff; padding: 1.25rem 1.5rem; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem;">
                    <i class="fas fa-shield-alt" style="color: var(--cyan); margin-right: 4px;"></i> Seguridad & Control
                </div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--navy);">PBKDF2 + HMAC-SHA256</div>
                <div style="font-size: 0.8rem; color: #22C55E; font-weight: 600; margin-top: 0.25rem;"><i class="fas fa-shield-check"></i> @cnc.gob.gt · OCC ETag · Audit</div>
            </div>
        </div>

        <!-- SECCIONES DE LA GUÍA TÉCNICA -->
        <div id="guideSectionsWrapper" style="display: flex; flex-direction: column; gap: 1.75rem;">

            <!-- SECCIÓN 1: ARQUITECTURA GENERAL Y STACK TECNOLÓGICO -->
            <section class="guide-section-card" data-category="arch" id="sec-arch" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(0,194,224,0.12); color: var(--cyan); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-cubes"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">1. Arquitectura General y Stack Tecnológico</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Arquitectura desacoplada basada en microservicios livianos, archivos estáticos optimizados y API RESTful</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <h3 style="font-size: 1rem; font-weight: 700; color: var(--navy); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-desktop" style="color: var(--blue-bright);"></i> Capa de Presentación (Frontend)
                        </h3>
                        <ul style="list-style: none; font-size: 0.88rem; color: var(--text-main); display: flex; flex-direction: column; gap: 0.5rem; padding: 0;">
                            <li><strong>• HTML5 Semántico:</strong> Estructura accesible con soporte para lectores de pantalla e i18n.</li>
                            <li><strong>• CSS3 Modular & Variables:</strong> Tema con variables en <code>:root</code>, sistema responsive grid/flexbox y transiciones fluidas de vista (<code>View Transitions API</code>).</li>
                            <li><strong>• JavaScript Vanilla (ES Modules):</strong> Sin frameworks pesados; módulos nativos reutilizables en cliente para máxima velocidad.</li>
                            <li><strong>• Motores Gráficos WebGL2 / Canvas:</strong> Efecto <code>createMoltenMetalEffect</code> para tarjetas 3D en Home y gráficos interactivos con Chart.js/Recharts.</li>
                            <li><strong>• Service Worker & PWA:</strong> Cacheamiento de assets estáticos y registro de notificaciones Web Push activas (<code>data-service-worker.js</code>).</li>
                        </ul>
                    </div>

                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <h3 style="font-size: 1rem; font-weight: 700; color: var(--navy); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-server" style="color: var(--cyan);"></i> Capa Servidora & Persistencia (Backend)
                        </h3>
                        <ul style="list-style: none; font-size: 0.88rem; color: var(--text-main); display: flex; flex-direction: column; gap: 0.5rem; padding: 0;">
                            <li><strong>• Node.js LTS (18-22+) ESM:</strong> Ejecución nativa con <code>import/export</code> y <code>dotenv</code>.</li>
                            <li><strong>• Express.js 4.19:</strong> Ruteo RESTful, interceptores transparentes JSON/SQL y servicio estático seguro.</li>
                            <li><strong>• Capa Híbrida JSON + SQL (<code>db/</code>):</strong> Conmutación sin cambios de código entre <em>Solo JSON</em>, <em>Solo SQL</em> (MySQL 8.0+ / MariaDB 10.6+ con <code>mysql2</code>) e <em>Híbrido</em> por módulo.</li>
                            <li><strong>• SDK Gemini AI (@google/genai):</strong> Proxy backend protegido para el asistente ciudadano Lupita con fallback heurístico offline.</li>
                            <li><strong>• Despliegue On-Premise / Cloud:</strong> Listo para Windows Server (IIS ARR + PM2/NSSM), Linux (Nginx + Systemd) o contenedor en puerto <strong>3000</strong>.</li>
                        </ul>
                    </div>
                </div>

                <div style="background: #05111F; color: #E8EDF5; padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(0,194,224,0.25);">
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--cyan); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-terminal"></i> Comandos de Ejecución, Lint y Pruebas (<code>package.json</code>)
                    </div>
                    <pre style="margin: 0; background: rgba(0,0,0,0.4); padding: 0.85rem 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; color: #38d6f0; overflow-x: auto;">
npm run dev    # Servidor Express en puerto 3000
npm start      # Arranque de producción (node server.js)
npm run lint   # Verificación sintáctica de servidor, DAL híbrida y panel
npm test       # Suite integral de seguridad, permisos, JSON y mappers SQL
                    </pre>
                </div>
            </section>

            <!-- SECCIÓN 2: ESTRUCTURA DE DIRECTORIOS Y ARCHIVOS -->
            <section class="guide-section-card" data-category="structure" id="sec-structure" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(43,130,201,0.12); color: var(--blue-bright); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-folder-tree"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">2. Estructura Completa del Proyecto</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Mapa de archivos, módulos del portal y componentes clave de la aplicación</p>
                    </div>
                </div>

                <div style="background: #0C2033; color: #F0F5FB; padding: 1.5rem; border-radius: 14px; font-family: monospace; font-size: 0.88rem; line-height: 1.6; overflow-x: auto; border: 1px solid rgba(0,194,224,0.2);">
<span style="color: #00C2E0;">/ (Raíz del Proyecto)</span>
├── <span style="color: #22C55E;">server.js</span>                        <span style="color: #94A3B8;"># Servidor Express, API REST, Auth, DAL Híbrida, Gemini AI y Auditoría</span>
├── <span style="color: #22C55E;">package.json</span>                     <span style="color: #94A3B8;"># Dependencias (express, mysql2, dotenv, @google/genai, jose)</span>
├── <span style="color: #22C55E;">.env.example</span>                     <span style="color: #94A3B8;"># Plantilla segura de variables de entorno (Puerto, Sesión, MySQL)</span>
├── <span style="color: #22C55E;">deploy-iis.ps1</span>                   <span style="color: #94A3B8;"># Script PowerShell automatizado de despliegue Windows + IIS + ACLs</span>
├── <span style="color: #22C55E;">web.config</span>                       <span style="color: #94A3B8;"># Configuración IIS (URL Rewrite + ARR, MIME y bloqueo de .env/.sql/data)</span>
├── <span style="color: #22C55E;">test_security_suite.js</span>           <span style="color: #94A3B8;"># Suite automatizada de seguridad, RBAC, JSON y SQL (36 pruebas)</span>
│
├── <span style="color: #38BDF8;">/sql/</span>                            <span style="color: #94A3B8;"># Scripts DDL para base de datos relacional</span>
│   └── <span style="color: #22C55E;">01_schema_mysql.sql</span>          <span style="color: #94A3B8;"># Esquema oficial MySQL/MariaDB de 14 tablas, FKs e índices</span>
│
├── <span style="color: #38BDF8;">/db/</span>                             <span style="color: #94A3B8;"># Capa de Acceso a Datos Híbrida (JSON + SQL)</span>
│   ├── <span style="color: #F97316;">sqlClient.js</span>                 <span style="color: #94A3B8;"># Pool de conexiones MySQL2 parametrizado y manejo de transacciones</span>
│   ├── <span style="color: #F97316;">schemaInit.js</span>                <span style="color: #94A3B8;"># Inicialización idempotente e inspección en INFORMATION_SCHEMA</span>
│   ├── <span style="color: #F97316;">storageConfig.js</span>             <span style="color: #94A3B8;"># Gestor de modalidad (json | sql | hybrid) por módulo</span>
│   ├── <span style="color: #F97316;">sqlRepository.js</span>             <span style="color: #94A3B8;"># CRUD parametrizado, ETag OCC y mappers SQL <-> JSON exactos</span>
│   ├── <span style="color: #F97316;">hybridStorage.js</span>             <span style="color: #94A3B8;"># Enrutador de fuente única por módulo</span>
│   └── <span style="color: #F97316;">migrationService.js</span>          <span style="color: #94A3B8;"># Importación JSON -> SQL y Exportación SQL -> JSON con respaldos</span>
│
├── <span style="color: #38BDF8;">/data/</span>                           <span style="color: #94A3B8;"># Directorio protegido (configurable con PIA_DATA_DIR=C:\PIA_Data)</span>
│   ├── <span style="color: #22C55E;">users_roles.json</span>             <span style="color: #94A3B8;"># Identidades institucionales con hash PBKDF2/SHA-512 y módulos</span>
│   ├── <span style="color: #22C55E;">storage_config.json</span>          <span style="color: #94A3B8;"># Modalidad activa (JSON / SQL / Híbrido) por módulo</span>
│   ├── <span style="color: #22C55E;">audit_logs.json</span>              <span style="color: #94A3B8;"># Bitácora oficial inmutable de auditoría con IP y cambios</span>
│   └── <span style="color: #38BDF8;">/backups/</span>                    <span style="color: #94A3B8;"># Respaldos automáticos rotativos previos a cada mutación/migración</span>
│
├── <span style="color: #38BDF8;">/docs/</span>                           <span style="color: #94A3B8;"># Documentación oficial de instalación y arquitectura</span>
│   ├── <span style="color: #22C55E;">GUIA_INSTALACION_WINDOWS_SQL.md</span>
│   └── <span style="color: #22C55E;">ARQUITECTURA_V2_Y_MIGRACION_SQL.md</span>
│
├── <span style="color: #38BDF8;">/admin/</span>                          <span style="color: #94A3B8;"># Panel Administrativo SPA Autenticado (/admin/)</span>
│   └── <span style="color: #38BDF8;">/js/</span>                         <span style="color: #94A3B8;"># app.js, auth.js, crud.js, user-manager.js, database-manager.js, technical-guide.js</span>
│
└── <span style="color: #38BDF8;">Módulos Públicos</span>                 <span style="color: #94A3B8;"># /canales-por-la-integridad/, /directorio/, /gobierno_en_numeros/, /riesgo/, /vehiculos/</span>
                </div>
            </section>

            <!-- SECCIÓN 3: MOTORES DE DATOS JSON -->
            <section class="guide-section-card" data-category="json" id="sec-json" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(34,197,94,0.12); color: #22C55E; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-database"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">3. Arquitectura Híbrida de Datos (JSON + MySQL/MariaDB)</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Convivencia de los 5 archivos JSON institucionales + métricas con 14 tablas relacionales SQL</p>
                    </div>
                </div>

                <p style="font-size: 0.92rem; color: var(--text-main); margin-bottom: 1.25rem;">
                    El sistema opera por defecto con escrituras atómicas sobre archivos <strong>JSON</strong> (sin requerir motor SQL instalado) y permite activar por módulo la persistencia en <strong>MySQL 8.0+ / MariaDB 10.6+</strong> desde <em>Almacenamiento y BD</em> con una única fuente autoritativa por módulo.
                </p>

                <div style="overflow-x: auto; margin-bottom: 1.5rem;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">
                        <thead>
                            <tr style="background: var(--navy); color: #fff; font-family: var(--font-head);">
                                <th style="padding: 0.85rem 1rem; border-radius: 8px 0 0 0;">Módulo en Panel</th>
                                <th style="padding: 0.85rem 1rem;">Archivo JSON Oficial</th>
                                <th style="padding: 0.85rem 1rem;">Tabla(s) SQL Relacional(es)</th>
                                <th style="padding: 0.85rem 1rem; border-radius: 0 8px 0 0;">Seguridad / Concurrencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--navy);"><i class="fas fa-comments" style="color: var(--cyan);"></i> Canales x Integridad</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace; color: var(--blue-bright);">/canales-por-la-integridad/data_directorio.json</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace;"><code>pia_canales_integridad</code></td>
                                <td style="padding: 0.85rem 1rem;"><span class="badge-audit" style="background: rgba(34,197,94,0.12); color: #22C55E; padding: 2px 8px; border-radius: 6px; font-weight: 700;">ETag OCC + Audit Log</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--border); background: var(--surface);">
                                <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--navy);"><i class="fas fa-address-book" style="color: var(--blue-bright);"></i> Directorio Ejecutivo</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace; color: var(--blue-bright);">/directorio/data_acceso.json</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace;"><code>pia_directorio_acceso</code>, <code>pia_directorio_enlaces</code></td>
                                <td style="padding: 0.85rem 1rem;"><span class="badge-audit" style="background: rgba(34,197,94,0.12); color: #22C55E; padding: 2px 8px; border-radius: 6px; font-weight: 700;">FK CASCADE + ETag</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--navy);"><i class="fas fa-chart-bar" style="color: #22C55E;"></i> Gobierno en Números</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace; color: var(--blue-bright);">/gobierno_en_numeros/data_tableros.json</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace;"><code>pia_tableros_gobierno</code></td>
                                <td style="padding: 0.85rem 1rem;"><span class="badge-audit" style="background: rgba(34,197,94,0.12); color: #22C55E; padding: 2px 8px; border-radius: 6px; font-weight: 700;">ETag OCC + Audit Log</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--border); background: var(--surface);">
                                <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--navy);"><i class="fas fa-bullseye" style="color: var(--orange);"></i> Riesgo en la Mira</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace; color: var(--blue-bright);">/riesgo/datos.json</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace;"><code>pia_riesgo_ciclos</code>, <code>pia_riesgo_instituciones</code>, <code>pia_riesgo_frecuentes</code></td>
                                <td style="padding: 0.85rem 1rem;"><span class="badge-audit" style="background: rgba(34,197,94,0.12); color: #22C55E; padding: 2px 8px; border-radius: 6px; font-weight: 700;">Transacción ACID</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--navy);"><i class="fas fa-car" style="color: var(--cyan);"></i> Transparencia Vehicular</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace; color: var(--blue-bright);">/vehiculos/vehiculos.json</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace;"><code>pia_vehiculos*</code> (5 tablas relacionales)</td>
                                <td style="padding: 0.85rem 1rem;"><span class="badge-audit" style="background: rgba(34,197,94,0.12); color: #22C55E; padding: 2px 8px; border-radius: 6px; font-weight: 700;">Transacción ACID</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--border); background: var(--surface);">
                                <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--navy);"><i class="fas fa-globe" style="color: #8b5cf6;"></i> Portal & Usuarios</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace; color: var(--blue-bright);">/data_portal.json · /data/users_roles.json</td>
                                <td style="padding: 0.85rem 1rem; font-family: monospace;"><code>pia_portal_metricas</code>, <code>pia_storage_migrations</code></td>
                                <td style="padding: 0.85rem 1rem;"><span class="badge-audit" style="background: rgba(239,68,68,0.12); color: var(--red); padding: 2px 8px; border-radius: 6px; font-weight: 700;">Fuera de wwwroot</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- SECCIÓN 4: CATÁLOGO API REST -->
            <section class="guide-section-card" data-category="api" id="sec-api" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(0,194,224,0.12); color: var(--cyan); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-plug"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">4. Catálogo de Endpoints de la API REST</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Rutas del servidor HTTP Express para autenticación, CRUD de módulos y servicios avanzadas</p>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                    <!-- Endpoint 1 -->
                    <div style="background: var(--surface); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #22C55E; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-family: monospace;">POST</span>
                            <code style="font-size: 0.95rem; font-weight: 700; color: var(--navy);">/api/auth/login</code>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Autentica cuentas <code>@cnc.gob.gt</code> contra <code>users_roles.json</code> y emite token HMAC-SHA256.</div>
                        <span style="font-size: 0.75rem; background: rgba(0,194,224,0.15); color: var(--blue-bright); padding: 3px 8px; border-radius: 6px; font-weight: 600;">Público</span>
                    </div>

                    <!-- Endpoint 2 -->
                    <div style="background: var(--surface); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: var(--blue-bright); color: #fff; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-family: monospace;">GET</span>
                            <code style="font-size: 0.95rem; font-weight: 700; color: var(--navy);">/api/:module</code>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Lee registros desde la fuente activa (JSON o MySQL) con encabezado <code>ETag</code>.</div>
                        <span style="font-size: 0.75rem; background: rgba(0,194,224,0.15); color: var(--blue-bright); padding: 3px 8px; border-radius: 6px; font-weight: 600;">Público</span>
                    </div>

                    <!-- Endpoint 3 -->
                    <div style="background: var(--surface); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #22C55E; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-family: monospace;">POST / PUT / DELETE</span>
                            <code style="font-size: 0.95rem; font-weight: 700; color: var(--navy);">/api/:module(/:id)</code>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Operaciones CRUD con concurrencia optimista <code>If-Match</code>, respaldo previo y auditoría.</div>
                        <span style="font-size: 0.75rem; background: rgba(239,68,68,0.15); color: var(--red); padding: 3px 8px; border-radius: 6px; font-weight: 700;">Bearer Auth + Permiso</span>
                    </div>

                    <!-- Endpoint 4 -->
                    <div style="background: var(--surface); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #0ea5e9; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-family: monospace;">GET / POST / PUT</span>
                            <code style="font-size: 0.95rem; font-weight: 700; color: var(--navy);">/api/admin/storage/*</code>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Estado SQL, inicialización de tablas, cambio de modalidad (JSON/SQL/Híbrido), migración JSON↔SQL y guías/scripts.</div>
                        <span style="font-size: 0.75rem; background: rgba(239,68,68,0.15); color: var(--red); padding: 3px 8px; border-radius: 6px; font-weight: 700;">Permiso database</span>
                    </div>

                    <!-- Endpoint 5 -->
                    <div style="background: var(--surface); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #8b5cf6; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-family: monospace;">POST</span>
                            <code style="font-size: 0.95rem; font-weight: 700; color: var(--navy);">/api/chatbot/ask</code>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Procesa consultas ciudadanas usando Gemini AI + base RAG con fallback heurístico local.</div>
                        <span style="font-size: 0.75rem; background: rgba(0,194,224,0.15); color: var(--blue-bright); padding: 3px 8px; border-radius: 6px; font-weight: 600;">Público (Rate Limited)</span>
                    </div>

                    <!-- Endpoint 6 -->
                    <div style="background: var(--surface); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: var(--blue-bright); color: #fff; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-family: monospace;">GET / POST / DELETE</span>
                            <code style="font-size: 0.95rem; font-weight: 700; color: var(--navy);">/api/admin/users · /api/audit</code>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Gestión dinámica de usuarios institucionales y consulta de bitácora de auditoría.</div>
                        <span style="font-size: 0.75rem; background: rgba(239,68,68,0.15); color: var(--red); padding: 3px 8px; border-radius: 6px; font-weight: 700;">Admin / Operador</span>
                    </div>
                </div>
            </section>

            <!-- SECCIÓN 5: SEGURIDAD, AUTENTICACIÓN Y ROLES -->
            <section class="guide-section-card" data-category="security" id="sec-security" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(0,194,224,0.12); color: var(--cyan); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">5. Seguridad Institucional, RBAC y Protección SQL</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Cuentas institucionales @cnc.gob.gt, PBKDF2/SHA-512, tokens HMAC-SHA256, OCC ETag y aislamiento de credenciales</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <div style="font-weight: 700; color: var(--navy); margin-bottom: 0.5rem;"><i class="fas fa-key" style="color: #2B82C9;"></i> Contraseñas Cifradas y Sesiones HMAC</div>
                        <p style="font-size: 0.88rem; color: var(--text-main); margin: 0; line-height: 1.5;">
                            Las contraseñas se almacenan fuera de <code>wwwroot</code> (<code>data/users_roles.json</code>) con sal aleatoria + <code>PBKDF2-HMAC-SHA512</code> y expiración por inactividad de 30 minutos. Solo se admiten correos institucionales <code>@cnc.gob.gt</code>.
                        </p>
                    </div>

                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <div style="font-weight: 700; color: var(--navy); margin-bottom: 0.5rem;"><i class="fas fa-exchange-alt" style="color: #22C55E;"></i> Concurrencia Optimista (ETag) & SQL</div>
                        <p style="font-size: 0.88rem; color: var(--text-main); margin: 0; line-height: 1.5;">
                            Tanto en JSON como en SQL, cada lectura entrega un <code>ETag</code> SHA-256. Si otro operador modifica datos previamente, el backend devuelve <code>409 Conflict</code> evitando sobrescrituras accidentales. Todas las consultas SQL usan parámetros preparados (<code>?</code>).
                        </p>
                    </div>

                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <div style="font-weight: 700; color: var(--navy); margin-bottom: 0.5rem;"><i class="fas fa-fingerprint" style="color: #F59E0B;"></i> Credenciales & Bitácora Inmutable</div>
                        <p style="font-size: 0.88rem; color: var(--text-main); margin: 0; line-height: 1.5;">
                            Las credenciales SQL (<code>MYSQL_*</code>) y llaves de sesión residen exclusivamente en variables de entorno (<code>.env</code>) del servidor; nunca se envían al frontend. Toda acción mutativa queda registrada en <code>audit_logs.json</code>.
                        </p>
                    </div>
                </div>
            </section>

            <!-- SECCIÓN 6: ASISTENTE VIRTUAL LUPITA (GEMINI AI) -->
            <section class="guide-section-card" data-category="ai" id="sec-ai" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(139,92,246,0.12); color: #8b5cf6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">6. Asistente Virtual Inteligente (Lupita - Gemini AI)</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Integración de Inteligencia Artificial Generativa con RAG y entrenamiento en tiempo real</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 1.25rem;">
                    <div>
                        <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6; margin-bottom: 1rem;">
                            Lupita es el asistente ciudadano impulsado por la librería oficial <code>@google/genai</code>. Combina el modelo **Gemini 2.5 Flash** con fragmentos de contexto extraídos de <code>chatbot_knowledge.json</code> para responder inquietudes sobre denuncias, directorio de autoridades, vehículos oficiales e indicadores presupuestarios.
                        </p>

                        <div style="background: var(--surface); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                            <div style="font-weight: 700; color: var(--navy); font-size: 0.88rem; margin-bottom: 0.4rem;">
                                <i class="fas fa-sliders-h" style="color: #8b5cf6;"></i> Configuración del Modelo
                            </div>
                            <ul style="font-size: 0.85rem; color: var(--text-muted); padding-left: 1.2rem; margin: 0; display: flex; flex-direction: column; gap: 0.3rem;">
                                <li>Modelo por defecto: <code>gemini-2.5-flash</code></li>
                                <li>API Key server-side: <code>process.env.GEMINI_API_KEY</code></li>
                                <li>Manejo de reintentos y respuestas fallback ante imprevistos de red.</li>
                            </ul>
                        </div>
                    </div>

                    <div style="background: #05111F; color: #E8EDF5; padding: 1.25rem; border-radius: 14px; font-size: 0.85rem;">
                        <div style="color: var(--cyan); font-weight: 700; margin-bottom: 0.5rem;"><i class="fas fa-code"></i> Fragmento del Handler Express (<code>server.js</code>)</div>
                        <pre style="margin: 0; background: rgba(0,0,0,0.4); padding: 0.85rem; border-radius: 8px; font-family: monospace; color: #a5b4fc; overflow-x: auto;">
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

app.post('/api/chatbot/ask', async (req, res) => {
    const { question } = req.body;
    const knowledge = readJsonFile('chatbot_knowledge.json');
    const prompt = buildRAGPrompt(question, knowledge);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    res.json({ answer: response.text });
});
                        </pre>
                    </div>
                </div>
            </section>

            <!-- SECCIÓN 7: NOTIFICACIONES PUSH Y SERVICE WORKER -->
            <section class="guide-section-card" data-category="push" id="sec-push" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(249,115,22,0.12); color: var(--orange); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">7. Sistema de Notificaciones Push y Service Worker</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Canal directo de difusión institucional en navegadores y dispositivos móviles</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <div style="font-weight: 700; color: var(--navy); margin-bottom: 0.4rem;"><i class="fas fa-id-card" style="color: var(--orange);"></i> Claves VAPID & Subscripciones</div>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">
                            Las alertas push operan mediante el protocolo Web Push con par de claves VAPID públicas/privadas. El navegador registra la suscripción en el Service Worker <code>data-service-worker.js</code>.
                        </p>
                    </div>

                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <div style="font-weight: 700; color: var(--navy); margin-bottom: 0.4rem;"><i class="fas fa-bullhorn" style="color: var(--blue-bright);"></i> Difusión Masiva (Broadcast)</div>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">
                            Los administradores pueden emitir alertas institucionales a todos los ciudadanos suscritos directamente desde el botón **"Enviar Push Notificación"** disponible en los módulos principales del panel.
                        </p>
                    </div>
                </div>
            </section>

            <!-- SECCIÓN 8: DESPLIEGUE, MANTENIMIENTO Y RESPALDOS -->
            <section class="guide-section-card" data-category="deploy" id="sec-deploy" style="background: #fff; border-radius: var(--radius-lg, 20px); border: 1px solid var(--border); padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem; border-bottom: 2px solid var(--surface); padding-bottom: 1rem;">
                    <div style="width: 42px; height: 42px; background: rgba(5,17,31,0.12); color: var(--navy); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800;">
                        <i class="fas fa-server"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-head); font-size: 1.35rem; font-weight: 800; color: var(--navy); margin: 0;">8. Despliegue en Servidor, Instalación SQL y Respaldos</h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Procedimiento para Windows Server (IIS + ARR + PM2/NSSM) o Linux (Nginx + Systemd) y recuperación ante desastres</p>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <h3 style="font-size: 1rem; font-weight: 700; color: var(--navy); margin-bottom: 0.5rem;"><i class="fas fa-server" style="color: var(--cyan);"></i> Paquete de Instalación en Servidor (Scripts Disponibles)</h3>
                        <ul style="font-size: 0.88rem; color: var(--text-main); padding-left: 1.2rem; margin: 0 0 0.85rem; display: flex; flex-direction: column; gap: 0.35rem;">
                            <li><strong><code>deploy-iis.ps1</code>:</strong> Script PowerShell para Windows Server que crea <code>C:\PIA_Data\backups</code> con ACLs NTFS estrictas, instala dependencias y crea el Application Pool <code>PiaAppPool</code>.</li>
                            <li><strong><code>web.config</code>:</strong> Reglas IIS (URL Rewrite + ARR) que enrutan <code>/api/*</code>, <code>/admin/*</code> y los JSON híbridos hacia <code>127.0.0.1:3000</code>, bloqueando acceso HTTP a <code>.env</code>, <code>.sql</code>, <code>.bak</code> y <code>data/</code>.</li>
                            <li><strong><code>sql/01_schema_mysql.sql</code>:</strong> Script DDL idempotente con las 14 tablas relacionales para MySQL 8.0+ / MariaDB 10.6+.</li>
                            <li><strong><code>.env.example</code>:</strong> Plantilla de variables para puerto, <code>PIA_SESSION_SECRET</code>, <code>PIA_DATA_DIR</code>, <code>PIA_STORAGE_MODE</code> y credenciales SQL.</li>
                        </ul>
                        <button type="button" id="btnJumpToInstallGuideCard" style="padding: 0.6rem 1.05rem; background: var(--navy); color: #fff; border-radius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-external-link-alt" style="color: var(--cyan);"></i> Ver Scripts Completos y Paso a Paso en Almacenamiento y BD
                        </button>
                    </div>

                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <h3 style="font-size: 1rem; font-weight: 700; color: var(--navy); margin-bottom: 0.5rem;"><i class="fas fa-download" style="color: var(--blue-bright);"></i> Copias de Seguridad (JSON + SQL)</h3>
                        <ol style="font-size: 0.88rem; color: var(--text-main); padding-left: 1.2rem; margin: 0; display: flex; flex-direction: column; gap: 0.4rem;">
                            <li><strong>JSON Automático:</strong> Cada modificación o migración genera snapshot en <code>PIA_DATA_DIR/backups/</code>.</li>
                            <li><strong>Exportación SQL → JSON:</strong> Desde <em>Almacenamiento y BD</em>, utilice <strong>Exportar SQL → JSON</strong> para descargar copias íntegras en formato JSON estándar.</li>
                            <li><strong>Respaldo SQL Programado:</strong> Ejecute <code>mysqldump --single-transaction --routines --triggers pia_db &gt; respaldo.sql</code> mediante Programador de Tareas o cron.</li>
                        </ol>
                    </div>

                    <div style="background: var(--surface); padding: 1.25rem; border-radius: 14px; border: 1px solid var(--border);">
                        <h3 style="font-size: 1rem; font-weight: 700; color: var(--navy); margin-bottom: 0.5rem;"><i class="fas fa-upload" style="color: #22C55E;"></i> Restauración y Verificación Post-Despliegue</h3>
                        <ol style="font-size: 0.88rem; color: var(--text-main); padding-left: 1.2rem; margin: 0; display: flex; flex-direction: column; gap: 0.4rem;">
                            <li>Para restaurar SQL ejecute <code>mysql -u pia_app_user -p pia_db &lt; respaldo.sql</code> o importe desde los archivos JSON en <em>Almacenamiento y BD</em>.</li>
                            <li>Para restaurar un módulo JSON utilice el <strong>Editor Directo JSON</strong> (validado por esquema) o los snapshots en <code>backups/</code>.</li>
                            <li>Valide la instalación ejecutando <code>npm test</code> y confirmando HTTP <code>200 OK</code> en <code>/api/modules</code> y <code>/admin/</code>.</li>
                        </ol>
                    </div>
                </div>
            </section>
        </div>
    `;

    // AGREGAR ESTILOS DINÁMICOS PARA LAS PESTAÑAS Y SECCIONES
    if (!document.getElementById('tech-guide-styles')) {
        const style = document.createElement('style');
        style.id = 'tech-guide-styles';
        style.textContent = `
            .guide-tab-btn {
                padding: 0.5rem 1rem;
                background: var(--surface, #F0F5FB);
                color: var(--text-muted, #5E7A8E);
                border: 1px solid var(--border);
                border-radius: 30px;
                font-weight: 700;
                font-size: 0.82rem;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .guide-tab-btn:hover {
                background: rgba(0, 194, 224, 0.1);
                color: var(--blue-bright, #2B82C9);
                border-color: rgba(0, 194, 224, 0.3);
            }
            .guide-tab-btn.active {
                background: var(--navy, #05111F);
                color: var(--cyan, #00C2E0);
                border-color: var(--navy, #05111F);
                box-shadow: 0 4px 12px rgba(5,17,31,0.15);
            }
            .btn-guide-action:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            @media print {
                .sidebar, .top-header, .page-header button, #guideSearchInput, #guideTabContainer {
                    display: none !important;
                }
                .guide-section-card {
                    break-inside: avoid;
                    box-shadow: none !important;
                    border: 1px solid #ccc !important;
                    margin-bottom: 2rem !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // LISTENER DE PESTAÑAS DE CATEGORÍA
    const tabs = document.querySelectorAll('.guide-tab-btn');
    const cards = document.querySelectorAll('.guide-section-card');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const cat = tab.dataset.category;
            cards.forEach(card => {
                if (cat === 'all' || card.dataset.category === cat) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // BUSCADOR EN TIEMPO REAL DENTRO DE LA GUÍA TÉCNICA
    const searchInput = document.getElementById('guideSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            // Si hay búsqueda, seleccionar la pestaña "Todo"
            if (query.length > 0) {
                tabs.forEach(t => t.classList.remove('active'));
                const allTab = document.querySelector('.guide-tab-btn[data-category="all"]');
                if (allTab) allTab.classList.add('active');
            }

            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (text.includes(query)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // BOTÓN IMPRIMIR / PDF
    const btnPrint = document.getElementById('btnPrintGuide');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }

    // BOTÓN SALTO DIRECTO A GUÍA Y SCRIPTS DE SERVIDOR EN ALMACENAMIENTO Y BD
    const jumpToServerInstall = () => {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('database', { tab: 'installguide' });
        }
    };
    document.getElementById('btnGoToServerInstallGuide')?.addEventListener('click', jumpToServerInstall);
    document.getElementById('btnJumpToInstallGuideCard')?.addEventListener('click', jumpToServerInstall);

    // BOTÓN COPIAR FICHA TÉCNICA
    const btnCopy = document.getElementById('btnCopySysInfo');
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            const summaryText = `
PORTAL DE INTEGRIDAD ACTIVA (PIA) — FICHA TÉCNICA
==================================================
Stack Tecnológico: Node.js LTS ESM, Express 4.19, mysql2, dotenv, @google/genai
Frontend: Vanilla JS ES Modules, HTML5, CSS3 Custom Properties, WebGL2
Servidor HTTP: Node.js Express en puerto 3000 detrás de IIS (ARR + web.config) o Nginx
Almacenamiento: Arquitectura Híbrida JSON + MySQL/MariaDB (3 modalidades: json, sql, hybrid)
Seguridad: PBKDF2/SHA-512, HMAC-SHA256, OCC ETag, Bitácora Audit Log, @cnc.gob.gt
IA Generativa: Asistente Virtual Lupita (Gemini + Fallback Heurístico)
Instalación Servidor: deploy-iis.ps1, web.config, sql/01_schema_mysql.sql, .env.example
            `.trim();

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(summaryText).then(() => {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Ficha técnica copiada al portapapeles', 'success');
                    }
                }).catch(() => {
                    if (typeof window.showToast === 'function') {
                        window.showToast('No fue posible copiar automáticamente la ficha técnica.', 'error');
                    }
                });
            }
        });
    }
}
