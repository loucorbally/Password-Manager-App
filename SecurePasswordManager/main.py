from flask import Flask, render_template, request, url_for, flash
from werkzeug.utils import redirect
import sqlite3
import os

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

        # For now, we store placeholder bytes for kdf_salt/encrypted_vault_key
        # (Next step: replace with real cryptography-based vault key encryption)
        kdf_salt = os.urandom(16)
        encrypted_vault_key = os.urandom(48)

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
    # Placeholder vault page
    return render_template("vault.html", username=current_user.username)

if __name__ == "__main__":
    init_db()
    app.run(debug=True)