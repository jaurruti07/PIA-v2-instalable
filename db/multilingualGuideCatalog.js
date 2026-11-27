// db/multilingualGuideCatalog.js
// Catálogo canónico, validación y normalización de la Guía Multilingüe
// (Portal Principal Inclusión Universal, Canales por la Integridad Maya y Diccionario pia-i18n)

export const MULTILINGUAL_SECTIONS = ['portal', 'canales', 'i18n'];

export const PORTAL_LANG_ORDER = ['es', 'en', 'kiche', 'qeqchi', 'kaqchikel', 'mam'];
export const PORTAL_MODULE_ORDER = [
  'full',
  'directorio',
  'vehiculos',
  'gobierno_numeros',
  'transparencia_codede',
  'canales_denuncias',
  'canales_integridad',
  'riesgo_mira',
  'radiografia_corrupcion',
  'acadeti'
];

export const PORTAL_MODULE_LABELS = {
  full: 'Resumen general del Portal (PIA)',
  directorio: 'Directorio Acceso Libre',
  vehiculos: 'Transparencia Vehicular Oficial',
  gobierno_numeros: 'Tu Gobierno en Números',
  transparencia_codede: 'Transparencia CODEDE',
  canales_denuncias: 'Vigilando la Integridad',
  canales_integridad: 'Canales por la Integridad',
  riesgo_mira: 'Riesgo en la Mira',
  radiografia_corrupcion: 'Radiografía de la Corrupción',
  acadeti: 'ACADETI'
};

export const CANALES_LANG_ORDER = ['es', 'en', 'kiche', 'qeqchi', 'kaqchikel', 'mam', 'tzutujil', 'poqomchi'];

export const MULTILINGUAL_SECTION_META = {
  portal: {
    key: 'portal',
    label: 'Portal Principal (Inclusión Universal)',
    description: 'Textos y guiones de locución por idioma y plataforma del módulo Inclusión Universal y Guiado Auditivo en /index.html.',
    publicUrl: '/#accesibilidad-multilingue',
    languages: PORTAL_LANG_ORDER
  },
  canales: {
    key: 'canales',
    label: 'Canales por la Integridad (Guía Maya)',
    description: 'Guía de denuncia segura en 8 idiomas: resumen auditivo, 4 pasos de denuncia, 3 garantías CNC y 5 términos del glosario.',
    publicUrl: '/canales-por-la-integridad/#guiaMultilingue',
    languages: CANALES_LANG_ORDER
  },
  i18n: {
    key: 'i18n',
    label: 'Diccionario de Interfaz (pia-i18n)',
    description: 'Frases globales del menú, filtros, botones y etiquetas traducibles dinámicamente por el motor /js/pia-i18n.js.',
    publicUrl: '/js/pia-i18n.js',
    languages: CANALES_LANG_ORDER
  }
};

export const DEFAULT_PORTAL_MULTILINGUAL = {
  es: {
    langName: 'Español (Oficial)',
    ttsLang: 'es-GT',
    modules: {
      full: {
        title: 'Resumen general del Portal de Integridad Activa (PIA)',
        text: 'El Portal de Integridad Activa (PIA) es la plataforma tecnológica oficial del Gobierno de la República de Guatemala que consolida la información pública, la rendición de cuentas y los mecanismos de denuncia administrativa dentro del Organismo Ejecutivo. A través del portal, los ciudadanos pueden acceder al directorio institucional en materia de información pública y de canales de denuncia administrativa, consultar datos abiertos sobre presupuestos y proyectos CODEDE, analizar indicadores de Riesgo en la Mira y presentar denuncias administrativas las 24 horas.'
      },
      directorio: {
        title: 'Directorio Acceso Libre',
        text: 'Esta plataforma permite contar con un directorio que recopila información importante y clave de las dependencias encargadas de información pública en los órganos del Organismo Ejecutivo. El directorio busca mejorar la transparencia, fortalecer la gestión pública y facilitar el acceso a la información pública.'
      },
      vehiculos: {
        title: 'Transparencia Vehicular Oficial',
        text: 'El módulo de Transparencia Vehicular ofrece la fiscalización ciudadana de la flota de vehículos oficiales del Gobierno de Guatemala. Los ciudadanos pueden verificar números de placa, tipo de vehículo, dependencia asignada y estado de uso, facilitando la detección y denuncia confidencial de cualquier uso indebido de los bienes del Estado.'
      },
      gobierno_numeros: {
        title: 'Tu Gobierno en Números',
        text: 'Constituye una herramienta de prevención que busca favorecer la rendición de cuentas, centraliza y publica, de manera proactiva, información importante sobre la gestión de recursos en las instituciones que conforman el Organismo Ejecutivo. El portal permite visualizar datos institucionales de forma clara, comprensible y accesible, facilitando el monitoreo ciudadano y fortaleciendo la cultura de integridad en la administración pública.'
      },
      transparencia_codede: {
        title: 'Transparencia CODEDE',
        text: 'Es una plataforma integrada por tableros de monitoreo que permiten visualizar, de manera ágil y comprensible, la ejecución presupuestaria y el avance físico-financiero de los proyectos financiados por los Consejos Departamentales de Desarrollo.'
      },
      canales_denuncias: {
        title: 'Vigilando la Integridad',
        text: 'Vigilando la Integridad es el centro seguro para la recepción de denuncias administrativas de la ciudadanía, y alertar sobre irregularidades en ministerios, secretarias, gobernaciones departamentales y otras instituciones que conforman el Organismo Ejecutivo. Garantiza protección al denunciante, uso las 24 horas del día y seguimiento activo por la Comisión Nacional contra la Corrupción.'
      },
      canales_integridad: {
        title: 'Canales por la Integridad',
        text: 'Canales por la Integridad consiste en la reunión de los canales de denuncia administrativos habilitados por cada institución del Organismo Ejecutivo, para que la ciudadanía pueda denunciar faltas éticas o actos de corrupción. La diversidad de los canales habilitados permite apegarse a las necesidades del denunciante, ya sea mediante correo electrónico, teléfono, formularios en línea, entre otros.'
      },
      riesgo_mira: {
        title: 'Riesgo en la Mira',
        text: 'Riesgo en la Mira constituye una herramienta de transparencia activa que permite visualizar el nivel de avance y cumplimiento de la gestión de riesgos de corrupción efectuados por las Instancias de Asuntos de Probidad de cada institución del Organismo Ejecutivo. A través de este ejercicio, se han podido identificar una serie de patrones de corrupción que constituyen alertivos para las propias institución y otras que podrían vincularse en la temática evidenciada, tal es el caso de anomalías, sobrecostos o concentración de proveedores, entre otros.'
      },
      radiografia_corrupcion: {
        title: 'Radiografía de la Corrupción',
        text: 'Radiografía de la Corrupción constituye una plataforma digital de visualización y monitoreo que centraliza información sobre las denuncias de actos de corrupción presentadas por las instituciones del Organismo Ejecutivo ante el Ministerio Público u órganos jurisdiccionales. De esa forma, se convierte la lucha contra la corrupción en un ejercicio cotidiano de visibilidad y responsabilidad pública, promovido por el Gobierno de la República de Guatemala.'
      },
      acadeti: {
        title: 'ACADETI',
        text: 'ACADETI es una plataforma 100% virtual de formación especializada en ética, integridad y prevención de la corrupción, diseñada para desarrollar procesos de enseñanza-aprendizaje a través de contenidos estructurados, recursos de multimedia, actividades interactivas y espacios de intercambio digital.'
      }
    }
  },
  en: {
    langName: 'English (Inglés)',
    ttsLang: 'en-US',
    modules: {
      full: {
        title: 'Active Integrity Portal (PIA) Overview',
        text: "The Active Integrity Portal (PIA) is the official technological platform of the Government of the Republic of Guatemala that consolidates public information, accountability, and administrative reporting mechanisms within the Executive Branch. Through the portal, citizens can access the institutional directory for public information and administrative reporting channels, consult open data on budgets and CODEDE projects, analyze Risk Spotlight indicators, and submit administrative complaints 24 hours a day."
      },
      directorio: {
        title: 'Open Access Directory',
        text: 'This platform provides a directory that compiles key information on the public information offices across the agencies of the Executive Branch. The directory aims to improve transparency, strengthen public management, and facilitate access to public information.'
      },
      vehiculos: {
        title: 'Official Vehicle Fleet Transparency',
        text: 'The Vehicle Transparency module enables public oversight of the official state vehicle fleet in Guatemala. Citizens can verify license plates, vehicle models, assigned government departments, and usage status to prevent and report improper asset use.'
      },
      gobierno_numeros: {
        title: 'Government in Numbers',
        text: 'It is a preventive tool designed to promote accountability by proactively centralizing and publishing key information on resource management across the institutions of the Executive Branch. The portal presents institutional data clearly and accessibly, facilitating citizen oversight and strengthening a culture of integrity in public administration.'
      },
      transparencia_codede: {
        title: 'CODEDE Transparency',
        text: 'It is a platform made up of monitoring dashboards that make it easy and clear to view budget execution and the physical and financial progress of projects funded by the Departmental Development Councils.'
      },
      canales_denuncias: {
        title: 'Vigilando la Integridad',
        text: 'Vigilando la Integridad is the secure center for receiving citizen administrative complaints and alerting on irregularities in ministries, secretariats, departmental governorships, and other institutions of the Executive Branch. It guarantees whistleblower protection, 24-hour access, and active follow-up by the National Commission Against Corruption.'
      },
      canales_integridad: {
        title: 'Channels for Integrity',
        text: "Channels for Integrity brings together the administrative reporting channels enabled by each institution of the Executive Branch so citizens can report ethical breaches or acts of corruption. The diversity of available channels adapts to the whistleblower's needs, whether via email, telephone, online forms, or other means."
      },
      riesgo_mira: {
        title: 'Risk Spotlight',
        text: 'Risk Spotlight is an active transparency tool that displays the progress and compliance level of corruption risk management carried out by the Probity Affairs Units of each Executive Branch institution. Through this exercise, corruption patterns have been identified as early warnings for institutions, including anomalies, cost overruns, and supplier concentration.'
      },
      radiografia_corrupcion: {
        title: 'Corruption Radiography',
        text: "Corruption Radiography is a digital visualization and monitoring platform that centralizes information on corruption complaints filed by Executive Branch institutions before the Public Prosecutor's Office or judicial bodies. In this way, the fight against corruption becomes an everyday exercise in public visibility and accountability promoted by the Government of the Republic of Guatemala."
      },
      acadeti: {
        title: 'ACADETI',
        text: 'ACADETI is a 100% virtual training platform specializing in ethics, integrity, and corruption prevention, designed to support teaching and learning processes through structured content, multimedia resources, interactive activities, and digital exchange spaces.'
      }
    }
  },
  kiche: {
    langName: "K'iche' (Idioma Maya)",
    ttsLang: 'es-GT',
    modules: {
      full: {
        title: "Resumen general rech ri Portal PIA (K'iche')",
        text: "Ri Portal de Integridad Activa (PIA) are ri chakub'al rech ri Q'atb'al Tzij rech Guatemala ri kumol ri saqil tzij, ri uq'alajisaxik ri chak ex ri b'ey rech tz'ujonik pa ri Organismo Ejecutivo. Chuxe' ri PIA, ri winaq kakwinik kakitz'et ri directorio institucional, ri tzij pa wi' ri pwaq ex CODEDE, ri Riesgo en la Mira ex kakik'am b'i tz'ujonik pa ronojel q'ij."
      },
      directorio: {
        title: "Directorio Acceso Libre (K'iche')",
        text: "We chakub'al ri' kuya' jun k'olbal tzij ri kumol ri nimak'amalb'e ex ri patanib'al rech q'alajisanik tzij pa ri Organismo Ejecutivo, rech utz uk'amik ri saqilal, uchuq'ab'ixik ri chak ex k'o b'ey chi ke ri winaq."
      },
      vehiculos: {
        title: "Q'alajisanik rech Ch'ich' rech Q'atb'al Tzij (K'iche')",
        text: "Ri chakub'al rech Q'alajisanik rech Ch'ich' kuya' q'alajisanik pa wi' ri ch'ich' rech ri q'atb'al tzij pa Guatemala. Ri winaq kakwinik kakitz'et ri retal ch'ich' ex kakib'an tz'ujonik we k'o uq'asaxik chak pa kijas."
      },
      gobierno_numeros: {
        title: "Tu Gobierno en Números (K'iche')",
        text: "Are jun chakub'al rech q'atenik rech kuya' rutzil ub'anik ri q'alajisanik, kumol ex kuk'ut ri tzij pa wi' ri pwaq ex tob'al pa ri patanib'al rech ri Organismo Ejecutivo, rech ri winaq kakitz'et pa saqilal."
      },
      transparencia_codede: {
        title: "Transparencia CODEDE (K'iche')",
        text: "Are jun chakub'al ruk' wachb'al rech tz'etonem ri kuk'ut pa saqilal ri ub'anik ri pwaq ex ri uq'axik ri chak tob'al b'anom kumal ri Consejos Departamentales de Desarrollo."
      },
      canales_denuncias: {
        title: "Vigilando la Integridad (K'iche')",
        text: "Vigilando la Integridad are ri k'olbal rech uk'ulik tz'ujonik rech ri winaq pa wi' ri etzelal pa ri ministerios, secretarías, gobernaciones departamentales ex nik'aj chik patanib'al rech ri Organismo Ejecutivo. Kuya' chajinem chi re ri tz'ujunel pa ronojel hora."
      },
      canales_integridad: {
        title: "Canales por la Integridad (K'iche')",
        text: "Canales por la Integridad kumol ronojel ri b'ey rech tz'ujonik k'o pa kijujunal ri patanib'al rech ri Organismo Ejecutivo rech ri winaq kakik'am b'i tz'ujonik pa wi' ri elaq' o etzelal pa correo electrónico, teléfono o wuj pa kematz'ib'."
      },
      riesgo_mira: {
        title: "Riesgo en la Mira (K'iche')",
        text: "Riesgo en la Mira are jun chakub'al rech saqilal ri kuk'ut ri ub'anik ex ri tz'aqatisanik rech uq'atexik ri elaq' b'anom kumal ri Instancias de Asuntos de Probidad pa ri Organismo Ejecutivo, rech kilitaj ri sachoj, sobrecostos o molom loq'oj."
      },
      radiografia_corrupcion: {
        title: "Radiografía de la Corrupción (K'iche')",
        text: "Radiografía de la Corrupción are jun chakub'al pa kematz'ib' rech tz'etonem ri kumol ri tzij pa wi' ri tz'ujonik rech elaq' ya'om kumal ri patanib'al rech ri Organismo Ejecutivo chuwach ri Ministerio Público o q'atb'al tzij."
      },
      acadeti: {
        title: "ACADETI (K'iche')",
        text: "ACADETI are jun tijob'al pa kematz'ib' rech eta'manik pa wi' ri utzilaj b'ey, jikomal ex q'atenik elaq', ruk' utzilaj tzij, wachb'al ex chakub'al rech tijonik pa kematz'ib'."
      }
    }
  },
  qeqchi: {
    langName: "Q'eqchi' (Idioma Maya)",
    ttsLang: 'es-GT',
    modules: {
      full: {
        title: "Resumen general re li Portal PIA (Q'eqchi')",
        text: "Li Portal de Integridad Activa (PIA) a'an li xk'anjelil li Awab'ejil re Guatemala li naxch'utub' li saqil esil, li yaalil k'anjel ut li b'e re yehok maak sa' li Organismo Ejecutivo. Sa' li PIA, li tenamit truko'q xk'anjelob'al li esil, li tumin ut CODEDE, li Riesgo en la Mira ut xk'eeb'al yehok maak chi k'ojk'o rajlal."
      },
      directorio: {
        title: "Directorio Acceso Libre (Q'eqchi')",
        text: "A'in li k'anjelob'aal naxk'ut chixjunil li xyaalalil eb' li rochochil k'anjel li neke'xk'e xch'olch'ob'il li esil sa' li Organismo Ejecutivo, re xchaab'ilob'resinkil li saqil k'anjel ut xtenq'ankil li tenamit."
      },
      vehiculos: {
        title: "Xyaalalil li B'eleba'aal re Tenamit (Q'eqchi')",
        text: "Li Xyaalalil li B'eleba'aal kixk'utub' chixjunil li b'eleba'aal xk'anjelil li tenamit Guatemala. Li tenamit tuko'q xk'e xyaalalil li placas ut xk'anjelil re xramb'al li maak."
      },
      gobierno_numeros: {
        title: "Tu Gobierno en Números (Q'eqchi')",
        text: "A'an jun k'anjelob'aal re xkolb'al li yaalil k'anjel li naxch'utub' ut naxk'ut chi saqil chan ru na'oksiman li tumin ut li k'anjel sa'eb' li rochochil li Organismo Ejecutivo."
      },
      transparencia_codede: {
        title: "Transparencia CODEDE (Q'eqchi')",
        text: "A'an jun k'anjelob'aal rik'in xk'utb'alil li tz'ilok li naxk'e chi ilok chi saqil chan ru yoo chi xik li tumin ut li k'anjel tenq'anb'il xb'aaneb' li Consejos Departamentales de Desarrollo."
      },
      canales_denuncias: {
        title: "Vigilando la Integridad (Q'eqchi')",
        text: "Vigilando la Integridad a'an li mukmuil na'ajej re xk'ulb'al li yehok maak xb'aan li tenamit sa'eb' li ministerios, secretarías, gobernaciones departamentales ut jalaneb' chik rochochil li Organismo Ejecutivo chi k'ojk'o 24 hora."
      },
      canales_integridad: {
        title: "Canales por la Integridad (Q'eqchi')",
        text: "Canales por la Integridad naxch'utub' chixjunileb' li b'e re yehok maak k'eeb'ileb' xb'aan li junjunq chi rochochil li Organismo Ejecutivo re naq li tenamit naru tixye li elq' malaj li maa'usilal sa' correo, teléfono malaj hu sa' ulul ch'iich'."
      },
      riesgo_mira: {
        title: "Riesgo en la Mira (Q'eqchi')",
        text: "Riesgo en la Mira a'an jun k'anjelob'aal re saqil k'anjel li naxk'ut chan ru yookeb' chi xramb'al li elq' eb' li Instancias de Asuntos de Probidad sa' li Organismo Ejecutivo re rilb'al li xmaa'usil li loq'ok ut li tumin."
      },
      radiografia_corrupcion: {
        title: "Radiografía de la Corrupción (Q'eqchi')",
        text: "Radiografía de la Corrupción a'an jun k'anjelob'aal sa' ulul ch'iich' re rilb'al li esil chiwix li yehok maak k'eeb'il xb'aaneb' li rochochil li Organismo Ejecutivo chiru li Ministerio Público malaj eb' li raqleb'aal aatin."
      },
      acadeti: {
        title: "ACADETI (Q'eqchi')",
        text: "ACADETI a'an jun tz'oleb'aal sa' li ulul ch'iich' re tz'olok sa' li chaab'il na'leb', yaalil k'anjel ut xramb'al li elq', rik'in tz'aqal esil, jalam u ut k'anjel sa' komonil."
      }
    }
  },
  kaqchikel: {
    langName: "Kaqchikel (Idioma Maya)",
    ttsLang: 'es-GT',
    modules: {
      full: {
        title: "Resumen general richin ri Portal PIA (Kaqchikel)",
        text: "Ri Portal de Integridad Activa (PIA) are ri samajib'äl richin ri Q'atb'al Tzij richin Guatemala ri numol ri saqil tzij, ri jikomal samaj chuqa' ri b'ey richin ya'oj tzij pa ri Organismo Ejecutivo. Pa ri PIA, ri winaqi' tikil nkitz'et ri directorio, ri pwaq chuqa' CODEDE, ri Riesgo en la Mira chuqa' nkiya' ya'oj tzij ronojel q'ij."
      },
      directorio: {
        title: "Directorio Acceso Libre (Kaqchikel)",
        text: "Re samaj re' nuya' jun k'olbal tzij ri numol rutzijol ri taqem samaj pa ri Organismo Ejecutivo richin ruto'ik ri saqilal, rutzil samaj ex ruya'ik b'ey chi ke ri winaqi' pa rutzijol tinamit."
      },
      vehiculos: {
        title: "Ch'ich' richin Q'atb me Tzij pa Jikomal (Kaqchikel)",
        text: "Ri ch'ich' richin Q'atb'al Tzij nuya' rutzijol ri ch'ich' richin ri q'atb'al tzij. Ri winaqi' tikil nkitz'et ri retal ch'ich' richin nkiq'atej ri elaq' samaj."
      },
      gobierno_numeros: {
        title: "Tu Gobierno en Números (Kaqchikel)",
        text: "Are jun samaj richin q'atenik elaq' ri numol ex nuk'ut pa saqilal ri pwaq ex ri samaj pa ri Organismo Ejecutivo, richin ri winaqi' tikil nkitz'et pa jikomal."
      },
      transparencia_codede: {
        title: "Transparencia CODEDE (Kaqchikel)",
        text: "Are jun samaj ruk' wachb'al richin tz'etoj ri nuk'ut pa saqilal ri pwaq ex ri ub'anik ri samaj to'on richin ri Consejos Departamentales de Desarrollo."
      },
      canales_denuncias: {
        title: "Vigilando la Integridad (Kaqchikel)",
        text: "Vigilando la Integridad are ri k'olbal richin uk'ulik ya'oj tzij richin ri winaqi' pa wi' ri etzelal pa ministerios, secretarías, gobernaciones departamentales chuqa' ch'aqa' chik samaj pa ri Organismo Ejecutivo pa 24 hora."
      },
      canales_integridad: {
        title: "Canales por la Integridad (Kaqchikel)",
        text: "Canales por la Integridad numol ronojel ri b'ey richin ya'oj tzij ya'on kumal ri rochoch samaj pa ri Organismo Ejecutivo richin ri winaqi' tikil nkiya' rutzijol ri elaq' o etzelal pa correo, teléfono o wuj pa kematz'ib'."
      },
      riesgo_mira: {
        title: "Riesgo en la Mira (Kaqchikel)",
        text: "Riesgo en la Mira are jun samajib'äl richin saqilal ri nuk'ut ri ub'anik chuqa' rutz'aqatixik ri q'atenik elaq' b'anon kumal ri Instancias de Asuntos de Probidad pa ri Organismo Ejecutivo richin rutz'etik sachoj o sobrecostos."
      },
      radiografia_corrupcion: {
        title: "Radiografía de la Corrupción (Kaqchikel)",
        text: "Radiografía de la Corrupción are jun samajib'äl pa kematz'ib' richin rutz'etik rutzijol ri ya'oj tzij pa wi' ri elaq' ya'on kumal ri rochoch samaj pa ri Organismo Ejecutivo chuwach ri Ministerio Público o q'atb'al tzij."
      },
      acadeti: {
        title: "ACADETI (Kaqchikel)",
        text: "ACADETI are jun tijob'al pa kematz'ib' richin tijonik pa wi' ri utzilaj b'ey, jikomal ex q'atenik elaq', ruk' tz'aqat tzij, wachb'al ex samaj pa komon."
      }
    }
  },
  mam: {
    langName: "Mam (Idioma Maya)",
    ttsLang: 'es-GT',
    modules: {
      full: {
        title: "Resumen general te Portal PIA (Mam)",
        text: "Aju Portal de Integridad Activa (PIA) te Q'atb'al Tzij te Guatemala nch'utb'ente saqil tqanil, aq'untl b'a'n ex be te q'i'n tzij toj Organismo Ejecutivo. Toj PIA, jaku tka'y xjal directorio, tqanil ti'j pwaq ex CODEDE, Riesgo en la Mira ex jaku t-xi q'i'n tzij toj 24 hora."
      },
      directorio: {
        title: "Directorio Acceso Libre (Mam)",
        text: "Aju aq'untl lu' ntzaj tq'o'n jun u'j te tqanil kyi'j k'loj aq'untl nchi q'onte tqanil te tnam toj Organismo Ejecutivo, tu'ntzun tten xnaq'tzb'il ex saqil toj aq'untl."
      },
      vehiculos: {
        title: "T-kolil B'eleba'al te Kavil (Mam)",
        text: "Ju T-kolil B'eleba'al nxq'uynen t-tx'olil b'eleba'al te Kavil te Guatemala, tu'n t-sje'n tnam ju placa ex tu'n t-kolil ja' t-sje'n elq'."
      },
      gobierno_numeros: {
        title: "Tu Gobierno en Números (Mam)",
        text: "Aju lu' jun aq'untl te xq'uqil tu'n tten saqil ti'j pwaq ex aq'untl toj Organismo Ejecutivo, tu'ntzun t-xi kyka'yin xjal chi b'a'nxix."
      },
      transparencia_codede: {
        title: "Transparencia CODEDE (Mam)",
        text: "Aju lu' jun aq'untl tuk'il ka'yb'il ntzaj tq'o'n tu'n t-xi ka'yit chi b'a'nxix tza'n n-ajb'en pwaq ex tza'n nxi b'et aq'untl kyu'n Consejos Departamentales de Desarrollo."
      },
      canales_denuncias: {
        title: "Vigilando la Integridad (Mam)",
        text: "Vigilando la Integridad jun kolb'il ja te k'ulb'il q'i'n tzij kyu'n xjal tib'aj il toj ministerios, secretarías, gobernaciones departamentales ex txqantl aq'untl toj Organismo Ejecutivo toj 24 hora."
      },
      canales_integridad: {
        title: "Canales por la Integridad (Mam)",
        text: "Canales por la Integridad nch'utb'ente kykyaqil be te q'i'n tzij q'o'n kyu'n junjun k'loj aq'untl toj Organismo Ejecutivo tu'n kyq'in xjal tzij tib'aj elq' toj correo, teléfono mo u'j toj kematz'ib'."
      },
      riesgo_mira: {
        title: "Riesgo en la Mira (Mam)",
        text: "Riesgo en la Mira jun aq'untl te saqil ntzaj tyek'un tza'n nxi b'et kolb'il ti'j elq' kyu'n Instancias de Asuntos de Probidad toj Organismo Ejecutivo tu'n t-xi ka'yit sobrecostos mo il toj laq'ob'il."
      },
      radiografia_corrupcion: {
        title: "Radiografía de la Corrupción (Mam)",
        text: "Radiografía de la Corrupción jun aq'untl toj kematz'ib' ntzaj tyek'un tqanil kyi'j q'i'n tzij tib'aj elq' q'o'n kyu'n aq'untl toj Organismo Ejecutivo twitz Ministerio Público mo q'atb'al tzij."
      },
      acadeti: {
        title: "ACADETI (Mam)",
        text: "ACADETI jun ja te xnaq'tzb'il toj kematz'ib' ti'j b'a'n b'e, jikomal ex kolb'il ti'j elq', tuk'il tqanil, tilb'ilal ex aq'untl toj komon."
      }
    }
  }
};

export const DEFAULT_CANALES_MULTILINGUAL = {
  es: {
    langKey: 'es',
    name: 'Español',
    badge: 'Nacional',
    title: 'Escuchar resumen informativo en Español',
    subtitle: 'Locución oficial sintetizada sobre cómo presentar denuncias sobre irregularidades.',
    speechText: 'Bienvenido a la Guía Multilingüe de Denuncia Segura de la Comisión Nacional contra la Corrupción. Para presentar una denuncia administrativa sobre cualquier falta de ética o corrupción en el Organismo Ejecutivo, siga cuatro pasos fundamentales: Primero, identifique el hecho o irregularidad. Segundo, elija su canal de preferencia como la línea 1514 o la plataforma Vigilando. Tercero, describa los detalles y adjunte evidencias si dispone de ellas. Cuarto, guarde su número correlativo de seguimiento. Su denuncia es 100% confidencial y protegida.',
    stepsHeading: 'Procedimiento de Denuncia Segura en 4 Pasos',
    steps: [
      { num: 1, title: 'Identificación del Hecho', native: 'Paso 1: Identificación', desc: 'Identifica la posible irregularidad, acto de corrupción o falta ética cometida en la institución del Ejecutivo.' },
      { num: 2, title: 'Selección de Canal', native: 'Paso 2: Selección de Canal', desc: 'Elige el mecanismo que prefieras: Línea telefónica 1514, correo de probidad, formulario web o atención presencial.' },
      { num: 3, title: 'Descripción y Evidencias', native: 'Paso 3: Detalle y Pruebas', desc: 'Proporciona información clara del suceso y adjunta documentos o fotos de soporte si cuentas con ellos.' },
      { num: 4, title: 'Correlativo Confidencial', native: 'Paso 4: Seguimiento', desc: 'Conserva tu código de seguimiento único para verificar el estado de gestión de forma confidencial y anónima.' }
    ],
    guaranteesTitle: 'Garantías de Confidencialidad y Protección CNC',
    guarantees: [
      { icon: 'fa-user-secret', title: '100% Confidencial y Anónimo', desc: 'No estás obligado a ingresar datos personales si temes por tu seguridad.' },
      { icon: 'fa-shield-alt', title: 'Protección contra Represalias', desc: 'Garantías éticas y legales para la protección del denunciante público y ciudadano.' },
      { icon: 'fa-clock', title: 'Disponibilidad 24/7 en Línea', desc: 'Recepcionamiento continuo mediante la plataforma oficial Vigilando la Integridad.' }
    ],
    glossaryTitle: 'Glosario de Términos en Lenguas Mayas',
    glossary: [
      { termEs: 'Corrupción', maya: 'Corrupción', speech: 'Corrupción: Uso indebido del poder público para beneficio privado.' },
      { termEs: 'Probidad', maya: 'Probidad e Integridad', speech: 'Probidad: Actuar con honestidad, transparencia y rectitud en el servicio público.' },
      { termEs: 'Denuncia', maya: 'Denuncia Confidencial', speech: 'Denuncia: Reporte formal sobre actos o irregularidades en el Estado.' },
      { termEs: 'Servidor Público', maya: 'Servidor Público', speech: 'Servidor público: Persona que trabaja e imparte servicios en las dependencias del Estado.' },
      { termEs: 'Transparencia', maya: 'Transparencia', speech: 'Transparencia: Acceso público y abierto a la información del gobierno.' }
    ]
  },
  en: {
    langKey: 'en',
    name: 'English',
    badge: 'International / English',
    title: 'Listen to the information summary in English',
    subtitle: 'Official synthesized voice guide on how to safely submit corruption and irregularity reports.',
    speechText: 'Welcome to the Multilingual Safe Reporting Guide of the National Commission against Corruption. To submit an administrative complaint regarding any corruption or lack of ethics in the Executive Branch, follow four key steps: First, identify the incident or irregularity. Second, choose your preferred channel such as line 1514 or the Vigilando platform. Third, describe the details and attach evidence if available. Fourth, keep your unique tracking code. Your report is 100% confidential and protected.',
    stepsHeading: 'Safe Reporting Procedure in 4 Steps',
    steps: [
      { num: 1, title: 'Incident Identification', native: 'Step 1: Identification', desc: 'Identify any potential irregularity, act of corruption, or breach of ethics within executive institutions.' },
      { num: 2, title: 'Channel Selection', native: 'Step 2: Channel Selection', desc: 'Select your preferred mechanism: Hotline 1514, probity email, online form, or in-person desk.' },
      { num: 3, title: 'Details & Evidence', native: 'Step 3: Details & Proof', desc: 'Provide clear information about the event and attach supporting documents or photos if available.' },
      { num: 4, title: 'Confidential Tracking Code', native: 'Step 4: Follow-up', desc: 'Save your unique tracking code to safely and anonymously check the status of your report.' }
    ],
    guaranteesTitle: 'Confidentiality & Whistleblower Protection Guarantees (CNC)',
    guarantees: [
      { icon: 'fa-user-secret', title: '100% Confidential & Anonymous', desc: 'You are not required to provide personal information if you fear for your safety.' },
      { icon: 'fa-shield-alt', title: 'Whistleblower Protection', desc: 'Ethical and legal guarantees to protect public servants and citizens who report.' },
      { icon: 'fa-clock', title: '24/7 Online Availability', desc: 'Continuous reception of reports through the official Vigilando la Integridad platform.' }
    ],
    glossaryTitle: 'Integrity Glossary & English / Mayan Terminology',
    glossary: [
      { termEs: 'Corruption', maya: 'Corruption', speech: 'Corruption: Abuse of entrusted public power for private gain.' },
      { termEs: 'Probity', maya: 'Probity & Integrity', speech: 'Probity: Adherence to highest principles, honesty, and transparency in public service.' },
      { termEs: 'Report', maya: 'Confidential Complaint', speech: 'Complaint: Formal report regarding illegal acts or irregularities in government.' },
      { termEs: 'Public Servant', maya: 'Public Servant', speech: 'Public servant: Person employed in government agencies providing public services.' },
      { termEs: 'Transparency', maya: 'Transparency', speech: 'Transparency: Open and public access to government information and decision-making.' }
    ]
  },
  kiche: {
    langKey: 'kiche',
    name: 'K’iche’',
    badge: 'Quiché / Totonicapán / Quetzaltenango',
    title: "Utatab'exik ri tz'ijob'al pa K’iche’",
    subtitle: 'Síntesis hablada en idioma K’iche’ sobre cómo usar los canales de denuncia de forma segura.',
    speechText: "Utzilaj peik pa ri chak patan re la CNC. Ri q’alajisanik chi rij ri itzel b’anob’al xukuje’ k’axk’olil k’aslemal: Nab’ey, chaweta’maj ri mac o k’axk’olil. Ruka’n, cha’o ri b’e ruk’ ri ojer ch’a’wibal 1514 o pa internet Vigilando. Rox, tz’ibaj ri chak u b’antajik xukuje’ ya’o ri wujil. Rukaj, k'olowa ri retal ujujal rech pa chi’ ri q’alajisanik. Konojel ri q'alajisanik e ebal xukuje' chajim k'aslemal.",
    stepsHeading: "B'eyb'al rech Q'alajisanik Jikomal pa 4 Taqim",
    steps: [
      { num: 1, title: 'Eta’manik re ri Mac', native: 'Nab’ey retal: Eta’manik', desc: 'Chaweta’maj xukuje’ chatz’ib’aj ri itzel b’anob’al o k’axk’olil xutir pa ri ja re k’amal b’e.' },
      { num: 2, title: 'Cha’oj re ri B’e', native: 'Ruka’n retal: Cha’oj b’e', desc: 'Cha’o ri b’e utz chawe: Ch’a’wibal 1514, wuj pa correo, o pa ri q’alajisabal Vigilando.' },
      { num: 3, title: 'Ujujal xukuje’ Wujil', native: 'Rox retal: Wujil q’alajisabal', desc: 'Tz’ib’aj ronojel ri xbanik xukuje’ ya’o ri wujil o wachbal chi rij ri mac.' },
      { num: 4, title: 'K’olowik Retal Ujujal', native: 'Rukaj retal: Retal chajinik', desc: 'K’olowa ri rajilajuj retal rech katkunik katz’onoj chi rij ri q’alajisanik pa ebal.' }
    ],
    guaranteesTitle: "Jikomal Ebal xukuje' Chajinik rech CNC",
    guarantees: [
      { icon: 'fa-user-secret', title: 'Ebal xukuje’ Maj Bi’aj', desc: 'Man k’atzin ta kaya’ ri abi’ we xiw kak’utuj ri chajinik.' },
      { icon: 'fa-shield-alt', title: 'Chajinik re ri Ajq’alajisal', desc: 'Garantías rech chajinik k’aslemal xukuje’ chak patan.' },
      { icon: 'fa-clock', title: 'Chak Ronojel Q’ij (24/7)', desc: 'Tzijim ri k’atel pa internet Vigilando la Integridad.' }
    ],
    glossaryTitle: "Choltzij pa Mayab' Tzijob'al K'iche'",
    glossary: [
      { termEs: 'Corrupción', maya: 'K’axk’olil k’aslemal', speech: 'K’axk’olil k’aslemal: Ri uq’ab’alisaxik ri chak pa itzelal.' },
      { termEs: 'Probidad', maya: 'Tiikil k’aslemal', speech: 'Tiikil k’aslemal: B’anob’al pa saqilal xukuje’ tiikilil.' },
      { termEs: 'Denuncia', maya: 'Q’alajisanik', speech: 'Q’alajisanik: Ya’ik b’ixik chi rij ri mac o itzel b’anob’al.' },
      { termEs: 'Servidor Público', maya: 'Ajchak re amaq’', speech: 'Ajchak re amaq’: Jun winaq kachakun pa ri ja re k’amal b’e.' },
      { termEs: 'Transparencia', maya: 'Saqilal', speech: 'Saqilal: Tz’etbal re ronojel ri chak rech ri k’amal b’e.' }
    ]
  },
  qeqchi: {
    langKey: 'qeqchi',
    name: 'Q’eqchi’',
    badge: 'Alta Verapaz / Baja Verapaz / Petén / Izabal',
    title: 'Xyeeb’al sa’ Aatinob’aal Q’eqchi’',
    subtitle: 'Síntesis informativa sintetizada en Q’eqchi’ sobre el procedimiento de denuncia segura.',
    speechText: 'Chaawil sa’ xyanqeb’ li xk’anjelal li xboqb’al xq’ilal li moko tiik ta xkuutuil sa’ li tenamit. Re xyeeb’al li xq’ilal: Xb’een, tawil li xmaak o li moko tiik ta b’anbil. Xka’pakal, taxik sa’ li tenamityeb’al malaj sa’ li aatinob’aal 1514 malaj Vigilando. Xrox, tatz’iib’aq resil chi us xend chaq’ab’iiqeb’ li hu. Xkaahil, taxakab’ li xruuchil xbaatxeb’al re tatenq’aq. Chixjunil li xyeeb’al muqmu ut tenq’anbil.',
    stepsHeading: "B'e re Yehok Maak sa' Muqmu sa' Kaahib' Xxik",
    steps: [
      { num: 1, title: 'Xtawab’al li Maak', native: 'Xb’een: Xtawab’al maak', desc: 'Tawil ut tatenq’a xk’utb’al li moko tiik ta xkuutuil b’anbil sa’ li rochoch k’anjel.' },
      { num: 2, title: 'Xsaq’ob’al li B’e', native: 'Xka’pakal: Xsaq’ob’al b’e', desc: 'Tasik’ li aatinob’aal 1514, correo de probidad, malaj sa’ li k’atam Vigilando.' },
      { num: 3, title: 'Xyeechi’ing ut Hu', native: 'Xrox: Xyeechi’ing hu', desc: 'Tatz’iib’aq resil ut tawakliqeb’ li xhuulil o xfotoyil li xmaak b’anbil.' },
      { num: 4, title: 'Xmuqik li Rajlabil', native: 'Xkaahil: Rajlabil muqmu', desc: 'Tak’atqaliq li xrajlabil xbaatxeb’al re xraqb’al xkuutuil sa’ muqmuil.' }
    ],
    guaranteesTitle: "Tenq'al Muqmu ut Kolb'al re CNC",
    guarantees: [
      { icon: 'fa-user-secret', title: 'Muqmu ut Tz’aqal Tenq’anbil', desc: 'Inc’a na’ajtaman aa k’ab’a’ re xyeeb’al li xmaak.' },
      { icon: 'fa-shield-alt', title: 'Xkolb’al li Ajyeel Maak', desc: 'Tenq’al chaq’rab’il re inc’a’ tatz’eq’te’q sa’ k’anjel.' },
      { icon: 'fa-clock', title: 'K’anjelal Rajlal K’utan (24/7)', desc: 'Li k’atam Vigilando wank sa’ k’unjil rajlal k’utan.' }
    ],
    glossaryTitle: "Aatinob'aal sa' Mayab' Aatin Q'eqchi'",
    glossary: [
      { termEs: 'Corrupción', maya: 'Moko tiik ta xkuutuil', speech: 'Moko tiik ta xkuutuil: Xk’anjelajisinkil li awab’ejiik sa’ moko tiik ta.' },
      { termEs: 'Probidad', maya: 'Tiikilal sa’ k’anjel', speech: 'Tiikilal: K’anjelak sa’ tiikilal ut sa’ saqenil.' },
      { termEs: 'Denuncia', maya: 'Xyeeb’al xq’ilal', speech: 'Xyeeb’al xq’ilal: Xboqb’al ut xyeeb’al li maak b’anbil.' },
      { termEs: 'Servidor Público', maya: 'Aj k’anjel chiru tenamit', speech: 'Aj k’anjel chiru tenamit: Li poyanam na k’anjelak sa’ awab’ejil.' },
      { termEs: 'Transparencia', maya: 'Saqenil sa’ k’anjel', speech: 'Saqenil: Xk’utb’al chixjunil sa’ saqilal chiru tenamit.' }
    ]
  },
  kaqchikel: {
    langKey: 'kaqchikel',
    name: 'Kaqchikel',
    badge: 'Chimaltenango / Sacatepéquez / Sololá',
    title: 'Ruwachinik Tz’ij pa Kaqchikel',
    subtitle: 'Síntesis oficial en Kaqchikel sobre la guía de denuncia e integridad institucional.',
    speechText: 'Ütz ipeteb’al pa ri ruwäch tz’ijob’äl re ri CNC. Re ujikorisaxik ri itzel b’anob’al o k’ayewal pa ri samaj re amaq’: Nab’ey, tawila’ ri mac. Ruka’n, tacha’ ri ab’ey achi’el ri ojer ch’a’wib’äl 1514 o ri ruxe’el Vigilando. Rox, tatz’ib’aj ronojel xukuje’ taya’ ri wujil. Rukaj, tak’olo’ ri rajilabal retal rech nakanuj ri rujikorisaxik. Ronojel ri tz’ij e ewän xukuje’ chajin.',
    stepsHeading: "Rub'eyal Jikorisaxik pa Ewäl pa Kaji' Taqim",
    steps: [
      { num: 1, title: 'Rujikorisaxik Mac', native: 'Nab’ey retal: Rujikorisaxik', desc: 'Tawila’ xukuje’ tatz’et ri itzel b’anob’al b’anom pa ri samaj re amaq’.' },
      { num: 2, title: 'Rucha’ik B’ey', native: 'Ruka’n retal: Rucha’ik b’ey', desc: 'Tacha’ ri ch’a’wib’äl 1514, correo de probidad, o ri ruxe’el Vigilando.' },
      { num: 3, title: 'Rutz’ib’axik xukuje’ Wuj', native: 'Rox retal: Wujil tz’eta’b’äl', desc: 'Tatz’ib’aj achike xbanatej xukuje’ taya’ ri wuj o rachb’al.' },
      { num: 4, title: 'Ruk’oloxik Retal', native: 'Rukaj retal: Retal ewäl', desc: 'Tak’olo’ ri rajilabal retal rech nak’utuj ri rujikorisaxik pa ewäl.' }
    ],
    guaranteesTitle: "Jikomal Ewäl chuqa' Ruchajixik CNC",
    guarantees: [
      { icon: 'fa-user-secret', title: '100% Ewäl xukuje’ Maj Bi’aj', desc: 'Man k’atzin ta naya’ abi’ we nak’utuj ri chajinik.' },
      { icon: 'fa-shield-alt', title: 'Ruchajixik Samajel', desc: 'Tob’al re chajinik pa samaj xukuje’ pa k’aslemal.' },
      { icon: 'fa-clock', title: 'Samaj Ronojel Q’ij (24/7)', desc: 'Ruxe’el Vigilando k’o pa internet ronojel ramaj.' }
    ],
    glossaryTitle: "Soltzij pa Maya' Ch'ab'äl Kaqchikel",
    glossary: [
      { termEs: 'Corrupción', maya: 'Itzel b’anob’al', speech: 'Itzel b’anob’al: Ruko’laxik ri uq’ab’al pa itzelil.' },
      { termEs: 'Probidad', maya: 'Choojilal', speech: 'Choojilal: Samajel pa choojilal xukuje’ pa saqilal.' },
      { termEs: 'Denuncia', maya: 'Rujikorisaxik mac', speech: 'Rujikorisaxik mac: Rutz’ib’axik xukuje’ ya’ik b’ixik re mac.' },
      { termEs: 'Servidor Público', maya: 'Samajel re amaq’', speech: 'Samajel re amaq’: Vinak kachakun pa rupeti’bal amaq’.' },
      { termEs: 'Transparencia', maya: 'Saqilal pa samaj', speech: 'Saqilal pa samaj: Rutz’etbal ronojel samaj chiru tenamit.' }
    ]
  },
  mam: {
    langKey: 'mam',
    name: 'Mam',
    badge: 'Huehuetenango / San Marcos / Quetzaltenango',
    title: 'Yol te Xpakyab’il pa Yol Mam',
    subtitle: 'Síntesis accesible en idioma Mam sobre el proceso de denuncia y garantías de protección.',
    speechText: 'B’an tzulena pa ri yol te xpakyab’il te CNC. Re t-xi t-q’ama’n jun myaw ba’n b’inchb’en pa ak’un te tnam: T-xe, t-ik’atz’ena ri myaw ba’n b’inchb’en. T-kab’in, t-sk’o’ya ri t-be achi’el ri yolb’il 1514 ma pa internet Vigilando. T-rox, t-tz’ib’ana ronojel xq’uqb’en utza’n t-q’ama’na wuj. T-kyajin, t-k’olob’a ri rajlab’al t-retal. Ronojel xpakyab’il te ewaj utz kolin.',
    stepsHeading: "T-b'eyil Xpakyab'il pa Ewajil sa' Kyaje' Taqam",
    steps: [
      { num: 1, title: 'T-ik’atz’en Myaw Ba’n', native: 'T-xe retal: Ik’atz’en', desc: 'T-ilintza utz t-tz’ib’anta ri myaw ba’n b’inchb’en b’inchajn pa ja te ak’unal.' },
      { num: 2, title: 'T-sk’o’ya B’ey', native: 'T-kab’in retal: Sk’o’b’ej', desc: 'T-sk’o’ya ri yolb’il 1514, correo de probidad, ma ri ruxe’el Vigilando.' },
      { num: 3, title: 'T-tz’ib’anjil utz Wuj', native: 'T-rox retal: Wuj xq’uqb’en', desc: 'T-tz’ib’anta tzu’n t-oba utz t-k’itz’a wuj ma foty te ch’ixb’il.' },
      { num: 4, title: 'T-k’olob’en Rajlab’al', native: 'T-kyajin retal: Rajlab’al ewaj', desc: 'T-k’olob’a ri rajlab’al t-retal te xq’uqlil pa ewajil.' }
    ],
    guaranteesTitle: "Kolb'il Ewajil ex Kolil CNC",
    guarantees: [
      { icon: 'fa-user-secret', title: 'Ewajil utz Nti’ Bi’aj', desc: 'Nti’ t-ilo t-ja’ya bi’aj ka t-q’ama’ya.' },
      { icon: 'fa-shield-alt', title: 'T-kolil Ajxpakyal', desc: 'Kolil xq’uqb’en te t-ak’un utz te t-k’aslemal.' },
      { icon: 'fa-clock', title: 'Ak’unal Q’ij Q’ij (24/7)', desc: 'Ruxe’el Vigilando ate’ pa internet tkyaqil q’ij.' }
    ],
    glossaryTitle: "Tx'oltzij pa Yol Maya Mam",
    glossary: [
      { termEs: 'Corrupción', maya: 'Myaw ba’n b’inchb’en', speech: 'Myaw ba’n b’inchb’en: T-ak’unil te tnam pa itzelil.' },
      { termEs: 'Probidad', maya: 'Ba’n ch’ixb’il', speech: 'Ba’n ch’ixb’il: Ak’unal pa choojil utz pa saqil.' },
      { termEs: 'Denuncia', maya: 'Xpakyab’il', speech: 'Xpakyab’il: T-xi q’ama’n myaw ba’n b’inchb’en.' },
      { termEs: 'Servidor Público', maya: 'Aq’unal te tnam', speech: 'Aq’unal te tnam: Xjal n-ak’unan pa ja te k’amal b’e.' },
      { termEs: 'Transparencia', maya: 'Saqtz’il pa ak’un', speech: 'Saqtz’il: T-ilintzaj tkyaqil ak’un chiru tnam.' }
    ]
  },
  tzutujil: {
    langKey: 'tzutujil',
    name: "Tz'utujil",
    badge: 'Sololá / Suchitepéquez',
    title: "Utatab'exik ri tz'ijob'al pa Tz'utujil",
    subtitle: "Síntesis hablada en Tz'utujil sobre canales de denuncia e integridad pública.",
    speechText: "Utzilaj peik pa ri chak patan re ri CNC. Re ujikorisaxik ri itzel b'anob'al pa ri qatinamit: Nab'ey, chaweta'maj ri mac. Ruka'n, cha'o ri b'e achi'el ri 1514 o Vigilando. Rox, tz'ibaj ronojel xukuje' ya'o ri wujil. Rukaj, k'olowa ri retal ujujal. Konojel ri q'alajisanik e ebal xukuje' chajin.",
    stepsHeading: "B'eyal Q'alajisanik Jikomal pa Kaji' Taqim",
    steps: [
      { num: 1, title: 'Eta’manik re ri Mac', native: 'Nab’ey: Eta’manik', desc: 'Chaweta’maj ri itzel b’anob’al o mac xutir pa ri rochoch k’amal b’ey.' },
      { num: 2, title: 'Cha’oj re ri B’e', native: 'Ruka’n: Cha’oj b’e', desc: 'Cha’o ri b’e utz: Ch’a’wibal 1514, correo de probidad, o ri plataforma Vigilando.' },
      { num: 3, title: 'Wujil xukuje’ Pruebas', native: 'Rox: Wujil q’alajisabal', desc: 'Tz’ib’aj ronojel ri xbanik xukuje’ ya’o ri wujil o wachbal chi rij ri mac.' },
      { num: 4, title: 'Retal Chajinik', native: 'Rukaj: Retal ewäl', desc: 'K’olowa ri rajilajuj retal rech katkunik katz’onoj pa ewäl.' }
    ],
    guaranteesTitle: "Jikomal Ewäl chuqa' Ruchajixik CNC",
    guarantees: [
      { icon: 'fa-user-secret', title: '100% Ewäl xukuje’ Maj Bi’aj', desc: 'Man k’atzin ta kaya’ ri abi’ we xiw kak’utuj ri chajinik.' },
      { icon: 'fa-shield-alt', title: 'Ruchajixik Ajq’alajisal', desc: 'Garantías rech chajinik k’aslemal xukuje’ chak patan.' },
      { icon: 'fa-clock', title: 'Chak Ronojel Q’ij (24/7)', desc: 'Tzijim ri k’atel pa internet Vigilando la Integridad.' }
    ],
    glossaryTitle: "Soltzij pa Tz'utujil Tzijob'al",
    glossary: [
      { termEs: 'Corrupción', maya: 'Itzel b’anob’al', speech: 'Itzel b’anob’al: Ri uq’ab’alisaxik ri chak pa itzelal.' },
      { termEs: 'Probidad', maya: 'Choojilal', speech: 'Choojilal: B’anob’al pa saqilal xukuje’ choojilal.' },
      { termEs: 'Denuncia', maya: 'Q’alajisanik', speech: 'Q’alajisanik: Ya’ik b’ixik chi rij ri mac o itzel b’anob’al.' },
      { termEs: 'Servidor Público', maya: 'Samajel re amaq’', speech: 'Samajel re amaq’: Jun winaq kachakun pa ri rochoch k’amal b’ey.' },
      { termEs: 'Transparencia', maya: 'Saqilal', speech: 'Saqilal: Tz’etbal re ronojel ri chak rech ri k’amal b’ey.' }
    ]
  },
  poqomchi: {
    langKey: 'poqomchi',
    name: "Poqomchi'",
    badge: 'Alta Verapaz / Baja Verapaz',
    title: "Xyeeb'al sa' Aatinob'aal Poqomchi'",
    subtitle: "Síntesis en idioma Poqomchi' sobre el procedimiento de denuncia y protección ciudadana.",
    speechText: "Chaawil sa' xyanqeb' li xk'anjelal li xboqb'al xq'ilal li moko tiik ta pan qatinamit. Re xyeeb'al li xq'ilal: Xb'een, tawil li xmaak. Xka'pakal, taxik sa' li aatinob'aal 1514 malaj Vigilando. Xrox, tatz'iib'aq resil ut ch'aqab'iiqeb' li hu. Xkaahil, taxakab' li xrajlabil. Chixjunil muqmu ut kolb'il.",
    stepsHeading: "B'e re Q'orb'al Maak sa' Muqmu pan Kajeeb' Xxik",
    steps: [
      { num: 1, title: 'Xtawab’al li Maak', native: 'Xb’een: Xtawab’al', desc: 'Tawil ut tatenq’a xk’utb’al li moko tiik ta xkuutuil pan rochoch k’amalb’e.' },
      { num: 2, title: 'Xsaq’ob’al li B’e', native: 'Xka’pakal: Xsaq’ob’al', desc: 'Tasik’ li aatinob’aal 1514, correo de probidad, malaj sa’ li k’atam Vigilando.' },
      { num: 3, title: 'Xyeechi’ing ut Hu', native: 'Xrox: Xyeechi’ing', desc: 'Tatz’iib’aq resil ut tawakliqeb’ li xhuulil o xfotoyil li xmaak.' },
      { num: 4, title: 'Xmuqik li Rajlabil', native: 'Xkaahil: Rajlabil muqmu', desc: 'Tak’atqaliq li xrajlabil xbaatxeb’al re xraqb’al sa’ muqmuil.' }
    ],
    guaranteesTitle: "Muqmuil ut Kolb'al re CNC",
    guarantees: [
      { icon: 'fa-user-secret', title: 'Muqmu ut Tz’aqal Kolb’il', desc: 'Inc’a na’ajtaman aa k’ab’a’ re xyeeb’al li xmaak.' },
      { icon: 'fa-shield-alt', title: 'Xkolb’al li Ajyeel Maak', desc: 'Tenq’al chaq’rab’il re inc’a’ tatz’eq’te’q pan k’anjel.' },
      { icon: 'fa-clock', title: 'K’anjelal Rajlal K’utan (24/7)', desc: 'Li k’atam Vigilando wank sa’ k’unjil rajlal k’utan.' }
    ],
    glossaryTitle: "Ahtinob'al pan Poqomchi' Tzij",
    glossary: [
      { termEs: 'Corrupción', maya: 'Moko tiik ta xkuutuil', speech: 'Moko tiik ta: Xk’anjelajisinkil li awab’ejiik sa’ moko tiik ta.' },
      { termEs: 'Probidad', maya: 'Tiikilal pan k’anjel', speech: 'Tiikilal: K’anjelak sa’ tiikilal ut sa’ saqenil.' },
      { termEs: 'Denuncia', maya: 'Q’orb’al maak', speech: 'Q’orb’al maak: Xboqb’al ut xyeeb’al li maak b’anbil.' },
      { termEs: 'Servidor Público', maya: 'Aj k’anjel re tinamit', speech: 'Aj k’anjel: Li poyanam na k’anjelak sa’ awab’ejil.' },
      { termEs: 'Transparencia', maya: 'Saqilal', speech: 'Saqilal: Xk’utb’al chixjunil pan saqilal chiru tenamit.' }
    ]
  }
};

export const DEFAULT_I18N_DICTIONARY = {
  es: {
    "Inicio": "Inicio",
    "Consulta": "Consulta",
    "Explora": "Explora",
    "Aprende": "Aprende",
    "Reporta": "Reporta",
    "Directorio institucional": "Directorio institucional",
    "Transparencia Vehicular": "Transparencia Vehicular",
    "Transparencia CODEDE": "Transparencia CODEDE",
    "Tu Gobierno en números": "Tu Gobierno en números",
    "Radiografía de la Corrupción": "Radiografía de la Corrupción",
    "Riesgo en la Mira": "Riesgo en la Mira",
    "ACADETI": "ACADETI",
    "Canales por la Integridad": "Canales por la Integridad",
    "Vigilando": "Vigilando",
    "Consultar canales": "Consultar canales",
    "Guía de Denuncia Segura": "Guía de Denuncia Segura",
    "¿Qué es Canales por la Integridad?": "¿Qué es Canales por la Integridad?",
    "Canales de denuncia": "Canales de denuncia",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "Listado de Canales de denuncia del Organismo Ejecutivo",
    "Tarjetas": "Tarjetas",
    "Lista": "Lista",
    "Filtros de Búsqueda": "Filtros de Búsqueda",
    "Tipo institución": "Tipo institución",
    "Nombre": "Nombre",
    "Búsqueda libre": "Búsqueda libre",
    "Favoritos": "Favoritos",
    "Restablecer filtros": "Restablecer filtros",
    "Instituciones": "Instituciones",
    "Con Protocolo de Actuación": "Con Protocolo de Actuación",
    "Protocolo de actuación - Emitido": "Protocolo de actuación - Emitido",
    "Protocolo de actuación - En proceso": "Protocolo de actuación - En proceso",
    "Exportar PDF": "Exportar PDF",
    "Exportar Excel": "Exportar Excel",
    "Detalles": "Detalles",
    "Procedimiento de Denuncia Segura en 4 Pasos": "Procedimiento de Denuncia Segura en 4 Pasos",
    "Garantías de Confidencialidad y Protección CNC": "Garantías de Confidencialidad y Protección CNC",
    "Glosario de Términos en Lenguas Mayas": "Glosario de Términos en Lenguas Mayas",
    "Dashboard de Cumplimiento del Protocolo CNC": "Dashboard de Cumplimiento del Protocolo CNC",
    "Mostrar Dashboard de Cumplimiento CNC": "Mostrar Dashboard de Cumplimiento CNC",
    "Ocultar Dashboard de Cumplimiento CNC": "Ocultar Dashboard de Cumplimiento CNC",
    "Corrupción": "Corrupción",
    "Probidad": "Probidad",
    "Denuncia": "Denuncia",
    "Servidor Público": "Servidor Público",
    "Transparencia": "Transparencia"
  },
  en: {
    "Inicio": "Home",
    "Consulta": "Directory & Query",
    "Explora": "Explore",
    "Aprende": "Learn",
    "Reporta": "Report",
    "Directorio institucional": "Institutional Directory",
    "Transparencia Vehicular": "Vehicle Transparency",
    "Transparencia CODEDE": "CODEDE Transparency",
    "Tu Gobierno en números": "Government in Numbers",
    "Radiografía de la Corrupción": "Corruption Radiography",
    "Riesgo en la Mira": "Risk Spotlight",
    "ACADETI": "ACADETI Academy",
    "Canales por la Integridad": "Channels for Integrity",
    "Vigilando": "Vigilando Platform",
    "Consultar canales": "Search Channels",
    "Guía de Denuncia Segura": "Safe Reporting Guide",
    "¿Qué es Canales por la Integridad?": "What is Channels for Integrity?",
    "Canales de denuncia": "Reporting Channels",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "List of Reporting Channels of the Executive Branch",
    "Tarjetas": "Cards",
    "Lista": "List",
    "Filtros de Búsqueda": "Search Filters",
    "Tipo institución": "Institution Type",
    "Nombre": "Name",
    "Búsqueda libre": "Keyword Search",
    "Favoritos": "Favorites",
    "Restablecer filtros": "Reset Filters",
    "Instituciones": "Institutions",
    "Con Protocolo de Actuación": "With Action Protocol",
    "Protocolo de actuación - Emitido": "Action Protocol - Issued",
    "Protocolo de actuación - En proceso": "Action Protocol - In Progress",
    "Exportar PDF": "Export PDF",
    "Exportar Excel": "Export Excel",
    "Detalles": "Details",
    "Procedimiento de Denuncia Segura en 4 Pasos": "Safe Reporting Procedure in 4 Steps",
    "Garantías de Confidencialidad y Protección CNC": "Confidentiality & Protection Guarantees (CNC)",
    "Glosario de Términos en Lenguas Mayas": "Glossary of Terms in Mayan Languages",
    "Dashboard de Cumplimiento del Protocolo CNC": "CNC Protocol Compliance Dashboard",
    "Mostrar Dashboard de Cumplimiento CNC": "Show CNC Compliance Dashboard",
    "Ocultar Dashboard de Cumplimiento CNC": "Hide CNC Compliance Dashboard",
    "Corrupción": "Corruption",
    "Probidad": "Probity",
    "Denuncia": "Complaint / Report",
    "Servidor Público": "Public Servant",
    "Transparencia": "Transparency"
  },
  kiche: {
    "Inicio": "Nab'ey Uwach",
    "Consulta": "Tz'ononik",
    "Explora": "Tz'etonik",
    "Aprende": "Eta'manik",
    "Reporta": "Q'alajisanik",
    "Directorio institucional": "K'olbal K'amal B'e",
    "Transparencia Vehicular": "Saqilal rech Ch'ich'",
    "Transparencia CODEDE": "Saqilal CODEDE",
    "Tu Gobierno en números": "Qatinamit pa Ajlab'al",
    "Radiografía de la Corrupción": "Q'alajisanik Itzelal",
    "Riesgo en la Mira": "Q'atb'al Elq'anem",
    "ACADETI": "Tijob'al ACADETI",
    "Canales por la Integridad": "B'e rech Jikomal",
    "Vigilando": "Vigilando la Integridad",
    "Consultar canales": "Chatzukuj B'ey",
    "Guía de Denuncia Segura": "Uwachb'al Q'alajisanik Jikomal",
    "¿Qué es Canales por la Integridad?": "¿Jas ri B'e rech Jikomal?",
    "Canales de denuncia": "B'e rech Q'alajisanik",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "Cholb'al B'e rech Q'alajisanik rech ri K'amal B'e",
    "Tarjetas": "Wujil",
    "Lista": "Cholaj",
    "Filtros de Búsqueda": "Chayub'al Tzukunem",
    "Tipo institución": "Uwach Patanib'al",
    "Nombre": "Bi'aj",
    "Búsqueda libre": "Tzukunem",
    "Favoritos": "Cha'om",
    "Restablecer filtros": "K'isb'al Chayub'al",
    "Instituciones": "Patanib'al Amaq'",
    "Con Protocolo de Actuación": "Ruk' B'eyb'al Chak",
    "Protocolo de actuación - Emitido": "B'eyb'al Chak - Tz'aqat Ya'om",
    "Protocolo de actuación - En proceso": "B'eyb'al Chak - Tajin Ub'anik",
    "Exportar PDF": "Wujil PDF",
    "Exportar Excel": "Wujil Excel",
    "Detalles": "Rilixik",
    "Procedimiento de Denuncia Segura en 4 Pasos": "B'eyb'al rech Q'alajisanik Jikomal pa 4 Taqim",
    "Garantías de Confidencialidad y Protección CNC": "Jikomal Ebal xukuje' Chajinik rech CNC",
    "Glosario de Términos en Lenguas Mayas": "Choltzij pa Mayab' Tzijob'al",
    "Dashboard de Cumplimiento del Protocolo CNC": "Wachbalil Pajtij rech B'eyb'al CNC",
    "Mostrar Dashboard de Cumplimiento CNC": "K'utu' Wachbalil Pajtij CNC",
    "Ocultar Dashboard de Cumplimiento CNC": "Ewa' Wachbalil Pajtij CNC",
    "Corrupción": "K’axk’olil k’aslemal",
    "Probidad": "Tiikil k’aslemal",
    "Denuncia": "Q’alajisanik",
    "Servidor Público": "Ajchak re amaq’",
    "Transparencia": "Saqilal"
  },
  qeqchi: {
    "Inicio": "Xb'eenil",
    "Consulta": "Tz'ilok",
    "Explora": "Sik'ok",
    "Aprende": "Tz'olek",
    "Reporta": "Yehok Maak",
    "Directorio institucional": "Rochochil K'anjel",
    "Transparencia Vehicular": "Saqenil li B'eleba'aal",
    "Transparencia CODEDE": "Saqenil CODEDE",
    "Tu Gobierno en números": "Li Tenamit sa' Ajl",
    "Radiografía de la Corrupción": "Xcha'alil li Moko Tiik Ta",
    "Riesgo en la Mira": "Xk'amb'al li C'a'ux",
    "ACADETI": "Tz'oleb'aal ACADETI",
    "Canales por la Integridad": "B'e re Tiikilal",
    "Vigilando": "Vigilando la Integridad",
    "Consultar canales": "Sik'eb' li B'e",
    "Guía de Denuncia Segura": "K'utb'esihom re Yehok Maak sa' Muqmu",
    "¿Qué es Canales por la Integridad?": "¿K'aru li B'e re Tiikilal?",
    "Canales de denuncia": "B'e re Yehok Maak",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "Xtuslal li B'e re Yehok Maak re li Awab'ejil",
    "Tarjetas": "Hu",
    "Lista": "Tuslal",
    "Filtros de Búsqueda": "Chayleb'al Sik'ok",
    "Tipo institución": "Xpaayil Rochochil K'anjel",
    "Nombre": "K'ab'a'ej",
    "Búsqueda libre": "Sik'ok",
    "Favoritos": "Sik'b'ileb'",
    "Restablecer filtros": "K'ojob'ankil Chayleb'al",
    "Instituciones": "Rochochil K'anjel",
    "Con Protocolo de Actuación": "Ruk' B'ey K'anjel",
    "Protocolo de actuación - Emitido": "B'ey K'anjel - K'eeb'il Chaq",
    "Protocolo de actuación - En proceso": "B'ey K'anjel - Yook K'anjelak",
    "Exportar PDF": "Xk'eb'al sa' PDF",
    "Exportar Excel": "Xk'eb'al sa' Excel",
    "Detalles": "Rileb'al",
    "Procedimiento de Denuncia Segura en 4 Pasos": "B'e re Yehok Maak sa' Muqmu sa' Kaahib' Xxik",
    "Garantías de Confidencialidad y Protección CNC": "Tenq'al Muqmu ut Kolb'al re CNC",
    "Glosario de Términos en Lenguas Mayas": "Aatinob'aal sa' Mayab' Aatin",
    "Dashboard de Cumplimiento del Protocolo CNC": "Xcha'alil Xk'anjelil li B'ey CNC",
    "Mostrar Dashboard de Cumplimiento CNC": "K'utb'esinkil Xcha'alil CNC",
    "Ocultar Dashboard de Cumplimiento CNC": "Muqb'al Xcha'alil CNC",
    "Corrupción": "Moko tiik ta xkuutuil",
    "Probidad": "Tiikilal sa’ k’anjel",
    "Denuncia": "Xyeeb’al xq’ilal",
    "Servidor Público": "Aj k’anjel chiru tenamit",
    "Transparencia": "Saqenil sa’ k’anjel"
  },
  kaqchikel: {
    "Inicio": "Rutikirb'al",
    "Consulta": "Tz'ononik",
    "Explora": "Kanoj",
    "Aprende": "Etamab'al",
    "Reporta": "Rujikorisaxik",
    "Directorio institucional": "Ruk'olbal Samaj",
    "Transparencia Vehicular": "Saqilal rech Ch'ich'",
    "Transparencia CODEDE": "Saqilal CODEDE",
    "Tu Gobierno en números": "Qatinamit pa Ajlab'al",
    "Radiografía de la Corrupción": "Rutz'etbal Itzelal",
    "Riesgo en la Mira": "Tz'etoj Ruyonal Elaq'",
    "ACADETI": "Tijob'al ACADETI",
    "Canales por la Integridad": "B'ey richin Jikomal",
    "Vigilando": "Vigilando la Integridad",
    "Consultar canales": "Consultar canales",
    "Guía de Denuncia Segura": "Ruwachb'al Jikorisaxik pa Ewäl",
    "¿Qué es Canales por la Integridad?": "¿Achike ri B'ey richin Jikomal?",
    "Canales de denuncia": "B'ey richin Jikorisaxik",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "Rucholajem B'ey richin Jikorisaxik pa Poponem Amaq'",
    "Tarjetas": "Wuj",
    "Lista": "Cholajem",
    "Filtros de Búsqueda": "Chayub'al Samaj",
    "Tipo institución": "Ruvech Samajel",
    "Nombre": "B'i'aj",
    "Búsqueda libre": "Kanoj Samaj",
    "Favoritos": "Cha'on",
    "Restablecer filtros": "Ruk'exik Chayub'al",
    "Instituciones": "Rochoch Samaj",
    "Con Protocolo de Actuación": "Rik'in B'eyb'al Samaj",
    "Protocolo de actuación - Emitido": "B'eyb'al Samaj - Ya'on",
    "Protocolo de actuación - En proceso": "B'eyb'al Samaj - Tajin B'anik",
    "Exportar PDF": "Relesaxik PDF",
    "Exportar Excel": "Relesaxik Excel",
    "Detalles": "Rutz'etexik",
    "Procedimiento de Denuncia Segura en 4 Pasos": "Rub'eyal Jikorisaxik pa Ewäl pa Kaji' Taqim",
    "Garantías de Confidencialidad y Protección CNC": "Jikomal Ewäl chuqa' Ruchajixik CNC",
    "Glosario de Términos en Lenguas Mayas": "Soltzij pa Maya' Ch'ab'äl",
    "Dashboard de Cumplimiento del Protocolo CNC": "Ruk'utb'al Tz'aqat Samaj CNC",
    "Mostrar Dashboard de Cumplimiento CNC": "K'utu' Ruk'utb'al CNC",
    "Ocultar Dashboard de Cumplimiento CNC": "Ewaj Ruk'utb'al CNC",
    "Corrupción": "Itzel b’anob’al",
    "Probidad": "Choojilal",
    "Denuncia": "Rujikorisaxik mac",
    "Servidor Público": "Samajel re amaq’",
    "Transparencia": "Saqilal pa samaj"
  },
  mam: {
    "Inicio": "T-xe",
    "Consulta": "Q'ol Tzij",
    "Explora": "Kano'n",
    "Aprende": "Xnaq'tzb'il",
    "Reporta": "Xpakyab'il",
    "Directorio institucional": "T-tx'olil Ja te Ak'unal",
    "Transparencia Vehicular": "Saqtz'il B'eleba'al",
    "Transparencia CODEDE": "Saqtz'il CODEDE",
    "Tu Gobierno en números": "Ju Tnam sa' Ajlab'il",
    "Radiografía de la Corrupción": "T-tz'etb'il Myaw Ba'n",
    "Riesgo en la Mira": "T-tz'etb'il Elq'",
    "ACADETI": "Ja te Xnaq'tzb'il ACADETI",
    "Canales por la Integridad": "Be te Jikomal",
    "Vigilando": "Vigilando la Integridad",
    "Consultar canales": "Kano'n Be",
    "Guía de Denuncia Segura": "Uwach Xpakyab'il pa Ewajil",
    "¿Qué es Canales por la Integridad?": "¿Ti'tzan ju Be te Jikomal?",
    "Canales de denuncia": "Be te Xpakyab'il",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "T-tx'olil Be te Xpakyab'il te Kavil Kavil",
    "Tarjetas": "Wuj",
    "Lista": "Tx'olil",
    "Filtros de Búsqueda": "Chayb'il Kanub'il",
    "Tipo institución": "T-xilen Ak'unal",
    "Nombre": "Bi'aj",
    "Búsqueda libre": "Kanb'il",
    "Favoritos": "Sk'o'n",
    "Restablecer filtros": "Najsb'il Chayb'il",
    "Instituciones": "Ja te Kavil",
    "Con Protocolo de Actuación": "Tuk'il Be te Ak'un",
    "Protocolo de actuación - Emitido": "Be te Ak'un - T-xik Q'on",
    "Protocolo de actuación - En proceso": "Be te Ak'un - N-b'ant",
    "Exportar PDF": "Xb'ant sa' PDF",
    "Exportar Excel": "Xb'ant sa' Excel",
    "Detalles": "T-tz'etb'il",
    "Procedimiento de Denuncia Segura en 4 Pasos": "T-b'eyil Xpakyab'il pa Ewajil sa' Kyaje' Taqam",
    "Garantías de Confidencialidad y Protección CNC": "Kolb'il Ewajil ex Kolil CNC",
    "Glosario de Términos en Lenguas Mayas": "Tx'oltzij pa Yol Maya",
    "Dashboard de Cumplimiento del Protocolo CNC": "Wachb'alil T-k'ulb'en Be CNC",
    "Mostrar Dashboard de Cumplimiento CNC": "K'utb'en Wachb'alil CNC",
    "Ocultar Dashboard de Cumplimiento CNC": "Ewaj Wachb'alil CNC",
    "Corrupción": "Myaw ba’n b’inchb’en",
    "Probidad": "Ba’n ch’ixb’il",
    "Denuncia": "Xpakyab’il",
    "Servidor Público": "Aq’unal te tnam",
    "Transparencia": "Saqtz’il pa ak’un"
  },
  tzutujil: {
    "Inicio": "Rutikirb'al",
    "Consulta": "Tz'ononik",
    "Explora": "Kanoj",
    "Aprende": "Etamab'al",
    "Reporta": "Q'alajisanik",
    "Directorio institucional": "Rochoch K'amal B'ey",
    "Transparencia Vehicular": "Saqilal Ch'ich'",
    "Transparencia CODEDE": "Saqilal CODEDE",
    "Tu Gobierno en números": "Qatinamit pa Ajlab'al",
    "Radiografía de la Corrupción": "Rilbal Elaq'",
    "Riesgo en la Mira": "Chajinik Elaq'",
    "ACADETI": "Tijob'al ACADETI",
    "Canales por la Integridad": "B'ey rech Jikomal",
    "Vigilando": "Vigilando la Integridad",
    "Consultar canales": "Chakanuj B'ey",
    "Guía de Denuncia Segura": "B'eyb'al Q'alajisanik pa Ewäl",
    "¿Qué es Canales por la Integridad?": "¿Achike ri B'ey rech Jikomal?",
    "Canales de denuncia": "B'ey rech Q'alajisanik",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "Cholaj B'ey rech Q'alajisanik rech ri K'amal B'ey",
    "Tarjetas": "Wujil",
    "Lista": "Cholaj",
    "Filtros de Búsqueda": "Chayub'al Tzukunem",
    "Tipo institución": "Uwach Rochochil",
    "Nombre": "B'i'aj",
    "Búsqueda libre": "Tzukunem",
    "Favoritos": "Cha'om",
    "Restablecer filtros": "K'exb'al Chayub'al",
    "Instituciones": "Rochochil Amaq'",
    "Con Protocolo de Actuación": "Rik'in B'eyb'al Chak",
    "Protocolo de actuación - Emitido": "B'eyb'al Chak - Ya'on",
    "Protocolo de actuación - En proceso": "B'eyb'al Chak - Tajin Ub'anik",
    "Exportar PDF": "Wujil PDF",
    "Exportar Excel": "Wujil Excel",
    "Detalles": "Rilixik",
    "Procedimiento de Denuncia Segura en 4 Pasos": "B'eyal Q'alajisanik Jikomal pa Kaji' Taqim",
    "Garantías de Confidencialidad y Protección CNC": "Jikomal Ewäl chuqa' Ruchajixik CNC",
    "Glosario de Términos en Lenguas Mayas": "Soltzij pa Tz'utujil Tzijob'al",
    "Dashboard de Cumplimiento del Protocolo CNC": "Wachbalil Tz'aqat Samaj CNC",
    "Mostrar Dashboard de Cumplimiento CNC": "K'utu' Wachbalil CNC",
    "Ocultar Dashboard de Cumplimiento CNC": "Ewaj Wachbalil CNC",
    "Corrupción": "Itzel b’anob’al",
    "Probidad": "Choojilal",
    "Denuncia": "Q'alajisanik",
    "Servidor Público": "Samajel re amaq’",
    "Transparencia": "Saqilal"
  },
  poqomchi: {
    "Inicio": "Xtikrjiik",
    "Consulta": "Pahiik",
    "Explora": "Sik'iik",
    "Aprende": "Na'lb'iik",
    "Reporta": "Q'orb'al Maak",
    "Directorio institucional": "Rochochil K'amalb'e",
    "Transparencia Vehicular": "Saqilal Ch'ihch'",
    "Transparencia CODEDE": "Saqilal CODEDE",
    "Tu Gobierno en números": "Qatinamit pan Ajl",
    "Radiografía de la Corrupción": "Rilb'al Maak",
    "Riesgo en la Mira": "Cha'jnil Elaq'",
    "ACADETI": "Tijob'al ACADETI",
    "Canales por la Integridad": "B'e re Jikomal",
    "Vigilando": "Vigilando la Integridad",
    "Consultar canales": "Sik'eb' li B'e",
    "Guía de Denuncia Segura": "K'uhtesb'al Q'orb'al Maak sa' Muqmu",
    "¿Qué es Canales por la Integridad?": "¿Chaj b'i' li B'e re Jikomal?",
    "Canales de denuncia": "B'e re Q'orb'al Maak",
    "Listado de Canales de denuncia del Organismo Ejecutivo": "Tuslal B'e re Q'orb'al Maak re li Awab'ejil",
    "Tarjetas": "Hu",
    "Lista": "Tuslal",
    "Filtros de Búsqueda": "Chayleb'al",
    "Tipo institución": "Xpaayil Rochochil",
    "Nombre": "B'ihnaal",
    "Búsqueda libre": "Sik'iik",
    "Favoritos": "Sik'b'ileb'",
    "Restablecer filtros": "K'ojob'ankil Chayleb'al",
    "Instituciones": "Rochochil K'amalb'e",
    "Con Protocolo de Actuación": "Ruk' B'ey K'anjel",
    "Protocolo de actuación - Emitido": "B'ey K'anjel - K'eeb'il",
    "Protocolo de actuación - En proceso": "B'ey K'anjel - Yook B'anariik",
    "Exportar PDF": "Xk'eb'al pan PDF",
    "Exportar Excel": "Xk'eb'al pan Excel",
    "Detalles": "Rilb'al",
    "Procedimiento de Denuncia Segura en 4 Pasos": "B'e re Q'orb'al Maak sa' Muqmu pan Kajeeb' Xxik",
    "Garantías de Confidencialidad y Protección CNC": "Muqmuil ut Kolb'al re CNC",
    "Glosario de Términos en Lenguas Mayas": "Ahtinob'al pan Poqomchi' Tzij",
    "Dashboard de Cumplimiento del Protocolo CNC": "Xcha'alil K'anjelil CNC",
    "Mostrar Dashboard de Cumplimiento CNC": "K'uhtunk Xcha'alil CNC",
    "Ocultar Dashboard de Cumplimiento CNC": "Muqb'al Xcha'alil CNC",
    "Corrupción": "Moko tiik ta xkuutuil",
    "Probidad": "Tiikilal pan k'anjel",
    "Denuncia": "Q'orb'al maak",
    "Servidor Público": "Aj k'anjel re tinamit",
    "Transparencia": "Saqilal"
  }
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const FORBIDDEN_PATTERN = /<\s*script|<\s*\/\s*script|<\s*iframe|<\s*object|<\s*embed|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|on[a-z]+\s*=|<[^>]+>/i;
const VALID_ICON_REGEX = /^fa[srbl]?\s+fa-[a-z0-9-]+$/i;
const SINGLE_ICON_REGEX = /^fa-[a-z0-9-]+$/i;

export function sanitizeMultilingualText(rawValue, maxLength = 2500, fieldLabel = 'Texto', { allowEmpty = false } = {}) {
  if (typeof rawValue !== 'string') {
    return { valid: false, error: `${fieldLabel} debe ser texto plano válido.` };
  }
  const normalized = rawValue
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .trim();

  if (!allowEmpty && normalized.length === 0) {
    return { valid: false, error: `${fieldLabel} no puede quedar vacío.` };
  }
  if (normalized.length > maxLength) {
    return { valid: false, error: `${fieldLabel} excede el límite permitido de ${maxLength} caracteres.` };
  }
  if (FORBIDDEN_PATTERN.test(normalized)) {
    return { valid: false, error: `${fieldLabel} contiene etiquetas HTML, scripts o esquemas no permitidos.` };
  }
  return { valid: true, value: normalized };
}

function safeIcon(rawIcon, fallback = 'fas fa-shield-alt') {
  const s = String(rawIcon || '').trim().replace(/\s+/g, ' ');
  if (VALID_ICON_REGEX.test(s)) return s.toLowerCase();
  if (SINGLE_ICON_REGEX.test(s)) return s.toLowerCase();
  return fallback;
}

export function normalizePortalMultilingual(rawPortal) {
  const base = deepClone(DEFAULT_PORTAL_MULTILINGUAL);
  if (!rawPortal || typeof rawPortal !== 'object' || Array.isArray(rawPortal)) {
    return base;
  }

  for (const lang of PORTAL_LANG_ORDER) {
    const incomingLang = rawPortal[lang];
    if (!incomingLang || typeof incomingLang !== 'object' || Array.isArray(incomingLang)) continue;

    if (typeof incomingLang.langName === 'string') {
      const check = sanitizeMultilingualText(incomingLang.langName, 100, `Nombre idioma (${lang})`);
      if (check.valid) base[lang].langName = check.value;
    }
    if (typeof incomingLang.ttsLang === 'string') {
      const check = sanitizeMultilingualText(incomingLang.ttsLang, 20, `Código voz (${lang})`);
      if (check.valid && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(check.value)) {
        base[lang].ttsLang = check.value;
      }
    }

    const incomingMods = incomingLang.modules;
    if (incomingMods && typeof incomingMods === 'object' && !Array.isArray(incomingMods)) {
      for (const modKey of PORTAL_MODULE_ORDER) {
        const m = incomingMods[modKey];
        if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
        if (typeof m.title === 'string') {
          const ct = sanitizeMultilingualText(m.title, 200, `Título (${lang}.${modKey})`);
          if (ct.valid) base[lang].modules[modKey].title = ct.value;
        }
        if (typeof m.text === 'string') {
          const cx = sanitizeMultilingualText(m.text, 2500, `Guion (${lang}.${modKey})`);
          if (cx.valid) base[lang].modules[modKey].text = cx.value;
        }
      }
    }
  }
  return base;
}

export function normalizeCanalesMultilingual(rawCanales) {
  const base = deepClone(DEFAULT_CANALES_MULTILINGUAL);
  if (!rawCanales || typeof rawCanales !== 'object' || Array.isArray(rawCanales)) {
    return base;
  }

  for (const lang of CANALES_LANG_ORDER) {
    const inc = rawCanales[lang];
    if (!inc || typeof inc !== 'object' || Array.isArray(inc)) continue;

    const strFields = [
      ['name', 80],
      ['badge', 160],
      ['title', 200],
      ['subtitle', 400],
      ['speechText', 2500],
      ['stepsHeading', 200],
      ['guaranteesTitle', 200],
      ['glossaryTitle', 200]
    ];
    for (const [fld, max] of strFields) {
      if (typeof inc[fld] === 'string') {
        const chk = sanitizeMultilingualText(inc[fld], max, `${lang}.${fld}`);
        if (chk.valid) base[lang][fld] = chk.value;
      }
    }

    if (Array.isArray(inc.steps)) {
      base[lang].steps = base[lang].steps.map((defStep, idx) => {
        const s = inc.steps[idx];
        if (!s || typeof s !== 'object') return defStep;
        const tChk = typeof s.title === 'string' ? sanitizeMultilingualText(s.title, 160, `${lang}.steps[${idx}].title`) : { valid: false };
        const nChk = typeof s.native === 'string' ? sanitizeMultilingualText(s.native, 160, `${lang}.steps[${idx}].native`) : { valid: false };
        const dChk = typeof s.desc === 'string' ? sanitizeMultilingualText(s.desc, 600, `${lang}.steps[${idx}].desc`) : { valid: false };
        return {
          num: idx + 1,
          title: tChk.valid ? tChk.value : defStep.title,
          native: nChk.valid ? nChk.value : defStep.native,
          desc: dChk.valid ? dChk.value : defStep.desc
        };
      });
    }

    if (Array.isArray(inc.guarantees)) {
      base[lang].guarantees = base[lang].guarantees.map((defG, idx) => {
        const g = inc.guarantees[idx];
        if (!g || typeof g !== 'object') return defG;
        const tChk = typeof g.title === 'string' ? sanitizeMultilingualText(g.title, 160, `${lang}.guarantees[${idx}].title`) : { valid: false };
        const dChk = typeof g.desc === 'string' ? sanitizeMultilingualText(g.desc, 600, `${lang}.guarantees[${idx}].desc`) : { valid: false };
        return {
          icon: safeIcon(g.icon, defG.icon),
          title: tChk.valid ? tChk.value : defG.title,
          desc: dChk.valid ? dChk.value : defG.desc
        };
      });
    }

    if (Array.isArray(inc.glossary)) {
      base[lang].glossary = base[lang].glossary.map((defGl, idx) => {
        const gl = inc.glossary[idx];
        if (!gl || typeof gl !== 'object') return defGl;
        const eChk = typeof gl.termEs === 'string' ? sanitizeMultilingualText(gl.termEs, 120, `${lang}.glossary[${idx}].termEs`) : { valid: false };
        const mChk = typeof gl.maya === 'string' ? sanitizeMultilingualText(gl.maya, 160, `${lang}.glossary[${idx}].maya`) : { valid: false };
        const sChk = typeof gl.speech === 'string' ? sanitizeMultilingualText(gl.speech, 600, `${lang}.glossary[${idx}].speech`) : { valid: false };
        return {
          termEs: eChk.valid ? eChk.value : defGl.termEs,
          maya: mChk.valid ? mChk.value : defGl.maya,
          speech: sChk.valid ? sChk.value : defGl.speech
        };
      });
    }
  }
  return base;
}

export function normalizeI18nDictionary(rawI18n) {
  const base = deepClone(DEFAULT_I18N_DICTIONARY);
  if (!rawI18n || typeof rawI18n !== 'object' || Array.isArray(rawI18n)) {
    return base;
  }

  const canonicalKeys = Object.keys(DEFAULT_I18N_DICTIONARY.es);
  for (const lang of CANALES_LANG_ORDER) {
    const incDict = rawI18n[lang];
    if (!incDict || typeof incDict !== 'object' || Array.isArray(incDict)) continue;

    for (const k of canonicalKeys) {
      if (Object.prototype.hasOwnProperty.call(incDict, k) && typeof incDict[k] === 'string') {
        const chk = sanitizeMultilingualText(incDict[k], 300, `Diccionario (${lang}.${k})`);
        if (chk.valid) {
          base[lang][k] = chk.value;
        }
      }
    }
  }
  return base;
}

export function normalizeMultilingualDoc(rawDoc) {
  const src = (rawDoc && typeof rawDoc === 'object' && !Array.isArray(rawDoc)) ? rawDoc : {};
  const sectionMeta = {};
  for (const sec of MULTILINGUAL_SECTIONS) {
    const m = src.sectionUpdatedAt && typeof src.sectionUpdatedAt === 'object' ? src.sectionUpdatedAt[sec] : null;
    sectionMeta[sec] = typeof m === 'string' ? m : (src.updatedAt || null);
  }
  return {
    schemaVersion: 1,
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : null,
    updatedBy: typeof src.updatedBy === 'string' ? src.updatedBy : null,
    sectionUpdatedAt: sectionMeta,
    portal: normalizePortalMultilingual(src.portal),
    canales: normalizeCanalesMultilingual(src.canales),
    i18n: normalizeI18nDictionary(src.i18n)
  };
}

export function validateMultilingualSectionPayload(section, payload) {
  if (!MULTILINGUAL_SECTIONS.includes(section)) {
    return { valid: false, error: `Sección multilingüe no reconocida: "${section}".` };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'El cuerpo de datos multilingüe debe ser un objeto válido.' };
  }

  const allowedLangs = section === 'portal' ? PORTAL_LANG_ORDER : CANALES_LANG_ORDER;
  const incomingKeys = Object.keys(payload);
  if (incomingKeys.length === 0) {
    return { valid: false, error: 'Debe incluir al menos un idioma a actualizar.' };
  }
  for (const k of incomingKeys) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      return { valid: false, error: 'Clave no permitida en carga útil.' };
    }
    if (!allowedLangs.includes(k)) {
      return { valid: false, error: `Idioma no permitido para la sección "${section}": "${k}".` };
    }
  }

  if (section === 'portal') {
    const result = deepClone(DEFAULT_PORTAL_MULTILINGUAL);
    for (const lang of incomingKeys) {
      const langObj = payload[lang];
      if (!langObj || typeof langObj !== 'object' || Array.isArray(langObj)) {
        return { valid: false, error: `Estructura inválida para el idioma "${lang}".` };
      }
      if (langObj.langName !== undefined) {
        const chk = sanitizeMultilingualText(langObj.langName, 100, `Nombre visible (${lang})`);
        if (!chk.valid) return { valid: false, error: chk.error };
        result[lang].langName = chk.value;
      }
      if (langObj.ttsLang !== undefined) {
        const chk = sanitizeMultilingualText(langObj.ttsLang, 20, `Código de voz (${lang})`);
        if (!chk.valid || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(chk.value)) {
          return { valid: false, error: `Código de síntesis de voz inválido para "${lang}". Use por ejemplo es-GT o en-US.` };
        }
        result[lang].ttsLang = chk.value;
      }
      if (langObj.modules !== undefined) {
        if (!langObj.modules || typeof langObj.modules !== 'object' || Array.isArray(langObj.modules)) {
          return { valid: false, error: `Bloque "modules" inválido para el idioma "${lang}".` };
        }
        for (const [modKey, modVal] of Object.entries(langObj.modules)) {
          if (!PORTAL_MODULE_ORDER.includes(modKey)) {
            return { valid: false, error: `Módulo de guía no permitido en Portal: "${modKey}".` };
          }
          if (!modVal || typeof modVal !== 'object' || Array.isArray(modVal)) {
            return { valid: false, error: `Estructura inválida para "${lang}.${modKey}".` };
          }
          if (modVal.title !== undefined) {
            const cTitle = sanitizeMultilingualText(modVal.title, 200, `Título (${lang} · ${modKey})`);
            if (!cTitle.valid) return { valid: false, error: cTitle.error };
            result[lang].modules[modKey].title = cTitle.value;
          }
          if (modVal.text !== undefined) {
            const cText = sanitizeMultilingualText(modVal.text, 2500, `Texto de locución (${lang} · ${modKey})`);
            if (!cText.valid) return { valid: false, error: cText.error };
            result[lang].modules[modKey].text = cText.value;
          }
        }
      }
    }
    return { valid: true, validatedByLang: payload, normalizedFull: result };
  }

  if (section === 'canales') {
    for (const lang of incomingKeys) {
      const inc = payload[lang];
      if (!inc || typeof inc !== 'object' || Array.isArray(inc)) {
        return { valid: false, error: `Estructura inválida para idioma "${lang}".` };
      }
      const fieldLimits = {
        name: 80,
        badge: 160,
        title: 200,
        subtitle: 400,
        speechText: 2500,
        stepsHeading: 200,
        guaranteesTitle: 200,
        glossaryTitle: 200
      };
      for (const [f, maxLen] of Object.entries(fieldLimits)) {
        if (inc[f] !== undefined) {
          const chk = sanitizeMultilingualText(inc[f], maxLen, `${lang}.${f}`);
          if (!chk.valid) return { valid: false, error: chk.error };
        }
      }
      if (inc.steps !== undefined) {
        if (!Array.isArray(inc.steps) || inc.steps.length === 0 || inc.steps.length > 6) {
          return { valid: false, error: `La lista de pasos en "${lang}" debe tener entre 1 y 6 elementos.` };
        }
        for (let i = 0; i < inc.steps.length; i++) {
          const s = inc.steps[i] || {};
          for (const [sf, sm] of [['title', 160], ['native', 160], ['desc', 600]]) {
            if (s[sf] !== undefined) {
              const chk = sanitizeMultilingualText(s[sf], sm, `${lang} paso ${i + 1} (${sf})`);
              if (!chk.valid) return { valid: false, error: chk.error };
            }
          }
        }
      }
      if (inc.guarantees !== undefined) {
        if (!Array.isArray(inc.guarantees) || inc.guarantees.length === 0 || inc.guarantees.length > 6) {
          return { valid: false, error: `La lista de garantías en "${lang}" debe tener entre 1 y 6 elementos.` };
        }
        for (let i = 0; i < inc.guarantees.length; i++) {
          const g = inc.guarantees[i] || {};
          for (const [gf, gm] of [['title', 160], ['desc', 600]]) {
            if (g[gf] !== undefined) {
              const chk = sanitizeMultilingualText(g[gf], gm, `${lang} garantía ${i + 1} (${gf})`);
              if (!chk.valid) return { valid: false, error: chk.error };
            }
          }
        }
      }
      if (inc.glossary !== undefined) {
        if (!Array.isArray(inc.glossary) || inc.glossary.length === 0 || inc.glossary.length > 15) {
          return { valid: false, error: `El glosario en "${lang}" debe tener entre 1 y 15 términos.` };
        }
        for (let i = 0; i < inc.glossary.length; i++) {
          const gl = inc.glossary[i] || {};
          for (const [glf, glm] of [['termEs', 120], ['maya', 160], ['speech', 600]]) {
            if (gl[glf] !== undefined) {
              const chk = sanitizeMultilingualText(gl[glf], glm, `${lang} glosario ${i + 1} (${glf})`);
              if (!chk.valid) return { valid: false, error: chk.error };
            }
          }
        }
      }
    }
    return { valid: true, validatedByLang: payload };
  }

  // section === 'i18n'
  const canonicalKeys = new Set(Object.keys(DEFAULT_I18N_DICTIONARY.es));
  for (const lang of incomingKeys) {
    const dict = payload[lang];
    if (!dict || typeof dict !== 'object' || Array.isArray(dict)) {
      return { valid: false, error: `Diccionario inválido para idioma "${lang}".` };
    }
    const entries = Object.entries(dict);
    if (entries.length > 150) {
      return { valid: false, error: `Demasiadas entradas en diccionario "${lang}".` };
    }
    for (const [phraseKey, phraseVal] of entries) {
      if (!canonicalKeys.has(phraseKey)) {
        return { valid: false, error: `Frase no reconocida en el catálogo i18n: "${phraseKey}".` };
      }
      const chk = sanitizeMultilingualText(phraseVal, 300, `Frase "${phraseKey}" (${lang})`);
      if (!chk.valid) return { valid: false, error: chk.error };
    }
  }
  return { valid: true, validatedByLang: payload };
}

export function mergeSectionIntoCurrent(section, currentSectionData, incomingPayload) {
  const merged = deepClone(currentSectionData);
  if (section === 'portal') {
    for (const [lang, obj] of Object.entries(incomingPayload)) {
      if (!merged[lang]) continue;
      if (obj.langName !== undefined) merged[lang].langName = sanitizeMultilingualText(obj.langName, 100).value;
      if (obj.ttsLang !== undefined) merged[lang].ttsLang = sanitizeMultilingualText(obj.ttsLang, 20).value;
      if (obj.modules && typeof obj.modules === 'object') {
        for (const [mk, mv] of Object.entries(obj.modules)) {
          if (!merged[lang].modules[mk]) continue;
          if (mv.title !== undefined) merged[lang].modules[mk].title = sanitizeMultilingualText(mv.title, 200).value;
          if (mv.text !== undefined) merged[lang].modules[mk].text = sanitizeMultilingualText(mv.text, 2500).value;
        }
      }
    }
    return normalizePortalMultilingual(merged);
  }

  if (section === 'canales') {
    for (const [lang, obj] of Object.entries(incomingPayload)) {
      if (!merged[lang]) continue;
      const copy = { ...merged[lang] };
      for (const f of ['name', 'badge', 'title', 'subtitle', 'speechText', 'stepsHeading', 'guaranteesTitle', 'glossaryTitle']) {
        if (obj[f] !== undefined) copy[f] = sanitizeMultilingualText(obj[f], 2500).value;
      }
      if (Array.isArray(obj.steps)) copy.steps = obj.steps;
      if (Array.isArray(obj.guarantees)) copy.guarantees = obj.guarantees;
      if (Array.isArray(obj.glossary)) copy.glossary = obj.glossary;
      merged[lang] = copy;
    }
    return normalizeCanalesMultilingual(merged);
  }

  // section === 'i18n'
  for (const [lang, dict] of Object.entries(incomingPayload)) {
    if (!merged[lang]) continue;
    for (const [k, v] of Object.entries(dict)) {
      const chk = sanitizeMultilingualText(v, 300);
      if (chk.valid) merged[lang][k] = chk.value;
    }
  }
  return normalizeI18nDictionary(merged);
}

export function countSectionCustomizations(section, sectionData) {
  if (section === 'portal') {
    let total = 0;
    let modified = 0;
    for (const lang of PORTAL_LANG_ORDER) {
      const curL = sectionData?.[lang];
      const defL = DEFAULT_PORTAL_MULTILINGUAL[lang];
      if (!defL) continue;
      for (const mk of PORTAL_MODULE_ORDER) {
        total += 2;
        const cMod = curL?.modules?.[mk];
        const dMod = defL.modules[mk];
        if (cMod && cMod.title !== dMod.title) modified++;
        if (cMod && cMod.text !== dMod.text) modified++;
      }
    }
    return { total, modified };
  }

  if (section === 'canales') {
    let total = 0;
    let modified = 0;
    for (const lang of CANALES_LANG_ORDER) {
      const cur = sectionData?.[lang];
      const def = DEFAULT_CANALES_MULTILINGUAL[lang];
      if (!def) continue;
      for (const f of ['title', 'subtitle', 'speechText', 'stepsHeading', 'guaranteesTitle', 'glossaryTitle']) {
        total++;
        if (cur && cur[f] !== def[f]) modified++;
      }
      (def.steps || []).forEach((ds, idx) => {
        total += 3;
        const cs = cur?.steps?.[idx];
        if (cs && cs.title !== ds.title) modified++;
        if (cs && cs.native !== ds.native) modified++;
        if (cs && cs.desc !== ds.desc) modified++;
      });
      (def.guarantees || []).forEach((dg, idx) => {
        total += 2;
        const cg = cur?.guarantees?.[idx];
        if (cg && cg.title !== dg.title) modified++;
        if (cg && cg.desc !== dg.desc) modified++;
      });
      (def.glossary || []).forEach((dgl, idx) => {
        total += 3;
        const cgl = cur?.glossary?.[idx];
        if (cgl && cgl.termEs !== dgl.termEs) modified++;
        if (cgl && cgl.maya !== dgl.maya) modified++;
        if (cgl && cgl.speech !== dgl.speech) modified++;
      });
    }
    return { total, modified };
  }

  // i18n
  let total = 0;
  let modified = 0;
  const keys = Object.keys(DEFAULT_I18N_DICTIONARY.es);
  for (const lang of CANALES_LANG_ORDER) {
    const curD = sectionData?.[lang] || {};
    const defD = DEFAULT_I18N_DICTIONARY[lang] || {};
    for (const k of keys) {
      total++;
      if (curD[k] !== undefined && curD[k] !== defD[k]) modified++;
    }
  }
  return { total, modified };
}

export function buildAdminMultilingualPayload(doc, cloudSync = null) {
  const normalized = normalizeMultilingualDoc(doc);
  const stats = {};
  let totalModified = 0;
  let totalEntries = 0;
  for (const sec of MULTILINGUAL_SECTIONS) {
    const c = countSectionCustomizations(sec, normalized[sec]);
    stats[sec] = c;
    totalModified += c.modified;
    totalEntries += c.total;
  }

  return {
    sectionsMeta: MULTILINGUAL_SECTION_META,
    portalModuleOrder: PORTAL_MODULE_ORDER,
    portalModuleLabels: PORTAL_MODULE_LABELS,
    portalLangOrder: PORTAL_LANG_ORDER,
    canalesLangOrder: CANALES_LANG_ORDER,
    data: {
      portal: normalized.portal,
      canales: normalized.canales,
      i18n: normalized.i18n
    },
    defaults: {
      portal: DEFAULT_PORTAL_MULTILINGUAL,
      canales: DEFAULT_CANALES_MULTILINGUAL,
      i18n: DEFAULT_I18N_DICTIONARY
    },
    stats: {
      ...stats,
      totalEntries,
      totalModified
    },
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy,
    sectionUpdatedAt: normalized.sectionUpdatedAt,
    ...(cloudSync ? { cloudSync } : {})
  };
}
