import os
import secrets
import sqlite3

from flask import Flask, request, jsonify
from flask_cors import CORS

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

# Use env var in production; generate a strong random key for dev so the
# placeholder "change_this" secret can never accidentally reach production.
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # set True when serving over HTTPS
)

CORS(
    app,
    supports_credentials=True,
    origins=["http://127.0.0.1:5173", "http://localhost:5173"],
)

bcrypt = Bcrypt(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "api_login"

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized"}), 401


# -----------------------
# Database
# -----------------------
def get_db():
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


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
      url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Personal',
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


def migrate_db():
    """Add columns introduced after the initial schema without breaking existing DBs."""
    conn = get_db()
    try:
        for stmt in [
            "ALTER TABLE credentials ADD COLUMN url TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE credentials ADD COLUMN category TEXT NOT NULL DEFAULT 'Personal'",
        ]:
            try:
                conn.execute(stmt)
                conn.commit()
            except sqlite3.OperationalError:
                pass  # column already exists
    finally:
        conn.close()


# -----------------------
# Crypto helpers
# -----------------------
PBKDF2_ITERATIONS = 200_000

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


# -----------------------
# Flask-Login user model
# -----------------------
class User(UserMixin):
    def __init__(self, user_id, username):
        self.id = str(user_id)
        self.username = username


@login_manager.user_loader
def load_user(user_id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, username FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not row:
            return None
        return User(row["id"], row["username"])
    finally:
        conn.close()


# -----------------------
# Password policy
# -----------------------
def is_strong_password(pw: str) -> bool:
    if not pw or len(pw) < 12:
        return False
    return (
        any(c.islower() for c in pw)
        and any(c.isupper() for c in pw)
        and any(c.isdigit() for c in pw)
        and any(not c.isalnum() for c in pw)
    )


# -----------------------
# Vault key helper
# -----------------------
def get_user_vault_key(user_id: str, master_password: str) -> bytes:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT kdf_salt, encrypted_vault_key, password_hash FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            raise ValueError("User not found")
        if not bcrypt.check_password_hash(row["password_hash"], master_password):
            raise ValueError("Invalid master password")
        kek = derive_kek(master_password, row["kdf_salt"])
        return decrypt_with_aesgcm(kek, row["encrypted_vault_key"])
    finally:
        conn.close()


# -----------------------
# Routes — auth
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


# -----------------------
# Routes — credentials
# -----------------------
@app.route("/api/credentials", methods=["GET"])
@login_required
def api_list_credentials():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT id, service, login, url, category, created_at, updated_at
               FROM credentials WHERE user_id = ? ORDER BY service ASC""",
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
    url = (data.get("url") or "").strip()
    category = (data.get("category") or "Personal").strip()

    if not service or not login_ or not password:
        return jsonify({"error": "site, username, and password are required."}), 400

    try:
        vault_key = get_user_vault_key(current_user.id, master_password)
    except ValueError as e:
        return jsonify({"error": str(e)}), 401

    aesgcm = AESGCM(vault_key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, password.encode("utf-8"), None)

    conn = get_db()
    try:
        cur = conn.execute(
            """INSERT INTO credentials
               (user_id, service, login, url, category, password_ciphertext, password_nonce)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (current_user.id, service, login_, url, category, ciphertext, nonce),
        )
        conn.commit()
        new_id = cur.lastrowid
    finally:
        conn.close()

    return jsonify({"ok": True, "id": new_id, "service": service, "login": login_,
                    "url": url, "category": category}), 201


@app.route("/api/credentials/<int:cred_id>", methods=["PUT"])
@login_required
def api_update_credential(cred_id):
    data = request.get_json(force=True) or {}
    service = (data.get("site") or data.get("service") or "").strip()
    login_ = (data.get("username") or data.get("login") or "").strip()
    url = (data.get("url") or "").strip()
    category = (data.get("category") or "Personal").strip()
    new_password = data.get("password") or ""
    master_password = data.get("master_password") or ""

    if not service or not login_:
        return jsonify({"error": "site and username are required."}), 400

    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id FROM credentials WHERE id = ? AND user_id = ?",
            (cred_id, current_user.id),
        ).fetchone()
        if not row:
            return jsonify({"error": "Not found."}), 404

        if new_password:
            try:
                vault_key = get_user_vault_key(current_user.id, master_password)
            except ValueError as e:
                return jsonify({"error": str(e)}), 401

            aesgcm = AESGCM(vault_key)
            nonce = os.urandom(12)
            ciphertext = aesgcm.encrypt(nonce, new_password.encode("utf-8"), None)
            conn.execute(
                """UPDATE credentials
                   SET service=?, login=?, url=?, category=?,
                       password_ciphertext=?, password_nonce=?, updated_at=datetime('now')
                   WHERE id=? AND user_id=?""",
                (service, login_, url, category, ciphertext, nonce, cred_id, current_user.id),
            )
        else:
            conn.execute(
                """UPDATE credentials
                   SET service=?, login=?, url=?, category=?, updated_at=datetime('now')
                   WHERE id=? AND user_id=?""",
                (service, login_, url, category, cred_id, current_user.id),
            )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"ok": True})


@app.route("/api/credentials/<int:cred_id>", methods=["DELETE"])
@login_required
def api_delete_credential(cred_id):
    conn = get_db()
    try:
        result = conn.execute(
            "DELETE FROM credentials WHERE id = ? AND user_id = ?",
            (cred_id, current_user.id),
        )
        conn.commit()
        if result.rowcount == 0:
            return jsonify({"error": "Not found."}), 404
    finally:
        conn.close()
    return jsonify({"ok": True})


@app.route("/api/credentials/<int:cred_id>/reveal", methods=["POST"])
@login_required
def api_reveal_credential(cred_id):
    data = request.get_json(force=True) or {}
    master_password = data.get("master_password") or ""

    conn = get_db()
    try:
        row = conn.execute(
            "SELECT password_ciphertext, password_nonce FROM credentials WHERE id = ? AND user_id = ?",
            (cred_id, current_user.id),
        ).fetchone()
        if not row:
            return jsonify({"error": "Not found."}), 404

        try:
            vault_key = get_user_vault_key(current_user.id, master_password)
        except ValueError as e:
            return jsonify({"error": str(e)}), 401

        aesgcm = AESGCM(vault_key)
        plaintext = aesgcm.decrypt(bytes(row["password_nonce"]), bytes(row["password_ciphertext"]), None)
        return jsonify({"password": plaintext.decode("utf-8")})
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    migrate_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
