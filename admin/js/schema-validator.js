// schema-validator.js - Módulo de validación de esquemas y sintaxis JSON del lado del cliente

/**
 * Helper: Verificar si un valor es un Objeto plano
 */
function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Helper: Verificar si es texto no vacío
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Helper: Verificar formato básico de Email
 */
function isValidEmail(val) {
  if (!val || typeof val !== 'string') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

/**
 * Helper: Verificar formato básico de URL o ruta
 */
function isValidUrlOrPath(val) {
  if (!val || typeof val !== 'string') return true;
  return /^(https?:\/\/|\/)/i.test(val.trim());
}

/**
 * Validar sintaxis JSON en texto de forma detallada
 * @param {string} jsonString - Cadena de texto JSON
 * @returns {Object} { isValid, data, error, line }
 */
export function validateJsonSyntax(jsonString) {
  if (typeof jsonString !== 'string') {
    return { isValid: false, data: null, error: 'La entrada no es una cadena de texto validable.', line: 1 };
  }

  if (!jsonString.trim()) {
    return { isValid: false, data: null, error: 'El contenido JSON no puede estar totalmente vacío.', line: 1 };
  }

  try {
    const data = JSON.parse(jsonString);
    return { isValid: true, data, error: null, line: null };
  } catch (err) {
    let line = 1;
    const msg = err.message || 'Error de sintaxis JSON';
    
    // Extraer posición o línea del mensaje de error del motor JS si está disponible
    const posMatch = msg.match(/at position (\d+)/i) || msg.match(/column (\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      line = jsonString.substring(0, pos).split('\n').length;
    } else {
      const lineMatch = msg.match(/line (\d+)/i);
      if (lineMatch) line = parseInt(lineMatch[1], 10);
    }

    return {
      isValid: false,
      data: null,
      error: `Error de sintaxis JSON en Línea ${line}: ${msg}`,
      line
    };
  }
}

/**
 * Validar estructura y tipos de datos según el esquema del archivo JSON
 * @param {string} filePath - Ruta o identificador del archivo JSON
 * @param {any} data - Objeto o Arreglo JavaScript parseado
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateJsonSchema(filePath, data) {
  const errors = [];
  const cleanPath = (filePath || '').toLowerCase();

  // 1. Validar Portal Principal (/data_portal.json)
  if (cleanPath.includes('data_portal') || cleanPath.includes('portal')) {
    if (!isObject(data)) {
      errors.push('El esquema de data_portal.json debe ser un Objeto principal ({ ... }), no un arreglo.');
    } else {
      const numericFields = ['oficinasProbidad', 'canalesDenuncia', 'denunciasPenales', 'plataformasActivas'];
      numericFields.forEach(field => {
        if (data[field] === undefined || data[field] === null) {
          errors.push(`Campo requerido '${field}' no encontrado en el objeto.`);
        } else if (typeof data[field] !== 'number' || isNaN(data[field]) || data[field] < 0) {
          errors.push(`El campo '${field}' debe ser un número entero mayor o igual a 0.`);
        }
      });
      if (data.metricas !== undefined) {
        if (!Array.isArray(data.metricas)) {
          errors.push('El campo "metricas" debe ser un arreglo JSON válido.');
        } else {
          data.metricas.forEach((m, idx) => {
            if (!isObject(m)) {
              errors.push(`[Métrica ${idx + 1}]: Debe ser un objeto válido.`);
              return;
            }
            if (!isNonEmptyString(m.titulo)) {
              errors.push(`[Métrica ${idx + 1}]: El campo 'titulo' es obligatorio.`);
            }
            if (typeof m.valor !== 'number' || isNaN(m.valor) || m.valor < 0) {
              errors.push(`[Métrica ${idx + 1}]: El campo 'valor' debe ser un número >= 0.`);
            }
          });
        }
      }
    }
  }

  // 2. Validar Canales por la Integridad (/canales-por-la-integridad/data_directorio.json)
  else if (cleanPath.includes('canales') || cleanPath.includes('data_directorio')) {
    if (!Array.isArray(data)) {
      errors.push('El archivo de Canales debe ser un arreglo de instituciones (JSON Array [ ... ]).');
    } else if (data.length === 0) {
      errors.push('El catálogo de Canales no puede ser un arreglo totalmente vacío.');
    } else {
      data.forEach((item, index) => {
        const itemNum = index + 1;
        if (!isObject(item)) {
          errors.push(`[Registro ${itemNum}]: El elemento debe ser un objeto válido.`);
          return;
        }
        if (!isNonEmptyString(item.institucion)) {
          errors.push(`[Registro ${itemNum}]: El campo 'institucion' es obligatorio y debe ser texto no vacío.`);
        }
        if (item.canales !== undefined && (typeof item.canales !== 'number' || item.canales < 0)) {
          errors.push(`[Registro ${itemNum}]: El campo 'canales' debe ser un número no negativo.`);
        }
        if (item.correo && !isValidEmail(item.correo)) {
          errors.push(`[Registro ${itemNum}]: Correo electrónico '${item.correo}' con formato inválido.`);
        }
        if (item.formulario && !isValidUrlOrPath(item.formulario)) {
          errors.push(`[Registro ${itemNum}]: Enlace de formulario '${item.formulario}' con formato URL inválido.`);
        }
      });
    }
  }

  // 3. Validar Directorio Ejecutivo de Acceso (/directorio/data_acceso.json)
  else if (cleanPath.includes('acceso') || cleanPath.includes('directorio')) {
    if (!Array.isArray(data)) {
      errors.push('El Directorio de Acceso debe ser un arreglo de dependencias (JSON Array [ ... ]).');
    } else if (data.length === 0) {
      errors.push('El Directorio de Acceso no puede estar totalmente vacío.');
    } else {
      data.forEach((item, index) => {
        const itemNum = index + 1;
        if (!isObject(item)) {
          errors.push(`[Registro ${itemNum}]: El elemento debe ser un objeto de institución.`);
          return;
        }
        if (!isNonEmptyString(item.nombre_institucion)) {
          errors.push(`[Registro ${itemNum}]: Campo obligatorio 'nombre_institucion' faltante o vacío.`);
        }
        if (typeof item.siglas !== 'string') {
          errors.push(`[Registro ${itemNum}]: Campo 'siglas' debe ser texto.`);
        }
        if (item.correo && !isValidEmail(item.correo)) {
          errors.push(`[Registro ${itemNum}]: Correo '${item.correo}' tiene un formato no válido.`);
        }
        if (item.solicitud_en_linea !== undefined && typeof item.solicitud_en_linea !== 'boolean') {
          errors.push(`[Registro ${itemNum}]: 'solicitud_en_linea' debe ser booleano (true o false).`);
        }
        if (item.informacion_publica_oficio !== undefined && typeof item.informacion_publica_oficio !== 'boolean') {
          errors.push(`[Registro ${itemNum}]: 'informacion_publica_oficio' debe ser booleano (true o false).`);
        }
        if (item.enlaces_solicitud && !Array.isArray(item.enlaces_solicitud)) {
          errors.push(`[Registro ${itemNum}]: 'enlaces_solicitud' debe ser un arreglo de enlaces.`);
        }
        if (item.enlaces_oficio && !Array.isArray(item.enlaces_oficio)) {
          errors.push(`[Registro ${itemNum}]: 'enlaces_oficio' debe ser un arreglo de enlaces.`);
        }
      });
    }
  }

  // 4. Validar Tu Gobierno en Números (/gobierno_en_numeros/data_tableros.json)
  else if (cleanPath.includes('tableros') || cleanPath.includes('gobierno_en_numeros')) {
    if (!Array.isArray(data)) {
      errors.push('El archivo de Tableros debe ser un arreglo (JSON Array [ ... ]).');
    } else if (data.length === 0) {
      errors.push('El archivo de Tableros no puede estar vacío.');
    } else {
      data.forEach((item, index) => {
        const itemNum = index + 1;
        if (!isObject(item)) {
          errors.push(`[Registro ${itemNum}]: Debe ser un objeto.`);
          return;
        }
        if (!isNonEmptyString(item.nombre_institucion)) {
          errors.push(`[Registro ${itemNum}]: 'nombre_institucion' es requerido.`);
        }
        if (item.link_tablero && !isValidUrlOrPath(item.link_tablero)) {
          errors.push(`[Registro ${itemNum}]: 'link_tablero' debe tener una URL o ruta válida.`);
        }
      });
    }
  }

  // 5. Validar Riesgo en la Mira (/riesgo/datos.json)
  else if (cleanPath.includes('riesgo') || cleanPath.includes('datos.json')) {
    if (!isObject(data)) {
      errors.push('El archivo de Riesgo debe ser un objeto raíz que contenga la propiedad "years".');
    } else if (!isObject(data.years)) {
      errors.push('Falta la propiedad obligatoria "years" como objeto en la raíz.');
    } else {
      Object.entries(data.years).forEach(([year, yearData]) => {
        if (!isObject(yearData)) {
          errors.push(`El año '${year}' debe ser un objeto con estadoRecoleccion e instituciones.`);
          return;
        }
        if (!Array.isArray(yearData.instituciones)) {
          errors.push(`El año '${year}' debe contener un arreglo "instituciones".`);
        } else {
          yearData.instituciones.forEach((inst, i) => {
            if (!isObject(inst) || !isNonEmptyString(inst.nombre)) {
              errors.push(`[Año ${year} - Inst ${i + 1}]: Falta 'nombre' en la institución.`);
            }
          });
        }
      });
    }
  }

  // 6. Validar Transparencia Vehicular (/vehiculos/vehiculos.json)
  else if (cleanPath.includes('vehiculos')) {
    if (!isObject(data)) {
      errors.push('El archivo vehiculos.json debe ser un objeto con "catalogInstituciones" o "vehicles".');
    } else {
      if (data.catalogInstituciones && !Array.isArray(data.catalogInstituciones)) {
        errors.push('"catalogInstituciones" debe ser un arreglo de instituciones.');
      }
      if (data.vehicles && !Array.isArray(data.vehicles)) {
        errors.push('"vehicles" debe ser un arreglo de vehículos.');
      }
      if (!data.catalogInstituciones && !data.vehicles) {
        errors.push('El archivo debe contener al menos un arreglo "catalogInstituciones" o "vehicles".');
      }

      if (Array.isArray(data.vehicles)) {
        data.vehicles.forEach((veh, i) => {
          if (!isObject(veh)) return;
          if (!isNonEmptyString(veh.plate)) {
            errors.push(`[Vehículo ${i + 1}]: El campo 'plate' (placa) es obligatorio.`);
          }
          if (veh.year !== undefined && (typeof veh.year !== 'number' || veh.year < 1900 || veh.year > 2030)) {
            errors.push(`[Vehículo ${i + 1}]: El campo 'year' (${veh.year}) debe ser un año entre 1900 y 2030.`);
          }
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validar configuración de Motores de Almacenamiento JSON
 * @param {Object} dbConfig - Objeto de configuración del motor
 * @returns {string[]} Lista de mensajes de error explicativos
 */
export function validateDbEngineConfig(dbConfig) {
  const errors = [];

  if (!dbConfig) {
    errors.push('Los datos del motor de almacenamiento son nulos.');
    return errors;
  }

  // Validar Nombre
  if (!dbConfig.name || typeof dbConfig.name !== 'string' || !dbConfig.name.trim()) {
    errors.push('El nombre del almacén de datos JSON es requerido.');
  } else if (dbConfig.name.trim().length < 3) {
    errors.push('El nombre del almacén debe contener al menos 3 caracteres.');
  }

  // Validar Tipo
  const validTypes = ['json_file', 'json_api', 'json_cluster'];
  if (!dbConfig.type || !validTypes.includes(dbConfig.type)) {
    errors.push('El tipo de motor seleccionado no es válido.');
  }

  // Validar Ruta / Endpoint
  if (!dbConfig.filePath || typeof dbConfig.filePath !== 'string' || !dbConfig.filePath.trim()) {
    errors.push('La ruta del fichero o endpoint JSON es requerida.');
  } else {
    const path = dbConfig.filePath.trim();
    if (!path.startsWith('/') && !path.startsWith('http://') && !path.startsWith('https://')) {
      errors.push('La ruta debe comenzar con barra diagonal "/" (ej. /vehiculos/vehiculos.json) o URL HTTP.');
    }
    if (!path.endsWith('.json') && !path.startsWith('/api/') && !path.includes('?')) {
      errors.push('La ruta del almacén debe referenciar un archivo ".json" o un endpoint de API (/api/).');
    }
  }

  return errors;
}

/**
 * Validar formulario de entrada de datos de un Registro CRUD según su módulo
 * @param {string} moduleName - Nombre del módulo
 * @param {Object} recordObj - Objeto con datos del formulario
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateModuleRecord(moduleName, recordObj) {
  const errors = [];

  if (moduleName === 'vehiculos') {
    if (!isNonEmptyString(recordObj.plate)) {
      errors.push('El número de placa del vehículo es obligatorio.');
    } else if (!/^[O|P|C|A|M|U|TC|TR|CC|CD|MI|DIS|O-]\d{3}[A-Z0-9]{3,}$/i.test(recordObj.plate.trim()) && recordObj.plate.trim().length < 4) {
      errors.push('El formato del número de placa es inválido (mínimo 4 caracteres alfanuméricos).');
    }

    if (!isNonEmptyString(recordObj.department)) {
      errors.push('Debe seleccionar o ingresar la entidad o departamento asignado.');
    }

    if (recordObj.year && (isNaN(recordObj.year) || recordObj.year < 1900 || recordObj.year > 2030)) {
      errors.push('El año del modelo debe estar comprendido entre 1900 y 2030.');
    }

    if (recordObj.multas !== undefined && (isNaN(recordObj.multas) || recordObj.multas < 0)) {
      errors.push('El número de multas no puede ser un valor negativo.');
    }
  } else if (moduleName === 'vehiculos_instituciones') {
    if (!isNonEmptyString(recordObj.nombre)) {
      errors.push('El nombre completo de la institución es obligatorio.');
    } else if (recordObj.nombre.trim().length < 3) {
      errors.push('El nombre de la institución debe tener al menos 3 caracteres.');
    }

    if (!isNonEmptyString(recordObj.siglas)) {
      errors.push('Las siglas de la institución son obligatorias.');
    }
  } else if (moduleName === 'directorio') {
    if (!isNonEmptyString(recordObj.nombre_institucion)) {
      errors.push('El nombre de la institución es obligatorio.');
    }
    if (!isNonEmptyString(recordObj.siglas)) {
      errors.push('Las siglas de la entidad son obligatorias.');
    }
    if (recordObj.correo && !isValidEmail(recordObj.correo)) {
      errors.push(`El correo electrónico de contacto '${recordObj.correo}' no tiene un formato válido.`);
    }
    if (recordObj.sitio_web && !isValidUrlOrPath(recordObj.sitio_web)) {
      errors.push('El sitio web ingresado no tiene un formato URL válido.');
    }
  } else if (moduleName === 'canales') {
    if (!isNonEmptyString(recordObj.institucion)) {
      errors.push('El nombre de la institución es obligatorio y debe tener al menos 3 caracteres.');
    } else if (recordObj.institucion.trim().length < 3) {
      errors.push('El nombre de la institución ingresado es demasiado corto.');
    }
    if (recordObj.correo && !isValidEmail(recordObj.correo)) {
      errors.push(`El correo electrónico de probidad/denuncias '${recordObj.correo}' no tiene un formato válido (ej. alerta@institucion.gob.gt).`);
    }
    if (recordObj.formulario && !isValidUrlOrPath(recordObj.formulario)) {
      errors.push(`El enlace del formulario web de denuncias '${recordObj.formulario}' debe tener un formato URL válido (iniciando con http:// o https://).`);
    }
    if (recordObj.canales !== undefined && (typeof recordObj.canales !== 'number' || recordObj.canales < 0)) {
      errors.push('El número de canales debe ser un valor numérico no negativo.');
    }
  } else if (moduleName === 'tableros') {
    if (!isNonEmptyString(recordObj.nombre_institucion)) {
      errors.push('El nombre de la institución es obligatorio.');
    } else if (recordObj.nombre_institucion.trim().length < 3) {
      errors.push('El nombre de la institución debe contener al menos 3 caracteres.');
    }
    if (!isNonEmptyString(recordObj.link_tablero)) {
      errors.push('La dirección URL del tablero de rendición de cuentas es obligatoria.');
    } else if (!isValidUrlOrPath(recordObj.link_tablero)) {
      errors.push(`La URL ingresada '${recordObj.link_tablero}' no es válida. Debe iniciar con http:// o https://.`);
    }
    if (!isNonEmptyString(recordObj.descripcion)) {
      errors.push('La descripción del tablero es obligatoria.');
    } else if (recordObj.descripcion.trim().length < 10) {
      errors.push('La descripción del tablero debe ser informativa (mínimo 10 caracteres explicativos).');
    }
    if (!isNonEmptyString(recordObj.estado)) {
      errors.push('El estado de disponibilidad del tablero es obligatorio.');
    }
  } else if (moduleName === 'portal_metric') {
    if (!isNonEmptyString(recordObj.titulo) || recordObj.titulo.trim().length < 2) {
      errors.push('El título de la métrica es obligatorio (mínimo 2 caracteres).');
    }
    if (recordObj.valor === undefined || recordObj.valor === null || isNaN(Number(recordObj.valor)) || Number(recordObj.valor) < 0) {
      errors.push('El valor numérico de la métrica debe ser mayor o igual a 0.');
    }
    if (recordObj.icono && !/^fa(?:s|r|b|l|d|ss|sr)?\s+fa-[a-z0-9-]+$/i.test(String(recordObj.icono).trim()) && !/^fa-[a-z0-9-]+$/i.test(String(recordObj.icono).trim())) {
      errors.push('El ícono debe tener formato FontAwesome válido (ej. "fas fa-shield-alt").');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
