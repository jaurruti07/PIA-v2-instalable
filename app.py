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

ALLOWED_OPERATOR_EMAILS = [
    'deteccionydenuncia@cnc.gob.gt',
    'apoyogi@cnc.gob.gt'
]

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
        if user_email not in ALLOWED_OPERATOR_EMAILS:
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

    if email not in ALLOWED_OPERATOR_EMAILS:
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
        "authorizedEmails": ALLOWED_OPERATOR_EMAILS
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
        "model": "two_operators_exclusive",
        "authorizedCount": len(sanitized),
        "maxAllowed": 2,
        "users": sanitized
    })

@app.route('/api/admin/users/<email>/permissions', methods=['PUT'])
@require_auth
def api_update_user_permissions(email):
    clean_email = email.strip().lower()
    if clean_email not in ALLOWED_OPERATOR_EMAILS:
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

@app.route('/api/admin/users/<email>/password', methods=['PUT'])
@require_auth
def api_update_user_password(email):
    clean_email = email.strip().lower()
    if clean_email not in ALLOWED_OPERATOR_EMAILS:
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
        "model": "two_operators_exclusive",
        "maxAllowed": 2,
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

# Endpoints de lectura pública de datos
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

@app.route('/api/audit', methods=['GET'])
@require_auth
def api_get_audit():
    if AUDIT_FILE.exists():
        with open(AUDIT_FILE, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
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

    # Respuesta heurística institucional oficial
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
    """Registra visitas reales a las páginas del portal."""
    body = request.get_json(silent=True) or {}
    page = (body.get('page') or '/').strip()

    try:
        data = {
            "totalVisits": 0,
            "pageVisits": {},
            "hourlyVisits": {},
            "dailyVisits": {},
            "lastVisit": datetime.now(timezone.utc).isoformat()
        }
        if VISITS_FILE.exists():
            with open(VISITS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)

        data['totalVisits'] = data.get('totalVisits', 0) + 1
        data['pageVisits'][page] = data['pageVisits'].get(page, 0) + 1
        data['lastVisit'] = datetime.now(timezone.utc).isoformat()

        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        data['dailyVisits'][today] = data.get('dailyVisits', {}).get(today, 0) + 1

        atomic_write_json(VISITS_FILE, data)
        return jsonify({"success": True, "totalVisits": data['totalVisits']})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/visits', methods=['GET'])
@require_auth
def api_get_visits():
    if VISITS_FILE.exists():
        with open(VISITS_FILE, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({"totalVisits": 0, "pageVisits": {}, "dailyVisits": {}})

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
