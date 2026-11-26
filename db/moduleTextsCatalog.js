// db/moduleTextsCatalog.js
// Catálogo oficial y validación de textos estáticos editables para las páginas de módulos PIA:
// - Directorio de Acceso al Ejecutivo (/directorio/)
// - Tu Gobierno en Números (/gobierno_en_numeros/)
// - Canales por la Integridad (/canales-por-la-integridad/)
// - Riesgo en la Mira (/riesgo/)

const DANGEROUS_TEXT_PATTERNS = [
  /<\s*\/?\s*[a-z!][^>]*>/i,
  /<\s*script/i,
  /\b(?:javascript|vbscript)\s*:/i,
  /\bon[a-z]+\s*=/i,
  /data\s*:\s*text\/html/i
];

export const TEXT_MODULES_ORDER = ['directorio', 'tableros', 'canales', 'riesgo'];

const MODULE_KEY_ALIASES = {
  directorio: 'directorio',
  tableros: 'tableros',
  gobierno_en_numeros: 'tableros',
  'gobierno-en-numeros': 'tableros',
  canales: 'canales',
  'canales-por-la-integridad': 'canales',
  canales_por_la_integridad: 'canales',
  riesgo: 'riesgo'
};

export function normalizeTextModuleKey(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return MODULE_KEY_ALIASES[key] || null;
}

// ========================================================
// 1. DIRECTORIO DE ACCESO AL EJECUTIVO
// ========================================================
const DIRECTORIO_SECTIONS = [
  {
    id: 'header',
    label: 'Encabezado y Navegación',
    icon: 'fa-compass',
    description: 'Etiquetas principales de la barra superior de navegación.'
  },
  {
    id: 'hero',
    label: 'Portada Principal (Hero)',
    icon: 'fa-star',
    description: 'Cintillo superior, título, lema, descripción introductoria, botones y etiqueta de indicadores.'
  },
  {
    id: 'sobre',
    label: 'Sección "Sobre la plataforma"',
    icon: 'fa-info-circle',
    description: 'Texto de presentación institucional y acordeón de preguntas informativas.'
  },
  {
    id: 'glosario',
    label: 'Glosario de Términos',
    icon: 'fa-book',
    description: 'Encabezado y tarjetas de conceptos clave del acceso a la información pública.'
  },
  {
    id: 'servicios',
    label: 'Mecanismos de Acceso',
    icon: 'fa-concierge-bell',
    description: 'Encabezado y etiquetas de los canales disponibles en el directorio.'
  },
  {
    id: 'directorio',
    label: 'Directorio y Filtros',
    icon: 'fa-address-book',
    description: 'Encabezado principal del listado interactivo y título del panel de filtros.'
  },
  {
    id: 'faq',
    label: 'Preguntas Frecuentes (FAQ)',
    icon: 'fa-question-circle',
    description: 'Encabezado y preguntas frecuentes sobre solicitudes de información pública.'
  },
  {
    id: 'footer',
    label: 'Pie de página (Footer)',
    icon: 'fa-shoe-prints',
    description: 'Descripción institucional, títulos de columnas, datos de contacto visibles y derechos.'
  }
];

const DIRECTORIO_CATALOG = [
  // Header
  { key: 'header.nav_accede', section: 'header', label: 'Menú superior: Grupo 1', description: 'Etiqueta del primer menú desplegable en el encabezado.', defaultText: 'Accede', maxLength: 30, multiline: false },
  { key: 'header.nav_explora', section: 'header', label: 'Menú superior: Grupo 2', description: 'Etiqueta del segundo menú desplegable en el encabezado.', defaultText: 'Explora', maxLength: 30, multiline: false },
  { key: 'header.nav_aprende', section: 'header', label: 'Menú superior: Grupo 3', description: 'Etiqueta del tercer menú desplegable en el encabezado.', defaultText: 'Aprende', maxLength: 30, multiline: false },
  { key: 'header.nav_reporta', section: 'header', label: 'Menú superior: Grupo 4', description: 'Etiqueta del cuarto menú desplegable en el encabezado.', defaultText: 'Reporta', maxLength: 30, multiline: false },

  // Hero
  { key: 'hero.eyebrow', section: 'hero', label: 'Cintillo superior de portada', description: 'Etiqueta breve ubicada encima del título principal.', defaultText: 'Transparencia y Acceso a la Información', maxLength: 100, multiline: false },
  { key: 'hero.title_prefix', section: 'hero', label: 'Título principal — Primera línea', description: 'Primera parte del título de portada.', defaultText: 'Directorio:', maxLength: 50, multiline: false },
  { key: 'hero.title_highlight', section: 'hero', label: 'Título principal — Línea destacada', description: 'Segunda línea destacada del título de portada.', defaultText: 'Acceso al Ejecutivo', maxLength: 80, multiline: false },
  { key: 'hero.lema', section: 'hero', label: 'Lema institucional (Portada)', description: 'Frase corta en cian debajo del título principal.', defaultText: 'Acceso a la Información Pública', maxLength: 100, multiline: false },
  { key: 'hero.sub', section: 'hero', label: 'Subtítulo descriptivo (Hero)', description: 'Párrafo introductorio debajo del lema en la portada.', defaultText: 'Esta herramienta pone a disposición de la ciudadanía un directorio consolidado de las dependencias responsables de garantizar el acceso a la información pública en las instituciones del Organismo Ejecutivo. Su objetivo es facilitar la localización de enlaces institucionales, mecanismos de solicitud de información y datos de contacto de las unidades responsables.', maxLength: 520, multiline: true },
  { key: 'hero.cta_primary', section: 'hero', label: 'Botón principal de portada', description: 'Botón que desplaza hacia el directorio interactivo.', defaultText: 'Consultar Directorio', maxLength: 50, multiline: false },
  { key: 'hero.cta_secondary', section: 'hero', label: 'Botón secundario de portada', description: 'Botón que desplaza hacia la sección "Sobre la plataforma".', defaultText: 'Conocer más', maxLength: 50, multiline: false },
  { key: 'stats.ribbon_tag', section: 'hero', label: 'Encabezado de la cinta de cifras', description: 'Etiqueta superior sobre los KPIs del módulo.', defaultText: 'Indicadores del módulo', maxLength: 80, multiline: false },

  // Sobre la plataforma
  { key: 'sobre.tag', section: 'sobre', label: 'Etiqueta "Sobre la plataforma"', description: 'Etiqueta superior en la tarjeta informativa principal.', defaultText: 'Sobre la plataforma', maxLength: 60, multiline: false },
  { key: 'sobre.lead_prefix', section: 'sobre', label: 'Presentación — Inicio', description: 'Palabra inicial antes del nombre destacado de la plataforma.', defaultText: 'El', maxLength: 30, multiline: false },
  { key: 'sobre.lead_highlight', section: 'sobre', label: 'Presentación — Nombre destacado', description: 'Nombre enfatizado de la plataforma en el párrafo introductorio.', defaultText: 'Directorio Acceso al Ejecutivo', maxLength: 80, multiline: false },
  { key: 'sobre.lead_suffix', section: 'sobre', label: 'Presentación — Desarrollo', description: 'Continuación del párrafo principal de presentación.', defaultText: 'centraliza información clave de las dependencias encargadas de información pública en el Organismo Ejecutivo para fortalecer la transparencia y facilitar el ejercicio del derecho de acceso a la información a ciudadanas, ciudadanos, periodistas, sociedad civil, sector público e investigadores.', maxLength: 480, multiline: true },
  { key: 'sobre.acc1_q', section: 'sobre', label: 'Acordeón 1 — Pregunta', description: 'Primera pregunta en "Sobre la plataforma".', defaultText: '¿Qué es la plataforma?', maxLength: 140, multiline: false },
  { key: 'sobre.acc1_a', section: 'sobre', label: 'Acordeón 1 — Respuesta', description: 'Respuesta de la primera pregunta informativa.', defaultText: 'Es una herramienta digital centralizada de consulta pública que unifica los datos de contacto, ubicaciones y canales oficiales para solicitar acceso a la información pública en todas las dependencias e instituciones del Organismo Ejecutivo de Guatemala.', maxLength: 500, multiline: true },
  { key: 'sobre.acc2_q', section: 'sobre', label: 'Acordeón 2 — Pregunta', description: 'Segunda pregunta en "Sobre la plataforma".', defaultText: '¿Quiénes pueden ingresar y utilizarla?', maxLength: 140, multiline: false },
  { key: 'sobre.acc2_a', section: 'sobre', label: 'Acordeón 2 — Respuesta', description: 'Respuesta de la segunda pregunta informativa.', defaultText: 'Toda la ciudadanía, estudiantes, investigadores, periodistas, servidores públicos y cualquier persona interesada en consultar información o contactar a las entidades estatales. El acceso es totalmente libre, público y gratuito, sin necesidad de registro ni credenciales.', maxLength: 500, multiline: true },
  { key: 'sobre.acc3_q', section: 'sobre', label: 'Acordeón 3 — Pregunta', description: 'Tercera pregunta en "Sobre la plataforma".', defaultText: '¿Qué puedes encontrar aquí?', maxLength: 140, multiline: false },
  { key: 'sobre.acc3_a', section: 'sobre', label: 'Acordeón 3 — Respuesta', description: 'Respuesta de la tercera pregunta informativa.', defaultText: 'Encontrarás para cada entidad información relacionada con el electrónico institucional, número de teléfono, dirección y ubicación de la Unidad, enlace para poder realizar solicitudes en línea y para información pública de oficio de cada institución.', maxLength: 500, multiline: true },
  { key: 'sobre.acc4_q', section: 'sobre', label: 'Acordeón 4 — Pregunta', description: 'Cuarta pregunta en "Sobre la plataforma".', defaultText: '¿Cómo usar y navegar en el directorio?', maxLength: 140, multiline: false },
  { key: 'sobre.acc4_a', section: 'sobre', label: 'Acordeón 4 — Respuesta', description: 'Respuesta de la cuarta pregunta informativa.', defaultText: 'Puedes buscar instituciones por nombre o palabras clave, filtrar por sector gubernamental o por disponibilidad de servicios (solicitud en línea o de oficio), alternar entre vista de tarjetas o de lista, realizar búsquedas por voz y descargar la información consolidada en reportes PDF o Excel.', maxLength: 520, multiline: true },

  // Glosario
  { key: 'glosario.tag', section: 'glosario', label: 'Etiqueta del Glosario', description: 'Etiqueta superior encima del título del glosario.', defaultText: 'Conceptos clave', maxLength: 60, multiline: false },
  { key: 'glosario.title', section: 'glosario', label: 'Título del Glosario', description: 'Título principal de la sección de glosario.', defaultText: 'Glosario de términos', maxLength: 100, multiline: false },
  { key: 'glosario.card1_title', section: 'glosario', label: 'Glosario tarjeta 1 — Título', description: 'Título del primer concepto del glosario.', defaultText: 'Acceso a la información pública', maxLength: 90, multiline: false },
  { key: 'glosario.card1_desc', section: 'glosario', label: 'Glosario tarjeta 1 — Definición', description: 'Definición del primer concepto del glosario.', defaultText: 'Derecho de toda persona a solicitar y recibir información generada por el Estado, salvo las excepciones establecidas por ley.', maxLength: 300, multiline: true },
  { key: 'glosario.card2_title', section: 'glosario', label: 'Glosario tarjeta 2 — Título', description: 'Título del segundo concepto del glosario.', defaultText: 'Transparencia', maxLength: 90, multiline: false },
  { key: 'glosario.card2_desc', section: 'glosario', label: 'Glosario tarjeta 2 — Definición', description: 'Definición del segundo concepto del glosario.', defaultText: 'Principio que obliga a las instituciones a publicar y facilitar el acceso a la información de su gestión, promoviendo la rendición de cuentas.', maxLength: 300, multiline: true },
  { key: 'glosario.card3_title', section: 'glosario', label: 'Glosario tarjeta 3 — Título', description: 'Título del tercer concepto del glosario.', defaultText: 'Información Pública de Oficio', maxLength: 90, multiline: false },
  { key: 'glosario.card3_desc', section: 'glosario', label: 'Glosario tarjeta 3 — Definición', description: 'Definición del tercer concepto del glosario.', defaultText: 'Información que las entidades deben publicar de forma proactiva, sin necesidad de que sea solicitada, para garantizar la transparencia.', maxLength: 300, multiline: true },
  { key: 'glosario.card4_title', section: 'glosario', label: 'Glosario tarjeta 4 — Título', description: 'Título del cuarto concepto del glosario.', defaultText: 'Solicitud de información', maxLength: 90, multiline: false },
  { key: 'glosario.card4_desc', section: 'glosario', label: 'Glosario tarjeta 4 — Definición', description: 'Definición del cuarto concepto del glosario.', defaultText: 'Petición formal que realiza un ciudadano a una institución para obtener información pública, a través de los canales habilitados.', maxLength: 300, multiline: true },
  { key: 'glosario.card5_title', section: 'glosario', label: 'Glosario tarjeta 5 — Título', description: 'Título del quinto concepto del glosario.', defaultText: 'Organismo Ejecutivo', maxLength: 90, multiline: false },
  { key: 'glosario.card5_desc', section: 'glosario', label: 'Glosario tarjeta 5 — Definición', description: 'Definición del quinto concepto del glosario.', defaultText: 'Rama del Estado encargada de la administración pública, conformada por ministerios, secretarías y otras dependencias.', maxLength: 300, multiline: true },

  // Mecanismos de acceso
  { key: 'servicios.tag', section: 'servicios', label: 'Etiqueta de Servicios disponibles', description: 'Etiqueta superior de la sección de mecanismos de acceso.', defaultText: 'Servicios disponibles', maxLength: 60, multiline: false },
  { key: 'servicios.title', section: 'servicios', label: 'Título de Mecanismos de acceso', description: 'Título principal de la fila de servicios disponibles.', defaultText: 'Mecanismos de acceso a la información', maxLength: 100, multiline: false },
  { key: 'servicios.sub', section: 'servicios', label: 'Subtítulo de Mecanismos de acceso', description: 'Descripción breve debajo del título de servicios disponibles.', defaultText: 'Cada institución ofrece diferentes canales para ejercer tu derecho a la información.', maxLength: 220, multiline: true },
  { key: 'servicios.pill1', section: 'servicios', label: 'Servicio 1 — Etiqueta', description: 'Primera insignia de servicio disponible.', defaultText: 'Correo electrónico', maxLength: 40, multiline: false },
  { key: 'servicios.pill2', section: 'servicios', label: 'Servicio 2 — Etiqueta', description: 'Segunda insignia de servicio disponible.', defaultText: 'Teléfono', maxLength: 40, multiline: false },
  { key: 'servicios.pill3', section: 'servicios', label: 'Servicio 3 — Etiqueta', description: 'Tercera insignia de servicio disponible.', defaultText: 'Solicitud en línea', maxLength: 40, multiline: false },
  { key: 'servicios.pill4', section: 'servicios', label: 'Servicio 4 — Etiqueta', description: 'Cuarta insignia de servicio disponible.', defaultText: 'Información de oficio', maxLength: 40, multiline: false },
  { key: 'servicios.pill5', section: 'servicios', label: 'Servicio 5 — Etiqueta', description: 'Quinta insignia de servicio disponible.', defaultText: 'Atención presencial', maxLength: 40, multiline: false },

  // Directorio
  { key: 'directorio.tag', section: 'directorio', label: 'Etiqueta de sección Directorio', description: 'Etiqueta superior encima del título del listado.', defaultText: 'Directorio', maxLength: 60, multiline: false },
  { key: 'directorio.title', section: 'directorio', label: 'Título de sección Directorio', description: 'Título principal del listado de instituciones.', defaultText: 'Directorio de Acceso al Ejecutivo', maxLength: 100, multiline: false },
  { key: 'directorio.disclaimer', section: 'directorio', label: 'Nota informativa de actualización', description: 'Aviso institucional sobre el origen y actualización periódica debajo del título del directorio.', defaultText: 'La información que se presenta ha sido proporcionada por las Unidades de Acceso a la Información Pública del Organismo Ejecutivo. La actualización de la misma es notificada por las mismas Unidades y se realiza de forma periódica.', maxLength: 420, multiline: true },
  { key: 'directorio.filters_title', section: 'directorio', label: 'Título del bloque de filtros', description: 'Encabezado de la barra de filtros de búsqueda.', defaultText: 'Filtros de Búsqueda', maxLength: 60, multiline: false },

  // FAQ
  { key: 'faq.tag', section: 'faq', label: 'Etiqueta de Preguntas frecuentes', description: 'Etiqueta superior de la sección FAQ.', defaultText: 'Preguntas frecuentes', maxLength: 60, multiline: false },
  { key: 'faq.title', section: 'faq', label: 'Título de Preguntas frecuentes', description: 'Título principal de la sección FAQ.', defaultText: 'Resolvemos tus dudas', maxLength: 100, multiline: false },
  { key: 'faq.sub', section: 'faq', label: 'Subtítulo de Preguntas frecuentes', description: 'Descripción introductoria de la sección FAQ.', defaultText: 'Respuestas a las consultas más comunes sobre el directorio y el acceso a la información pública.', maxLength: 240, multiline: true },
  { key: 'faq.q1', section: 'faq', label: 'FAQ 1 — Pregunta', description: 'Primera pregunta frecuente.', defaultText: '¿Qué es una solicitud de acceso a la información pública?', maxLength: 180, multiline: false },
  { key: 'faq.a1', section: 'faq', label: 'FAQ 1 — Respuesta', description: 'Respuesta de la primera pregunta frecuente.', defaultText: 'Es el derecho que tiene toda persona, sin necesidad de justificar su interés, de solicitar y obtener información que se encuentre en posesión de las instituciones públicas, de acuerdo con lo establecido en la Ley de Acceso a la Información Pública (Decreto 57-2008). Las entidades obligadas deben proporcionar la información solicitada, salvo las excepciones expresamente reguladas por la ley.', maxLength: 700, multiline: true },
  { key: 'faq.q2', section: 'faq', label: 'FAQ 2 — Pregunta', description: 'Segunda pregunta frecuente.', defaultText: '¿Qué es la Información Pública de Oficio?', maxLength: 180, multiline: false },
  { key: 'faq.a2', section: 'faq', label: 'FAQ 2 — Respuesta', description: 'Respuesta de la segunda pregunta frecuente.', defaultText: 'Es la información que las instituciones públicas están obligadas a publicar y mantener actualizada de forma permanente, sin necesidad de que exista una solicitud previa. Esta información incluye aspectos como estructura organizacional, directorios de funcionarios, presupuesto, contrataciones, programas, informes de gestión y otros datos definidos en el artículo 10 de la Ley de Acceso a la Información Pública.', maxLength: 700, multiline: true },
  { key: 'faq.q3', section: 'faq', label: 'FAQ 3 — Pregunta', description: 'Tercera pregunta frecuente.', defaultText: '¿Cómo encuentro la institución que necesito?', maxLength: 180, multiline: false },
  { key: 'faq.a3', section: 'faq', label: 'FAQ 3 — Respuesta', description: 'Respuesta de la tercera pregunta frecuente.', defaultText: 'Puede utilizar el buscador y los filtros disponibles en el directorio para localizar la institución de su interés. También puede navegar por categoría, nombre de la entidad o sector gubernamental hasta encontrar la dependencia correspondiente y consultar su información de contacto y acceso a la información pública.', maxLength: 700, multiline: true },
  { key: 'faq.q4', section: 'faq', label: 'FAQ 4 — Pregunta', description: 'Cuarta pregunta frecuente.', defaultText: '¿La información del directorio está actualizada?', maxLength: 180, multiline: false },
  { key: 'faq.a4', section: 'faq', label: 'FAQ 4 — Respuesta', description: 'Respuesta de la cuarta pregunta frecuente.', defaultText: 'La información publicada proviene de las fuentes oficiales de cada institución y es actualizada periódicamente. No obstante, debido a cambios administrativos, organizacionales o tecnológicos que puedan ocurrir en las entidades públicas, se recomienda verificar directamente con la institución correspondiente cualquier dato que requiera confirmación inmediata.', maxLength: 700, multiline: true },
  { key: 'faq.q5', section: 'faq', label: 'FAQ 5 — Pregunta', description: 'Quinta pregunta frecuente.', defaultText: '¿Puedo realizar solicitudes directamente desde esta plataforma?', maxLength: 180, multiline: false },
  { key: 'faq.a5', section: 'faq', label: 'FAQ 5 — Respuesta', description: 'Respuesta de la quinta pregunta frecuente.', defaultText: 'No. Esta plataforma tiene un carácter informativo y de consulta. Su objetivo es facilitar el acceso a los datos de contacto, enlaces y canales oficiales de las instituciones públicas. Las solicitudes de acceso a la información pública deben realizarse directamente ante la Unidad de Información Pública de la institución correspondiente, utilizando los medios que esta tenga habilitados para tal fin (portal web, formulario electrónico, correo electrónico, atención presencial u otros canales oficiales).', maxLength: 800, multiline: true },

  // Footer
  { key: 'footer.brand_phrase', section: 'footer', label: 'Descripción del pie de página', description: 'Párrafo debajo de los logotipos en la primera columna del pie de página.', defaultText: 'Directorio de Acceso al Ejecutivo — Herramienta oficial para localizar los canales de acceso a la información pública del Organismo Ejecutivo.', maxLength: 300, multiline: true },
  { key: 'footer.col1_title', section: 'footer', label: 'Pie de página — Título columna 1', description: 'Encabezado de la columna Reporta irregularidades.', defaultText: 'Reporta irregularidades', maxLength: 60, multiline: false },
  { key: 'footer.col2_title', section: 'footer', label: 'Pie de página — Título columna 2', description: 'Encabezado de la columna Explora datos.', defaultText: 'Explora datos', maxLength: 60, multiline: false },
  { key: 'footer.col3_title', section: 'footer', label: 'Pie de página — Título columna 3', description: 'Encabezado de la columna Accede a la información.', defaultText: 'Accede a la información', maxLength: 60, multiline: false },
  { key: 'footer.col4_title', section: 'footer', label: 'Pie de página — Subtítulo "Aprende"', description: 'Encabezado del bloque de formación en la tercera columna.', defaultText: 'Aprende', maxLength: 60, multiline: false },
  { key: 'footer.col5_title', section: 'footer', label: 'Pie de página — Título de contacto', description: 'Encabezado de la columna de contacto y redes sociales.', defaultText: 'Contacto', maxLength: 60, multiline: false },
  { key: 'footer.contact_email', section: 'footer', label: 'Pie de página — Correo visible', description: 'Texto del correo visible en el pie de página.', defaultText: 'info@pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.contact_web', section: 'footer', label: 'Pie de página — Sitio web visible', description: 'Texto del enlace web visible en el pie de página.', defaultText: 'pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.copyright', section: 'footer', label: 'Aviso de derechos / Pie inferior', description: 'Texto institucional al pie de la página.', defaultText: '© Gobierno de Guatemala 2025. Comprometidos con la integridad pública.', maxLength: 180, multiline: false }
];

// ========================================================
// 2. TU GOBIERNO EN NÚMEROS
// ========================================================
const TABLEROS_SECTIONS = [
  {
    id: 'header',
    label: 'Encabezado y Navegación',
    icon: 'fa-compass',
    description: 'Etiquetas principales de la barra superior de navegación.'
  },
  {
    id: 'hero',
    label: 'Portada Principal (Hero)',
    icon: 'fa-star',
    description: 'Cintillo, título, lema, descripción introductoria, botones y etiqueta de indicadores.'
  },
  {
    id: 'sobre',
    label: 'Sección "Sobre la plataforma"',
    icon: 'fa-info-circle',
    description: 'Párrafos institucionales de presentación y tarjetas de atributos destacados.'
  },
  {
    id: 'glosario',
    label: 'Glosario (Encabezado)',
    icon: 'fa-book',
    description: 'Etiqueta y título principal de la sección de glosario de rendición de cuentas.'
  },
  {
    id: 'tableros',
    label: 'Tableros y Filtros',
    icon: 'fa-chart-bar',
    description: 'Encabezado de tableros, nota de responsabilidad institucional y título de filtros.'
  },
  {
    id: 'faq',
    label: 'Preguntas Frecuentes (FAQ)',
    icon: 'fa-question-circle',
    description: 'Encabezado y preguntas frecuentes sobre los tableros de rendición de cuentas.'
  },
  {
    id: 'footer',
    label: 'Pie de página (Footer)',
    icon: 'fa-shoe-prints',
    description: 'Descripción institucional, títulos de columnas, datos de contacto visibles y derechos.'
  }
];

const TABLEROS_CATALOG = [
  // Header
  { key: 'header.nav_accede', section: 'header', label: 'Menú superior: Grupo 1', description: 'Etiqueta del primer menú desplegable en el encabezado.', defaultText: 'Accede', maxLength: 30, multiline: false },
  { key: 'header.nav_explora', section: 'header', label: 'Menú superior: Grupo 2', description: 'Etiqueta del segundo menú desplegable en el encabezado.', defaultText: 'Explora', maxLength: 30, multiline: false },
  { key: 'header.nav_aprende', section: 'header', label: 'Menú superior: Grupo 3', description: 'Etiqueta del tercer menú desplegable en el encabezado.', defaultText: 'Aprende', maxLength: 30, multiline: false },
  { key: 'header.nav_reporta', section: 'header', label: 'Menú superior: Grupo 4', description: 'Etiqueta del cuarto menú desplegable en el encabezado.', defaultText: 'Reporta', maxLength: 30, multiline: false },

  // Hero
  { key: 'hero.eyebrow', section: 'hero', label: 'Cintillo superior de portada', description: 'Etiqueta breve ubicada encima del título principal.', defaultText: 'Transparencia y Rendición de Cuentas', maxLength: 100, multiline: false },
  { key: 'hero.title_prefix', section: 'hero', label: 'Título principal — Primera línea', description: 'Primera palabra del título principal.', defaultText: 'Tu', maxLength: 40, multiline: false },
  { key: 'hero.title_highlight', section: 'hero', label: 'Título principal — Línea destacada', description: 'Segunda línea destacada del título de portada.', defaultText: 'Gobierno en Números', maxLength: 80, multiline: false },
  { key: 'hero.lema', section: 'hero', label: 'Lema institucional (Portada)', description: 'Frase breve en cian debajo del título principal.', defaultText: 'Tableros de Rendición de cuentas', maxLength: 100, multiline: false },
  { key: 'hero.sub', section: 'hero', label: 'Subtítulo descriptivo (Hero)', description: 'Párrafo introductorio debajo del lema en la portada.', defaultText: 'Son herramientas de prevención que busca favorecer la rendición de cuentas. Centraliza y publica de manera proactiva, información importante sobre la gestión de recursos en las instituciones que conforman el Organismo Ejecutivo.', maxLength: 460, multiline: true },
  { key: 'hero.cta_primary', section: 'hero', label: 'Botón principal de portada', description: 'Botón que desplaza hacia los tableros.', defaultText: 'Consultar Tableros', maxLength: 50, multiline: false },
  { key: 'hero.cta_secondary', section: 'hero', label: 'Botón secundario de portada', description: 'Botón que desplaza hacia "Sobre la plataforma".', defaultText: 'Conocer Más', maxLength: 50, multiline: false },
  { key: 'stats.ribbon_tag', section: 'hero', label: 'Encabezado de la cinta de cifras', description: 'Etiqueta superior sobre los KPIs del módulo.', defaultText: 'Indicadores del módulo', maxLength: 80, multiline: false },

  // Sobre la plataforma
  { key: 'sobre.tag', section: 'sobre', label: 'Etiqueta "Sobre la plataforma"', description: 'Etiqueta superior encima del título de presentación.', defaultText: 'Sobre la plataforma', maxLength: 60, multiline: false },
  { key: 'sobre.title_prefix', section: 'sobre', label: 'Título "Sobre la plataforma" — Inicio', description: 'Palabra inicial del título en la sección de presentación.', defaultText: 'Tu', maxLength: 40, multiline: false },
  { key: 'sobre.title_highlight', section: 'sobre', label: 'Título "Sobre la plataforma" — Destacado', description: 'Texto destacado en color dentro del título de presentación.', defaultText: 'Gobierno en Números', maxLength: 80, multiline: false },
  { key: 'sobre.p1', section: 'sobre', label: 'Párrafo 1 de presentación', description: 'Primer párrafo informativo sobre el propósito de los tableros.', defaultText: 'Facilita el acceso a información gubernamental mediante tableros claros, accesibles y de fácil comprensión, fortaleciendo la transparencia y la rendición de cuentas.', maxLength: 360, multiline: true },
  { key: 'sobre.p2', section: 'sobre', label: 'Párrafo 2 de presentación', description: 'Segundo párrafo informativo indicando los públicos objetivo.', defaultText: 'Dirigido a ciudadanía, periodistas, organizaciones, academia y autoridades que requieran información clara y consolidada para conocer, analizar y dar seguimiento a la gestión y uso de los recursos públicos del Organismo Ejecutivo.', maxLength: 400, multiline: true },
  { key: 'sobre.feat1', section: 'sobre', label: 'Atributo destacado 1', description: 'Etiqueta de la primera ficha de características.', defaultText: 'Datos actualizados', maxLength: 50, multiline: false },
  { key: 'sobre.feat2', section: 'sobre', label: 'Atributo destacado 2', description: 'Etiqueta de la segunda ficha de características.', defaultText: 'Comparte información', maxLength: 50, multiline: false },
  { key: 'sobre.feat3', section: 'sobre', label: 'Atributo destacado 3', description: 'Etiqueta de la tercera ficha de características.', defaultText: 'Exporta resultados', maxLength: 50, multiline: false },
  { key: 'sobre.feat4', section: 'sobre', label: 'Atributo destacado 4', description: 'Etiqueta de la cuarta ficha de características.', defaultText: 'Transparencia activa', maxLength: 50, multiline: false },

  // Glosario
  { key: 'glosario.tag', section: 'glosario', label: 'Etiqueta del Glosario', description: 'Etiqueta superior del glosario de rendición de cuentas.', defaultText: 'Conceptos clave', maxLength: 60, multiline: false },
  { key: 'glosario.title', section: 'glosario', label: 'Título del Glosario', description: 'Título principal de la sección de glosario.', defaultText: 'Glosario de Transparencia y Rendición de Cuentas', maxLength: 120, multiline: false },

  // Tableros y filtros
  { key: 'tableros.tag', section: 'tableros', label: 'Etiqueta de sección Tableros', description: 'Etiqueta superior encima del título de tableros.', defaultText: 'Datos y transparencia', maxLength: 60, multiline: false },
  { key: 'tableros.title', section: 'tableros', label: 'Título de sección Tableros', description: 'Título principal del catálogo de tableros.', defaultText: 'Tableros de Rendición de Cuentas', maxLength: 100, multiline: false },
  { key: 'tableros.disclaimer', section: 'tableros', label: 'Nota de responsabilidad institucional', description: 'Aviso informativo debajo del título de tableros.', defaultText: 'La información que se presenta ha sido proporcionada bajo responsabilidad de las dependencias encargadas del acceso a la información pública del Organismo Ejecutivo. La actualización de los enlaces y contenidos es responsabilidad de cada institución.', maxLength: 420, multiline: true },
  { key: 'tableros.filters_title', section: 'tableros', label: 'Título del bloque de filtros', description: 'Encabezado de la barra de filtros de búsqueda.', defaultText: 'Filtros de Búsqueda', maxLength: 60, multiline: false },

  // FAQ
  { key: 'faq.tag', section: 'faq', label: 'Etiqueta de Preguntas frecuentes', description: 'Etiqueta superior de la sección FAQ.', defaultText: 'Preguntas frecuentes', maxLength: 60, multiline: false },
  { key: 'faq.title', section: 'faq', label: 'Título de Preguntas frecuentes', description: 'Título principal de la sección FAQ.', defaultText: 'Resolvemos tus dudas', maxLength: 100, multiline: false },
  { key: 'faq.sub', section: 'faq', label: 'Subtítulo de Preguntas frecuentes', description: 'Descripción introductoria de la sección FAQ.', defaultText: 'Respuestas a las consultas más comunes sobre la plataforma y los tableros de rendición de cuentas.', maxLength: 240, multiline: true },
  { key: 'faq.q1', section: 'faq', label: 'FAQ 1 — Pregunta', description: 'Primera pregunta frecuente.', defaultText: '¿Qué información puedo consultar?', maxLength: 180, multiline: false },
  { key: 'faq.a1', section: 'faq', label: 'FAQ 1 — Respuesta', description: 'Respuesta de la primera pregunta frecuente.', defaultText: 'En algunos tableros podrás consultar las autoridades de cada institución, el presupuesto vigente, el presupuesto ejecutado, información de pago de salarios, avance en proyectos prioritarios, resultados o logros, espacios para sugerencias y mucho más.', maxLength: 600, multiline: true },
  { key: 'faq.q2', section: 'faq', label: 'FAQ 2 — Pregunta', description: 'Segunda pregunta frecuente.', defaultText: '¿Quién actualiza los tableros?', maxLength: 180, multiline: false },
  { key: 'faq.a2', section: 'faq', label: 'FAQ 2 — Respuesta', description: 'Respuesta de la segunda pregunta frecuente.', defaultText: 'Cada institución es responsable de la actualización y calidad de la información publicada en su tablero. La plataforma solo enlaza a las fuentes oficiales.', maxLength: 500, multiline: true },
  { key: 'faq.q3', section: 'faq', label: 'FAQ 3 — Pregunta', description: 'Tercera pregunta frecuente.', defaultText: '¿Puedo descargar información?', maxLength: 180, multiline: false },
  { key: 'faq.a3', section: 'faq', label: 'FAQ 3 — Respuesta', description: 'Respuesta de la tercera pregunta frecuente.', defaultText: 'Sí, puede exportar los resultados filtrados en formato PDF o Excel utilizando los botones de exportación disponibles en la sección del directorio.', maxLength: 500, multiline: true },
  { key: 'faq.q4', section: 'faq', label: 'FAQ 4 — Pregunta', description: 'Cuarta pregunta frecuente.', defaultText: '¿Cómo comparto un tablero?', maxLength: 180, multiline: false },
  { key: 'faq.a4', section: 'faq', label: 'FAQ 4 — Respuesta', description: 'Respuesta de la cuarta pregunta frecuente.', defaultText: 'Cada tarjeta tiene un botón de compartir que genera un mensaje con el nombre de la institución y el enlace al tablero, listo para enviar por WhatsApp o copiar al portapapeles.', maxLength: 500, multiline: true },
  { key: 'faq.q5', section: 'faq', label: 'FAQ 5 — Pregunta', description: 'Quinta pregunta frecuente.', defaultText: '¿La plataforma genera información propia?', maxLength: 180, multiline: false },
  { key: 'faq.a5', section: 'faq', label: 'FAQ 5 — Respuesta', description: 'Respuesta de la quinta pregunta frecuente.', defaultText: 'No. La plataforma es un directorio que enlaza a las fuentes oficiales de cada institución. No genera ni modifica la información publicada.', maxLength: 500, multiline: true },

  // Footer
  { key: 'footer.brand_phrase', section: 'footer', label: 'Descripción del pie de página', description: 'Párrafo debajo de los logotipos en la primera columna del pie de página.', defaultText: 'Tu Gobierno en Números — Tableros de Rendición de Cuentas del Organismo Ejecutivo.', maxLength: 300, multiline: true },
  { key: 'footer.col1_title', section: 'footer', label: 'Pie de página — Título columna 1', description: 'Encabezado de la columna Reporta irregularidades.', defaultText: 'Reporta irregularidades', maxLength: 60, multiline: false },
  { key: 'footer.col2_title', section: 'footer', label: 'Pie de página — Título columna 2', description: 'Encabezado de la columna Explora datos.', defaultText: 'Explora datos', maxLength: 60, multiline: false },
  { key: 'footer.col3_title', section: 'footer', label: 'Pie de página — Título columna 3', description: 'Encabezado de la columna Accede a la información.', defaultText: 'Accede a la información', maxLength: 60, multiline: false },
  { key: 'footer.col4_title', section: 'footer', label: 'Pie de página — Subtítulo "Aprende"', description: 'Encabezado del bloque de formación en la tercera columna.', defaultText: 'Aprende', maxLength: 60, multiline: false },
  { key: 'footer.col5_title', section: 'footer', label: 'Pie de página — Título de contacto', description: 'Encabezado de la columna de contacto y redes sociales.', defaultText: 'Contacto', maxLength: 60, multiline: false },
  { key: 'footer.contact_email', section: 'footer', label: 'Pie de página — Correo visible', description: 'Texto del correo visible en el pie de página.', defaultText: 'info@pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.contact_web', section: 'footer', label: 'Pie de página — Sitio web visible', description: 'Texto del enlace web visible en el pie de página.', defaultText: 'pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.copyright', section: 'footer', label: 'Aviso de derechos / Pie inferior', description: 'Texto institucional al pie de la página.', defaultText: '© Gobierno de Guatemala 2025. Comprometidos con la integridad pública.', maxLength: 180, multiline: false }
];

// ========================================================
// 3. CANALES POR LA INTEGRIDAD
// ========================================================
const CANALES_SECTIONS = [
  {
    id: 'header',
    label: 'Encabezado y Navegación',
    icon: 'fa-compass',
    description: 'Etiquetas principales de la barra superior de navegación.'
  },
  {
    id: 'hero',
    label: 'Portada Principal (Hero)',
    icon: 'fa-star',
    description: 'Cintillo, título, lema, descripción, botones, aviso de confidencialidad y cinta de cifras.'
  },
  {
    id: 'listado',
    label: 'Listado de Canales y Filtros',
    icon: 'fa-bullhorn',
    description: 'Encabezado del listado, aviso de alcance administrativo, tipos de canales y filtros.'
  },
  {
    id: 'sobre',
    label: 'Sección "Sobre la plataforma"',
    icon: 'fa-info-circle',
    description: 'Mensaje de compromiso institucional y acordeón informativo.'
  },
  {
    id: 'definiciones',
    label: 'Definiciones Clave',
    icon: 'fa-book',
    description: 'Encabezado y tarjetas del carrusel de definiciones fundamentales.'
  },
  {
    id: 'dashboard_cnc',
    label: 'Dashboard de Cumplimiento CNC',
    icon: 'fa-chart-pie',
    description: 'Encabezados y descripciones estáticas de la sección de cumplimiento.'
  },
  {
    id: 'vigilando',
    label: 'Banner "Vigilando la Integridad"',
    icon: 'fa-shield-alt',
    description: 'Bloque promocional de la plataforma oficial de denuncias en línea y sus 4 garantías.'
  },
  {
    id: 'faq',
    label: 'Preguntas Frecuentes (FAQ)',
    icon: 'fa-question-circle',
    description: 'Encabezado y preguntas frecuentes sobre los canales de denuncia.'
  },
  {
    id: 'footer',
    label: 'Pie de página (Footer)',
    icon: 'fa-shoe-prints',
    description: 'Descripción institucional, aviso de confidencialidad, títulos de columnas y derechos.'
  }
];

const CANALES_CATALOG = [
  // Header
  { key: 'header.nav_accede', section: 'header', label: 'Menú superior: Grupo 1', description: 'Etiqueta del primer menú desplegable en el encabezado.', defaultText: 'Accede', maxLength: 30, multiline: false },
  { key: 'header.nav_explora', section: 'header', label: 'Menú superior: Grupo 2', description: 'Etiqueta del segundo menú desplegable en el encabezado.', defaultText: 'Explora', maxLength: 30, multiline: false },
  { key: 'header.nav_aprende', section: 'header', label: 'Menú superior: Grupo 3', description: 'Etiqueta del tercer menú desplegable en el encabezado.', defaultText: 'Aprende', maxLength: 30, multiline: false },
  { key: 'header.nav_reporta', section: 'header', label: 'Menú superior: Grupo 4', description: 'Etiqueta del cuarto menú desplegable en el encabezado.', defaultText: 'Reporta', maxLength: 30, multiline: false },

  // Hero
  { key: 'hero.eyebrow', section: 'hero', label: 'Cintillo superior de portada', description: 'Etiqueta breve ubicada encima del título principal.', defaultText: 'Gobierno de Guatemala · Organismo Ejecutivo', maxLength: 100, multiline: false },
  { key: 'hero.title_prefix', section: 'hero', label: 'Título principal — Primera línea', description: 'Primera parte del título de portada.', defaultText: 'Canales por la', maxLength: 50, multiline: false },
  { key: 'hero.title_highlight', section: 'hero', label: 'Título principal — Línea destacada', description: 'Segunda línea destacada del título de portada.', defaultText: 'Integridad', maxLength: 60, multiline: false },
  { key: 'hero.lema', section: 'hero', label: 'Lema institucional (Portada)', description: 'Frase breve debajo del título principal.', defaultText: 'Tu voz fortalece la integridad', maxLength: 100, multiline: false },
  { key: 'hero.sub', section: 'hero', label: 'Subtítulo descriptivo (Hero)', description: 'Párrafo introductorio debajo del lema en la portada.', defaultText: 'Listado público y actualizado de canales de denuncia administrativa del Organismo Ejecutivo. Encuentra fácilmente dónde y cómo reportar posibles irregularidades.', maxLength: 420, multiline: true },
  { key: 'hero.cta_primary', section: 'hero', label: 'Botón principal de portada', description: 'Botón que desplaza hacia el listado de canales.', defaultText: 'Consultar canales', maxLength: 50, multiline: false },
  { key: 'hero.cta_secondary', section: 'hero', label: 'Botón secundario de portada', description: 'Botón que desplaza hacia "¿Qué es Canales por la Integridad?".', defaultText: '¿Qué es Canales por la Integridad?', maxLength: 70, multiline: false },
  { key: 'hero.security_label', section: 'hero', label: 'Aviso de confidencialidad — Título', description: 'Texto en negrita del aviso de seguridad debajo de los botones.', defaultText: 'Tratamiento seguro y confidencial:', maxLength: 80, multiline: false },
  { key: 'hero.security_text', section: 'hero', label: 'Aviso de confidencialidad — Descripción', description: 'Texto complementario de garantía de confidencialidad.', defaultText: 'Se garantiza la protección de tu identidad y la gestión reservada de cada reporte de denuncia.', maxLength: 260, multiline: true },
  { key: 'stats.ribbon_tag', section: 'hero', label: 'Encabezado de la cinta de cifras', description: 'Etiqueta superior sobre los KPIs del módulo.', defaultText: 'Indicadores del módulo', maxLength: 80, multiline: false },

  // Listado y filtros
  { key: 'listado.tag', section: 'listado', label: 'Etiqueta de sección Listado', description: 'Etiqueta superior encima del título principal del listado.', defaultText: 'Canales de denuncia', maxLength: 60, multiline: false },
  { key: 'listado.title', section: 'listado', label: 'Título de sección Listado', description: 'Título principal del listado de canales.', defaultText: 'Listado de Canales de denuncia del Organismo Ejecutivo', maxLength: 120, multiline: false },
  { key: 'listado.sub_prefix', section: 'listado', label: 'Nota de alcance — Inicio', description: 'Texto inicial antes de la frase destacada en negrita.', defaultText: 'Cada institución puede tener uno o más de los siguientes canales habilitados para recepcionar únicamente', maxLength: 220, multiline: true },
  { key: 'listado.sub_emphasis', section: 'listado', label: 'Nota de alcance — Frase destacada', description: 'Frase enfatizada en negrita sobre el alcance administrativo.', defaultText: 'denuncias administrativas del Organismo Ejecutivo', maxLength: 140, multiline: false },
  { key: 'listado.sub_suffix', section: 'listado', label: 'Nota de alcance — Cierre', description: 'Aclaración final del alcance entre paréntesis.', defaultText: '(no aplica para denuncias penales ni para instituciones fuera del Organismo Ejecutivo).', maxLength: 220, multiline: true },
  { key: 'listado.pill1', section: 'listado', label: 'Tipo de canal 1 — Etiqueta', description: 'Primera insignia de canal de denuncia.', defaultText: 'Teléfono', maxLength: 40, multiline: false },
  { key: 'listado.pill2', section: 'listado', label: 'Tipo de canal 2 — Etiqueta', description: 'Segunda insignia de canal de denuncia.', defaultText: 'Correo electrónico', maxLength: 40, multiline: false },
  { key: 'listado.pill3', section: 'listado', label: 'Tipo de canal 3 — Etiqueta', description: 'Tercera insignia de canal de denuncia.', defaultText: 'Formulario web', maxLength: 40, multiline: false },
  { key: 'listado.pill4', section: 'listado', label: 'Tipo de canal 4 — Etiqueta', description: 'Cuarta insignia de canal de denuncia.', defaultText: 'Presencial', maxLength: 40, multiline: false },
  { key: 'listado.pill5', section: 'listado', label: 'Tipo de canal 5 — Etiqueta', description: 'Quinta insignia de canal de denuncia.', defaultText: 'Otro canal', maxLength: 40, multiline: false },
  { key: 'listado.filters_title', section: 'listado', label: 'Título del bloque de filtros', description: 'Encabezado de la barra de filtros de búsqueda.', defaultText: 'Filtros de Búsqueda', maxLength: 60, multiline: false },

  // Sobre la plataforma
  { key: 'sobre.tag', section: 'sobre', label: 'Etiqueta "Sobre la plataforma"', description: 'Etiqueta superior en la banda oscura de presentación.', defaultText: 'Sobre la plataforma', maxLength: 60, multiline: false },
  { key: 'sobre.lead_prefix', section: 'sobre', label: 'Frase principal — Inicio', description: 'Texto inicial antes de la palabra enfatizada.', defaultText: 'En Guatemala, la integridad pública es un compromiso de', maxLength: 160, multiline: false },
  { key: 'sobre.lead_emphasis', section: 'sobre', label: 'Frase principal — Palabra destacada', description: 'Palabra enfatizada en cursiva/cian.', defaultText: 'todos', maxLength: 40, multiline: false },
  { key: 'sobre.lead_suffix', section: 'sobre', label: 'Frase principal — Cierre', description: 'Continuación de la frase institucional.', defaultText: '. Por eso nace Canales por la Integridad.', maxLength: 140, multiline: false },
  { key: 'sobre.acc1_q', section: 'sobre', label: 'Acordeón 1 — Pregunta', description: 'Primera pregunta en "Sobre la plataforma".', defaultText: '¿Qué es Canales por la Integridad?', maxLength: 140, multiline: false },
  { key: 'sobre.acc1_a', section: 'sobre', label: 'Acordeón 1 — Respuesta', description: 'Respuesta de la primera pregunta.', defaultText: 'Listado interactivo que reúne los canales de denuncia administrativa del Organismo Ejecutivo.', maxLength: 340, multiline: true },
  { key: 'sobre.acc2_q', section: 'sobre', label: 'Acordeón 2 — Pregunta', description: 'Segunda pregunta en "Sobre la plataforma".', defaultText: '¿Por qué es importante?', maxLength: 140, multiline: false },
  { key: 'sobre.acc2_a', section: 'sobre', label: 'Acordeón 2 — Respuesta', description: 'Respuesta de la segunda pregunta.', defaultText: 'Fortalece la transparencia y la participación ciudadana en la rendición de cuentas pública.', maxLength: 340, multiline: true },
  { key: 'sobre.acc3_q', section: 'sobre', label: 'Acordeón 3 — Pregunta', description: 'Tercera pregunta en "Sobre la plataforma".', defaultText: '¿A quién está dirigida?', maxLength: 140, multiline: false },
  { key: 'sobre.acc3_a', section: 'sobre', label: 'Acordeón 3 — Respuesta', description: 'Respuesta de la tercera pregunta.', defaultText: 'A toda la población y actores interesados en denunciar irregularidades en el Organismo Ejecutivo.', maxLength: 340, multiline: true },

  // Definiciones clave
  { key: 'definiciones.tag', section: 'definiciones', label: 'Etiqueta de Definiciones clave', description: 'Etiqueta superior del carrusel de definiciones.', defaultText: 'Glosario', maxLength: 60, multiline: false },
  { key: 'definiciones.title', section: 'definiciones', label: 'Título de Definiciones clave', description: 'Título principal de la sección de definiciones.', defaultText: 'Definiciones clave', maxLength: 100, multiline: false },
  { key: 'definiciones.sub', section: 'definiciones', label: 'Subtítulo de Definiciones clave', description: 'Descripción introductoria debajo del título.', defaultText: 'Conoce los conceptos fundamentales de la denuncia administrativa y la integridad pública.', maxLength: 240, multiline: true },
  { key: 'definiciones.def1_title', section: 'definiciones', label: 'Definición 1 — Título', description: 'Título de la primera tarjeta de definición.', defaultText: 'Denuncia administrativa', maxLength: 80, multiline: false },
  { key: 'definiciones.def1_desc', section: 'definiciones', label: 'Definición 1 — Descripción', description: 'Texto de la primera tarjeta de definición.', defaultText: 'Aviso formal sobre posibles irregularidades cometidas en instituciones del Estado, que activa los mecanismos internos de investigación.', maxLength: 320, multiline: true },
  { key: 'definiciones.def2_title', section: 'definiciones', label: 'Definición 2 — Título', description: 'Título de la segunda tarjeta de definición.', defaultText: 'Irregularidad', maxLength: 80, multiline: false },
  { key: 'definiciones.def2_desc', section: 'definiciones', label: 'Definición 2 — Descripción', description: 'Texto de la segunda tarjeta de definición.', defaultText: 'Acto u omisión que se aparta de normas, procedimientos o principios establecidos en el ordenamiento jurídico.', maxLength: 320, multiline: true },
  { key: 'definiciones.def3_title', section: 'definiciones', label: 'Definición 3 — Título', description: 'Título de la tercera tarjeta de definición.', defaultText: 'Falta ética', maxLength: 80, multiline: false },
  { key: 'definiciones.def3_desc', section: 'definiciones', label: 'Definición 3 — Descripción', description: 'Texto de la tercera tarjeta de definición.', defaultText: 'Conducta contraria a los principios de integridad, honestidad y transparencia que rigen la función pública.', maxLength: 320, multiline: true },
  { key: 'definiciones.def4_title', section: 'definiciones', label: 'Definición 4 — Título', description: 'Título de la cuarta tarjeta de definición.', defaultText: 'Acto de corrupción', maxLength: 80, multiline: false },
  { key: 'definiciones.def4_desc', section: 'definiciones', label: 'Definición 4 — Descripción', description: 'Texto de la cuarta tarjeta de definición.', defaultText: 'Uso indebido de cargos, recursos públicos o influencias para obtener beneficios personales o de terceros.', maxLength: 320, multiline: true },
  { key: 'definiciones.def5_title', section: 'definiciones', label: 'Definición 5 — Título', description: 'Título de la quinta tarjeta de definición.', defaultText: 'Canal de denuncia', maxLength: 80, multiline: false },
  { key: 'definiciones.def5_desc', section: 'definiciones', label: 'Definición 5 — Descripción', description: 'Texto de la quinta tarjeta de definición.', defaultText: 'Mecanismo oficial habilitado por las instituciones del Organismo Ejecutivo para recibir reportes sobre irregularidades administrativas, promoviendo la transparencia y la rendición de cuentas.', maxLength: 360, multiline: true },

  // Dashboard CNC
  { key: 'dashboard.tag', section: 'dashboard_cnc', label: 'Etiqueta del Dashboard CNC', description: 'Etiqueta superior del bloque de cumplimiento del protocolo CNC.', defaultText: 'Transparencia e Indicadores', maxLength: 80, multiline: false },
  { key: 'dashboard.title', section: 'dashboard_cnc', label: 'Título del Dashboard CNC', description: 'Título principal de la sección Dashboard de Cumplimiento CNC.', defaultText: 'Dashboard de Cumplimiento del Protocolo CNC', maxLength: 120, multiline: false },
  { key: 'dashboard.sub', section: 'dashboard_cnc', label: 'Subtítulo del Dashboard CNC', description: 'Descripción introductoria del monitoreo del protocolo CNC.', defaultText: 'Monitoreo en tiempo real del grado de adopción del protocolo estándar de la Comisión Nacional contra la Corrupción (CNC) en el Organismo Ejecutivo.', maxLength: 320, multiline: true },
  { key: 'dashboard.toggle_hint', section: 'dashboard_cnc', label: 'Texto guía para desplegar Dashboard', description: 'Indicación breve junto al botón de mostrar u ocultar el dashboard.', defaultText: 'Haz clic para desplegar u ocultar las estadísticas y métricas de cumplimiento', maxLength: 180, multiline: false },
  { key: 'dashboard.table_title', section: 'dashboard_cnc', label: 'Título de tabla de adopción CNC', description: 'Encabezado sobre la tabla de cumplimiento por institución.', defaultText: 'Detalle de Adopción por Institución', maxLength: 100, multiline: false },
  { key: 'dashboard.table_sub', section: 'dashboard_cnc', label: 'Subtítulo de tabla de adopción CNC', description: 'Texto explicativo debajo del título de la tabla.', defaultText: 'Estado verificado de cada dependencia según los estándares de la Comisión Nacional contra la Corrupción', maxLength: 240, multiline: true },

  // Vigilando
  { key: 'vigilando.eyebrow', section: 'vigilando', label: 'Cintillo de "Vigilando la Integridad"', description: 'Etiqueta superior de la tarjeta promocional de Vigilando.', defaultText: 'Plataforma oficial de denuncias', maxLength: 80, multiline: false },
  { key: 'vigilando.title_line1', section: 'vigilando', label: 'Titular Vigilando — Línea 1', description: 'Primera línea del titular de la sección Vigilando.', defaultText: '¿Identificaste una', maxLength: 50, multiline: false },
  { key: 'vigilando.title_line2', section: 'vigilando', label: 'Titular Vigilando — Línea 2', description: 'Segunda línea del titular antes de la frase destacada.', defaultText: 'irregularidad?', maxLength: 50, multiline: false },
  { key: 'vigilando.title_em1', section: 'vigilando', label: 'Titular Vigilando — Destacado 1', description: 'Primera parte de la frase enfatizada en cian.', defaultText: 'Denuncia', maxLength: 40, multiline: false },
  { key: 'vigilando.title_em2', section: 'vigilando', label: 'Titular Vigilando — Destacado 2', description: 'Segunda parte de la frase enfatizada en cian.', defaultText: 'en línea', maxLength: 40, multiline: false },
  { key: 'vigilando.desc_brand', section: 'vigilando', label: 'Descripción Vigilando — Nombre destacado', description: 'Nombre en negrita al inicio del párrafo de Vigilando.', defaultText: 'Vigilando la Integridad', maxLength: 80, multiline: false },
  { key: 'vigilando.desc_body', section: 'vigilando', label: 'Descripción Vigilando — Texto', description: 'Continuación del párrafo informativo de Vigilando.', defaultText: 'es el canal oficial del Gobierno de Guatemala para recibir y gestionar denuncias administrativas las 24 horas. Conoce qué puedes denunciar, cómo opera la plataforma y las herramientas a tu disposición.', maxLength: 420, multiline: true },
  { key: 'vigilando.cta_primary', section: 'vigilando', label: 'Botón principal Vigilando', description: 'Texto del botón para abrir el portal de denuncias.', defaultText: 'Ir a denunciar', maxLength: 50, multiline: false },
  { key: 'vigilando.cta_secondary', section: 'vigilando', label: 'Botón secundario Vigilando', description: 'Texto del botón informativo de Vigilando.', defaultText: 'Conoce más', maxLength: 50, multiline: false },
  { key: 'vigilando.badge', section: 'vigilando', label: 'Insignia de confianza Vigilando', description: 'Etiqueta destacada sobre las tarjetas de atributos.', defaultText: '100% Confidencial', maxLength: 50, multiline: false },
  { key: 'vigilando.feat1_title', section: 'vigilando', label: 'Garantía 1 — Título', description: 'Título de la primera tarjeta de atributo.', defaultText: 'Disponible 24/7', maxLength: 60, multiline: false },
  { key: 'vigilando.feat1_desc', section: 'vigilando', label: 'Garantía 1 — Descripción', description: 'Descripción de la primera tarjeta de atributo.', defaultText: 'Presenta tu denuncia en cualquier momento, desde cualquier dispositivo.', maxLength: 200, multiline: true },
  { key: 'vigilando.feat2_title', section: 'vigilando', label: 'Garantía 2 — Título', description: 'Título de la segunda tarjeta de atributo.', defaultText: 'Protección al denunciante', maxLength: 60, multiline: false },
  { key: 'vigilando.feat2_desc', section: 'vigilando', label: 'Garantía 2 — Descripción', description: 'Descripción de la segunda tarjeta de atributo.', defaultText: 'Tu identidad y datos personales están protegidos conforme a la ley.', maxLength: 200, multiline: true },
  { key: 'vigilando.feat3_title', section: 'vigilando', label: 'Garantía 3 — Título', description: 'Título de la tercera tarjeta de atributo.', defaultText: 'Seguimiento en línea', maxLength: 60, multiline: false },
  { key: 'vigilando.feat3_desc', section: 'vigilando', label: 'Garantía 3 — Descripción', description: 'Descripción de la tercera tarjeta de atributo.', defaultText: 'Consulta el estado de tu denuncia directamente desde la plataforma.', maxLength: 200, multiline: true },
  { key: 'vigilando.feat4_title', section: 'vigilando', label: 'Garantía 4 — Título', description: 'Título de la cuarta tarjeta de atributo.', defaultText: 'Gestión institucional', maxLength: 60, multiline: false },
  { key: 'vigilando.feat4_desc', section: 'vigilando', label: 'Garantía 4 — Descripción', description: 'Descripción de la cuarta tarjeta de atributo.', defaultText: 'Cada denuncia es recibida por la Instancia de Probidad correspondiente.', maxLength: 200, multiline: true },

  // FAQ
  { key: 'faq.tag', section: 'faq', label: 'Etiqueta de Preguntas frecuentes', description: 'Etiqueta superior de la sección FAQ.', defaultText: 'Preguntas frecuentes', maxLength: 60, multiline: false },
  { key: 'faq.title', section: 'faq', label: 'Título de Preguntas frecuentes', description: 'Título principal de la sección FAQ.', defaultText: 'Resolvemos tus dudas', maxLength: 100, multiline: false },
  { key: 'faq.sub', section: 'faq', label: 'Subtítulo de Preguntas frecuentes', description: 'Descripción introductoria de la sección FAQ.', defaultText: 'Respuestas a las consultas más comunes sobre la plataforma.', maxLength: 240, multiline: true },
  { key: 'faq.q1', section: 'faq', label: 'FAQ 1 — Pregunta', description: 'Primera pregunta frecuente.', defaultText: '¿Puedo consultar los canales sin presentar una denuncia?', maxLength: 180, multiline: false },
  { key: 'faq.a1', section: 'faq', label: 'FAQ 1 — Respuesta', description: 'Respuesta de la primera pregunta frecuente.', defaultText: 'Sí. La plataforma permite explorar libremente todos los canales habilitados sin necesidad de ingresar datos personales.', maxLength: 500, multiline: true },
  { key: 'faq.q2', section: 'faq', label: 'FAQ 2 — Pregunta', description: 'Segunda pregunta frecuente.', defaultText: '¿Qué tipo de hechos puedo denunciar?', maxLength: 180, multiline: false },
  { key: 'faq.a2', section: 'faq', label: 'FAQ 2 — Respuesta', description: 'Respuesta de la segunda pregunta frecuente.', defaultText: 'Actos que constituyan faltas éticas, corrupción, abuso de autoridad o irregularidades administrativas en el Organismo Ejecutivo.', maxLength: 500, multiline: true },
  { key: 'faq.q3', section: 'faq', label: 'FAQ 3 — Pregunta', description: 'Tercera pregunta frecuente.', defaultText: '¿Quién recibe la denuncia?', maxLength: 180, multiline: false },
  { key: 'faq.a3', section: 'faq', label: 'FAQ 3 — Respuesta', description: 'Respuesta de la tercera pregunta frecuente.', defaultText: 'La Instancia de Asuntos de Probidad de cada institución es la responsable de recibir y tramitar las denuncias administrativas.', maxLength: 500, multiline: true },
  { key: 'faq.q4', section: 'faq', label: 'FAQ 4 — Pregunta', description: 'Cuarta pregunta frecuente.', defaultText: '¿Todas las instituciones tienen canales?', maxLength: 180, multiline: false },
  { key: 'faq.a4', section: 'faq', label: 'FAQ 4 — Respuesta', description: 'Respuesta de la cuarta pregunta frecuente.', defaultText: 'Aún no todas, pero la plataforma se actualiza constantemente conforme las instituciones habilitan sus mecanismos.', maxLength: 500, multiline: true },
  { key: 'faq.q5', section: 'faq', label: 'FAQ 5 — Pregunta', description: 'Quinta pregunta frecuente.', defaultText: '¿Qué hacer si mi institución no aparece?', maxLength: 180, multiline: false },
  { key: 'faq.a5_prefix', section: 'faq', label: 'FAQ 5 — Respuesta (Inicio)', description: 'Texto previo al enlace de correo electrónico.', defaultText: 'Escríbenos a', maxLength: 100, multiline: false },
  { key: 'faq.a5_suffix', section: 'faq', label: 'FAQ 5 — Respuesta (Cierre)', description: 'Texto posterior al enlace de correo electrónico.', defaultText: 'y gestionaremos la incorporación.', maxLength: 180, multiline: false },

  // Footer
  { key: 'footer.brand_phrase', section: 'footer', label: 'Descripción del pie de página', description: 'Párrafo debajo de los logotipos en la primera columna del pie de página.', defaultText: 'Listado público y actualizado de canales de denuncia administrativa del Organismo Ejecutivo de Guatemala.', maxLength: 300, multiline: true },
  { key: 'footer.security_title', section: 'footer', label: 'Pie de página — Título confidencialidad', description: 'Encabezado destacado de la tarjeta verde en el pie de página.', defaultText: 'Confidencialidad y Seguridad:', maxLength: 80, multiline: false },
  { key: 'footer.security_text', section: 'footer', label: 'Pie de página — Texto confidencialidad', description: 'Mensaje de confidencialidad en el recuadro inferior izquierdo.', defaultText: 'Garantizamos el tratamiento reservado, seguro y protegido de cada denuncia administrativa en apego a los estándares de integridad pública.', maxLength: 320, multiline: true },
  { key: 'footer.col1_title', section: 'footer', label: 'Pie de página — Título columna 1', description: 'Encabezado de la columna Reporta irregularidades.', defaultText: 'Reporta irregularidades', maxLength: 60, multiline: false },
  { key: 'footer.col2_title', section: 'footer', label: 'Pie de página — Título columna 2', description: 'Encabezado de la columna Explora datos.', defaultText: 'Explora datos', maxLength: 60, multiline: false },
  { key: 'footer.col3_title', section: 'footer', label: 'Pie de página — Título columna 3', description: 'Encabezado de la columna Accede a la información.', defaultText: 'Accede a la información', maxLength: 60, multiline: false },
  { key: 'footer.col4_title', section: 'footer', label: 'Pie de página — Subtítulo "Aprende"', description: 'Encabezado del bloque de formación en la tercera columna.', defaultText: 'Aprende', maxLength: 60, multiline: false },
  { key: 'footer.col5_title', section: 'footer', label: 'Pie de página — Título de contacto', description: 'Encabezado de la columna de contacto y redes sociales.', defaultText: 'Contacto', maxLength: 60, multiline: false },
  { key: 'footer.contact_email', section: 'footer', label: 'Pie de página — Correo visible', description: 'Texto del correo visible en el pie de página.', defaultText: 'info@pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.contact_web', section: 'footer', label: 'Pie de página — Sitio web visible', description: 'Texto del enlace web visible en el pie de página.', defaultText: 'pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.copyright', section: 'footer', label: 'Aviso de derechos / Pie inferior', description: 'Texto institucional al pie de la página.', defaultText: '© Gobierno de Guatemala 2025. Comprometidos con la integridad pública.', maxLength: 180, multiline: false }
];

// ========================================================
// 4. RIESGO EN LA MIRA
// ========================================================
const RIESGO_SECTIONS = [
  {
    id: 'header',
    label: 'Encabezado y Navegación',
    icon: 'fa-compass',
    description: 'Etiquetas principales de la barra superior de navegación.'
  },
  {
    id: 'hero',
    label: 'Portada Principal (Hero) y Panel de Estado',
    icon: 'fa-star',
    description: 'Cintillo, lema, descripción, pilares, botones, etiquetas del semáforo y cinta de cifras.'
  },
  {
    id: 'que_mide',
    label: 'Sección "¿Qué mide este sistema?"',
    icon: 'fa-clipboard-check',
    description: 'Encabezado y tarjetas explicativas de lo que SÍ mide y lo que NO mide la plataforma.'
  },
  {
    id: 'cumplir',
    label: 'Sección "¿Qué significa cumplir?"',
    icon: 'fa-tasks',
    description: 'Tres pasos metodológicos de cumplimiento y nota metodológica inferior.'
  },
  {
    id: 'riesgos_frecuentes',
    label: 'Sección "Riesgos más frecuentes"',
    icon: 'fa-exclamation-triangle',
    description: 'Encabezado, subtítulo y nota inferior sobre patrones de corrupción frecuentes.'
  },
  {
    id: 'datos_gestion',
    label: 'Sección "Datos de la gestión"',
    icon: 'fa-chart-pie',
    description: 'Encabezado y subtítulo del resumen de indicadores del ciclo.'
  },
  {
    id: 'catalogo',
    label: 'Catálogo de Instituciones',
    icon: 'fa-table',
    description: 'Encabezado, descripción y nota aclaratoria sobre indicadores adicionales.'
  },
  {
    id: 'comparador',
    label: 'Nivel de Cumplimiento (Gráficos)',
    icon: 'fa-chart-line',
    description: 'Encabezado, subtítulo y nota de uso del comparador visual entre años.'
  },
  {
    id: 'abordaje',
    label: 'Abordaje Técnico',
    icon: 'fa-microscope',
    description: 'Marco metodológico, cuatro tarjetas técnicas y cita institucional de cierre.'
  },
  {
    id: 'footer',
    label: 'Pie de página (Footer)',
    icon: 'fa-shoe-prints',
    description: 'Descripción institucional, títulos de columnas, datos de contacto visibles y derechos.'
  }
];

const RIESGO_CATALOG = [
  // Header
  { key: 'header.nav_accede', section: 'header', label: 'Menú superior: Grupo 1', description: 'Etiqueta del primer menú desplegable en el encabezado.', defaultText: 'Accede', maxLength: 30, multiline: false },
  { key: 'header.nav_explora', section: 'header', label: 'Menú superior: Grupo 2', description: 'Etiqueta del segundo menú desplegable en el encabezado.', defaultText: 'Explora', maxLength: 30, multiline: false },
  { key: 'header.nav_aprende', section: 'header', label: 'Menú superior: Grupo 3', description: 'Etiqueta del tercer menú desplegable en el encabezado.', defaultText: 'Aprende', maxLength: 30, multiline: false },
  { key: 'header.nav_reporta', section: 'header', label: 'Menú superior: Grupo 4', description: 'Etiqueta del cuarto menú desplegable en el encabezado.', defaultText: 'Reporta', maxLength: 30, multiline: false },

  // Hero & Panel
  { key: 'hero.eyebrow', section: 'hero', label: 'Cintillo superior de portada', description: 'Etiqueta breve ubicada encima del logotipo en la portada.', defaultText: 'Gestión de Riesgos - Gobierno de Guatemala · Organismo Ejecutivo', maxLength: 120, multiline: false },
  { key: 'hero.lema', section: 'hero', label: 'Subtítulo destacado de portada', description: 'Frase en cian debajo del logotipo de Riesgo en la Mira.', defaultText: 'Identificación de riesgos, análisis y presentación a máxima autoridad', maxLength: 140, multiline: false },
  { key: 'hero.sub', section: 'hero', label: 'Párrafo descriptivo (Hero)', description: 'Descripción introductoria sobre el monitoreo GRC.', defaultText: 'Monitoreo público de la debida gestión de riesgos de Corrupción (GRC) en las Instituciones del Organismo Ejecutivo de Guatemala, que puedan afectar la integridad, transparencia y adecuada administración de los recursos públicos.', maxLength: 480, multiline: true },
  { key: 'hero.pill1', section: 'hero', label: 'Pilar Hero 1', description: 'Primera cápsula debajo de la descripción principal.', defaultText: 'Identificación', maxLength: 40, multiline: false },
  { key: 'hero.pill2', section: 'hero', label: 'Pilar Hero 2', description: 'Segunda cápsula debajo de la descripción principal.', defaultText: 'Análisis y evaluación', maxLength: 40, multiline: false },
  { key: 'hero.pill3', section: 'hero', label: 'Pilar Hero 3', description: 'Tercera cápsula debajo de la descripción principal.', defaultText: 'Tratamiento', maxLength: 40, multiline: false },
  { key: 'hero.pill4', section: 'hero', label: 'Pilar Hero 4', description: 'Cuarta cápsula debajo de la descripción principal.', defaultText: 'Monitoreo', maxLength: 40, multiline: false },
  { key: 'hero.cta_primary', section: 'hero', label: 'Botón principal de portada', description: 'Botón que desplaza hacia el catálogo de instituciones.', defaultText: 'Ver catálogo', maxLength: 50, multiline: false },
  { key: 'hero.cta_secondary', section: 'hero', label: 'Botón secundario de portada', description: 'Botón que desplaza hacia Datos de la gestión.', defaultText: 'Ver datos', maxLength: 50, multiline: false },
  { key: 'hero.panel_title', section: 'hero', label: 'Panel de semáforo — Título', description: 'Encabezado del recuadro lateral de estado de cumplimiento.', defaultText: 'Estado de cumplimiento', maxLength: 60, multiline: false },
  { key: 'hero.sem_cumple', section: 'hero', label: 'Semáforo — Etiqueta Verde', description: 'Etiqueta de la celda verde del panel lateral.', defaultText: 'Cumplen', maxLength: 40, multiline: false },
  { key: 'hero.sem_parcial', section: 'hero', label: 'Semáforo — Etiqueta Amarilla', description: 'Etiqueta de la celda amarilla del panel lateral.', defaultText: 'Parcial', maxLength: 40, multiline: false },
  { key: 'hero.sem_proceso', section: 'hero', label: 'Semáforo — Etiqueta Naranja', description: 'Etiqueta de la celda naranja del panel lateral.', defaultText: 'En proceso', maxLength: 40, multiline: false },
  { key: 'hero.sem_total', section: 'hero', label: 'Semáforo — Etiqueta Total', description: 'Etiqueta de la cuarta celda del panel lateral.', defaultText: 'Total instituciones', maxLength: 40, multiline: false },
  { key: 'hero.bar_buenas', section: 'hero', label: 'Panel lateral — Indicador 1', description: 'Etiqueta de la primera barra resumen del panel lateral.', defaultText: 'Aplicación de buenas prácticas GRC', maxLength: 80, multiline: false },
  { key: 'hero.bar_avanzado', section: 'hero', label: 'Panel lateral — Indicador 2', description: 'Etiqueta de la segunda barra resumen del panel lateral.', defaultText: 'Nivel avanzado', maxLength: 80, multiline: false },
  { key: 'hero.update_note', section: 'hero', label: 'Nota inferior del panel lateral', description: 'Texto de verificación debajo del selector de años.', defaultText: 'Datos verificados por CNC', maxLength: 80, multiline: false },
  { key: 'stats.ribbon_tag', section: 'hero', label: 'Encabezado de la cinta de cifras', description: 'Etiqueta superior sobre los KPIs del módulo.', defaultText: 'Indicadores del módulo', maxLength: 80, multiline: false },

  // Qué mide
  { key: 'que_mide.tag', section: 'que_mide', label: 'Etiqueta "¿Qué mide este sistema?"', description: 'Etiqueta superior en la sección de metodología.', defaultText: 'El sistema', maxLength: 60, multiline: false },
  { key: 'que_mide.title', section: 'que_mide', label: 'Título "¿Qué mide este sistema?"', description: 'Título principal de la tarjeta "¿Qué mide este sistema?".', defaultText: '¿Qué mide este sistema?', maxLength: 100, multiline: false },
  { key: 'que_mide.sub', section: 'que_mide', label: 'Subtítulo "¿Qué mide este sistema?"', description: 'Texto explicativo debajo del título.', defaultText: 'Conoce exactamente qué evalúa y qué no evalúa la plataforma, garantizando objetividad en la metodología.', maxLength: 260, multiline: true },
  { key: 'que_mide.si_title', section: 'que_mide', label: 'Tarjeta SÍ mide — Título', description: 'Título de la tarjeta verde "Lo que SÍ mide".', defaultText: '✅ Lo que SÍ mide', maxLength: 80, multiline: false },
  { key: 'que_mide.si_prefix', section: 'que_mide', label: 'Tarjeta SÍ mide — Inicio', description: 'Texto inicial antes de la frase destacada en negrita.', defaultText: 'Cada entidad del Organismo Ejecutivo debe agotar la metodología internamente, que consiste en la', maxLength: 220, multiline: true },
  { key: 'que_mide.si_emphasis', section: 'que_mide', label: 'Tarjeta SÍ mide — Frase destacada', description: 'Frase enfatizada en negrita dentro de la tarjeta "Lo que SÍ mide".', defaultText: 'identificación, análisis y presentación', maxLength: 120, multiline: false },
  { key: 'que_mide.si_suffix', section: 'que_mide', label: 'Tarjeta SÍ mide — Cierre', description: 'Continuación después de la frase destacada.', defaultText: 'a la máxima autoridad, esto último es lo verificado por la Comisión Nacional contra la Corrupción.', maxLength: 240, multiline: true },
  { key: 'que_mide.no_title', section: 'que_mide', label: 'Tarjeta NO mide — Título', description: 'Título de la tarjeta "Lo que NO mide".', defaultText: '🚫 Lo que NO mide', maxLength: 80, multiline: false },
  { key: 'que_mide.no_desc', section: 'que_mide', label: 'Tarjeta NO mide — Descripción', description: 'Texto explicativo de lo que no evalúa la plataforma.', defaultText: 'La implementación de controles internos específicos. Los documentos de análisis de riesgos son de uso interno de cada entidad con el fin de preservar la objetividad del proceso y evitar ejercicios meramente formales de cumplimiento.', maxLength: 420, multiline: true },

  // Cumplir
  { key: 'cumplir.tag', section: 'cumplir', label: 'Etiqueta "¿Qué significa cumplir?"', description: 'Etiqueta superior de la sección de 3 pasos.', defaultText: 'Proceso', maxLength: 60, multiline: false },
  { key: 'cumplir.title', section: 'cumplir', label: 'Título "¿Qué significa cumplir?"', description: 'Título principal de la sección de cumplimiento.', defaultText: '¿Qué significa cumplir?', maxLength: 100, multiline: false },
  { key: 'cumplir.sub', section: 'cumplir', label: 'Subtítulo "¿Qué significa cumplir?"', description: 'Descripción breve de los tres pasos verificados.', defaultText: 'Tres pasos verificados que definen el cumplimiento del lineamiento de gestión de riesgos de corrupción.', maxLength: 240, multiline: true },
  { key: 'cumplir.step1_title', section: 'cumplir', label: 'Paso 01 — Título', description: 'Título de la primera etapa de cumplimiento.', defaultText: 'Identificación de riesgos', maxLength: 80, multiline: false },
  { key: 'cumplir.step1_desc', section: 'cumplir', label: 'Paso 01 — Descripción', description: 'Descripción de la primera etapa.', defaultText: 'Elaboración de un catálogo de eventos de corrupción potenciales específicos de la institución, por proceso y área crítica.', maxLength: 300, multiline: true },
  { key: 'cumplir.step1_badge', section: 'cumplir', label: 'Paso 01 — Insignia', description: 'Etiqueta inferior de la primera tarjeta.', defaultText: 'Paso fundamental', maxLength: 40, multiline: false },
  { key: 'cumplir.step2_title', section: 'cumplir', label: 'Paso 02 — Título', description: 'Título de la segunda etapa de cumplimiento.', defaultText: 'Análisis de riesgos', maxLength: 80, multiline: false },
  { key: 'cumplir.step2_desc', section: 'cumplir', label: 'Paso 02 — Descripción', description: 'Descripción de la segunda etapa.', defaultText: 'Valoración de la probabilidad e impacto de cada riesgo identificado para priorizar y enfocar los esfuerzos de mitigación.', maxLength: 300, multiline: true },
  { key: 'cumplir.step2_badge', section: 'cumplir', label: 'Paso 02 — Insignia', description: 'Etiqueta inferior de la segunda tarjeta.', defaultText: 'Priorización', maxLength: 40, multiline: false },
  { key: 'cumplir.step3_title', section: 'cumplir', label: 'Paso 03 — Título', description: 'Título de la tercera etapa de cumplimiento.', defaultText: 'Presentación a máxima autoridad', maxLength: 80, multiline: false },
  { key: 'cumplir.step3_desc', section: 'cumplir', label: 'Paso 03 — Descripción', description: 'Descripción de la tercera etapa.', defaultText: 'Validación formal ante la autoridad superior de la institución, verificada por la CNC mediante acta documentada.', maxLength: 300, multiline: true },
  { key: 'cumplir.step3_badge', section: 'cumplir', label: 'Paso 03 — Insignia', description: 'Etiqueta inferior de la tercera tarjeta.', defaultText: 'Verificado CNC', maxLength: 40, multiline: false },
  { key: 'cumplir.note', section: 'cumplir', label: 'Nota metodológica inferior', description: 'Nota informativa centrada al pie de los tres pasos.', defaultText: 'Los documentos de análisis de riesgos son de uso interno de cada entidad con el fin de preservar la objetividad del proceso y evitar ejercicios meramente formales de cumplimiento.', maxLength: 360, multiline: true },

  // Riesgos frecuentes
  { key: 'riesgos.tag', section: 'riesgos_frecuentes', label: 'Etiqueta de Riesgos frecuentes', description: 'Etiqueta superior de la sección de riesgos frecuentes.', defaultText: 'Contexto', maxLength: 60, multiline: false },
  { key: 'riesgos.title', section: 'riesgos_frecuentes', label: 'Título de Riesgos frecuentes', description: 'Título principal de la sección de patrones frecuentes.', defaultText: 'Riesgos de corrupción más frecuentes', maxLength: 100, multiline: false },
  { key: 'riesgos.sub', section: 'riesgos_frecuentes', label: 'Subtítulo de Riesgos frecuentes', description: 'Descripción introductoria sobre los patrones identificados.', defaultText: 'Patrones de corrupción identificados por la CNC en el Organismo Ejecutivo. Haz clic en "Ver más" para conocer el detalle.', maxLength: 260, multiline: true },
  { key: 'riesgos.note', section: 'riesgos_frecuentes', label: 'Nota inferior de Riesgos frecuentes', description: 'Nota al pie del bloque de riesgos frecuentes.', defaultText: 'Estos patrones se actualizan periódicamente considerando los actos de corrupción reportados y las tendencias de denuncia.', maxLength: 260, multiline: true },

  // Datos de gestión
  { key: 'datos.tag', section: 'datos_gestion', label: 'Etiqueta "Datos de la gestión"', description: 'Etiqueta superior de la sección de indicadores del ciclo.', defaultText: 'Indicadores', maxLength: 60, multiline: false },
  { key: 'datos.title', section: 'datos_gestion', label: 'Título "Datos de la gestión"', description: 'Título principal de la sección de resumen de indicadores.', defaultText: '📊 Datos de la gestión', maxLength: 100, multiline: false },
  { key: 'datos.sub', section: 'datos_gestion', label: 'Subtítulo "Datos de la gestión"', description: 'Descripción breve del resumen de cumplimiento del ciclo actual.', defaultText: 'Resumen del estado de cumplimiento del ciclo actual, verificado conforme al lineamiento vigente.', maxLength: 240, multiline: true },

  // Catálogo
  { key: 'catalogo.tag', section: 'catalogo', label: 'Etiqueta de Catálogo de instituciones', description: 'Etiqueta superior encima del título del catálogo.', defaultText: 'Directorio', maxLength: 60, multiline: false },
  { key: 'catalogo.title', section: 'catalogo', label: 'Título de Catálogo de instituciones', description: 'Título principal de la tabla de cumplimiento.', defaultText: 'Catálogo de instituciones', maxLength: 100, multiline: false },
  { key: 'catalogo.sub', section: 'catalogo', label: 'Subtítulo de Catálogo de instituciones', description: 'Descripción debajo del título del catálogo.', defaultText: 'Estado de cumplimiento en gestión de riesgos de corrupción por institución, sector y nivel de adopción.', maxLength: 240, multiline: true },
  { key: 'catalogo.note', section: 'catalogo', label: 'Nota aclaratoria del catálogo', description: 'Nota al pie de la tabla de instituciones.', defaultText: '"El proceso de adopción de buenas prácticas de Gestión de Riesgos de Corrupción GRC" y "Verificación hallazgos CGC" son indicadores adicionales no obligatorios.', maxLength: 320, multiline: true },

  // Comparador
  { key: 'comparador.tag', section: 'comparador', label: 'Etiqueta de Nivel de cumplimiento', description: 'Etiqueta superior de la sección de gráficos comparativos.', defaultText: 'Visualización', maxLength: 60, multiline: false },
  { key: 'comparador.title', section: 'comparador', label: 'Título de Nivel de cumplimiento', description: 'Título principal del comparador visual.', defaultText: '📋 Nivel de cumplimiento por institución', maxLength: 120, multiline: false },
  { key: 'comparador.sub', section: 'comparador', label: 'Subtítulo de Nivel de cumplimiento', description: 'Descripción introductoria del comparador de años.', defaultText: 'Compara el grado de cumplimiento entre años. Selecciona el tipo de gráfico: barras, líneas, áreas o pastel.', maxLength: 260, multiline: true },
  { key: 'comparador.note', section: 'comparador', label: 'Nota de uso de gráficos', description: 'Nota explicativa debajo del lienzo del gráfico.', defaultText: 'Para gráficos de barras/líneas/áreas: seleccione hasta 3 años y use paginación. Para gráfico de pastel: se muestra la distribución del primer año seleccionado.', maxLength: 300, multiline: true },

  // Abordaje técnico
  { key: 'abordaje.tag', section: 'abordaje', label: 'Etiqueta de Abordaje técnico', description: 'Etiqueta superior de la sección metodológica.', defaultText: 'Metodología', maxLength: 60, multiline: false },
  { key: 'abordaje.title', section: 'abordaje', label: 'Título de Abordaje técnico', description: 'Título principal de la sección Abordaje técnico.', defaultText: 'Abordaje técnico', maxLength: 100, multiline: false },
  { key: 'abordaje.sub', section: 'abordaje', label: 'Subtítulo de Abordaje técnico', description: 'Descripción introductoria de la metodología CNC.', defaultText: 'La CNC verifica la presentación a la máxima autoridad sin divulgar contenido analítico sensible, garantizando objetividad y solidez metodológica.', maxLength: 300, multiline: true },
  { key: 'abordaje.card1_title', section: 'abordaje', label: 'Tarjeta técnica 1 — Título', description: 'Título de la primera tarjeta técnica.', defaultText: 'Lineamiento vigente', maxLength: 80, multiline: false },
  { key: 'abordaje.card1_desc', section: 'abordaje', label: 'Tarjeta técnica 1 — Descripción', description: 'Descripción de la primera tarjeta técnica.', defaultText: 'Marco normativo actualizado para la gestión de riesgos de corrupción en el Organismo Ejecutivo.', maxLength: 260, multiline: true },
  { key: 'abordaje.card2_title', section: 'abordaje', label: 'Tarjeta técnica 2 — Título', description: 'Título de la segunda tarjeta técnica.', defaultText: 'Guía metodológica', maxLength: 80, multiline: false },
  { key: 'abordaje.card2_desc', section: 'abordaje', label: 'Tarjeta técnica 2 — Descripción', description: 'Descripción de la segunda tarjeta técnica.', defaultText: 'Documento técnico para identificar, analizar y priorizar riesgos con criterios verificables.', maxLength: 260, multiline: true },
  { key: 'abordaje.card3_title', section: 'abordaje', label: 'Tarjeta técnica 3 — Título', description: 'Título de la tercera tarjeta técnica.', defaultText: 'Verificación CNC', maxLength: 80, multiline: false },
  { key: 'abordaje.card3_desc', section: 'abordaje', label: 'Tarjeta técnica 3 — Descripción', description: 'Descripción de la tercera tarjeta técnica.', defaultText: 'La CNC valida mediante actas la presentación formal a la máxima autoridad institucional.', maxLength: 260, multiline: true },
  { key: 'abordaje.card4_title', section: 'abordaje', label: 'Tarjeta técnica 4 — Título', description: 'Título de la cuarta tarjeta técnica.', defaultText: 'Patrones de corrupción', maxLength: 80, multiline: false },
  { key: 'abordaje.card4_desc', section: 'abordaje', label: 'Tarjeta técnica 4 — Descripción', description: 'Descripción de la cuarta tarjeta técnica.', defaultText: 'Análisis de datos históricos de denuncias para generar alertas tempranas y tendencias.', maxLength: 260, multiline: true },
  { key: 'abordaje.quote', section: 'abordaje', label: 'Frase de cierre metodológico', description: 'Cita destacada al final de la sección Abordaje técnico.', defaultText: '"Publicamos el cumplimiento de la gestión de riesgos de corrupción y explicamos el método."', maxLength: 220, multiline: false },

  // Footer
  { key: 'footer.brand_phrase', section: 'footer', label: 'Descripción del pie de página', description: 'Párrafo debajo de los logotipos en la primera columna del pie de página.', defaultText: 'Tu Gobierno en Números — Tableros de Rendición de Cuentas del Organismo Ejecutivo.', maxLength: 300, multiline: true },
  { key: 'footer.col1_title', section: 'footer', label: 'Pie de página — Título columna 1', description: 'Encabezado de la columna Reporta irregularidades.', defaultText: 'Reporta irregularidades', maxLength: 60, multiline: false },
  { key: 'footer.col2_title', section: 'footer', label: 'Pie de página — Título columna 2', description: 'Encabezado de la columna Explora datos.', defaultText: 'Explora datos', maxLength: 60, multiline: false },
  { key: 'footer.col3_title', section: 'footer', label: 'Pie de página — Título columna 3', description: 'Encabezado de la columna Accede a la información.', defaultText: 'Accede a la información', maxLength: 60, multiline: false },
  { key: 'footer.col4_title', section: 'footer', label: 'Pie de página — Subtítulo "Aprende"', description: 'Encabezado del bloque de formación en la tercera columna.', defaultText: 'Aprende', maxLength: 60, multiline: false },
  { key: 'footer.col5_title', section: 'footer', label: 'Pie de página — Título de contacto', description: 'Encabezado de la columna de contacto y redes sociales.', defaultText: 'Contacto', maxLength: 60, multiline: false },
  { key: 'footer.contact_email', section: 'footer', label: 'Pie de página — Correo visible', description: 'Texto del correo visible en el pie de página.', defaultText: 'info@pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.contact_web', section: 'footer', label: 'Pie de página — Sitio web visible', description: 'Texto del enlace web visible en el pie de página.', defaultText: 'pia.gob.gt', maxLength: 100, multiline: false },
  { key: 'footer.copyright', section: 'footer', label: 'Aviso de derechos / Pie inferior', description: 'Texto institucional al pie de la página.', defaultText: '© Gobierno de Guatemala 2026. Comprometidos con la integridad pública.', maxLength: 180, multiline: false }
];

// ========================================================
// MAPA UNIFICADO DE DEFINICIONES POR MÓDULO
// ========================================================
export const MODULE_TEXT_DEFINITIONS = {
  directorio: {
    key: 'directorio',
    title: 'Directorio de Acceso al Ejecutivo',
    shortLabel: 'Directorio Ejecutivo',
    description: 'Edita de forma segura los títulos, bienvenidas, acordeón informativo, glosario, preguntas frecuentes y pie de página del Directorio de Acceso al Ejecutivo.',
    publicUrl: '/directorio/',
    fileName: 'module_texts_directorio.json',
    icon: 'fa-address-book',
    sections: DIRECTORIO_SECTIONS,
    catalog: DIRECTORIO_CATALOG,
    catalogMap: new Map(DIRECTORIO_CATALOG.map(e => [e.key, e]))
  },
  tableros: {
    key: 'tableros',
    title: 'Tu Gobierno en Números',
    shortLabel: 'Tu Gobierno en Números',
    description: 'Edita de forma segura los títulos, bienvenidas, atributos, nota de responsabilidad, preguntas frecuentes y pie de página de Tu Gobierno en Números.',
    publicUrl: '/gobierno_en_numeros/',
    fileName: 'module_texts_tableros.json',
    icon: 'fa-chart-bar',
    sections: TABLEROS_SECTIONS,
    catalog: TABLEROS_CATALOG,
    catalogMap: new Map(TABLEROS_CATALOG.map(e => [e.key, e]))
  },
  canales: {
    key: 'canales',
    title: 'Canales por la Integridad',
    shortLabel: 'Canales por la Integridad',
    description: 'Edita de forma segura los títulos, avisos de confidencialidad, definiciones, bloque de Vigilando, preguntas frecuentes y pie de página de Canales por la Integridad.',
    publicUrl: '/canales-por-la-integridad/',
    fileName: 'module_texts_canales.json',
    icon: 'fa-comments',
    sections: CANALES_SECTIONS,
    catalog: CANALES_CATALOG,
    catalogMap: new Map(CANALES_CATALOG.map(e => [e.key, e]))
  },
  riesgo: {
    key: 'riesgo',
    title: 'Riesgo en la Mira',
    shortLabel: 'Riesgo en la Mira',
    description: 'Edita de forma segura los títulos, etiquetas del semáforo, secciones metodológicas, catálogo, comparador y pie de página de Riesgo en la Mira.',
    publicUrl: '/riesgo/',
    fileName: 'module_texts_riesgo.json',
    icon: 'fa-bullseye',
    sections: RIESGO_SECTIONS,
    catalog: RIESGO_CATALOG,
    catalogMap: new Map(RIESGO_CATALOG.map(e => [e.key, e]))
  }
};

export function getModuleTextsDefinition(moduleKey) {
  const canonical = normalizeTextModuleKey(moduleKey);
  if (!canonical) return null;
  return MODULE_TEXT_DEFINITIONS[canonical] || null;
}

export function sanitizeAndValidateModuleText(moduleKey, key, rawValue) {
  const def = getModuleTextsDefinition(moduleKey);
  if (!def) {
    return { valid: false, error: `Módulo de textos no reconocido: "${moduleKey}".` };
  }
  const entry = def.catalogMap.get(String(key || '').trim());
  if (!entry) {
    return { valid: false, error: `Clave de texto no reconocida en el catálogo de "${def.shortLabel}": "${key}".` };
  }
  if (typeof rawValue !== 'string') {
    return { valid: false, error: `El valor para "${entry.label}" debe ser una cadena de texto.` };
  }

  let normalized = rawValue.replace(/\r\n/g, '\n');
  if (!entry.multiline) {
    normalized = normalized.replace(/[\r\n]+/g, ' ');
  }
  normalized = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

  if (!normalized) {
    return { valid: false, error: `El texto "${entry.label}" no puede quedar vacío.` };
  }
  if (normalized.length > entry.maxLength) {
    return {
      valid: false,
      error: `El texto "${entry.label}" excede el máximo permitido de ${entry.maxLength} caracteres (recibidos: ${normalized.length}).`
    };
  }
  for (const rx of DANGEROUS_TEXT_PATTERNS) {
    if (rx.test(normalized)) {
      return {
        valid: false,
        error: `El texto "${entry.label}" contiene etiquetas HTML o secuencias no permitidas. Ingrese únicamente texto plano.`
      };
    }
  }

  return { valid: true, value: normalized, entry };
}

export function normalizeModuleTextsDoc(moduleKey, rawDoc) {
  const def = getModuleTextsDefinition(moduleKey);
  if (!def) {
    throw new Error(`Módulo de textos no soportado: ${moduleKey}`);
  }

  const src = (rawDoc && typeof rawDoc === 'object' && !Array.isArray(rawDoc)) ? rawDoc : {};
  const rawOverrides = (src.overrides && typeof src.overrides === 'object' && !Array.isArray(src.overrides))
    ? src.overrides
    : {};

  const overrides = {};
  const texts = {};

  for (const entry of def.catalog) {
    const candidate = rawOverrides[entry.key];
    if (typeof candidate === 'string') {
      const check = sanitizeAndValidateModuleText(def.key, entry.key, candidate);
      if (check.valid && check.value !== entry.defaultText) {
        overrides[entry.key] = check.value;
        texts[entry.key] = check.value;
        continue;
      }
    }
    texts[entry.key] = entry.defaultText;
  }

  return {
    module: def.key,
    overrides,
    texts,
    updatedAt: src.updatedAt || null,
    updatedBy: src.updatedBy || null
  };
}
