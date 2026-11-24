-- ============================================================================
-- Portal de Integridad Activa (PIA) - Comisión Nacional contra la Corrupción
-- Script Idempotente de Configuración Inicial (MySQL 8.0+ / MariaDB 10.6+)
-- Ejecutar después de sql/01_schema_mysql.sql (usa INSERT IGNORE).
-- ============================================================================

USE `pia_db`;

-- ----------------------------------------------------------------------------
-- 1. Métricas base del Portal Principal (pia_portal_metricas)
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `pia_portal_metricas`
  (`id`, `oficinas_probidad`, `canales_denuncia`, `denuncias_penales`, `plataformas_activas`, `metricas_json`)
VALUES
  (
    1,
    65,
    200,
    446,
    9,
    '[{"id":1,"clave":"oficinasProbidad","valor":65,"sufijo":"+","titulo":"Instancias de Asuntos de Probidad","descripcion":"Instituciones especializadas con Oficinas de Asuntos de Probidad","icono":"fas fa-building","activo":true,"orden":1},{"id":2,"clave":"canalesDenuncia","valor":200,"sufijo":"+","titulo":"Canales de denuncia","descripcion":"Correos, teléfonos, formularios","icono":"fas fa-envelope-open-text","activo":true,"orden":2},{"id":3,"clave":"denunciasPenales","valor":446,"sufijo":"+","titulo":"Denuncias penales","descripcion":"En proceso y resueltas","icono":"fas fa-gavel","activo":true,"orden":3},{"id":4,"clave":"plataformasActivas","valor":9,"sufijo":"","titulo":"Plataformas activas","descripcion":"Integradas para la transparencia","icono":"fas fa-layer-group","activo":true,"orden":4}]'
  );

-- ----------------------------------------------------------------------------
-- 2. Configuración inicial de visibilidad de Canales por la Integridad
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `pia_canales_config`
  (`id`, `show_protocolos`, `show_dashboard_cnc`, `updated_by`)
VALUES
  (1, 0, 0, 'sistema');

-- ----------------------------------------------------------------------------
-- 3. Imagen de sección "¿Por qué existe?" en Portal PIA
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `pia_modules_ui_section_images`
  (`module_key`, `section_key`, `image_url`, `updated_by`)
VALUES
  ('portal', 'porqueExiste', '/img/wallpaperdirectorio.jpg', 'sistema');

-- ----------------------------------------------------------------------------
-- 4. Fondos Hero iniciales por módulo (pia_modules_ui_backgrounds)
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `pia_modules_ui_backgrounds` (`module_key`, `bg_id`, `url`, `titulo`, `activo`, `orden`) VALUES
  ('portal', 1, '/img/wallpaper_directorio_acceso_ejecutivo.png', 'Acceso Ejecutivo', 1, 1),
  ('portal', 2, '/img/gobiernoNumerosWall.jpg', 'Gobierno en Números', 1, 2),
  ('portal', 3, '/img/wallpaperportal2.png', 'Portal Integridad 2', 1, 3),
  ('portal', 4, '/img/wallpaperportal3.jpg', 'Portal Integridad 3', 1, 4),
  ('portal', 5, '/img/numeros.png', 'Datos y Cifras', 1, 5),

  ('canales', 1, '/img/canalesfondobanner.png', 'Canales Banner Principal', 1, 1),
  ('canales', 2, '/img/wallpapercanales1.jpg', 'Canales Fondo 1', 1, 2),
  ('canales', 3, '/img/wallpapercanales4.jpg', 'Canales Fondo 4', 1, 3),
  ('canales', 4, '/img/wallpapercanales5.jpg', 'Canales Fondo 5', 1, 4),
  ('canales', 5, '/img/L2.png', 'Canales Institucional', 1, 5),

  ('directorio', 1, '/img/directoriov2.2.png', 'Directorio Principal', 1, 1),
  ('directorio', 2, '/img/wallpaperdirectorio.jpg', 'Directorio Fondo 2', 1, 2),
  ('directorio', 3, '/img/wallpaper_directorio_acceso_ejecutivo.png', 'Acceso Ejecutivo', 1, 3),
  ('directorio', 4, '/img/wallpaperportal3.jpg', 'Portal 3', 1, 4),
  ('directorio', 5, '/img/logodirectorio2.png', 'Directorio Institucional', 1, 5),

  ('tableros', 1, '/img/gobiernoNumerosWall2.jpg', 'Gobierno en Números 2', 1, 1),
  ('tableros', 2, '/img/gobiernoNumerosWall.jpg', 'Gobierno en Números 1', 1, 2),
  ('tableros', 3, '/img/gobiernoNumerosWall3.jpg', 'Gobierno en Números 3', 1, 3),
  ('tableros', 4, '/img/numeros.png', 'Indicadores y Cifras', 1, 4),

  ('riesgo', 1, '/img/gestion-de-riesgo.png', 'Gestión de Riesgo Principal', 1, 1),
  ('riesgo', 2, '/img/riesgo.png', 'Riesgo en la Mira 1', 1, 2),
  ('riesgo', 3, '/img/riesgo2.png', 'Riesgo en la Mira 2', 1, 3),
  ('riesgo', 4, '/img/riesgo3.jpg', 'Riesgo en la Mira 3', 1, 4),

  ('vehiculos', 1, '/img/vehiculosOficiales.png', 'Vehículos Oficiales', 1, 1),
  ('vehiculos', 2, '/img/vehiculo1.jpg', 'Vehículos Fondo 1', 1, 2),
  ('vehiculos', 3, '/img/vehiculos2.jpg', 'Vehículos Fondo 2', 1, 3),
  ('vehiculos', 4, '/img/vehiculos3.jpg', 'Vehículos Fondo 3', 1, 4),
  ('vehiculos', 5, '/img/vehiculos4.png', 'Vehículos Fondo 4', 1, 5);

-- ----------------------------------------------------------------------------
-- 5. KPIs iniciales configurables por módulo (pia_modules_ui_kpis)
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `pia_modules_ui_kpis`
  (`module_key`, `kpi_id`, `clave`, `modo_valor`, `auto_key`, `valor`, `sufijo`, `titulo`, `descripcion`, `icono`, `requires_config_flag`, `activo`, `orden`)
VALUES
  ('canales', 1, 'totalCanales', 'auto', 'totalCanales', '0', '', 'Canales disponibles', 'Total de canales habilitados por las instituciones del Organismo Ejecutivo para recepcionar denuncias administrativas.', 'fas fa-phone-alt', NULL, 1, 1),
  ('canales', 2, 'totalInstituciones', 'auto', 'totalInstituciones', '0', '', 'Instituciones', 'Cantidad total de dependencias e instituciones del Organismo Ejecutivo registradas en este directorio.', 'fas fa-building', NULL, 1, 2),
  ('canales', 3, 'totalProtocolos', 'auto', 'totalProtocolos', '0', '', 'Instituciones con protocolo de actuación', 'Instituciones del Organismo Ejecutivo que cuentan con un protocolo interno formalizado para tramitar denuncias administrativas.', 'fas fa-file-contract', 'showProtocolos', 1, 3),
  ('canales', 4, 'accesoContinuo', 'manual', NULL, '24/7', '', 'Acceso continuo', 'Portal disponible en línea las 24 horas del día, los 7 días de la semana, para consultar los medios oficiales de denuncia.', 'fas fa-clock', NULL, 1, 4),
  ('canales', 5, 'segura', 'manual', NULL, '100', '%', 'Segura', 'Consulta pública sin registro previo y acceso directo a los canales oficiales de cada entidad bajo resguardo confidencial.', 'fas fa-shield-alt', NULL, 1, 5),
  ('canales', 6, 'actualizada', 'manual', NULL, '100', '%', 'Actualizada', 'Directorio en revisión continua conforme las instituciones reportan cambios en sus puntos y medios de atención.', 'fas fa-sync-alt', NULL, 1, 6),
  ('canales', 7, 'validada', 'manual', NULL, 'Validada', '', 'Datos validados por CNC', 'Información verificada por la Comisión Nacional contra la Corrupción en coordinación con las Instancias de Asuntos de Probidad.', 'fas fa-user-secret', NULL, 1, 7),

  ('directorio', 1, 'totalInstituciones', 'auto', 'totalInstituciones', '0', '', 'Instituciones registradas', 'Dependencias del Organismo Ejecutivo incluidas en el directorio', 'fas fa-building', NULL, 1, 1),
  ('directorio', 2, 'totalCorreo', 'auto', 'totalCorreo', '0', '', 'Con correo electrónico', 'Unidades con dirección electrónica oficial de contacto', 'fas fa-envelope', NULL, 1, 2),
  ('directorio', 3, 'totalTelefono', 'auto', 'totalTelefono', '0', '', 'Con teléfono', 'Instituciones con línea telefónica de atención ciudadana', 'fas fa-phone-alt', NULL, 1, 3),
  ('directorio', 4, 'totalSolicitud', 'auto', 'totalSolicitud', '0', '', 'Con solicitud en línea', 'Cuentan con portal o formulario digital de acceso', 'fas fa-globe', NULL, 1, 4),
  ('directorio', 5, 'totalOficio', 'auto', 'totalOficio', '0', '', 'Con información de oficio', 'Disponen de enlace directo a su sección de información pública', 'fas fa-file-alt', NULL, 1, 5),

  ('tableros', 1, 'totalInstituciones', 'auto', 'totalInstituciones', '0', '', 'Instituciones registradas', 'Entidades públicas integradas en la plataforma', 'fas fa-building', NULL, 1, 1),
  ('tableros', 2, 'totalTableros', 'auto', 'totalTableros', '0', '', 'Tableros disponibles', 'Tableros interactivos de rendición de cuentas publicados', 'fas fa-table', NULL, 1, 2),
  ('tableros', 3, 'totalMinisterios', 'auto', 'totalMinisterios', '0', '', 'Ministerios', 'Ministerios del Organismo Ejecutivo con tablero activo', 'fas fa-university', NULL, 1, 3),
  ('tableros', 4, 'totalSecretarias', 'auto', 'totalSecretarias', '0', '', 'Secretarías', 'Secretarías de la Presidencia con publicación activa', 'fas fa-file-signature', NULL, 1, 4),
  ('tableros', 5, 'totalOtras', 'auto', 'totalOtras', '0', '', 'Otras dependencias', 'Gobernaciones y dependencias descentralizadas', 'fas fa-sitemap', NULL, 1, 5),

  ('riesgo', 1, 'totalInstituciones', 'auto', 'totalInstituciones', '0', '', 'Instituciones', 'Instituciones evaluadas en el ciclo de gestión de riesgos', 'fas fa-building', NULL, 1, 1),
  ('riesgo', 2, 'pctCumplen', 'auto', 'pctCumplen', '0', '%', 'Cumplen', 'Instituciones que cumplen el lineamiento completo', 'fas fa-check-circle', NULL, 1, 2),
  ('riesgo', 3, 'pctEnProceso', 'auto', 'pctEnProceso', '0', '%', 'En proceso', 'Instituciones en fase de implementación o cumplimiento parcial', 'fas fa-spinner', NULL, 1, 3),
  ('riesgo', 4, 'pctBuenasPracticas', 'auto', 'pctBuenasPracticas', '0', '%', 'Buenas prácticas GRC', 'Adopción voluntaria de buenas prácticas de gestión de riesgos', 'fas fa-star', NULL, 1, 4),
  ('riesgo', 5, 'cicloActivo', 'auto', 'cicloActivo', '2025', '', 'Ciclo activo', 'Año de evaluación seleccionado en la consulta', 'fas fa-clock', NULL, 1, 5),

  ('vehiculos', 1, 'kpiCumple', 'auto', 'kpiCumple', '0', '', 'Cumple (7/7)', 'Instituciones que cumplen los 7 criterios evaluados', 'fas fa-check-circle', NULL, 1, 1),
  ('vehiculos', 2, 'kpiProceso', 'auto', 'kpiProceso', '0', '', 'En proceso (1-6)', 'Instituciones con cumplimiento parcial de criterios', 'fas fa-clock', NULL, 1, 2),
  ('vehiculos', 3, 'kpiNoCumple', 'auto', 'kpiNoCumple', '0', '', 'No cumple (0/7)', 'Instituciones sin criterios cumplidos registrados', 'fas fa-times-circle', NULL, 1, 3);
