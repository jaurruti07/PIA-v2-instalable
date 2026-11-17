-- ============================================================================
-- Portal de Integridad Activa (PIA) - Comisión Nacional contra la Corrupción
-- Script de Instalación de Base de Datos Relacional (MySQL 8.0+ / MariaDB 10.6+)
-- Arquitectura Híbrida JSON + SQL basada fielmente en los esquemas JSON reales
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `pia_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pia_db`;

-- ----------------------------------------------------------------------------
-- 1. Módulo: Canales por la Integridad (canales-por-la-integridad/data_directorio.json)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pia_canales_integridad` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `institucion` VARCHAR(300) NOT NULL,
  `tipo` VARCHAR(120) NOT NULL DEFAULT '',
  `canales` INT NOT NULL DEFAULT 1,
  `correo` VARCHAR(255) NOT NULL DEFAULT '',
  `telefono` VARCHAR(150) NOT NULL DEFAULT '',
  `formulario` VARCHAR(600) NOT NULL DEFAULT '',
  `tipocom` VARCHAR(200) NOT NULL DEFAULT '',
  `otro` VARCHAR(500) NOT NULL DEFAULT '',
  `direccion` VARCHAR(500) NOT NULL DEFAULT '',
  `ubicacion` VARCHAR(500) NOT NULL DEFAULT '',
  `horario` VARCHAR(255) NOT NULL DEFAULT '',
  `protocolo_actuacion` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_canales_tipo` (`tipo`),
  INDEX `idx_canales_institucion` (`institucion`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Módulo: Directorio Acceso al Ejecutivo (directorio/data_acceso.json)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pia_directorio_acceso` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre_institucion` VARCHAR(300) NOT NULL,
  `siglas` VARCHAR(80) NOT NULL DEFAULT '',
  `sector` VARCHAR(150) NOT NULL DEFAULT '',
  `departamento` VARCHAR(120) NOT NULL DEFAULT '',
  `correo` VARCHAR(255) NOT NULL DEFAULT '',
  `telefono` VARCHAR(150) NOT NULL DEFAULT '',
  `direccion` VARCHAR(500) NOT NULL DEFAULT '',
  `horario_atencion` VARCHAR(255) NOT NULL DEFAULT '',
  `solicitud_en_linea` TINYINT(1) NOT NULL DEFAULT 0,
  `informacion_publica_oficio` TINYINT(1) NOT NULL DEFAULT 0,
  `sitio_web` VARCHAR(500) NOT NULL DEFAULT '',
  `latitud` DECIMAL(11, 7) NOT NULL DEFAULT 0.0000000,
  `longitud` DECIMAL(11, 7) NOT NULL DEFAULT 0.0000000,
  `ultima_actualizacion` VARCHAR(40) NOT NULL DEFAULT '',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dir_sector` (`sector`),
  INDEX `idx_dir_departamento` (`departamento`),
  INDEX `idx_dir_siglas` (`siglas`),
  INDEX `idx_dir_nombre` (`nombre_institucion`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pia_directorio_enlaces` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `directorio_id` INT NOT NULL,
  `tipo_enlace` ENUM('solicitud', 'oficio') NOT NULL,
  `url` VARCHAR(700) NOT NULL,
  `orden` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_dir_enlace_padre` (`directorio_id`, `tipo_enlace`, `orden`),
  CONSTRAINT `fk_dir_enlaces_acceso`
    FOREIGN KEY (`directorio_id`) REFERENCES `pia_directorio_acceso` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Módulo: Tu Gobierno en Números (gobierno_en_numeros/data_tableros.json)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pia_tableros_gobierno` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre_institucion` VARCHAR(300) NOT NULL,
  `siglas` VARCHAR(80) NOT NULL DEFAULT '',
  `tipo_dependencia` VARCHAR(150) NOT NULL DEFAULT '',
  `sector` VARCHAR(150) NOT NULL DEFAULT '',
  `link_tablero` VARCHAR(600) NOT NULL DEFAULT '',
  `descripcion` TEXT NULL,
  `fecha_actualizacion` VARCHAR(40) NOT NULL DEFAULT '',
  `estado` VARCHAR(60) NOT NULL DEFAULT 'Disponible',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tab_sector` (`sector`),
  INDEX `idx_tab_tipo` (`tipo_dependencia`),
  INDEX `idx_tab_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Módulo: Riesgo en la Mira (riesgo/datos.json)
-- Conserva ciclos anuales (2025-2028), ribbonStats, instituciones y riesgosFrecuentes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pia_riesgo_ciclos` (
  `anio` VARCHAR(10) NOT NULL,
  `estado_recoleccion` VARCHAR(60) NOT NULL DEFAULT 'activo',
  `fecha_actualizacion` VARCHAR(40) NOT NULL DEFAULT '',
  `ribbon_stats_json` LONGTEXT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`anio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pia_riesgo_instituciones` (
  `pk_id` INT NOT NULL AUTO_INCREMENT,
  `id` INT NOT NULL,
  `anio` VARCHAR(10) NOT NULL DEFAULT '2025',
  `siglas` VARCHAR(80) NOT NULL DEFAULT '',
  `nombre` VARCHAR(300) NOT NULL,
  `sector` VARCHAR(150) NOT NULL DEFAULT '',
  `estado` VARCHAR(60) NOT NULL DEFAULT 'en_proceso',
  `nivel` VARCHAR(80) NOT NULL DEFAULT 'Inicial',
  `check_identificacion` TINYINT(1) NOT NULL DEFAULT 0,
  `check_analisis` TINYINT(1) NOT NULL DEFAULT 0,
  `check_presentacion` TINYINT(1) NOT NULL DEFAULT 0,
  `buenas_practicas` TINYINT(1) NOT NULL DEFAULT 0,
  `verificacion_cgc` VARCHAR(255) NOT NULL DEFAULT '',
  `fecha_actualizacion` VARCHAR(40) NOT NULL DEFAULT '',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pk_id`),
  UNIQUE KEY `uk_riesgo_anio_id` (`anio`, `id`),
  INDEX `idx_riesgo_sector` (`sector`),
  INDEX `idx_riesgo_estado` (`estado`),
  INDEX `idx_riesgo_siglas` (`siglas`),
  CONSTRAINT `fk_riesgo_inst_ciclo`
    FOREIGN KEY (`anio`) REFERENCES `pia_riesgo_ciclos` (`anio`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pia_riesgo_frecuentes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `icono` VARCHAR(80) NOT NULL DEFAULT '',
  `texto` VARCHAR(300) NOT NULL,
  `descripcion_breve` VARCHAR(500) NOT NULL DEFAULT '',
  `detalle_completo` TEXT NULL,
  `fuente` VARCHAR(200) NOT NULL DEFAULT '',
  `categoria` VARCHAR(150) NOT NULL DEFAULT '',
  `orden` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_riesgo_frec_cat` (`categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Módulo: Transparencia Vehicular (vehiculos/vehiculos.json)
-- Conserva catalogInstituciones (criterios + documentosPublicos) y vehicles (history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pia_vehiculos_instituciones` (
  `id` VARCHAR(191) NOT NULL,
  `nombre` VARCHAR(300) NOT NULL,
  `siglas` VARCHAR(80) NOT NULL DEFAULT '',
  `sector` VARCHAR(150) NOT NULL DEFAULT '',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_veh_inst_sector` (`sector`),
  INDEX `idx_veh_inst_siglas` (`siglas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pia_vehiculos_institucion_criterios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `institucion_id` VARCHAR(191) NOT NULL,
  `clave_criterio` VARCHAR(100) NOT NULL,
  `label` VARCHAR(300) NOT NULL,
  `cumple` TINYINT(1) NOT NULL DEFAULT 0,
  `doc_url` VARCHAR(600) NULL,
  `doc_nombre` VARCHAR(300) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_veh_inst_criterio` (`institucion_id`, `clave_criterio`),
  CONSTRAINT `fk_veh_criterios_inst`
    FOREIGN KEY (`institucion_id`) REFERENCES `pia_vehiculos_instituciones` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pia_vehiculos_institucion_documentos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `institucion_id` VARCHAR(191) NOT NULL,
  `tipo` VARCHAR(150) NOT NULL DEFAULT '',
  `titulo` VARCHAR(300) NOT NULL DEFAULT '',
  `url` VARCHAR(600) NOT NULL DEFAULT '',
  `orden` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_veh_doc_inst` (`institucion_id`, `orden`),
  CONSTRAINT `fk_veh_docs_inst`
    FOREIGN KEY (`institucion_id`) REFERENCES `pia_vehiculos_instituciones` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pia_vehiculos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `plate` VARCHAR(40) NOT NULL,
  `plate_type` VARCHAR(20) NOT NULL DEFAULT '',
  `department` VARCHAR(300) NOT NULL DEFAULT '',
  `tipo_inst` VARCHAR(120) NOT NULL DEFAULT '',
  `sector` VARCHAR(150) NOT NULL DEFAULT '',
  `authorized_use` VARCHAR(255) NOT NULL DEFAULT '',
  `brand` VARCHAR(120) NOT NULL DEFAULT '',
  `model` VARCHAR(120) NOT NULL DEFAULT '',
  `year` INT NULL,
  `color` VARCHAR(80) NOT NULL DEFAULT '',
  `status` VARCHAR(80) NOT NULL DEFAULT 'Activo',
  `inactive_reason` VARCHAR(255) NULL,
  `last_update` VARCHAR(60) NOT NULL DEFAULT '',
  `iscv_moroso` TINYINT(1) NOT NULL DEFAULT 0,
  `multas` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_veh_plate` (`plate`),
  INDEX `idx_veh_department` (`department`(191)),
  INDEX `idx_veh_sector` (`sector`),
  INDEX `idx_veh_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pia_vehiculos_historial` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vehiculo_id` INT NOT NULL,
  `fecha` VARCHAR(60) NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'Activo',
  `multas` INT NOT NULL DEFAULT 0,
  `iscv_moroso` TINYINT(1) NOT NULL DEFAULT 0,
  `orden` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_veh_hist_padre` (`vehiculo_id`, `orden`),
  CONSTRAINT `fk_veh_historial_vehiculo`
    FOREIGN KEY (`vehiculo_id`) REFERENCES `pia_vehiculos` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Módulo: Métricas Generales del Portal (data_portal.json)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pia_portal_metricas` (
  `id` INT NOT NULL DEFAULT 1,
  `oficinas_probidad` INT NOT NULL DEFAULT 0,
  `canales_denuncia` INT NOT NULL DEFAULT 0,
  `denuncias_penales` INT NOT NULL DEFAULT 0,
  `plataformas_activas` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Bitácora Técnica de Migraciones JSON <-> SQL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pia_storage_migrations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `direction` ENUM('json_to_sql', 'sql_to_json') NOT NULL,
  `module_name` VARCHAR(80) NOT NULL,
  `conflict_mode` VARCHAR(40) NOT NULL DEFAULT 'skip',
  `inserted_count` INT NOT NULL DEFAULT 0,
  `updated_count` INT NOT NULL DEFAULT 0,
  `skipped_count` INT NOT NULL DEFAULT 0,
  `error_count` INT NOT NULL DEFAULT 0,
  `backup_ref` VARCHAR(255) NULL,
  `executed_by` VARCHAR(150) NOT NULL,
  `details` TEXT NULL,
  `executed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_mig_fecha` (`executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
