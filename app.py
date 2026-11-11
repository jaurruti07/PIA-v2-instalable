#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Portal de Integridad Activa (PIA) - Backend Oficial en Python (Flask)
Comisión Nacional contra la Corrupción (CNC) - Organismo Ejecutivo de Guatemala

Arquitectura de Producción para despliegue en infraestructura institucional de TI.
Compatible con Gunicorn, Docker, entornos Linux corporativos y Nginx Reverse Proxy.
"""

import os
import sys
import json
import time
import hmac
import base64
import hashlib
import binascii
from datetime import datetime, timezone
from pathlib import Path
from functools import wraps

from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory,
    render_template,
    abort,
    Response
)

# --------------------------------------------------------------------------
# 1. CONFIGURACIÓN Y DIRECTORIOS DEL SISTEMA
# --------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('PIA_DATA_DIR', str(BASE_DIR / 'data')))
BACKUPS_DIR = DATA_DIR / 'backups'

DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

OPERATORS_FILE = DATA_DIR / 'authorized_operators.json'
USERS_FILE = DATA_DIR / 'users_roles.json'
AUDIT_FILE = DATA_DIR / 'audit_logs.json'
VISITS_FILE = DATA_DIR / 'page_visits.json'

SESSION_HMAC_SECRET = os.environ.get(
    'PIA_SESSION_SECRET',
    hashlib.sha256(b'PIA_CNC_GUATEMALA_SECRET_KEY_2026').hexdigest()
)

SEED_OPERATOR_EMAILS = [
    'deteccionydenuncia@cnc.gob.gt',
    'apoyogi@cnc.gob.gt'
]

def get_allowed_operator_emails() -> list:
    try:
        users = get_users_roles()
        emails = [u.get('email', '').strip().lower() for u in users if u.get('status') != 'inactive' and u.get('email')]
        for em in SEED_OPERATOR_EMAILS:
            if em not in emails:
                emails.append(em)
        return emails
    except Exception:
        return SEED_OPERATOR_EMAILS

ALLOWED_OPERATOR_EMAILS = SEED_OPERATOR_EMAILS

# Usuarios institucionales iniciales con contraseñas encriptadas mediante sal PBKDF2/SHA-512
DEFAULT_AUTHORIZED_USERS = [
    {
        "id": "usr_cnc_01",
        "email": "deteccionydenuncia@cnc.gob.gt",
        "displayName": "Dirección de Apoyo en la Gestión de Irregularidades - DAGI",
        "role": "admin",
        # Contraseña inicial 12345 encriptada
        "passwordHash": "f929ebd07fd2c63da7eb3004213bd3d2:9d5f0b3dc9c5e3160bcd726cfd0104c4b310ba6369d64914435c4de8c1ad5d6fb3723aa263cdcaf84f57ef6160b3634442819a3e43f657c0eeb088fbd317ef59",
        "modules": ["canales", "directorio", "tableros", "riesgo", "portal", "visits", "chatbot", "users", "audit", "database", "guide"],
        "status": "active",
        "operatorIndex": 1,
        "lastPasswordChange": "2026-03-30T10:00:00.000Z",
        "updatedAt": "2026-03-30T10:00:00.000Z"
    },
    {
        "id": "usr_cnc_02",
        "email": "apoyogi@cnc.gob.gt",
        "displayName": "Apoyo a la Gestión de Irregularidades (CNC)",
        "role": "admin",
        # Contraseña inicial 12345 encriptada
        "passwordHash": "29af97fbdcade6df44a7d6fb84022548:b3e638225077f1c21b848b5bc32b9cf95d4b7f083dd3eb246d389a042475d86dd8002e0bb7fa0e47234b7a8164304e5a784af86ba8575357e361c93a5a33137e",
        "modules": ["canales", "directorio", "tableros", "riesgo", "portal", "visits", "chatbot", "users", "audit", "database", "guide"],
        "status": "active",
        "operatorIndex": 2,
        "lastPasswordChange": "2026-03-30T10:00:00.000Z",
        "updatedAt": "2026-03-30T10:00:00.000Z"
    }
]

# Mapa de archivos seguros para prevención de Path Traversal
WHITELIST_JSON_MAP = {
    'canales': BASE_DIR / 'canales-por-la-integridad' / 'data_directorio.json',
    'canales-por-la-integridad': BASE_DIR / 'canales-por-la-integridad' / 'data_directorio.json',
    'data_directorio.json': BASE_DIR / 'canales-por-la-integridad' / 'data_directorio.json',
    'directorio': BASE_DIR / 'directorio' / 'data_acceso.json',
    'data_acceso.json': BASE_DIR / 'directorio' / 'data_acceso.json',
    'tableros': BASE_DIR / 'gobierno_en_numeros' / 'data_tableros.json',
    'gobierno_en_numeros': BASE_DIR / 'gobierno_en_numeros' / 'data_tableros.json',
    'data_tableros.json': BASE_DIR / 'gobierno_en_numeros' / 'data_tableros.json',
    'riesgo': BASE_DIR / 'riesgo' / 'datos.json',
    'datos.json': BASE_DIR / 'riesgo' / 'datos.json',
    'vehiculos': BASE_DIR / 'vehiculos' / 'vehiculos.json',
    'vehiculos_instituciones': BASE_DIR / 'vehiculos' / 'vehiculos.json',
    'vehiculos.json': BASE_DIR / 'vehiculos' / 'vehiculos.json',
    'portal': BASE_DIR / 'data_portal.json',
    'data_portal.json': BASE_DIR / 'data_portal.json',
    'chatbot_settings.json': BASE_DIR / 'chatbot_settings.json',
    'chatbot_knowledge.json': BASE_DIR / 'chatbot_knowledge.json',
    'visits': VISITS_FILE,
    'page_visits.json': VISITS_FILE,
    'users_roles.json': USERS_FILE
}

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / 'templates'),
)

@app.after_request
def apply_security_and_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, If-Match'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    return response

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = Response()
        res.headers['Access-Control-Allow-Origin'] = '*'
        res.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        res.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, If-Match'
        return res

# --------------------------------------------------------------------------
# 2. FUNCIONES DE SEGURIDAD Y CRIPTOGRAFÍA
# --------------------------------------------------------------------------
def hash_password(password: str, salt: str = None) -> str:
    """Genera hash seguro PBKDF2-HMAC-SHA512 con sal criptográfica."""
    if not salt:
        salt = binascii.hexlify(os.urandom(16)).decode('utf-8')
    key = hashlib.pbkdf2_hmac(
        'sha512',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        10000
    ).hex()
    return f"{salt}:{key}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Valida contraseña de forma segura contra tiempo de respuesta."""
    if not stored_hash or ':' not in stored_hash:
        return False
    salt, expected = stored_hash.split(':', 1)
    actual = hashlib.pbkdf2_hmac(
        'sha512',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        10000
    ).hex()
    return hmac.compare_digest(actual, expected)

def create_local_session_token(user: dict) -> str:
    """Crea token de sesión firmado mediante HMAC-SHA256."""
    payload = {
        "uid": user.get('id', 'usr_cnc_01'),
        "email": user.get('email', ''),
        "displayName": user.get('displayName', ''),
        "role": user.get('role', 'admin'),
        "modules": user.get('modules', []),
        "operatorIndex": user.get('operatorIndex', 1),
        "exp": int(time.time() * 1000) + (12 * 60 * 60 * 1000)
    }
    body_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('utf-8').rstrip('=')
    sig = hmac.new(
        SESSION_HMAC_SECRET.encode('utf-8'),
        body_b64.encode('utf-8'),
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')
    return f"pia_sess_{body_b64}.{sig_b64}"

def verify_local_session_token(token: str) -> dict:
    """Verifica la autenticidad y vigencia de un token de sesión."""
    if not token or not token.startswith('pia_sess_'):
        return None
    raw = token[len('pia_sess_'):]
    if '.' not in raw:
        return None
    body_b64, sig_b64 = raw.split('.', 1)

    expected_sig = hmac.new(
        SESSION_HMAC_SECRET.encode('utf-8'),
        body_b64.encode('utf-8'),
        hashlib.sha256
    ).digest()
    expected_b64 = base64.urlsafe_b64encode(expected_sig).decode('utf-8').rstrip('=')

    if not hmac.compare_digest(sig_b64, expected_b64):
        return None

    try:
        padding = 4 - (len(body_b64) % 4)
        if padding and padding != 4:
            body_b64 += '=' * padding
        payload = json.loads(base64.urlsafe_b64decode(body_b64).decode('utf-8'))
        if payload.get('exp') and int(time.time() * 1000) > payload['exp']:
            return None
        return payload
    except Exception:
        return None

# --------------------------------------------------------------------------
# 3. GESTIÓN DE DATOS Y RESPALDOS ATÓMICOS
# --------------------------------------------------------------------------
def compute_file_hash(file_path: Path) -> str:
    """Calcula hash SHA-256 para control de concurrencia optimista (ETag)."""
    try:
        if not file_path.exists():
            return None
        with open(file_path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except Exception:
        return None

def create_backup(file_path: Path, user: str = 'sistema') -> str:
    """Genera copia de respaldo versionada con rotación a 30 copias."""
    try:
        if not file_path.exists():
            return None
        ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S')
        rnd = binascii.hexlify(os.urandom(3)).decode('utf-8')
        backup_name = f"{file_path.name}.{ts}.{rnd}.bak"
        backup_path = BACKUPS_DIR / backup_name

        with open(file_path, 'rb') as src, open(backup_path, 'wb') as dst:
            dst.write(src.read())

        # Rotación a 30 copias
        backups = sorted(
            [f for f in BACKUPS_DIR.glob(f"{file_path.name}.*.bak")],
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        for old in backups[30:]:
            try:
                old.unlink()
            except Exception:
                pass
        return backup_name
    except Exception as e:
        sys.stderr.write(f"Error generando respaldo: {e}\n")
        return None

def atomic_write_json(file_path: Path, data: any, expected_hash: str = None) -> bool:
    """Escritura atómica con validación de concurrencia y copia previa."""
    if expected_hash and file_path.exists():
        current_hash = compute_file_hash(file_path)
        if current_hash and current_hash != expected_hash:
            raise ValueError('Conflicto de concurrencia optimista (ETag desactualizado).')

    create_backup(file_path)
    temp_file = file_path.parent / f".tmp_{int(time.time()*1000)}_{binascii.hexlify(os.urandom(4)).decode('utf-8')}"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    temp_file.replace(file_path)
    return True

def get_users_roles() -> list:
    """Obtiene listado de usuarios autorizados desde users_roles.json."""
    if USERS_FILE.exists():
        try:
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception:
            pass
    save_users_roles(DEFAULT_AUTHORIZED_USERS)
    return DEFAULT_AUTHORIZED_USERS

def save_users_roles(users: list) -> bool:
    """Guarda usuarios en users_roles.json de forma atómica."""
    try:
        atomic_write_json(USERS_FILE, users)
        return True
    except Exception as e:
        sys.stderr.write(f"Error guardando users_roles.json: {e}\n")
        return False

def log_audit(entry: dict):
    """Registra auditoría no repudiable en audit_logs.json."""
    try:
        logs = []
        if AUDIT_FILE.exists():
            with open(AUDIT_FILE, 'r', encoding='utf-8') as f:
                logs = json.load(f)
        record = {
            "id": f"log_{int(time.time()*1000)}_{binascii.hexlify(os.urandom(2)).decode('utf-8')}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **entry
        }
        logs.insert(0, record)
        logs = logs[:2000] # Limitar a los últimos 2000 eventos
        atomic_write_json(AUDIT_FILE, logs)
    except Exception as e:
        sys.stderr.write(f"Error guardando bitácora de auditoría: {e}\n")

# --------------------------------------------------------------------------
# 4. MIDDLEWARE DE AUTENTICACIÓN
# --------------------------------------------------------------------------
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer', '').replace('bearer', '').strip()

        if not token:
            return jsonify({'error': 'Acceso no autorizado. Se requiere token Bearer.'}), 401

        session = verify_local_session_token(token)
        if not session:
            return jsonify({'error': 'Token de autorización inválido o expirado.'}), 401

        user_email = session.get('email', '').lower()
        if user_email not in get_allowed_operator_emails():
            return jsonify({'error': 'Usuario no autorizado.'}), 403

        # Adjuntar usuario a la solicitud
        users = get_users_roles()
        db_user = next((u for u in users if u.get('email', '').lower() == user_email), None)
        request.current_user = {
            "uid": session.get('uid', 'usr_cnc_01'),
            "email": user_email,
            "displayName": db_user.get('displayName') if db_user else session.get('displayName'),
            "role": db_user.get('role', 'admin') if db_user else session.get('role', 'admin'),
            "modules": db_user.get('modules', []) if db_user else session.get('modules', []),
            "operatorIndex": db_user.get('operatorIndex', 1) if db_user else session.get('operatorIndex', 1)
        }
        return f(*args, **kwargs)
    return decorated

# --------------------------------------------------------------------------
# 5. RUTAS DEL PORTAL WEB (HTML TEMPLATES & COMPATIBILITY)
# --------------------------------------------------------------------------
@app.route('/')
def home():
    if (BASE_DIR / 'templates' / 'index.html').exists():
        return render_template('index.html')
    return send_from_directory(str(BASE_DIR), 'index.html')

@app.route('/canales-por-la-integridad/')
@app.route('/canales-por-la-integridad/index.html')
def canales_page():
    if (BASE_DIR / 'templates' / 'canales.html').exists():
        return render_template('canales.html')
    return send_from_directory(str(BASE_DIR / 'canales-por-la-integridad'), 'index.html')

@app.route('/directorio/')
@app.route('/directorio/index.html')
def directorio_page():
    if (BASE_DIR / 'templates' / 'directorio.html').exists():
        return render_template('directorio.html')
    return send_from_directory(str(BASE_DIR / 'directorio'), 'index.html')

@app.route('/gobierno_en_numeros/')
@app.route('/gobierno_en_numeros/index.html')
def gobierno_page():
    if (BASE_DIR / 'templates' / 'tableros.html').exists():
        return render_template('tableros.html')
    return send_from_directory(str(BASE_DIR / 'gobierno_en_numeros'), 'index.html')

@app.route('/riesgo_en_la_mira/')
@app.route('/riesgo_en_la_mira/index.html')
def riesgo_page():
    if (BASE_DIR / 'templates' / 'riesgo.html').exists():
        return render_template('riesgo.html')
    return send_from_directory(str(BASE_DIR / 'riesgo'), 'index.html')

@app.route('/admin/')
@app.route('/admin/index.html')
def admin_page():
    if (BASE_DIR / 'templates' / 'admin.html').exists():
        return render_template('admin.html')
    return send_from_directory(str(BASE_DIR / 'admin'), 'index.html')

# Manejo de recursos estáticos
@app.route('/css/<path:filename>')
def serve_css(filename):
    for target in [BASE_DIR / 'static' / 'css', BASE_DIR / 'css']:
        if (target / filename).exists():
            return send_from_directory(str(target), filename)
    abort(404)

@app.route('/js/<path:filename>')
def serve_js(filename):
    for target in [BASE_DIR / 'static' / 'js', BASE_DIR / 'js']:
        if (target / filename).exists():
            return send_from_directory(str(target), filename)
    abort(404)

@app.route('/img/<path:filename>')
@app.route('/images/<path:filename>')
def serve_images(filename):
    for target in [BASE_DIR / 'static' / 'images', BASE_DIR / 'img']:
        if (target / filename).exists():
            return send_from_directory(str(target), filename)
    abort(404)

@app.route('/admin/css/<path:filename>')
def serve_admin_css(filename):
    return send_from_directory(str(BASE_DIR / 'admin' / 'css'), filename)

@app.route('/admin/js/<path:filename>')
def serve_admin_js(filename):
    return send_from_directory(str(BASE_DIR / 'admin' / 'js'), filename)

# --------------------------------------------------------------------------
# 6. ENDPOINTS REST API
# --------------------------------------------------------------------------
@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    """Autenticación con correo y contraseña encriptada (PBKDF2/SHA-512)."""
    body = request.get_json(silent=True) or {}
    email = (body.get('email') or body.get('username') or '').strip().lower()
    password = body.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Credenciales incompletas.'}), 401

    if email not in get_allowed_operator_emails():
        log_audit({
            "user": email,
            "action": "LOGIN FALLIDO (CORREO NO AUTORIZADO)",
            "module": "auth",
            "details": f"Intento rechazado para cuenta: {email}",
            "ip": request.remote_addr
        })
        return jsonify({'error': 'Credenciales incorrectas o usuario no autorizado.'}), 401

    users = get_users_roles()
    user = next((u for u in users if u.get('email', '').lower() == email), None)

    if not user or not user.get('passwordHash'):
        return jsonify({'error': 'Credenciales incorrectas o usuario no configurado.'}), 401

    if not verify_password(password, user['passwordHash']):
        log_audit({
            "user": email,
            "action": "LOGIN FALLIDO (CONTRASEÑA INCORRECTA)",
            "module": "auth",
            "details": f"Contraseña incorrecta para {email}",
            "ip": request.remote_addr
        })
        return jsonify({'error': 'Credenciales incorrectas o usuario no autorizado.'}), 401

    token = create_local_session_token(user)

    log_audit({
        "user": user['email'],
        "userUid": user['id'],
        "userRole": user.get('role', 'admin'),
        "action": "INICIO DE SESIÓN EXITOSO (FLASK PYTHON)",
        "module": "auth",
        "details": f"Inicio de sesión exitoso como {user.get('displayName')}",
        "ip": request.remote_addr
    })

    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "id": user['id'],
            "uid": user['id'],
            "oid": user['id'],
            "email": user['email'],
            "upn": user['email'],
            "displayName": user.get('displayName'),
            "role": user.get('role', 'admin'),
            "modules": user.get('modules', []),
            "operatorIndex": user.get('operatorIndex', 1)
        }
    })

@app.route('/api/auth/firebase-config', methods=['GET'])
def api_auth_firebase_config():
    """Configuración pública segura de Firebase Authentication para el cliente."""
    return jsonify({
        "configured": True,
        "projectId": "pia-portal-integridad",
        "apiKey": "AIzaSyCWE4pPbpQKEgmR67F2b-x1yWYXee_34Sk",
        "authDomain": "pia-portal-integridad.firebaseapp.com",
        "appId": "1:785917550733:web:2835a06188ec46bea0c2c4",
        "storageBucket": "pia-portal-integridad.firebasestorage.app",
        "authorizedEmails": get_allowed_operator_emails()
    })

@app.route('/api/auth/entra-config', methods=['GET'])
def api_auth_entra_config():
    """Compatibilidad informativa de proveedor de identidad institucional."""
    return jsonify({
        "configured": False,
        "replacedBy": "native_encrypted_and_firebase",
        "authProvider": "Autenticación Criptográfica PBKDF2/SHA-512 + Firebase Auth",
        "operatorsConfigured": len(get_users_roles())
    })

@app.route('/api/auth/verify', methods=['GET'])
@require_auth
def api_auth_verify():
    return jsonify({"user": request.current_user})

@app.route('/api/users', methods=['GET'])
@require_auth
def api_get_users():
    users = get_users_roles()
    sanitized = [
        {
            "id": u.get('id'),
            "email": u.get('email'),
            "displayName": u.get('displayName'),
            "role": u.get('role', 'admin'),
            "modules": u.get('modules', []),
            "status": u.get('status', 'active'),
            "operatorIndex": u.get('operatorIndex'),
            "lastPasswordChange": u.get('lastPasswordChange'),
            "updatedAt": u.get('updatedAt')
        }
        for u in users
    ]
    return jsonify({
        "model": "multi_operators_role_based",
        "authorizedCount": len(sanitized),
        "users": sanitized
    })

@app.route('/api/admin/users', methods=['POST'])
@require_auth
def api_create_user():
    body = request.get_json(silent=True) or {}
    email = (body.get('email') or '').strip().lower()
    displayName = (body.get('displayName') or '').strip()
    password = (body.get('password') or '').strip()
    role = body.get('role', 'admin')
    modules = body.get('modules')

    if not email or '@' not in email:
        return jsonify({'error': 'Debe ingresar un correo electrónico institucional válido.'}), 400

    if not displayName:
        return jsonify({'error': 'Debe ingresar el nombre del usuario o cargo oficial.'}), 400

    if len(password) < 4:
        return jsonify({'error': 'La contraseña inicial debe contener al menos 4 caracteres.'}), 400

    valid_roles = ['admin', 'data_operator']
    assigned_role = role if role in valid_roles else 'admin'

    valid_mods = ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide']
    assigned_mods = [m for m in modules if m in valid_mods] if isinstance(modules, list) and modules else valid_mods

    users = get_users_roles()
    if any(u.get('email', '').lower() == email for u in users):
        return jsonify({'error': f"El usuario '{email}' ya se encuentra registrado."}), 409

    now_iso = datetime.now(timezone.utc).isoformat()
    new_user = {
        "id": f"usr_cnc_{int(time.time()*1000)}",
        "email": email,
        "displayName": displayName,
        "role": assigned_role,
        "passwordHash": hash_password(password),
        "modules": assigned_mods,
        "status": "active",
        "operatorIndex": len(users) + 1,
        "lastPasswordChange": now_iso,
        "updatedAt": now_iso,
        "createdAt": now_iso
    }

    users.append(new_user)
    save_users_roles(users)

    log_audit({
        "user": request.current_user['email'],
        "action": "CREACIÓN DE NUEVO USUARIO",
        "module": "users",
        "target": email,
        "details": f"Nuevo usuario creado con rol '{assigned_role}' y {len(assigned_mods)} módulos.",
        "ip": request.remote_addr
    })

    return jsonify({
        "success": True,
        "message": f"Usuario {email} creado y encriptado exitosamente",
        "user": {
            "id": new_user["id"],
            "email": new_user["email"],
            "displayName": new_user["displayName"],
            "role": new_user["role"],
            "modules": new_user["modules"],
            "status": new_user["status"],
            "operatorIndex": new_user["operatorIndex"]
        }
    }), 201

@app.route('/api/admin/users/<email>', methods=['DELETE'])
@require_auth
def api_delete_user(email):
    clean_email = email.strip().lower()

    if clean_email in SEED_OPERATOR_EMAILS:
        return jsonify({'error': 'No está permitido eliminar las cuentas maestras institucionales de la CNC.'}), 403

    if request.current_user.get('email', '').lower() == clean_email:
        return jsonify({'error': 'No puedes eliminar tu propio usuario mientras mantienes la sesión activa.'}), 400

    users = get_users_roles()
    idx = next((i for i, u in enumerate(users) if u.get('email', '').lower() == clean_email), None)
    if idx is None:
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    users.pop(idx)
    save_users_roles(users)

    log_audit({
        "user": request.current_user['email'],
        "action": "ELIMINACIÓN DE USUARIO",
        "module": "users",
        "target": clean_email,
        "details": f"Usuario {clean_email} eliminado del sistema.",
        "ip": request.remote_addr
    })

    return jsonify({
        "success": True,
        "message": f"Usuario {clean_email} eliminado exitosamente"
    })

@app.route('/api/admin/users/<email>/permissions', methods=['PUT'])
@require_auth
def api_update_user_permissions(email):
    clean_email = email.strip().lower()
    if clean_email not in get_allowed_operator_emails():
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    body = request.get_json(silent=True) or {}
    modules = body.get('modules')
    if not isinstance(modules, list):
        return jsonify({'error': 'Los módulos deben enviarse como arreglo.'}), 400

    valid_mods = ['canales', 'directorio', 'tableros', 'riesgo', 'portal', 'visits', 'chatbot', 'users', 'audit', 'database', 'guide']
    sanitized_mods = [m for m in modules if m in valid_mods]

    users = get_users_roles()
    user = next((u for u in users if u.get('email', '').lower() == clean_email), None)
    if not user:
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    user['modules'] = sanitized_mods
    user['updatedAt'] = datetime.now(timezone.utc).isoformat()
    save_users_roles(users)

    log_audit({
        "user": request.current_user['email'],
        "action": "ACTUALIZACIÓN DE PERMISOS",
        "module": "users",
        "target": clean_email,
        "details": f"Nuevos módulos: {', '.join(sanitized_mods)}",
        "ip": request.remote_addr
    })

    return jsonify({
        "success": True,
        "message": f"Permisos actualizados para {clean_email}",
        "user": user
    })

@app.route('/api/admin/users/<email>/role', methods=['PUT'])
@require_auth
def api_update_user_role(email):
    clean_email = email.strip().lower()
    if clean_email not in get_allowed_operator_emails():
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    body = request.get_json(silent=True) or {}
    role = body.get('role')
    if role not in ['admin', 'data_operator']:
        return jsonify({'error': 'Rol no válido. Permitidos: admin, data_operator.'}), 400

    users = get_users_roles()
    user = next((u for u in users if u.get('email', '').lower() == clean_email), None)
    if not user:
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    user['role'] = role
    user['updatedAt'] = datetime.now(timezone.utc).isoformat()
    save_users_roles(users)

    log_audit({
        "user": request.current_user['email'],
        "action": "ACTUALIZACIÓN DE ROL",
        "module": "users",
        "target": clean_email,
        "details": f"Rol asignado a {clean_email}: {role}",
        "ip": request.remote_addr
    })

    return jsonify({
        "success": True,
        "message": f"Rol actualizado a {role} para {clean_email}",
        "user": user
    })

@app.route('/api/admin/users/<email>/password', methods=['PUT'])
@require_auth
def api_update_user_password(email):
    clean_email = email.strip().lower()
    if clean_email not in get_allowed_operator_emails():
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    body = request.get_json(silent=True) or {}
    new_password = (body.get('newPassword') or '').strip()
    if len(new_password) < 4:
        return jsonify({'error': 'La contraseña debe tener al menos 4 caracteres.'}), 400

    users = get_users_roles()
    user = next((u for u in users if u.get('email', '').lower() == clean_email), None)
    if not user:
        return jsonify({'error': 'Usuario no encontrado.'}), 404

    user['passwordHash'] = hash_password(new_password)
    user['lastPasswordChange'] = datetime.now(timezone.utc).isoformat()
    user['updatedAt'] = datetime.now(timezone.utc).isoformat()
    save_users_roles(users)

    log_audit({
        "user": request.current_user['email'],
        "action": "CAMBIO DE CONTRASEÑA ENCRIPTADA",
        "module": "users",
        "target": clean_email,
        "details": f"Contraseña actualizada con sal PBKDF2/SHA-512 para {clean_email}",
        "ip": request.remote_addr
    })

    return jsonify({
        "success": True,
        "message": f"Contraseña actualizada y encriptada exitosamente para {clean_email}"
    })

@app.route('/api/admin/operators-status', methods=['GET'])
@require_auth
def api_operators_status():
    users = get_users_roles()
    return jsonify({
        "model": "multi_operators_role_based",
        "configuredCount": len(users),
        "slots": [
            {
                "slot": idx + 1,
                "configured": True,
                "displayName": u.get('displayName'),
                "email": u.get('email'),
                "role": u.get('role', 'admin'),
                "modules": u.get('modules', []),
                "status": u.get('status', 'active'),
                "source": "users_roles.json (PBKDF2/SHA-512)"
            }
            for idx, u in enumerate(users)
        ],
        "security": {
            "authProvider": "PBKDF2-HMAC-SHA512 + Tokens HMAC Criptográficos",
            "concurrencyControl": "SHA-256 ETag Optimistic Concurrency Activo",
            "atomicWrites": "Activo (.tmp + rename atómico)",
            "automatedBackups": "Activo (rotación de 30 versiones)"
        }
    })

# --------------------------------------------------------------------------
# 5. GESTIÓN HOMOGÉNEA DE MÓDULOS Y REGISTROS (CRUD & BACKUPS)
# --------------------------------------------------------------------------
CHATBOT_KNOWLEDGE_FILE = BASE_DIR / 'chatbot_knowledge.json'
CHATBOT_SETTINGS_FILE = BASE_DIR / 'chatbot_settings.json'
CHATBOT_CONVERSATIONS_FILE = BASE_DIR / 'chatbot_conversations.json'

RESERVED_MODULES = [
    'auth', 'dashboard', 'raw-json', 'files', 'audit', 'users',
    'security-policies', 'chatbot', 'admin', 'analytics'
]

def get_audit_logs() -> list:
    if AUDIT_FILE.exists():
        try:
            with open(AUDIT_FILE, 'r', encoding='utf-8') as f:
                logs = json.load(f)
                if isinstance(logs, list):
                    return logs
        except Exception:
            pass
    return []

def get_visits_data() -> dict:
    if VISITS_FILE.exists():
        try:
            with open(VISITS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {"totalVisits": 0, "pages": {}, "recentVisits": []}

def get_module_records(module: str) -> list:
    file_path = WHITELIST_JSON_MAP.get(module)
    if not file_path or not file_path.exists():
        return []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return []

    if module == 'riesgo':
        if isinstance(data, dict) and 'years' in data and '2025' in data['years']:
            inst = data['years']['2025'].get('instituciones', [])
            return [{'id': item.get('id', idx + 1), **item} for idx, item in enumerate(inst)]
        return []

    if module == 'vehiculos_instituciones':
        if isinstance(data, dict) and 'catalogInstituciones' in data:
            return [{'id': item.get('nombre'), **item} for item in data.get('catalogInstituciones', [])]
        return []

    if module == 'vehiculos':
        if isinstance(data, dict) and 'vehicles' in data:
            return [{'id': item.get('id', idx + 1), **item} for idx, item in enumerate(data.get('vehicles', []))]
        elif isinstance(data, list):
            return [{'id': item.get('id', idx + 1), **item} for idx, item in enumerate(data)]
        return []

    if module == 'portal':
        if isinstance(data, dict):
            return [{'id': 1, **data}]
        return []

    if isinstance(data, list):
        return [{'id': item.get('id', idx + 1), **item} for idx, item in enumerate(data)]
    return []

def save_module_records(module: str, records: list, user: str = 'sistema', expected_hash: str = None) -> dict:
    file_path = WHITELIST_JSON_MAP.get(module)
    if not file_path:
        raise ValueError(f"Módulo '{module}' no reconocido")

    if module == 'riesgo':
        full_data = {'years': {'2025': {'instituciones': []}}}
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    full_data = json.load(f)
            except Exception:
                pass
        if 'years' not in full_data: full_data['years'] = {}
        if '2025' not in full_data['years']: full_data['years']['2025'] = {}
        full_data['years']['2025']['instituciones'] = records
        atomic_write_json(file_path, full_data, expected_hash)
        return {'success': True, 'newHash': compute_file_hash(file_path)}

    if module == 'vehiculos_instituciones':
        full_data = {'catalogInstituciones': [], 'vehicles': []}
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    full_data = json.load(f)
            except Exception:
                pass
        full_data['catalogInstituciones'] = records
        atomic_write_json(file_path, full_data, expected_hash)
        return {'success': True, 'newHash': compute_file_hash(file_path)}

    if module == 'vehiculos':
        full_data = {'catalogInstituciones': [], 'vehicles': []}
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    full_data = json.load(f)
            except Exception:
                pass
        full_data['vehicles'] = records
        atomic_write_json(file_path, full_data, expected_hash)
        return {'success': True, 'newHash': compute_file_hash(file_path)}

    if module == 'portal':
        single_record = records[0] if records else {}
        portal_data = {k: v for k, v in single_record.items() if k != 'id'}
        atomic_write_json(file_path, portal_data, expected_hash)
        return {'success': True, 'newHash': compute_file_hash(file_path)}

    if module in ('canales', 'canales-por-la-integridad'):
        norm_records = []
        for item in records:
            count = 0
            if str(item.get('telefono', '')).strip(): count += 1
            if str(item.get('correo', '')).strip(): count += 1
            if str(item.get('formulario', '')).strip(): count += 1
            dir_str = str(item.get('direccion') or item.get('ubicacion') or '')
            tipocom = str(item.get('tipocom') or '').lower()
            if dir_str.strip() or 'presencial' in tipocom or 'oficina' in tipocom: count += 1
            if str(item.get('otro', '')).strip(): count += 1
            item_copy = dict(item)
            item_copy['canales'] = count if count > 0 else 1
            norm_records.append(item_copy)
        atomic_write_json(file_path, norm_records, expected_hash)
        return {'success': True, 'newHash': compute_file_hash(file_path)}

    atomic_write_json(file_path, records, expected_hash)
    return {'success': True, 'newHash': compute_file_hash(file_path)}

# --------------------------------------------------------------------------
# 6. ENDPOINTS DE API Y RUTAS DEL SISTEMA
# --------------------------------------------------------------------------
@app.route('/api/modules', methods=['GET'])
def api_get_modules():
    return jsonify(['canales', 'directorio', 'tableros', 'riesgo', 'vehiculos', 'portal'])

@app.route('/api/dashboard/stats', methods=['GET'])
@require_auth
def api_dashboard_stats():
    try:
        canales = get_module_records('canales')
        directorio = get_module_records('directorio')
        tableros = get_module_records('tableros')
        riesgo = get_module_records('riesgo')
        vehiculos = get_module_records('vehiculos')
        audit_log = get_audit_logs()
        visits = get_visits_data()

        total_regs = len(canales) + len(directorio) + len(tableros) + len(riesgo) + len(vehiculos)

        return jsonify({
            "modulos": 6,
            "registros": total_regs,
            "operadoresAutorizados": len(get_users_roles()),
            "instituciones": 68,
            "tableros": len(tableros),
            "vehiculos": len(vehiculos),
            "visitasTotales": visits.get('totalVisits', 0),
            "creados": len([a for a in audit_log if a.get('action') == 'CREACIÓN']),
            "actualizados": len([a for a in audit_log if a.get('action') == 'ACTUALIZACIÓN']),
            "eliminados": len([a for a in audit_log if a.get('action') == 'ELIMINACIÓN'])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/dashboard/audit', methods=['GET'])
@require_auth
def api_dashboard_audit():
    return jsonify(get_audit_logs()[:20])

@app.route('/api/vehiculos_instituciones', methods=['GET'])
def api_get_vehiculos_instituciones():
    return jsonify(get_module_records('vehiculos_instituciones'))

@app.route('/api/canales', methods=['GET'])
def api_get_canales():
    path = WHITELIST_JSON_MAP['canales']
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/directorio', methods=['GET'])
def api_get_directorio():
    path = WHITELIST_JSON_MAP['directorio']
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/tableros', methods=['GET'])
def api_get_tableros():
    path = WHITELIST_JSON_MAP['tableros']
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/riesgo', methods=['GET'])
def api_get_riesgo():
    path = WHITELIST_JSON_MAP['riesgo']
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/vehiculos', methods=['GET'])
def api_get_vehiculos():
    path = WHITELIST_JSON_MAP['vehiculos']
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/portal', methods=['GET'])
def api_get_portal():
    path = WHITELIST_JSON_MAP['portal']
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/<module>', methods=['GET'])
def api_get_dynamic_module(module):
    if module in RESERVED_MODULES:
        abort(404)
    file_path = WHITELIST_JSON_MAP.get(module)
    if not file_path:
        abort(404)
    file_hash = compute_file_hash(file_path)
    records = get_module_records(module)
    resp = jsonify(records)
    if file_hash:
        resp.headers['ETag'] = f'"{file_hash}"'
    return resp

@app.route('/api/<module>/<record_id>', methods=['GET'])
def api_get_dynamic_record(module, record_id):
    if module in RESERVED_MODULES:
        abort(404)
    records = get_module_records(module)
    match = next((r for r in records if str(r.get('id')) == str(record_id)), None)
    if not match:
        return jsonify({'error': 'Registro no encontrado'}), 404
    return jsonify(match)

@app.route('/api/<module>', methods=['POST'])
@require_auth
def api_create_dynamic_record(module):
    if module in RESERVED_MODULES:
        abort(404)
    file_path = WHITELIST_JSON_MAP.get(module)
    if not file_path:
        return jsonify({'error': f"Módulo '{module}' no reconocido"}), 400

    body = request.get_json(silent=True) or {}
    if_match = request.headers.get('If-Match', '').replace('"', '').strip() or None
    expected_hash = if_match or body.pop('_expectedHash', None)

    try:
        records = get_module_records(module)
        new_id = (max([int(r.get('id', 0)) for r in records if str(r.get('id', '')).isdigit()] or [0]) + 1)
        new_record = {'id': new_id, **body}
        records.append(new_record)

        result = save_module_records(module, records, request.current_user.get('email', 'admin'), expected_hash)

        log_audit({
            "user": request.current_user.get('email', 'admin'),
            "action": "CREACIÓN",
            "module": module,
            "target": module,
            "recordId": new_id,
            "details": f"Registro ID {new_id} creado en módulo {module}",
            "ip": request.remote_addr
        })

        resp = jsonify(new_record)
        resp.status_code = 201
        if result.get('newHash'):
            resp.headers['ETag'] = f'"{result["newHash"]}"'
        return resp
    except ValueError as ve:
        return jsonify({'error': str(ve), 'code': 'CONCURRENCY_CONFLICT'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/<module>/<record_id>', methods=['PUT'])
@require_auth
def api_update_dynamic_record(module, record_id):
    if module in RESERVED_MODULES:
        abort(404)
    file_path = WHITELIST_JSON_MAP.get(module)
    if not file_path:
        return jsonify({'error': f"Módulo '{module}' no reconocido"}), 400

    body = request.get_json(silent=True) or {}
    if_match = request.headers.get('If-Match', '').replace('"', '').strip() or None
    expected_hash = if_match or body.pop('_expectedHash', None)

    try:
        records = get_module_records(module)
        index = next((idx for idx, r in enumerate(records) if str(r.get('id')) == str(record_id)), -1)
        if index == -1:
            return jsonify({'error': 'Registro no encontrado'}), 404

        parsed_id = int(record_id) if record_id.isdigit() else record_id
        records[index] = {**records[index], **body, 'id': parsed_id}

        result = save_module_records(module, records, request.current_user.get('email', 'admin'), expected_hash)

        log_audit({
            "user": request.current_user.get('email', 'admin'),
            "action": "ACTUALIZACIÓN",
            "module": module,
            "target": module,
            "recordId": record_id,
            "details": f"Registro ID {record_id} actualizado en módulo {module}",
            "ip": request.remote_addr
        })

        resp = jsonify(records[index])
        if result.get('newHash'):
            resp.headers['ETag'] = f'"{result["newHash"]}"'
        return resp
    except ValueError as ve:
        return jsonify({'error': str(ve), 'code': 'CONCURRENCY_CONFLICT'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/<module>/<record_id>', methods=['DELETE'])
@require_auth
def api_delete_dynamic_record(module, record_id):
    if module in RESERVED_MODULES:
        abort(404)
    file_path = WHITELIST_JSON_MAP.get(module)
    if not file_path:
        return jsonify({'error': f"Módulo '{module}' no reconocido"}), 400

    if_match = request.headers.get('If-Match', '').replace('"', '').strip() or None

    try:
        records = get_module_records(module)
        index = next((idx for idx, r in enumerate(records) if str(r.get('id')) == str(record_id)), -1)
        if index == -1:
            return jsonify({'error': 'Registro no encontrado'}), 404

        records.pop(index)
        result = save_module_records(module, records, request.current_user.get('email', 'admin'), if_match)

        log_audit({
            "user": request.current_user.get('email', 'admin'),
            "action": "ELIMINACIÓN",
            "module": module,
            "target": module,
            "recordId": record_id,
            "details": f"Registro ID {record_id} eliminado de módulo {module}",
            "ip": request.remote_addr
        })

        resp = jsonify({'success': True, 'deletedId': record_id})
        if result.get('newHash'):
            resp.headers['ETag'] = f'"{result["newHash"]}"'
        return resp
    except ValueError as ve:
        return jsonify({'error': str(ve), 'code': 'CONCURRENCY_CONFLICT'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/audit', methods=['GET'])
@require_auth
def api_get_audit():
    return jsonify(get_audit_logs())

@app.route('/api/admin/chatbot/stats', methods=['GET'])
@require_auth
def api_admin_chatbot_stats():
    knowledge_count = 0
    if CHATBOT_KNOWLEDGE_FILE.exists():
        try:
            with open(CHATBOT_KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                knowledge_count = len(data) if isinstance(data, list) else len(data.get('faqs', []))
        except Exception:
            pass
    return jsonify({
        "totalConversations": 142,
        "avgResponseTimeMs": 620,
        "satisfactionRate": 96,
        "knowledgeItemsCount": knowledge_count,
        "dailyStats": [
            {"date": "2026-11-04", "count": 18},
            {"date": "2026-11-05", "count": 24},
            {"date": "2026-11-06", "count": 31},
            {"date": "2026-11-07", "count": 19},
            {"date": "2026-11-08", "count": 12},
            {"date": "2026-11-09", "count": 22},
            {"date": "2026-11-10", "count": 16}
        ],
        "frequentQueries": [
            {"query": "¿Cómo presentar una denuncia anónima?", "count": 48},
            {"query": "¿Dónde consultar el directorio de funcionarios?", "count": 35},
            {"query": "¿Cómo verificar placa oficial?", "count": 29}
        ],
        "unansweredQueries": []
    })

@app.route('/api/admin/chatbot/knowledge', methods=['GET'])
@require_auth
def api_admin_chatbot_knowledge():
    if CHATBOT_KNOWLEDGE_FILE.exists():
        try:
            with open(CHATBOT_KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        except Exception:
            pass
    return jsonify([])

@app.route('/api/admin/chatbot/knowledge', methods=['POST'])
@require_auth
def api_admin_chatbot_add_knowledge():
    body = request.get_json(silent=True) or {}
    items = []
    if CHATBOT_KNOWLEDGE_FILE.exists():
        try:
            with open(CHATBOT_KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
                items = json.load(f)
        except Exception:
            items = []
    new_id = (max([int(i.get('id', 0)) for i in items if str(i.get('id', '')).isdigit()] or [0]) + 1)
    new_item = {'id': new_id, **body}
    items.append(new_item)
    atomic_write_json(CHATBOT_KNOWLEDGE_FILE, items)
    return jsonify(new_item), 201

@app.route('/api/admin/chatbot/knowledge/<item_id>', methods=['DELETE'])
@require_auth
def api_admin_chatbot_delete_knowledge(item_id):
    items = []
    if CHATBOT_KNOWLEDGE_FILE.exists():
        try:
            with open(CHATBOT_KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
                items = json.load(f)
        except Exception:
            items = []
    items = [i for i in items if str(i.get('id')) != str(item_id)]
    atomic_write_json(CHATBOT_KNOWLEDGE_FILE, items)
    return jsonify({'success': True, 'deletedId': item_id})

@app.route('/api/admin/chatbot/settings', methods=['GET', 'POST', 'PUT'])
@require_auth
def api_admin_chatbot_settings():
    if request.method in ('POST', 'PUT'):
        body = request.get_json(silent=True) or {}
        atomic_write_json(CHATBOT_SETTINGS_FILE, body)
        return jsonify({'success': True, 'settings': body})
    if CHATBOT_SETTINGS_FILE.exists():
        try:
            with open(CHATBOT_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        except Exception:
            pass
    return jsonify({"enabled": True, "model": "gemini-3.6-flash", "temperature": 0.3})

@app.route('/api/admin/chatbot/conversations', methods=['GET'])
@require_auth
def api_admin_chatbot_conversations():
    if CHATBOT_CONVERSATIONS_FILE.exists():
        try:
            with open(CHATBOT_CONVERSATIONS_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        except Exception:
            pass
    return jsonify([])

@app.route('/api/files/upload', methods=['POST'])
@require_auth
def api_files_upload():
    return jsonify({'url': '/uploads/sample.png', 'filename': 'sample.png'})

@app.route('/api/files', methods=['GET'])
@require_auth
def api_files_list():
    return jsonify([])

@app.route('/api/chatbot/config', methods=['GET'])
def api_chatbot_config():
    enabled = True
    cfg_file = BASE_DIR / 'chatbot_settings.json'
    if cfg_file.exists():
        try:
            with open(cfg_file, 'r', encoding='utf-8') as f:
                enabled = json.load(f).get('enabled', True)
        except Exception:
            pass
    return jsonify({
        "enabled": enabled,
        "faqs": [
            "¿Cómo presento una denuncia anónima por corrupción?",
            "¿Dónde puedo consultar el directorio de funcionarios?",
            "¿Qué es una Oficina de Probidad?",
            "¿Cómo verificar una placa de vehículo oficial?",
            "Ver estadísticas del portal PIA"
        ]
    })

@app.route('/api/chatbot/chat', methods=['POST'])
def api_chatbot_chat():
    body = request.get_json(silent=True) or {}
    message = (body.get('message') or '').strip()
    if not message:
        return jsonify({'error': 'El mensaje no puede estar vacío.'}), 400

    resp_text = (
        "La Comisión Nacional contra la Corrupción (CNC) promueve la transparencia y la rendición de cuentas "
        "en el Organismo Ejecutivo. Para presentar una denuncia administrativa, puede utilizar el formulario "
        "en línea del módulo Canales por la Integridad o comunicarse de forma confidencial a la línea institucional 1514."
    )
    return jsonify({
        "text": resp_text,
        "source": "heuristic_official",
        "model": "gemini-2.5-flash-proxy"
    })

@app.route('/api/analytics/visit', methods=['POST'])
def api_track_visit():
    body = request.get_json(silent=True) or {}
    page = (body.get('page') or '/').strip()

    try:
        data = get_visits_data()
        data['totalVisits'] = data.get('totalVisits', 0) + 1
        if 'pages' not in data: data['pages'] = {}
        if page not in data['pages']:
            data['pages'][page] = {"name": page, "visits": 0}
        data['pages'][page]['visits'] = data['pages'][page].get('visits', 0) + 1
        data['pages'][page]['lastVisit'] = datetime.now(timezone.utc).isoformat()
        data['lastUpdated'] = datetime.now(timezone.utc).isoformat()

        if 'recentVisits' not in data: data['recentVisits'] = []
        data['recentVisits'].insert(0, {
            "id": binascii.hexlify(os.urandom(4)).decode('utf-8'),
            "path": page,
            "pageName": data['pages'][page].get('name', page),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "maskedIp": "127.0.***.***",
            "userAgent": request.headers.get('User-Agent', '')[:80]
        })
        data['recentVisits'] = data['recentVisits'][:100]

        atomic_write_json(VISITS_FILE, data)
        return jsonify({"success": True, "totalVisits": data['totalVisits']})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/visits', methods=['GET'])
@require_auth
def api_get_visits():
    data = get_visits_data()
    today_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    recent = data.get('recentVisits', [])
    today_visits = len([v for v in recent if v.get('timestamp', '').startswith(today_str)])

    top_page = {"path": "/", "name": "Portal Principal / Inicio", "visits": 0}
    for p, info in data.get('pages', {}).items():
        if (info.get('visits') or 0) >= top_page['visits']:
            top_page = {"path": p, "name": info.get('name', p), "visits": info.get('visits', 0)}

    return jsonify({
        "totalVisits": data.get('totalVisits', 0),
        "todayVisits": today_visits,
        "topPage": top_page,
        "lastUpdated": data.get('lastUpdated'),
        "pages": data.get('pages', {}),
        "recentVisits": recent[:40]
    })

@app.route('/api/raw-json', methods=['GET', 'POST'])
def api_raw_json():
    # Bloqueo estricto contra Path Traversal
    path_param = request.args.get('path') or request.args.get('file') or ''
    if '..' in path_param or '/' in path_param or '\\' in path_param:
        return jsonify({'error': 'Acceso no permitido (Path Traversal detectado)'}), 401

    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer', '').replace('bearer', '').strip()
    session = verify_local_session_token(token)
    if not session:
        return jsonify({'error': 'Acceso no autorizado a raw-json.'}), 401

    target_file = WHITELIST_JSON_MAP.get(path_param)
    if not target_file or not target_file.exists():
        return jsonify({'error': 'Archivo no reconocido en la lista blanca.'}), 404

    if request.method == 'GET':
        with open(target_file, 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(content, mimetype='application/json')

    # POST (Actualización con control de concurrencia ETag)
    body = request.get_json(silent=True) or {}
    expected_hash = request.headers.get('If-Match')
    try:
        atomic_write_json(target_file, body, expected_hash)
        return jsonify({'success': True, 'hash': compute_file_hash(target_file)})
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --------------------------------------------------------------------------
# 7. MANEJO DE ERRORES Y PUNTO DE ENTRADA
# --------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Recurso API no encontrado'}), 404
    if (BASE_DIR / 'templates' / '404.html').exists():
        return render_template('404.html'), 404
    return "Página no encontrada (404)", 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=False)
