from flask import Flask, render_template, request, url_for, flash
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
@app.route("/")
def home():
    if current_user.is_authenticated:
        return redirect(url_for("vault"))
    return redirect(url_for("login"))

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

@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("vault"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        master_password = request.form.get("master_password") or ""
        confirm_password = request.form.get("confirm_password") or ""

        if not username:
            flash("Username is required.", "error")
            return redirect(url_for("register"))

        if master_password != confirm_password:
            flash("Passwords do not match.", "error")
            return redirect(url_for("register"))

        if not is_strong_password(master_password):
            flash("Password must be 12+ chars and include upper/lower/digit/symbol.", "error")
            return redirect(url_for("register"))

        password_hash = bcrypt.generate_password_hash(master_password).decode("utf-8")

        kdf_salt = os.urandom(16)
        kek = derive_kek(master_password, kdf_salt)

        vault_key = generate_vault_key()
        encrypted_vault_key = encrypt_with_aesgcm(kek, vault_key)

        conn = get_db()
        try:
            try:
                conn.execute(
                    "INSERT INTO users (username, password_hash, kdf_salt, encrypted_vault_key) VALUES (?, ?, ?, ?)",
                    (username, password_hash, kdf_salt, encrypted_vault_key),
                )
                conn.commit()
            except sqlite3.IntegrityError:
                flash("That username is already taken.", "error")
                return redirect(url_for("register"))
        finally:
            conn.close()

        flash("Account created. Please log in.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("vault"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        master_password = request.form.get("master_password") or ""

        conn = get_db()
        try:
            row = conn.execute(
                "SELECT id, username, password_hash FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        finally:
            conn.close()

        if not row:
            flash("Invalid username or password.", "error")
            return redirect(url_for("login"))

        if not bcrypt.check_password_hash(row["password_hash"], master_password):
            flash("Invalid username or password.", "error")
            return redirect(url_for("login"))

        user = User(row["id"], row["username"])
        login_user(user)
        flash("Logged in successfully.", "success")
        return redirect(url_for("vault"))

    return render_template("login.html")

@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))

@app.route("/vault")
@login_required
def vault():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, service, login, created_at, updated_at FROM credentials WHERE user_id = ? ORDER BY id DESC",
            (current_user.id,),
        ).fetchall()
        creds = [dict(r) for r in rows]
    finally:
        conn.close()

    return render_template("vault.html", username=current_user.username, creds=creds)

@app.route("/credentials/new", methods=["GET", "POST"])
@login_required
def new_credential():
    if request.method == "POST":
        service = (request.form.get("service") or "").strip()
        login_ = (request.form.get("login") or "").strip()
        password = request.form.get("password") or ""
        master_password = request.form.get("master_password") or ""

        if not service or not login_ or not password:
            flash("Service, login, and password are required.", "error")
            return redirect(url_for("new_credential"))

        try:
            vault_key = get_user_vault_key(current_user.id, master_password)
        except ValueError:
            flash("Master password is incorrect.", "error")
            return redirect(url_for("new_credential"))

        aesgcm = AESGCM(vault_key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, password.encode("utf-8"), None)

        conn = get_db()
        try:
            conn.execute(
                """
                INSERT INTO credentials (user_id, service, login, password_ciphertext, password_nonce)
                VALUES (?, ?, ?, ?, ?)
                """,
                (current_user.id, service, login_, ciphertext, nonce),
            )
            conn.commit()
        finally:
            conn.close()

        flash("Credential added.", "success")
        return redirect(url_for("vault"))

    return render_template("credential_new.html")

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
