/**
 * js/pia-i18n.js
 * Motor Global de Internacionalización y Traducción Reactiva (i18n)
 * Portal de Integridad Activa (PIA) — Gobierno de Guatemala
 *
 * Idiomas soportados:
 * - es: Español (Nacional / Oficial)
 * - en: English (Internacional)
 * - kiche: K'iche' (Maya)
 * - qeqchi: Q'eqchi' (Maya)
 * - kaqchikel: Kaqchikel (Maya)
 * - mam: Mam (Maya)
 * - tzutujil: Tz'utujil (Maya)
 * - poqomchi: Poqomchi' (Maya)
 */

(function (window, document) {
    'use strict';

    // 1. DICCIONARIO CANÓNICO Y EXACTO BIDIRECCIONAL
    const EXACT_DICTIONARY = {
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
            "Acadeti": "Acadeti",
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
            "Acadeti": "Acadeti Academy",
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
            "Acadeti": "Tijob'al Acadeti",
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
            "Acadeti": "Tz'oleb'aal Acadeti",
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
            "Acadeti": "Tijob'al Acadeti",
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
            "Acadeti": "Ja te Xnaq'tzb'il Acadeti",
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
            "Acadeti": "Tijob'al Acadeti",
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
            "Acadeti": "Tijob'al Acadeti",
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

    // 2. DATOS ESTRUCTURADOS DE MÓDULOS MAYAS Y MULTILINGÜES
    const MAYA_MODULE_DATA = {
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
                { icon: 'fa-shield-alt', title: 'Protection Against Retaliation', desc: 'Ethical and legal guarantees to protect public servants and citizens who report.' },
                { icon: 'fa-clock', title: '24/7 Online Availability', desc: 'Continuous reception of reports through the official Vigilando la Integridad platform.' }
            ],
            glossaryTitle: 'Integrity Glossary & English / Mayan Terminology',
            glossary: [
                { termEs: 'Corruption', maya: 'Corruption', speech: 'Corruption: Abuse of entrusted public power for private gain.' },
                { termEs: 'Probity', maya: 'Probity & Integrity', speech: 'Probity: Adherence to highest principles, honesty, and transparency in public service.' },
                { termEs: 'Complaint', maya: 'Confidential Complaint', speech: 'Complaint: Formal report regarding illegal acts or irregularities in government.' },
                { termEs: 'Public Servant', maya: 'Public Servant', speech: 'Public servant: Person employed in government agencies providing public services.' },
                { termEs: 'Transparency', maya: 'Transparency', speech: 'Transparency: Open and public access to government information and decision-making.' }
            ]
        },
        kiche: {
            langKey: 'kiche',
            name: "K’iche’",
            badge: "Quiché / Totonicapán / Quetzaltenango",
            title: "Utatab'exik ri tz'ijob'al pa K’iche’",
            subtitle: "Síntesis hablada en idioma K’iche’ sobre cómo usar los canales de denuncia de forma segura.",
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
            name: "Q’eqchi’",
            badge: "Alta Verapaz / Baja Verapaz / Petén / Izabal",
            title: "Xyeeb’al sa’ Aatinob’aal Q’eqchi’",
            subtitle: "Síntesis informativa sintetizada en Q’eqchi’ sobre el procedimiento de denuncia segura.",
            speechText: "Chaawil sa’ xyanqeb’ li xk’anjelal li xboqb’al xq’ilal li moko tiik ta xkuutuil sa’ li tenamit. Re xyeeb’al li xq’ilal: Xb’een, tawil li xmaak o li moko tiik ta b’anbil. Xka’pakal, taxik sa’ li tenamityeb’al malaj sa’ li aatinob’aal 1514 malaj Vigilando. Xrox, tatz’iib’aq resil chi us xend chaq’ab’iiqeb’ li hu. Xkaahil, taxakab’ li xruuchil xbaatxeb’al re tatenq’aq. Chixjunil li xyeeb’al muqmu ut tenq’anbil.",
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
            name: "Kaqchikel",
            badge: "Chimaltenango / Sacatepéquez / Sololá",
            title: "Ruwachinik Tz’ij pa Kaqchikel",
            subtitle: "Síntesis oficial en Kaqchikel sobre la guía de denuncia e integridad institucional.",
            speechText: "Ütz ipeteb’al pa ri ruwäch tz’ijob’äl re ri CNC. Re ujikorisaxik ri itzel b’anob’al o k’ayewal pa ri samaj re amaq’: Nab’ey, tawila’ ri mac. Ruka’n, tacha’ ri ab’ey achi’el ri ojer ch’a’wib’äl 1514 o ri ruxe’el Vigilando. Rox, tatz’ib’aj ronojel xukuje’ taya’ ri wujil. Rukaj, tak’olo’ ri rajilabal retal rech nakanuj ri rujikorisaxik. Ronojel ri tz’ij e ewän xukuje’ chajin.",
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
            name: "Mam",
            badge: "Huehuetenango / San Marcos / Quetzaltenango",
            title: "Yol te Xpakyab’il pa Yol Mam",
            subtitle: "Síntesis accesible en idioma Mam sobre el proceso de denuncia y garantías de protección.",
            speechText: "B’an tzulena pa ri yol te xpakyab’il te CNC. Re t-xi t-q’ama’n jun myaw ba’n b’inchb’en pa ak’un te tnam: T-xe, t-ik’atz’ena ri myaw ba’n b’inchb’en. T-kab’in, t-sk’o’ya ri t-be achi’el ri yolb’il 1514 ma pa internet Vigilando. T-rox, t-tz’ib’ana ronojel xq’uqb’en utza’n t-q’ama’na wuj. T-kyajin, t-k’olob’a ri rajlab’al t-retal. Ronojel xpakyab’il te ewaj utz kolin.",
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
            badge: "Sololá / Suchitepéquez",
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
            badge: "Alta Verapaz / Baja Verapaz",
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

    // 3. DETECCIÓN Y GESTIÓN DE IDIOMA
    const SUPPORTED_LANGS = ['es', 'en', 'kiche', 'qeqchi', 'kaqchikel', 'mam', 'tzutujil', 'poqomchi'];
    let currentLang = 'es';

    function detectLanguage() {
        // La guía multilingüe se encuentra inactivada de la interfaz por requerimiento oficial.
        // El idioma predeterminado de la plataforma es estrictamente Español ('es').
        try {
            // Limpiar cualquier residuo previo en localStorage para garantizar español
            const stored = localStorage.getItem('pia_inclusive_lang') || localStorage.getItem('pia_selected_lang');
            if (stored && stored !== 'es' && !window.PIA_MULTILINGUE_ACTIVE) {
                localStorage.setItem('pia_inclusive_lang', 'es');
                localStorage.setItem('pia_selected_lang', 'es');
            }
        } catch (_) {}
        return 'es';
    }

    currentLang = detectLanguage();

    // 4. BÚSQUEDA BIDIRECCIONAL Y CANÓNICA DE TRADUCCIÓN
    function findCanonicalSpanishKey(str) {
        if (!str || typeof str !== 'string') return '';
        const trimmed = str.trim();
        if (EXACT_DICTIONARY.es[trimmed]) return trimmed;

        // Búsqueda inversa en todos los idiomas para encontrar la llave canónica en español
        for (const lang of SUPPORTED_LANGS) {
            const dict = EXACT_DICTIONARY[lang];
            if (!dict) continue;
            for (const [esKey, val] of Object.entries(dict)) {
                if (val && val.toLowerCase() === trimmed.toLowerCase()) {
                    return esKey;
                }
            }
        }
        return trimmed;
    }

    function translateText(key, targetLang) {
        if (!key || typeof key !== 'string') return '';
        const target = (targetLang || currentLang || 'es').toLowerCase();
        const trimmed = key.trim();

        // Si ya es el idioma meta y existe directamente
        if (EXACT_DICTIONARY[target] && EXACT_DICTIONARY[target][trimmed]) {
            return EXACT_DICTIONARY[target][trimmed];
        }

        // Obtener llave canónica
        const canonicalKey = findCanonicalSpanishKey(trimmed);

        // Traducir desde el diccionario exacto
        if (EXACT_DICTIONARY[target] && EXACT_DICTIONARY[target][canonicalKey]) {
            return EXACT_DICTIONARY[target][canonicalKey];
        }

        // Si no se encuentra, retornar la llave canónica o el texto original
        return canonicalKey || trimmed;
    }

    // 5. REEMPLAZO DINÁMICO EN EL DOM PRESERVANDO ICONOS
    function replaceElementTextPreservingIcons(el, translatedText) {
        if (!el || !translatedText) return;

        // Guardar iconos FontAwesome existentes
        const icons = Array.from(el.querySelectorAll('i, svg'));
        const iconClones = icons.map(icon => icon.cloneNode(true));

        // Detectar si los iconos estaban al inicio o al final
        const startsWithIcon = el.firstElementChild && (el.firstElementChild.tagName === 'I' || el.firstElementChild.tagName === 'svg');
        const endsWithIcon = el.lastElementChild && (el.lastElementChild.tagName === 'I' || el.lastElementChild.tagName === 'svg');

        // Limpiar contenido
        el.innerHTML = '';

        if (startsWithIcon && iconClones.length > 0) {
            el.appendChild(iconClones[0]);
            el.appendChild(document.createTextNode(' ' + translatedText));
            for (let i = 1; i < iconClones.length; i++) {
                el.appendChild(document.createTextNode(' '));
                el.appendChild(iconClones[i]);
            }
        } else if (endsWithIcon && iconClones.length > 0) {
            el.appendChild(document.createTextNode(translatedText + ' '));
            iconClones.forEach(icon => el.appendChild(icon));
        } else {
            el.textContent = translatedText;
        }
    }

    // 6. ACTUALIZACIÓN GLOBAL DEL DOM
    function updateDOM(targetLang) {
        const lang = (targetLang || currentLang || 'es').toLowerCase();

        // A. Elementos con atributos declarativos (data-i18n, data-translate, data-t)
        const declarativeElements = document.querySelectorAll('[data-i18n], [data-translate], [data-t]');
        declarativeElements.forEach(el => {
            const rawKey = el.getAttribute('data-i18n') || el.getAttribute('data-translate') || el.getAttribute('data-t');
            if (rawKey) {
                const trans = translateText(rawKey, lang);
                replaceElementTextPreservingIcons(el, trans);
            }
        });

        // B. Reemplazo por IDs conocidos del Portal y Canales
        // Nota: heroCTA se mantiene estrictamente en español por requerimiento oficial
        const idMap = {
            'mayaStepsHeadingText': 'Procedimiento de Denuncia Segura en 4 Pasos',
            'mayaGuaranteesTitle': 'Garantías de Confidencialidad y Protección CNC',
            'labelToggleDash': 'Mostrar Dashboard de Cumplimiento CNC',
            'heroGuiaCTA': 'Guía de Denuncia Segura'
        };

        for (const [id, defaultEsKey] of Object.entries(idMap)) {
            const el = document.getElementById(id);
            if (el) {
                const currentText = el.textContent || defaultEsKey;
                const translated = translateText(currentText, lang);
                replaceElementTextPreservingIcons(el, translated);
            }
        }

        // C. Sincronizar módulos especiales (Guía multilingüe, pasos, garantías, glosario)
        updateSpecialModules(lang);

        // D. Actualizar atributo lang en el documento
        document.documentElement.setAttribute('lang', lang);

        // E. Sincronizar selectores de accesibilidad en navbar o páginas
        const topSelect = document.getElementById('a11yLangSelectTop');
        if (topSelect && topSelect.value !== lang) {
            topSelect.value = lang;
        }
    }

    // 7. MÓDULO ESPECIAL: «Procedimiento de Denuncia Segura en 4 Pasos», Garantías y Glosario
    function updateSpecialModules(lang) {
        const moduleData = MAYA_MODULE_DATA[lang] || MAYA_MODULE_DATA['es'];
        if (!moduleData) return;

        // 1. Encabezado de los 4 Pasos
        const stepsHeadingEl = document.getElementById('mayaStepsHeading');
        const stepsHeadingTextEl = document.getElementById('mayaStepsHeadingText');
        if (stepsHeadingTextEl) {
            stepsHeadingTextEl.textContent = moduleData.stepsHeading;
        } else if (stepsHeadingEl) {
            replaceElementTextPreservingIcons(stepsHeadingEl, moduleData.stepsHeading);
        }

        // 2. Banner de Audio Locución
        const audioTitle = document.getElementById('mayaAudioTitle');
        const audioSub = document.getElementById('mayaAudioSub');
        const labelPlayBtn = document.getElementById('labelPlayBtn');
        if (audioTitle) audioTitle.textContent = moduleData.title;
        if (audioSub) audioSub.textContent = moduleData.subtitle;
        if (labelPlayBtn) labelPlayBtn.textContent = `Escuchar en ${moduleData.name}`;

        // 3. Cuadrícula de 4 Pasos (#mayaStepsContainer)
        const stepsContainer = document.getElementById('mayaStepsContainer');
        if (stepsContainer && Array.isArray(moduleData.steps)) {
            stepsContainer.innerHTML = moduleData.steps.map(s => `
                <div class="maya-step-card">
                    <div class="maya-step-num">${s.num}</div>
                    <div class="maya-step-title">${s.title}</div>
                    <div class="maya-step-native"><i class="fas fa-language"></i> ${s.native}</div>
                    <p class="maya-step-desc">${s.desc}</p>
                </div>
            `).join('');
        }

        // 4. Garantías CNC (#mayaGuaranteesGrid)
        const guaranteesTitle = document.getElementById('mayaGuaranteesTitle');
        if (guaranteesTitle) {
            guaranteesTitle.textContent = moduleData.guaranteesTitle;
        }

        const guaranteesGrid = document.getElementById('mayaGuaranteesGrid');
        if (guaranteesGrid && Array.isArray(moduleData.guarantees)) {
            guaranteesGrid.innerHTML = moduleData.guarantees.map(g => `
                <div style="display:flex; gap:0.85rem; align-items:flex-start;">
                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(43,130,201,0.1); color:var(--blue-bright); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fas ${g.icon}"></i>
                    </div>
                    <div>
                        <strong style="color:var(--navy); font-size:0.9rem; font-family:var(--font-head); display:block; margin-bottom:0.2rem;">${g.title}</strong>
                        <p style="margin:0; font-size:0.8rem; color:var(--text-muted); line-height:1.4;">${g.desc}</p>
                    </div>
                </div>
            `).join('');
        }

        // 5. Glosario Multilingüe (#mayaGlossaryGrid)
        const glossaryGrid = document.getElementById('mayaGlossaryGrid');
        if (glossaryGrid && Array.isArray(moduleData.glossary)) {
            glossaryGrid.innerHTML = moduleData.glossary.map(item => {
                const safeSpeech = (item.speech || '').replace(/'/g, "\\'");
                return `
                    <div class="glossary-maya-card">
                        <div>
                            <div class="glossary-term-es">${item.termEs}</div>
                            <div class="glossary-term-maya">${item.maya}</div>
                        </div>
                        <button type="button" class="btn-speak-term" onclick="window.speakSingleTerm ? window.speakSingleTerm('${safeSpeech}') : (window.PIA_I18N && window.PIA_I18N.speak ? window.PIA_I18N.speak('${safeSpeech}') : null)">
                            <i class="fas fa-volume-up"></i> Escuchar
                        </button>
                    </div>
                `;
            }).join('');
        }

        // 6. Sincronizar píldoras de idiomas (#mayaLangBar)
        const langBar = document.getElementById('mayaLangBar');
        if (langBar) {
            langBar.querySelectorAll('.lang-pill-btn').forEach(btn => {
                const btnLang = btn.getAttribute('data-lang');
                if (btnLang === lang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    // 8. FUNCIÓN GLOBAL PRINCIPAL t(key, target)
    function t(key, target) {
        if (!key) return '';
        return translateText(key, target);
    }

    // Métodos auxiliares expuestos en window.t
    t.getLanguage = function () {
        return currentLang;
    };

    t.setLanguage = function (newLang) {
        if (!newLang || typeof newLang !== 'string') return;
        const normalized = newLang.toLowerCase().trim();
        if (!SUPPORTED_LANGS.includes(normalized)) return;

        currentLang = normalized;
        try {
            localStorage.setItem('pia_inclusive_lang', normalized);
            localStorage.setItem('pia_selected_lang', normalized);
        } catch (_) {}

        updateDOM(normalized);

        // Disparar evento personalizado para observadores y componentes reactivos
        try {
            if (typeof CustomEvent === 'function') {
                window.dispatchEvent(new CustomEvent('pia-language-changed', {
                    detail: { language: normalized }
                }));
            } else if (document.createEvent) {
                const evt = document.createEvent('CustomEvent');
                evt.initCustomEvent('pia-language-changed', true, true, { language: normalized });
                window.dispatchEvent(evt);
            }
        } catch (_) {}
    };

    t.updateDOM = function (targetLang) {
        updateDOM(targetLang || currentLang);
    };

    t.translate = function (key, targetLang) {
        return translateText(key, targetLang);
    };

    t.updateSpecialModules = function (targetLang) {
        updateSpecialModules(targetLang || currentLang);
    };

    // 9. OBJETO NAMESPACE GLOBAL window.PIA_I18N
    window.PIA_I18N = {
        t: t,
        getLanguage: t.getLanguage,
        setLanguage: t.setLanguage,
        updateDOM: t.updateDOM,
        translate: t.translate,
        updateSpecialModules: t.updateSpecialModules,
        DICTIONARY: EXACT_DICTIONARY,
        MODULES: MAYA_MODULE_DATA,
        SUPPORTED_LANGS: SUPPORTED_LANGS,
        speak: function (text, lang) {
            if (!('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = (lang === 'en' ? 'en-US' : 'es-GT');
            utt.rate = 0.95;
            window.speechSynthesis.speak(utt);
        }
    };

    // Exponer la función global window.t
    window.t = t;

    // 10. INICIALIZACIÓN REACTIVA AL CARGAR EL DOM
    function onDOMLoaded() {
        currentLang = detectLanguage();
        updateDOM(currentLang);

        // Interceptar clics en píldoras de lenguaje si existen (#mayaLangBar)
        const langBar = document.getElementById('mayaLangBar');
        if (langBar) {
            langBar.addEventListener('click', (e) => {
                const btn = e.target.closest('.lang-pill-btn');
                if (!btn) return;
                const lang = btn.getAttribute('data-lang');
                if (lang) {
                    window.t.setLanguage(lang);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMLoaded);
    } else {
        onDOMLoaded();
    }

})(window, document);
