from flask import Flask, render_template, request, url_for, flash, jsonify
from flask_cors import CORS
from werkzeug.utils import redirect
import sqlite3
import os

import base64

from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from flask_bcrypt import Bcrypt
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    login_required,
    logout_user,
    current_user,
)

db_file = "passwordData.db"

app = Flask(__name__)
app.secret_key = "change_this_to_a_random_secret"  # needed for flash/sessions

CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}},
)

bcrypt = Bcrypt(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"  # endpoint name (function name)

def get_db():
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

PBKDF2_ITERATIONS = 200_000  # reasonable baseline for a project

def derive_kek(master_password: str, kdf_salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=kdf_salt,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(master_password.encode("utf-8"))

def encrypt_with_aesgcm(key: bytes, plaintext: bytes) -> bytes:
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext

def decrypt_with_aesgcm(key: bytes, blob: bytes) -> bytes:
    nonce = blob[:12]
    ciphertext = blob[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)

def generate_vault_key() -> bytes:
    return os.urandom(32)

def init_db():
    users_table = """
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      kdf_salt BLOB NOT NULL,
      encrypted_vault_key BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """

    credentials_table = """
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service TEXT NOT NULL,
      login TEXT NOT NULL,
      password_ciphertext BLOB NOT NULL,
      password_nonce BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """

    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service);",
    ]


    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(users_table)
        cur.execute(credentials_table)
        for stmt in indexes:
            cur.execute(stmt)
        conn.commit()
    finally:
        conn.close()

# -----------------------
# Flask-Login User model
# -----------------------
class User(UserMixin):
    def __init__(self, user_id, username):
        self.id = str(user_id)   # flask-login expects string IDs
        self.username = username


@login_manager.user_loader
def load_user(user_id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, username FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            return None
        return User(row["id"], row["username"])
    finally:
        conn.close()


# -----------------------
# Helper: password rules
# -----------------------
def is_strong_password(pw: str) -> bool:
    if pw is None:
        return False
    if len(pw) < 12:
        return False
    has_lower = any(c.islower() for c in pw)
    has_upper = any(c.isupper() for c in pw)
    has_digit = any(c.isdigit() for c in pw)
    has_symbol = any(not c.isalnum() for c in pw)
    return has_lower and has_upper and has_digit and has_symbol

# -----------------------
# Routes
# -----------------------
@app.route("/api/health")
def api_health():
    return jsonify({"ok": True})

@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(force=True) or {}
    username = (data.get("email") or data.get("username") or "").strip()
    master_password = data.get("password") or ""
    confirm = data.get("confirm") or master_password

    if not username:
        return jsonify({"error": "Username/email is required."}), 400
    if master_password != confirm:
        return jsonify({"error": "Passwords do not match."}), 400
    if not is_strong_password(master_password):
        return jsonify({"error": "Password must be 12+ chars and include upper/lower/digit/symbol."}), 400

    password_hash = bcrypt.generate_password_hash(master_password).decode("utf-8")
    kdf_salt = os.urandom(16)
    kek = derive_kek(master_password, kdf_salt)
    vault_key = generate_vault_key()
    encrypted_vault_key = encrypt_with_aesgcm(kek, vault_key)

    conn = get_db()
    try:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, kdf_salt, encrypted_vault_key) VALUES (?, ?, ?, ?)",
                (username, password_hash, kdf_salt, encrypted_vault_key),
            )
            conn.commit()
            user_id = cur.lastrowid
        except sqlite3.IntegrityError:
            return jsonify({"error": "That username is already taken."}), 409
    finally:
        conn.close()

    # Optional: log them in immediately after registering
    login_user(User(user_id, username))
    return jsonify({"ok": True, "user": {"email": username}}), 201

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(force=True) or {}
    username = (data.get("email") or data.get("username") or "").strip()
    master_password = data.get("password") or ""

    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    finally:
        conn.close()

    if not row or not bcrypt.check_password_hash(row["password_hash"], master_password):
        return jsonify({"error": "Invalid username or password."}), 401

    login_user(User(row["id"], row["username"]))
    return jsonify({"ok": True, "user": {"email": row["username"]}})

@app.route("/api/logout", methods=["POST"])
@login_required
def api_logout():
    logout_user()
    return jsonify({"ok": True})

@app.route("/api/me", methods=["GET"])
def api_me():
    if not current_user.is_authenticated:
        return jsonify({"user": None}), 200
    return jsonify({"user": {"email": current_user.username}}), 200

def get_user_vault_key(user_id: str, master_password: str) -> bytes:
    """
    Decrypts and returns the user's vault key (DEK) given the master password.
    Used when encrypting/decrypting credentials.
    """
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT kdf_salt, encrypted_vault_key, password_hash FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            raise ValueError("User not found")

        # verify password first (important)
        if not bcrypt.check_password_hash(row["password_hash"], master_password):
            raise ValueError("Invalid master password")

        kek = derive_kek(master_password, row["kdf_salt"])
        vault_key = decrypt_with_aesgcm(kek, row["encrypted_vault_key"])
        return vault_key
    finally:
        conn.close()

@app.route("/api/credentials", methods=["GET"])
@login_required
def api_list_credentials():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, service, login, created_at, updated_at FROM credentials WHERE user_id = ? ORDER BY id DESC",
            (current_user.id,),
        ).fetchall()
        creds = [dict(r) for r in rows]
    finally:
        conn.close()

    return jsonify({"items": creds})

@app.route("/api/credentials", methods=["POST"])
@login_required
def api_create_credential():
    data = request.get_json(force=True) or {}
    service = (data.get("site") or data.get("service") or "").strip()
    login_ = (data.get("username") or data.get("login") or "").strip()
    password = data.get("password") or ""
    master_password = data.get("master_password") or ""

    if not service or not login_ or not password:
        return jsonify({"error": "service/site, login/username, and password are required."}), 400

    try:
        vault_key = get_user_vault_key(current_user.id, master_password)
    except ValueError:
        return jsonify({"error": "Master password is incorrect."}), 401

    aesgcm = AESGCM(vault_key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, password.encode("utf-8"), None)

    conn = get_db()
    try:
        cur = conn.execute(
            """
            INSERT INTO credentials (user_id, service, login, password_ciphertext, password_nonce)
            VALUES (?, ?, ?, ?, ?)
            """,
            (current_user.id, service, login_, ciphertext, nonce),
        )
        conn.commit()
        new_id = cur.lastrowid
    finally:
        conn.close()

    return jsonify({"ok": True, "id": new_id}), 201

if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
