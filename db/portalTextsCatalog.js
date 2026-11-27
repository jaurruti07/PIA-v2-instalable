// db/portalTextsCatalog.js
// Catálogo oficial y validación de textos estáticos editables del Portal Principal PIA (/index.html)

export const PORTAL_TEXT_SECTIONS = [
  {
    id: 'header',
    label: 'Encabezado y Navegación',
    icon: 'fa-compass',
    description: 'Marca institucional y etiquetas principales de la barra superior de navegación.'
  },
  {
    id: 'hero',
    label: 'Portada Principal (Hero)',
    icon: 'fa-star',
    description: 'Mensaje de bienvenida, título principal, subtítulo, botones de acción y encabezado de la cinta de cifras.'
  },
  {
    id: 'porque_existe',
    label: 'Sección "¿Por qué existe?"',
    icon: 'fa-info-circle',
    description: 'Texto institucional de presentación, propósito del portal y botones de acción de la banda principal.'
  },
  {
    id: 'inclusion',
    label: 'Inclusión Universal (Encabezado)',
    icon: 'fa-universal-access',
    description: 'Título, etiqueta y descripción introductoria del módulo de inclusión multilingüe y guiado auditivo.'
  },
  {
    id: 'todo_comienza',
    label: 'Sección "Todo comienza aquí"',
    icon: 'fa-rocket',
    description: 'Encabezado y las cuatro tarjetas introductorias de los pilares (Accede, Explora, Aprende, Reporta).'
  },
  {
    id: 'que_obtienes',
    label: 'Sección "¿Qué obtienes?"',
    icon: 'fa-gem',
    description: 'Bloque de valor y beneficios, destacados rápidos y las tres tarjetas informativas de uso ciudadano.'
  },
  {
    id: 'plataformas',
    label: 'Sección "Nuestras plataformas"',
    icon: 'fa-layer-group',
    description: 'Encabezado del ecosistema digital y textos descriptivos de cada tarjeta del carrusel de plataformas.'
  },
  {
    id: 'asi_funciona',
    label: 'Sección "Así funciona PIA"',
    icon: 'fa-diagram-project',
    description: 'Infografía en 6 pasos del flujo ciudadano y la barra inferior de garantías.'
  },
  {
    id: 'principios',
    label: 'Principios y Metodología',
    icon: 'fa-balance-scale',
    description: 'Fundamentos institucionales y las tres tarjetas de principios anticorrupción.'
  },
  {
    id: 'acceso_directo',
    label: 'Acceso Directo (Carrusel 3D)',
    icon: 'fa-th-large',
    description: 'Encabezado y descripciones breves de las tarjetas del carrusel interactivo de acceso directo.'
  },
  {
    id: 'footer',
    label: 'Pie de página (Footer)',
    icon: 'fa-shoe-prints',
    description: 'Frase institucional, títulos de columnas, datos de contacto visibles y aviso de derechos.'
  }
];

export const PORTAL_TEXT_CATALOG = [
  // 1. HEADER
  {
    key: 'header.pia_abbr',
    section: 'header',
    label: 'Sigla del portal (Encabezado)',
    description: 'Abreviatura destacada junto al logotipo oficial en la barra superior.',
    defaultText: 'PIA',
    maxLength: 20,
    multiline: false
  },
  {
    key: 'header.pia_name',
    section: 'header',
    label: 'Nombre del portal (Encabezado)',
    description: 'Nombre institucional mostrado junto a la sigla en la barra superior.',
    defaultText: 'Portal Integridad Activa',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'header.nav_accede',
    section: 'header',
    label: 'Menú superior: Grupo 1',
    description: 'Etiqueta del primer menú desplegable en el encabezado.',
    defaultText: 'Accede',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'header.nav_explora',
    section: 'header',
    label: 'Menú superior: Grupo 2',
    description: 'Etiqueta del segundo menú desplegable en el encabezado.',
    defaultText: 'Explora',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'header.nav_aprende',
    section: 'header',
    label: 'Menú superior: Grupo 3',
    description: 'Etiqueta del tercer menú desplegable en el encabezado.',
    defaultText: 'Aprende',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'header.nav_reporta',
    section: 'header',
    label: 'Menú superior: Grupo 4',
    description: 'Etiqueta del cuarto menú desplegable en el encabezado.',
    defaultText: 'Reporta',
    maxLength: 30,
    multiline: false
  },

  // 2. HERO
  {
    key: 'hero.eyebrow',
    section: 'hero',
    label: 'Cintillo superior de portada',
    description: 'Etiqueta breve ubicada encima del título principal en la portada.',
    defaultText: 'Transparencia — Gobierno de Guatemala · Organismo Ejecutivo',
    maxLength: 120,
    multiline: false
  },
  {
    key: 'hero.title_prefix',
    section: 'hero',
    label: 'Título principal — Primera línea',
    description: 'Primera parte del titular principal de la portada.',
    defaultText: 'Portal de',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'hero.title_highlight',
    section: 'hero',
    label: 'Título principal — Línea destacada',
    description: 'Segunda línea del titular principal con resaltado de color.',
    defaultText: 'Integridad Activa',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'hero.subtitle',
    section: 'hero',
    label: 'Subtítulo de bienvenida (Hero)',
    description: 'Párrafo introductorio debajo del título principal de la portada.',
    defaultText: 'Accede a información pública, explora datos abiertos, fortalece tus conocimientos sobre integridad y reporta irregularidades administrativas, todo desde un mismo ecosistema digital.',
    maxLength: 420,
    multiline: true
  },
  {
    key: 'hero.contact_label',
    section: 'hero',
    label: 'Etiqueta de correo visible en portada',
    description: 'Texto informativo de contacto mostrado en la cápsula debajo del subtítulo.',
    defaultText: 'info@pia.gob.gt',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'hero.cta_explore',
    section: 'hero',
    label: 'Botón secundario de portada',
    description: 'Texto del botón que desplaza hacia el carrusel de plataformas.',
    defaultText: 'Explorar plataformas',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'hero.cta_report',
    section: 'hero',
    label: 'Botón principal de portada',
    description: 'Texto del botón principal para presentar una denuncia en Vigilando.',
    defaultText: 'Presentar denuncia',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'stats.section_tag',
    section: 'hero',
    label: 'Encabezado de la cinta de cifras',
    description: 'Etiqueta superior sobre las métricas dinámicas del ecosistema en cifras.',
    defaultText: 'El ecosistema en cifras',
    maxLength: 80,
    multiline: false
  },

  // 3. POR QUE EXISTE
  {
    key: 'porque.tag',
    section: 'porque_existe',
    label: 'Etiqueta de sección "¿Por qué existe?"',
    description: 'Etiqueta superior en color cian de la banda de presentación institucional.',
    defaultText: '¿Por qué existe?',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'porque.lead_intro',
    section: 'porque_existe',
    label: 'Párrafo principal — Introducción',
    description: 'Texto inicial del bloque institucional antes de la frase destacada en cian.',
    defaultText: 'El Portal de Integridad Activa (PIA) nace para reunir en un solo lugar las plataformas, herramientas y servicios digitales de la Comisión Nacional Contra la Corrupción al servicio del Organismo Ejecutivo, para promover la',
    maxLength: 450,
    multiline: true
  },
  {
    key: 'porque.lead_emphasis',
    section: 'porque_existe',
    label: 'Párrafo principal — Frase destacada',
    description: 'Continuación enfatizada en color cian al cierre del párrafo principal.',
    defaultText: 'transparencia, el acceso a la información pública, la integridad institucional y la participación ciudadana',
    maxLength: 240,
    multiline: true
  },
  {
    key: 'porque.body_intro',
    section: 'porque_existe',
    label: 'Segundo párrafo — Introducción',
    description: 'Texto previo a las cuatro acciones destacadas en negrita.',
    defaultText: 'Su propósito es facilitar el acceso a la información, fortalecer la cultura de integridad y brindar mecanismos para que cualquier persona pueda',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'porque.body_verb_1',
    section: 'porque_existe',
    label: 'Segundo párrafo — Acción destacada 1',
    description: 'Primer verbo destacado en negrita cian.',
    defaultText: 'consultar',
    maxLength: 40,
    multiline: false
  },
  {
    key: 'porque.body_verb_2',
    section: 'porque_existe',
    label: 'Segundo párrafo — Acción destacada 2',
    description: 'Segundo verbo destacado en negrita cian.',
    defaultText: 'aprender',
    maxLength: 40,
    multiline: false
  },
  {
    key: 'porque.body_verb_3',
    section: 'porque_existe',
    label: 'Segundo párrafo — Acción destacada 3',
    description: 'Tercer verbo destacado en negrita cian.',
    defaultText: 'participar',
    maxLength: 40,
    multiline: false
  },
  {
    key: 'porque.body_verb_4',
    section: 'porque_existe',
    label: 'Segundo párrafo — Acción destacada 4',
    description: 'Cuarto verbo destacado en negrita cian.',
    defaultText: 'reportar',
    maxLength: 40,
    multiline: false
  },
  {
    key: 'porque.body_outro',
    section: 'porque_existe',
    label: 'Segundo párrafo — Cierre',
    description: 'Frase final después de los cuatro verbos destacados.',
    defaultText: 'de forma sencilla y segura.',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'porque.cta_explore',
    section: 'porque_existe',
    label: 'Botón "Explorar plataformas" (¿Por qué existe?)',
    description: 'Primer botón de acción dentro de la tarjeta "¿Por qué existe?".',
    defaultText: 'Explorar plataformas',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'porque.cta_report',
    section: 'porque_existe',
    label: 'Botón "Denunciar" (¿Por qué existe?)',
    description: 'Segundo botón de acción dentro de la tarjeta "¿Por qué existe?".',
    defaultText: 'Denunciar',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'porque.cta_inclusion',
    section: 'porque_existe',
    label: 'Botón de Inclusión Universal',
    description: 'Etiqueta del botón que despliega el módulo de Inclusión Universal y Guiado.',
    defaultText: 'Inclusión Universal y Guiado',
    maxLength: 60,
    multiline: false
  },

  // 4. INCLUSION UNIVERSAL (SOLO ENCABEZADO ESTATICO)
  {
    key: 'inclusion.badge',
    section: 'inclusion',
    label: 'Etiqueta del módulo Inclusión Universal',
    description: 'Insignia superior del panel desplegable de inclusión y guiado auditivo.',
    defaultText: 'Inclusión Universal y Guiado Auditivo',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'inclusion.title',
    section: 'inclusion',
    label: 'Título del módulo Inclusión Universal',
    description: 'Título principal del panel de explicación en idiomas originarios e inglés.',
    defaultText: 'Explicación del Portal en Idiomas Originarios e Inglés',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'inclusion.subtitle',
    section: 'inclusion',
    label: 'Descripción del módulo Inclusión Universal',
    description: 'Subtítulo explicativo debajo del título de Inclusión Universal.',
    defaultText: "Consulte y escuche la síntesis del Portal de Integridad Activa en español, inglés e idiomas mayas originarios (K'iche', Q'eqchi', Kaqchikel y Mam)",
    maxLength: 320,
    multiline: true
  },

  // 5. TODO COMIENZA AQUI
  {
    key: 'comienza.tag',
    section: 'todo_comienza',
    label: 'Etiqueta superior "Todo comienza aquí"',
    description: 'Etiqueta sobre el título "Todo comienza aquí".',
    defaultText: 'Portal de Integridad Activa',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'comienza.title',
    section: 'todo_comienza',
    label: 'Título de sección "Todo comienza aquí"',
    description: 'Título principal de la tarjeta blanca introductoria.',
    defaultText: 'Todo comienza aquí',
    maxLength: 90,
    multiline: false
  },
  {
    key: 'comienza.subtitle_prefix',
    section: 'todo_comienza',
    label: 'Subtítulo "Todo comienza aquí" — Inicio',
    description: 'Texto inicial antes de los pilares destacados (acceder, explorar, aprender, participar).',
    defaultText: 'Descubre las herramientas del Portal de Integridad Activa para',
    maxLength: 220,
    multiline: true
  },
  {
    key: 'comienza.subtitle_suffix',
    section: 'todo_comienza',
    label: 'Subtítulo "Todo comienza aquí" — Cierre',
    description: 'Texto final después de los pilares destacados.',
    defaultText: 'fortaleciendo una gestión pública más transparente e íntegra.',
    maxLength: 220,
    multiline: true
  },
  {
    key: 'comienza.card1_title',
    section: 'todo_comienza',
    label: 'Pilar 1 — Título',
    description: 'Título de la primera tarjeta en "Todo comienza aquí".',
    defaultText: 'Accede',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'comienza.card1_desc',
    section: 'todo_comienza',
    label: 'Pilar 1 — Descripción',
    description: 'Descripción breve de la primera tarjeta.',
    defaultText: 'Consulta información pública y servicios institucionales.',
    maxLength: 220,
    multiline: true
  },
  {
    key: 'comienza.card2_title',
    section: 'todo_comienza',
    label: 'Pilar 2 — Título',
    description: 'Título de la segunda tarjeta en "Todo comienza aquí".',
    defaultText: 'Explora',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'comienza.card2_desc',
    section: 'todo_comienza',
    label: 'Pilar 2 — Descripción',
    description: 'Descripción breve de la segunda tarjeta.',
    defaultText: 'Visualiza datos, indicadores y plataformas de transparencia.',
    maxLength: 220,
    multiline: true
  },
  {
    key: 'comienza.card3_title',
    section: 'todo_comienza',
    label: 'Pilar 3 — Título',
    description: 'Título de la tercera tarjeta en "Todo comienza aquí".',
    defaultText: 'Aprende',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'comienza.card3_desc',
    section: 'todo_comienza',
    label: 'Pilar 3 — Descripción',
    description: 'Descripción breve de la tercera tarjeta.',
    defaultText: 'Fortalece tus conocimientos sobre integridad y ética pública.',
    maxLength: 220,
    multiline: true
  },
  {
    key: 'comienza.card4_title',
    section: 'todo_comienza',
    label: 'Pilar 4 — Título',
    description: 'Título de la cuarta tarjeta en "Todo comienza aquí".',
    defaultText: 'Reporta',
    maxLength: 50,
    multiline: false
  },
  {
    key: 'comienza.card4_desc',
    section: 'todo_comienza',
    label: 'Pilar 4 — Descripción',
    description: 'Descripción breve de la cuarta tarjeta.',
    defaultText: 'Utiliza los mecanismos oficiales para participar activamente.',
    maxLength: 220,
    multiline: true
  },

  // 6. QUE OBTIENES
  {
    key: 'obtienes.tag',
    section: 'que_obtienes',
    label: 'Etiqueta de sección "¿Qué obtienes?"',
    description: 'Etiqueta superior encima del título "¿Qué obtienes?".',
    defaultText: 'Valor y beneficios',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'obtienes.title',
    section: 'que_obtienes',
    label: 'Título de sección "¿Qué obtienes?"',
    description: 'Título principal de la sección de beneficios.',
    defaultText: '¿Qué obtienes?',
    maxLength: 90,
    multiline: false
  },
  {
    key: 'obtienes.highlight1_num',
    section: 'que_obtienes',
    label: 'Beneficio 1 — Cifra/Dato',
    description: 'Valor destacado de la primera tarjeta de beneficio.',
    defaultText: '9',
    maxLength: 24,
    multiline: false
  },
  {
    key: 'obtienes.highlight1_lbl',
    section: 'que_obtienes',
    label: 'Beneficio 1 — Etiqueta',
    description: 'Título de la primera tarjeta de beneficio.',
    defaultText: 'Plataformas',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'obtienes.highlight1_sub',
    section: 'que_obtienes',
    label: 'Beneficio 1 — Subtexto',
    description: 'Texto complementario de la primera tarjeta de beneficio.',
    defaultText: 'Integradas para la transparencia',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.highlight2_num',
    section: 'que_obtienes',
    label: 'Beneficio 2 — Cifra/Dato',
    description: 'Valor destacado de la segunda tarjeta de beneficio.',
    defaultText: '24/7',
    maxLength: 24,
    multiline: false
  },
  {
    key: 'obtienes.highlight2_lbl',
    section: 'que_obtienes',
    label: 'Beneficio 2 — Etiqueta',
    description: 'Título de la segunda tarjeta de beneficio.',
    defaultText: 'Disponibilidad',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'obtienes.highlight2_sub',
    section: 'que_obtienes',
    label: 'Beneficio 2 — Subtexto',
    description: 'Texto complementario de la segunda tarjeta de beneficio.',
    defaultText: 'Acceso permanente',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.highlight3_num',
    section: 'que_obtienes',
    label: 'Beneficio 3 — Cifra/Dato',
    description: 'Valor destacado de la tercera tarjeta de beneficio.',
    defaultText: '100%',
    maxLength: 24,
    multiline: false
  },
  {
    key: 'obtienes.highlight3_lbl',
    section: 'que_obtienes',
    label: 'Beneficio 3 — Etiqueta',
    description: 'Título de la tercera tarjeta de beneficio.',
    defaultText: 'Gestión documentada',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'obtienes.highlight3_sub',
    section: 'que_obtienes',
    label: 'Beneficio 3 — Subtexto',
    description: 'Texto complementario de la tercera tarjeta de beneficio.',
    defaultText: 'Cada caso tiene trazabilidad',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.highlight4_num',
    section: 'que_obtienes',
    label: 'Beneficio 4 — Cifra/Dato',
    description: 'Valor destacado de la cuarta tarjeta de beneficio.',
    defaultText: '100%',
    maxLength: 24,
    multiline: false
  },
  {
    key: 'obtienes.highlight4_lbl',
    section: 'que_obtienes',
    label: 'Beneficio 4 — Etiqueta',
    description: 'Título de la cuarta tarjeta de beneficio.',
    defaultText: 'Segura',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'obtienes.highlight4_sub',
    section: 'que_obtienes',
    label: 'Beneficio 4 — Subtexto',
    description: 'Texto complementario de la cuarta tarjeta de beneficio.',
    defaultText: 'Protección del denunciante',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info1_title',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 1 — Título',
    description: 'Título de la primera tarjeta inferior ("¿Qué puedes hacer?").',
    defaultText: '¿Qué puedes hacer?',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'obtienes.info1_item1',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 1 — Punto 1',
    description: 'Primer elemento de la lista "¿Qué puedes hacer?".',
    defaultText: 'Consultar información',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info1_item2',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 1 — Punto 2',
    description: 'Segundo elemento de la lista "¿Qué puedes hacer?".',
    defaultText: 'Analizar datos',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info1_item3',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 1 — Punto 3',
    description: 'Tercer elemento de la lista "¿Qué puedes hacer?".',
    defaultText: 'Acceder a recursos',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info1_item4',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 1 — Punto 4',
    description: 'Cuarto elemento de la lista "¿Qué puedes hacer?".',
    defaultText: 'Reportar irregularidades',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info2_title',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 2 — Título',
    description: 'Título de la segunda tarjeta inferior ("¿Quién puede utilizar PIA?").',
    defaultText: '¿Quién puede utilizar PIA?',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'obtienes.info2_item1',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 2 — Punto 1',
    description: 'Primer público objetivo en "¿Quién puede utilizar PIA?".',
    defaultText: 'Población en general',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info2_item2',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 2 — Punto 2',
    description: 'Segundo público objetivo en "¿Quién puede utilizar PIA?".',
    defaultText: 'Sociedad civil organizada',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info2_item3',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 2 — Punto 3',
    description: 'Tercer público objetivo en "¿Quién puede utilizar PIA?".',
    defaultText: 'Periodistas y academia',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info2_item4',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 2 — Punto 4',
    description: 'Cuarto público objetivo en "¿Quién puede utilizar PIA?".',
    defaultText: 'Contratistas del Estado',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info2_item5',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 2 — Punto 5',
    description: 'Quinto público objetivo en "¿Quién puede utilizar PIA?".',
    defaultText: 'Sectores fiscalizadores',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'obtienes.info3_title',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 3 — Título',
    description: 'Título de la tercera tarjeta inferior ("¿Qué buscamos lograr?").',
    defaultText: '¿Qué buscamos lograr?',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'obtienes.info3_desc',
    section: 'que_obtienes',
    label: 'Tarjeta informativa 3 — Párrafo',
    description: 'Descripción del objetivo general en "¿Qué buscamos lograr?".',
    defaultText: 'Fomentar una cultura de denuncia responsable, uso adecuado de canales, identificación de riesgos de corrupción y una ciudadanía vigilante y activa comprometida con la integridad pública.',
    maxLength: 380,
    multiline: true
  },

  // 7. NUESTRAS PLATAFORMAS
  {
    key: 'plataformas.tag',
    section: 'plataformas',
    label: 'Etiqueta de sección "Nuestras plataformas"',
    description: 'Etiqueta superior de la sección oscura del carrusel de plataformas.',
    defaultText: 'Ecosistema digital',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.title',
    section: 'plataformas',
    label: 'Título de sección "Nuestras plataformas"',
    description: 'Título principal sobre el carrusel de tarjetas giratorias.',
    defaultText: 'Nuestras plataformas',
    maxLength: 90,
    multiline: false
  },
  {
    key: 'plataformas.subtitle',
    section: 'plataformas',
    label: 'Subtítulo de "Nuestras plataformas"',
    description: 'Descripción general de los componentes del ecosistema debajo del título.',
    defaultText: 'Nueve componentes complementarios para denunciar, vigilar, analizar, prevenir, acceder a información y formarse en integridad.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.choose_label',
    section: 'plataformas',
    label: 'Texto previo a pilares en plataformas',
    description: 'Texto introductorio antes de "Accede, Explora, Aprende y Reporta".',
    defaultText: 'Elige cómo quieres comenzar:',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'plataformas.hint',
    section: 'plataformas',
    label: 'Indicación interactiva de tarjetas',
    description: 'Aviso informativo que indica cómo interactuar con las tarjetas giratorias.',
    defaultText: 'Pasa el cursor o toca cada tarjeta para más información',
    maxLength: 120,
    multiline: false
  },

  // Tarjetas visibles en Nuestras plataformas
  {
    key: 'plataformas.directorio.title',
    section: 'plataformas',
    label: 'Tarjeta Directorio — Nombre',
    description: 'Título en el frente de la tarjeta de Directorio Acceso al Ejecutivo.',
    defaultText: 'Directorio Acceso al Ejecutivo',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.directorio.quote',
    section: 'plataformas',
    label: 'Tarjeta Directorio — Frase destacada',
    description: 'Cita en la parte posterior de la tarjeta Directorio.',
    defaultText: '"Información pública al alcance de todos"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.directorio.what_is',
    section: 'plataformas',
    label: 'Tarjeta Directorio — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de Directorio.',
    defaultText: 'Consolida los datos de contacto y los mecanismos oficiales para solicitar acceso a la información pública en las instituciones del Organismo Ejecutivo.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.directorio.why_matters',
    section: 'plataformas',
    label: 'Tarjeta Directorio — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de Directorio.',
    defaultText: 'Facilita la localización de enlaces institucionales y mecanismos de solicitud.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.directorio.cta',
    section: 'plataformas',
    label: 'Tarjeta Directorio — Botón',
    description: 'Texto del enlace en el reverso de la tarjeta Directorio.',
    defaultText: 'Visitar',
    maxLength: 40,
    multiline: false
  },

  {
    key: 'plataformas.codede.title',
    section: 'plataformas',
    label: 'Tarjeta Transparencia CODEDE — Nombre',
    description: 'Título en el frente de la tarjeta Transparencia CODEDE.',
    defaultText: 'Transparencia CODEDE',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.codede.quote',
    section: 'plataformas',
    label: 'Tarjeta Transparencia CODEDE — Frase destacada',
    description: 'Cita en el reverso de la tarjeta Transparencia CODEDE.',
    defaultText: '"Información pública de oficio al alcance"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.codede.what_is',
    section: 'plataformas',
    label: 'Tarjeta Transparencia CODEDE — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de Transparencia CODEDE.',
    defaultText: 'Portal que consolida la información pública de oficio publicada por las instituciones del Organismo Ejecutivo.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.codede.why_matters',
    section: 'plataformas',
    label: 'Tarjeta Transparencia CODEDE — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de Transparencia CODEDE.',
    defaultText: 'Garantiza el acceso proactivo a la información sin necesidad de solicitud previa.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.codede.cta',
    section: 'plataformas',
    label: 'Tarjeta Transparencia CODEDE — Botón',
    description: 'Texto del enlace en el reverso de la tarjeta Transparencia CODEDE.',
    defaultText: 'Consultar',
    maxLength: 40,
    multiline: false
  },

  {
    key: 'plataformas.gobierno.title',
    section: 'plataformas',
    label: 'Tarjeta Tu Gobierno en Números — Nombre',
    description: 'Título en el frente de la tarjeta Tu Gobierno en Números.',
    defaultText: 'Tu Gobierno en Números',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.gobierno.quote',
    section: 'plataformas',
    label: 'Tarjeta Tu Gobierno en Números — Frase destacada',
    description: 'Cita en el reverso de la tarjeta Tu Gobierno en Números.',
    defaultText: '"Datos claros, gestión transparente"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.gobierno.what_is',
    section: 'plataformas',
    label: 'Tarjeta Tu Gobierno en Números — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de Tu Gobierno en Números.',
    defaultText: 'Tableros de rendición de cuentas con indicadores de gestión, ejecución presupuestaria y resultados institucionales.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.gobierno.why_matters',
    section: 'plataformas',
    label: 'Tarjeta Tu Gobierno en Números — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de Tu Gobierno en Números.',
    defaultText: 'Permite a la ciudadanía consultar y compartir información pública de forma accesible.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.gobierno.cta',
    section: 'plataformas',
    label: 'Tarjeta Tu Gobierno en Números — Botón',
    description: 'Texto del enlace en el reverso de la tarjeta Tu Gobierno en Números.',
    defaultText: 'Explorar',
    maxLength: 40,
    multiline: false
  },

  {
    key: 'plataformas.radiografia.title',
    section: 'plataformas',
    label: 'Tarjeta Radiografía — Nombre',
    description: 'Título en el frente de la tarjeta Radiografía de la Corrupción.',
    defaultText: 'Radiografía de la Corrupción',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.radiografia.quote',
    section: 'plataformas',
    label: 'Tarjeta Radiografía — Frase destacada',
    description: 'Cita en el reverso de la tarjeta Radiografía de la Corrupción.',
    defaultText: '"Los datos fortalecen el combate a la corrupción"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.radiografia.what_is',
    section: 'plataformas',
    label: 'Tarjeta Radiografía — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de Radiografía de la Corrupción.',
    defaultText: 'Plataforma que muestra información actualizada sobre denuncias, tendencias e instituciones.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.radiografia.why_matters',
    section: 'plataformas',
    label: 'Tarjeta Radiografía — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de Radiografía de la Corrupción.',
    defaultText: 'Convierte datos en transparencia activa y permite la auditoría social.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.radiografia.cta',
    section: 'plataformas',
    label: 'Tarjeta Radiografía — Botón',
    description: 'Texto del enlace en el reverso de Radiografía de la Corrupción.',
    defaultText: 'Explorar',
    maxLength: 40,
    multiline: false
  },

  {
    key: 'plataformas.riesgo.title',
    section: 'plataformas',
    label: 'Tarjeta Riesgo en la Mira — Nombre',
    description: 'Título en el frente de la tarjeta Riesgo en la Mira.',
    defaultText: 'Riesgo en la Mira',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.riesgo.quote',
    section: 'plataformas',
    label: 'Tarjeta Riesgo en la Mira — Frase destacada',
    description: 'Cita en el reverso de la tarjeta Riesgo en la Mira.',
    defaultText: '"La prevención comienza identificando los riesgos"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.riesgo.what_is',
    section: 'plataformas',
    label: 'Tarjeta Riesgo en la Mira — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de Riesgo en la Mira.',
    defaultText: 'Plataforma que muestra el estado de cumplimiento institucional en gestión de riesgos, con semaforización.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.riesgo.why_matters',
    section: 'plataformas',
    label: 'Tarjeta Riesgo en la Mira — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de Riesgo en la Mira.',
    defaultText: 'Genera presión reputacional positiva y consolida la cultura de integridad preventiva.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.riesgo.cta',
    section: 'plataformas',
    label: 'Tarjeta Riesgo en la Mira — Botón',
    description: 'Texto del enlace en el reverso de Riesgo en la Mira.',
    defaultText: 'Ver',
    maxLength: 40,
    multiline: false
  },

  {
    key: 'plataformas.acadeti.title',
    section: 'plataformas',
    label: 'Tarjeta ACADETI — Nombre',
    description: 'Título en el frente de la tarjeta ACADETI.',
    defaultText: 'ACADETI',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.acadeti.quote',
    section: 'plataformas',
    label: 'Tarjeta ACADETI — Frase destacada',
    description: 'Cita en el reverso de la tarjeta ACADETI.',
    defaultText: '"Formación continua para la integridad"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.acadeti.what_is',
    section: 'plataformas',
    label: 'Tarjeta ACADETI — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de ACADETI.',
    defaultText: 'Plataforma educativa con cursos, materiales y recursos para fortalecer competencias en transparencia y ética pública.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.acadeti.why_matters',
    section: 'plataformas',
    label: 'Tarjeta ACADETI — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de ACADETI.',
    defaultText: 'Capacita a servidores públicos y ciudadanía en buenas prácticas de integridad.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.acadeti.cta',
    section: 'plataformas',
    label: 'Tarjeta ACADETI — Botón',
    description: 'Texto del enlace en el reverso de ACADETI.',
    defaultText: 'Entrar',
    maxLength: 40,
    multiline: false
  },

  {
    key: 'plataformas.canales.title',
    section: 'plataformas',
    label: 'Tarjeta Canales por la Integridad — Nombre',
    description: 'Título en el frente de la tarjeta Canales por la Integridad.',
    defaultText: 'Canales por la Integridad',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.canales.quote',
    section: 'plataformas',
    label: 'Tarjeta Canales por la Integridad — Frase destacada',
    description: 'Cita en el reverso de la tarjeta Canales por la Integridad.',
    defaultText: '"La integridad pública es un compromiso de todos"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.canales.what_is',
    section: 'plataformas',
    label: 'Tarjeta Canales por la Integridad — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de Canales por la Integridad.',
    defaultText: 'Directorio interactivo que reúne todos los canales de denuncia administrativa del Organismo Ejecutivo.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.canales.why_matters',
    section: 'plataformas',
    label: 'Tarjeta Canales por la Integridad — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de Canales por la Integridad.',
    defaultText: 'Fortalece la transparencia, reduce barreras y centraliza la información.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.canales.cta',
    section: 'plataformas',
    label: 'Tarjeta Canales por la Integridad — Botón',
    description: 'Texto del enlace en el reverso de Canales por la Integridad.',
    defaultText: 'Visitar',
    maxLength: 40,
    multiline: false
  },

  {
    key: 'plataformas.vigilando.title',
    section: 'plataformas',
    label: 'Tarjeta Vigilando la Integridad — Nombre',
    description: 'Título en el frente de la tarjeta Vigilando la Integridad.',
    defaultText: 'Vigilando la Integridad',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'plataformas.vigilando.quote',
    section: 'plataformas',
    label: 'Tarjeta Vigilando la Integridad — Frase destacada',
    description: 'Cita en el reverso de la tarjeta Vigilando la Integridad.',
    defaultText: '"Ante irregularidades, denunciar es clave"',
    maxLength: 140,
    multiline: false
  },
  {
    key: 'plataformas.vigilando.what_is',
    section: 'plataformas',
    label: 'Tarjeta Vigilando la Integridad — ¿Qué es?',
    description: 'Descripción "¿Qué es?" en el reverso de Vigilando la Integridad.',
    defaultText: 'Plataforma oficial para canalizar denuncias administrativas en línea, disponible 24/7.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'plataformas.vigilando.why_matters',
    section: 'plataformas',
    label: 'Tarjeta Vigilando la Integridad — ¿Por qué importa?',
    description: 'Texto "¿Por qué importa?" en el reverso de Vigilando la Integridad.',
    defaultText: 'Centraliza denuncias, mejora tiempos de respuesta.',
    maxLength: 260,
    multiline: true
  },
  {
    key: 'plataformas.vigilando.cta',
    section: 'plataformas',
    label: 'Tarjeta Vigilando la Integridad — Botón',
    description: 'Texto del enlace en el reverso de Vigilando la Integridad.',
    defaultText: 'Denunciar',
    maxLength: 40,
    multiline: false
  },

  // 8. ASI FUNCIONA PIA
  {
    key: 'funciona.badge',
    section: 'asi_funciona',
    label: 'Insignia de sección "Así funciona PIA"',
    description: 'Cápsula superior encima del título "Así funciona PIA".',
    defaultText: 'Flujo de navegación e interacción',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'funciona.title',
    section: 'asi_funciona',
    label: 'Título de sección "Así funciona PIA"',
    description: 'Título principal de la infografía de flujo en 6 pasos.',
    defaultText: 'Así funciona PIA',
    maxLength: 90,
    multiline: false
  },
  {
    key: 'funciona.subtitle',
    section: 'asi_funciona',
    label: 'Subtítulo de "Así funciona PIA"',
    description: 'Párrafo introductorio de la línea de tiempo interactiva.',
    defaultText: 'Un proceso guiado e intuitivo en 6 etapas que conecta las necesidades ciudadanas con el ecosistema de datos abiertos, fiscalización y denuncia.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'funciona.step1_tag',
    section: 'asi_funciona',
    label: 'Paso 1 — Etiqueta',
    description: 'Etiqueta de paso en la primera tarjeta del flujo.',
    defaultText: 'Paso 01',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'funciona.step1_title',
    section: 'asi_funciona',
    label: 'Paso 1 — Título',
    description: 'Título de la primera etapa del flujo.',
    defaultText: '1. Identificación de necesidad',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.step1_desc',
    section: 'asi_funciona',
    label: 'Paso 1 — Descripción',
    description: 'Texto explicativo del paso 1.',
    defaultText: 'Reconoce qué tipo de información pública o servicio requieres: solicitudes de datos, consulta vehicular, monitoreo de riesgos o denuncias.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'funciona.step2_tag',
    section: 'asi_funciona',
    label: 'Paso 2 — Etiqueta',
    description: 'Etiqueta de paso en la segunda tarjeta del flujo.',
    defaultText: 'Paso 02',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'funciona.step2_title',
    section: 'asi_funciona',
    label: 'Paso 2 — Título',
    description: 'Título de la segunda etapa del flujo.',
    defaultText: '2. Selección de plataforma',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.step2_desc',
    section: 'asi_funciona',
    label: 'Paso 2 — Descripción',
    description: 'Texto explicativo del paso 2.',
    defaultText: 'Navega entre las 9 plataformas del ecosistema PIA y elige la especializada para tu consulta (Transparencia Vehicular, Radiografía, Vigilando, etc.).',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'funciona.step3_tag',
    section: 'asi_funciona',
    label: 'Paso 3 — Etiqueta',
    description: 'Etiqueta de paso en la tercera tarjeta del flujo.',
    defaultText: 'Paso 03',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'funciona.step3_title',
    section: 'asi_funciona',
    label: 'Paso 3 — Título',
    description: 'Título de la tercera etapa del flujo.',
    defaultText: '3. Consulta o interacción',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.step3_desc',
    section: 'asi_funciona',
    label: 'Paso 3 — Descripción',
    description: 'Texto explicativo del paso 3.',
    defaultText: 'Accede directamente a tableros, buscadores interactivos, módulos de formación o al formulario seguro de denuncias 24/7.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'funciona.step4_tag',
    section: 'asi_funciona',
    label: 'Paso 4 — Etiqueta',
    description: 'Etiqueta de paso en la cuarta tarjeta del flujo.',
    defaultText: 'Paso 04',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'funciona.step4_title',
    section: 'asi_funciona',
    label: 'Paso 4 — Título',
    description: 'Título de la cuarta etapa del flujo.',
    defaultText: '4. Obtención de datos',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.step4_desc',
    section: 'asi_funciona',
    label: 'Paso 4 — Descripción',
    description: 'Texto explicativo del paso 4.',
    defaultText: 'Visualiza datos abiertos, indicadores institucionales, certificaciones de cursos o números de correlativo de seguimiento.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'funciona.step5_tag',
    section: 'asi_funciona',
    label: 'Paso 5 — Etiqueta',
    description: 'Etiqueta de paso en la quinta tarjeta del flujo.',
    defaultText: 'Paso 05',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'funciona.step5_title',
    section: 'asi_funciona',
    label: 'Paso 5 — Título',
    description: 'Título de la quinta etapa del flujo.',
    defaultText: '5. Participación activa',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.step5_desc',
    section: 'asi_funciona',
    label: 'Paso 5 — Descripción',
    description: 'Texto explicativo del paso 5.',
    defaultText: 'Utiliza la información para auditar la gestión pública, ejercer tu derecho de petición o alertar sobre posibles anomalías de forma segura.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'funciona.step6_tag',
    section: 'asi_funciona',
    label: 'Paso 6 — Etiqueta',
    description: 'Etiqueta de paso en la tarjeta final del flujo.',
    defaultText: 'Paso Final',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'funciona.step6_title',
    section: 'asi_funciona',
    label: 'Paso 6 — Título',
    description: 'Título de la sexta y última etapa del flujo.',
    defaultText: '6. Fortalecimiento de Integridad',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.step6_desc',
    section: 'asi_funciona',
    label: 'Paso 6 — Descripción',
    description: 'Texto explicativo del paso 6.',
    defaultText: 'Cada consulta, denuncia y acción fiscalizadora impulsa la cultura de probidad, reduce la opacidad y fortalece el Estado de Derecho.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'funciona.feat1_title',
    section: 'asi_funciona',
    label: 'Garantía 1 — Título',
    description: 'Título del primer recuadro inferior de garantías en "Así funciona PIA".',
    defaultText: 'Anonimato Garantizado',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'funciona.feat1_desc',
    section: 'asi_funciona',
    label: 'Garantía 1 — Descripción',
    description: 'Subtítulo del primer recuadro de garantías.',
    defaultText: 'Protección total del denunciante',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.feat2_title',
    section: 'asi_funciona',
    label: 'Garantía 2 — Título',
    description: 'Título del segundo recuadro inferior de garantías.',
    defaultText: 'Disponible 24/7',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'funciona.feat2_desc',
    section: 'asi_funciona',
    label: 'Garantía 2 — Descripción',
    description: 'Subtítulo del segundo recuadro de garantías.',
    defaultText: 'Plataformas digitales activas',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.feat3_title',
    section: 'asi_funciona',
    label: 'Garantía 3 — Título',
    description: 'Título del tercer recuadro inferior de garantías.',
    defaultText: 'Datos Abiertos',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'funciona.feat3_desc',
    section: 'asi_funciona',
    label: 'Garantía 3 — Descripción',
    description: 'Subtítulo del tercer recuadro de garantías.',
    defaultText: 'Visualización transparente',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'funciona.feat4_title',
    section: 'asi_funciona',
    label: 'Garantía 4 — Título',
    description: 'Título del cuarto recuadro inferior de garantías.',
    defaultText: 'Seguimiento Oficial',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'funciona.feat4_desc',
    section: 'asi_funciona',
    label: 'Garantía 4 — Descripción',
    description: 'Subtítulo del cuarto recuadro de garantías.',
    defaultText: 'Canales institucionales',
    maxLength: 100,
    multiline: false
  },

  // 9. PRINCIPIOS Y METODOLOGIA
  {
    key: 'principios.tag',
    section: 'principios',
    label: 'Etiqueta de sección "Principios y Metodología"',
    description: 'Etiqueta superior de la sección de principios institucionales.',
    defaultText: '¿En qué se basa este ecosistema?',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'principios.title',
    section: 'principios',
    label: 'Título de sección "Principios y Metodología"',
    description: 'Título principal de la banda de principios.',
    defaultText: 'Principios y Metodología',
    maxLength: 90,
    multiline: false
  },
  {
    key: 'principios.subtitle',
    section: 'principios',
    label: 'Subtítulo de "Principios y Metodología"',
    description: 'Párrafo introductorio sobre la lucha contra la corrupción y fortalecimiento estatal.',
    defaultText: 'La lucha contra la corrupción constituye un pilar esencial para el desarrollo sostenible y el bienestar de la población guatemalteca. Este proyecto nace con el propósito de fortalecer a las instituciones del Estado y de promover la transparencia en cada una de sus acciones.',
    maxLength: 420,
    multiline: true
  },
  {
    key: 'principios.card1_title',
    section: 'principios',
    label: 'Principio 1 — Título',
    description: 'Título de la primera tarjeta de principios.',
    defaultText: 'Gestión y acompañamiento especializado',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'principios.card1_desc',
    section: 'principios',
    label: 'Principio 1 — Descripción',
    description: 'Texto de la primera tarjeta de principios.',
    defaultText: 'Las denuncias son recibidas y gestionadas por Instancias de Probidad, con seguimiento continuo y protocolos establecidos.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'principios.card2_title',
    section: 'principios',
    label: 'Principio 2 — Título',
    description: 'Título de la segunda tarjeta de principios.',
    defaultText: 'Compromiso con la lucha anticorrupción',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'principios.card2_desc',
    section: 'principios',
    label: 'Principio 2 — Descripción',
    description: 'Texto de la segunda tarjeta de principios.',
    defaultText: 'Impulso a la rendición de cuentas, transformando cada denuncia en acción concreta y visible para la ciudadanía.',
    maxLength: 320,
    multiline: true
  },
  {
    key: 'principios.card3_title',
    section: 'principios',
    label: 'Principio 3 — Título',
    description: 'Título de la tercera tarjeta de principios.',
    defaultText: 'Alineados con la agenda global',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'principios.card3_desc',
    section: 'principios',
    label: 'Principio 3 — Descripción',
    description: 'Texto de la tercera tarjeta de principios.',
    defaultText: 'Guatemala ratificó la Convención Interamericana contra la Corrupción, reafirmando su compromiso con los estándares internacionales.',
    maxLength: 320,
    multiline: true
  },

  // 10. ACCESO DIRECTO (CARRUSEL 3D)
  {
    key: 'acceso.tag',
    section: 'acceso_directo',
    label: 'Etiqueta de sección "Acceso directo"',
    description: 'Etiqueta superior sobre el carrusel 3D de acceso directo.',
    defaultText: 'Acceso directo',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.title',
    section: 'acceso_directo',
    label: 'Título de sección "Accede a nuestras plataformas"',
    description: 'Título principal de la sección del carrusel 3D.',
    defaultText: 'Accede a nuestras plataformas',
    maxLength: 90,
    multiline: false
  },
  {
    key: 'acceso.subtitle',
    section: 'acceso_directo',
    label: 'Subtítulo de "Accede a nuestras plataformas"',
    description: 'Texto explicativo debajo del título de acceso directo.',
    defaultText: 'Cada plataforma cumple una función diferente, pero juntas conforman un ecosistema digital para fortalecer la integridad pública. Puedes ingresar por cualquiera de ellas o recorrerlas según tu necesidad.',
    maxLength: 360,
    multiline: true
  },
  {
    key: 'acceso.directorio.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Directorio — Nombre',
    description: 'Nombre visible en la tarjeta 3D de Directorio Acceso al Ejecutivo.',
    defaultText: 'Directorio Acceso al Ejecutivo',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.directorio.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Directorio — Descripción',
    description: 'Resumen breve en la tarjeta 3D de Directorio.',
    defaultText: 'Consolida datos de contacto y mecanismos de acceso a la información.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.directorio.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Directorio — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de Directorio.',
    defaultText: 'Accede',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'acceso.codede.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Transparencia CODEDE — Nombre',
    description: 'Nombre visible en la tarjeta 3D de Transparencia CODEDE.',
    defaultText: 'Transparencia CODEDE',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.codede.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Transparencia CODEDE — Descripción',
    description: 'Resumen breve en la tarjeta 3D de Transparencia CODEDE.',
    defaultText: 'Información pública de oficio del Organismo Ejecutivo.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.codede.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Transparencia CODEDE — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de Transparencia CODEDE.',
    defaultText: 'Explora',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'acceso.gobierno.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Tu Gobierno en Números — Nombre',
    description: 'Nombre visible en la tarjeta 3D de Tu Gobierno en Números.',
    defaultText: 'Tu Gobierno en Números',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.gobierno.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Tu Gobierno en Números — Descripción',
    description: 'Resumen breve en la tarjeta 3D de Tu Gobierno en Números.',
    defaultText: 'Tableros de rendición de cuentas con indicadores de gestión.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.gobierno.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Tu Gobierno en Números — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de Tu Gobierno en Números.',
    defaultText: 'Explora',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'acceso.radiografia.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Radiografía — Nombre',
    description: 'Nombre visible en la tarjeta 3D de Radiografía de la Corrupción.',
    defaultText: 'Radiografía de la Corrupción',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.radiografia.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Radiografía — Descripción',
    description: 'Resumen breve en la tarjeta 3D de Radiografía.',
    defaultText: 'Visualización de datos abiertos sobre denuncias y tendencias.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.radiografia.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Radiografía — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de Radiografía.',
    defaultText: 'Explora',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'acceso.riesgo.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Riesgo en la Mira — Nombre',
    description: 'Nombre visible en la tarjeta 3D de Riesgo en la Mira.',
    defaultText: 'Riesgo en la Mira',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.riesgo.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Riesgo en la Mira — Descripción',
    description: 'Resumen breve en la tarjeta 3D de Riesgo en la Mira.',
    defaultText: 'Transparencia en la gestión de riesgos institucionales.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.riesgo.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Riesgo en la Mira — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de Riesgo en la Mira.',
    defaultText: 'Explora',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'acceso.acadeti.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: ACADETI — Nombre',
    description: 'Nombre visible en la tarjeta 3D de ACADETI.',
    defaultText: 'ACADETI',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.acadeti.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: ACADETI — Descripción',
    description: 'Resumen breve en la tarjeta 3D de ACADETI.',
    defaultText: 'Plataforma educativa para la formación en integridad.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.acadeti.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: ACADETI — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de ACADETI.',
    defaultText: 'Aprende',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'acceso.canales.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Canales por la Integridad — Nombre',
    description: 'Nombre visible en la tarjeta 3D de Canales por la Integridad.',
    defaultText: 'Canales por la Integridad',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.canales.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Canales por la Integridad — Descripción',
    description: 'Resumen breve en la tarjeta 3D de Canales por la Integridad.',
    defaultText: 'Directorio interactivo de canales de denuncia administrativa.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.canales.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Canales por la Integridad — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de Canales por la Integridad.',
    defaultText: 'Reporta',
    maxLength: 30,
    multiline: false
  },
  {
    key: 'acceso.vigilando.name',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Vigilando la Integridad — Nombre',
    description: 'Nombre visible en la tarjeta 3D de Vigilando la Integridad.',
    defaultText: 'Vigilando la Integridad',
    maxLength: 80,
    multiline: false
  },
  {
    key: 'acceso.vigilando.desc',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Vigilando la Integridad — Descripción',
    description: 'Resumen breve en la tarjeta 3D de Vigilando la Integridad.',
    defaultText: 'Canal oficial 24/7 para presentar denuncias de forma segura.',
    maxLength: 200,
    multiline: true
  },
  {
    key: 'acceso.vigilando.pill',
    section: 'acceso_directo',
    label: 'Carrusel 3D: Vigilando la Integridad — Botón',
    description: 'Etiqueta del botón inferior de la tarjeta 3D de Vigilando la Integridad.',
    defaultText: 'Reporta',
    maxLength: 30,
    multiline: false
  },

  // 11. FOOTER
  {
    key: 'footer.brand_phrase',
    section: 'footer',
    label: 'Frase institucional del pie de página',
    description: 'Párrafo debajo de los logotipos en la primera columna del pie de página.',
    defaultText: 'Dónde hay vigilancia, hay menos corrupción. La integridad del Organismo Ejecutivo empieza con una denuncia bien canalizada.',
    maxLength: 300,
    multiline: true
  },
  {
    key: 'footer.col1_title',
    section: 'footer',
    label: 'Pie de página — Título columna 1',
    description: 'Encabezado de la columna de enlaces de denuncia.',
    defaultText: 'Reporta irregularidades',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'footer.col2_title',
    section: 'footer',
    label: 'Pie de página — Título columna 2',
    description: 'Encabezado de la columna de enlaces de exploración.',
    defaultText: 'Explora datos',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'footer.col3_title',
    section: 'footer',
    label: 'Pie de página — Título columna 3',
    description: 'Encabezado superior de la tercera columna de enlaces.',
    defaultText: 'Accede a la información',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'footer.col4_title',
    section: 'footer',
    label: 'Pie de página — Subtítulo "Aprende"',
    description: 'Encabezado del bloque de formación en la tercera columna.',
    defaultText: 'Aprende',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'footer.col5_title',
    section: 'footer',
    label: 'Pie de página — Título de contacto',
    description: 'Encabezado de la columna de contacto y redes sociales.',
    defaultText: 'Contacto',
    maxLength: 60,
    multiline: false
  },
  {
    key: 'footer.contact_email',
    section: 'footer',
    label: 'Pie de página — Texto de correo visible',
    description: 'Texto del correo electrónico visible en la sección de contacto del pie de página.',
    defaultText: 'info@pia.gob.gt',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'footer.contact_web',
    section: 'footer',
    label: 'Pie de página — Texto de sitio web visible',
    description: 'Texto del enlace web visible en la sección de contacto del pie de página.',
    defaultText: 'pia.gob.gt',
    maxLength: 100,
    multiline: false
  },
  {
    key: 'footer.copyright',
    section: 'footer',
    label: 'Aviso de derechos / Pie inferior',
    description: 'Línea institucional ubicada en la parte inferior izquierda del pie de página.',
    defaultText: '© Gobierno de Guatemala 2025. Comprometidos con la integridad pública.',
    maxLength: 180,
    multiline: false
  }
];

export const PORTAL_TEXT_CATALOG_MAP = new Map(
  PORTAL_TEXT_CATALOG.map(entry => [entry.key, entry])
);

const DANGEROUS_TEXT_PATTERNS = [
  /<\s*\/?\s*[a-z!][^>]*>/i,
  /<\s*script/i,
  /\b(?:javascript|vbscript)\s*:/i,
  /\bon[a-z]+\s*=/i,
  /data\s*:\s*text\/html/i
];

export function sanitizeAndValidatePortalText(key, rawValue) {
  const entry = PORTAL_TEXT_CATALOG_MAP.get(String(key || '').trim());
  if (!entry) {
    return { valid: false, error: `Clave de texto no reconocida en el catálogo: "${key}".` };
  }
  if (typeof rawValue !== 'string') {
    return { valid: false, error: `El valor para "${entry.label}" debe ser una cadena de texto.` };
  }

  let normalized = rawValue.replace(/\r\n/g, '\n');
  if (!entry.multiline) {
    normalized = normalized.replace(/[\r\n]+/g, ' ');
  }
  // Eliminar caracteres de control no imprimibles (preservando \n en campos multilínea)
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

export function normalizePortalTextsDoc(rawDoc) {
  const src = (rawDoc && typeof rawDoc === 'object' && !Array.isArray(rawDoc)) ? rawDoc : {};
  const rawOverrides = (src.overrides && typeof src.overrides === 'object' && !Array.isArray(src.overrides))
    ? src.overrides
    : {};

  const overrides = {};
  const texts = {};

  for (const entry of PORTAL_TEXT_CATALOG) {
    const candidate = rawOverrides[entry.key];
    if (typeof candidate === 'string') {
      const check = sanitizeAndValidatePortalText(entry.key, candidate);
      if (check.valid && check.value !== entry.defaultText) {
        overrides[entry.key] = check.value;
        texts[entry.key] = check.value;
        continue;
      }
    }
    texts[entry.key] = entry.defaultText;
  }

  return {
    overrides,
    texts,
    updatedAt: src.updatedAt || null,
    updatedBy: src.updatedBy || null
  };
}
