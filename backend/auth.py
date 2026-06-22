import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
from db import get_db_connection

security = HTTPBearer()

def init_auth_db():
    """Create the authentication tables if they do not exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (username) REFERENCES app_users(username)
            )
        """)
        conn.commit()

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Securely hash a password using PBKDF2 with SHA-256."""
    if not salt:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return pw_hash, salt

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """Verify a password matches its stored hash."""
    pw_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(pw_hash, password_hash)

def create_user(username: str, password: str) -> bool:
    """Register a new user in the database."""
    username = username.strip().lower()
    if not username or not password:
        raise ValueError("Username and password cannot be empty")
        
    pw_hash, salt = hash_password(password)
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO app_users (username, password_hash, salt) VALUES (?, ?, ?)",
                (username, pw_hash, salt)
            )
            conn.commit()
        return True
    except Exception as e:
        if "IntegrityError" in type(e).__name__:
            return False
        raise e

def check_user_exists(username: str) -> bool:
    """Check if a username is already taken."""
    username = username.strip().lower()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        res = cursor.execute("SELECT 1 FROM app_users WHERE username = ?", (username,)).fetchone()
        return res is not None

def create_session(username: str, expires_in_days: int = 7) -> str:
    """Generate a secure session token for a user."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO app_sessions (token, username, expires_at) VALUES (?, ?, ?)",
            (token, username, expires_at.isoformat())
        )
        conn.commit()
    return token

def verify_session(token: str) -> Optional[str]:
    """Verify an active session token and return the username if valid."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        res = cursor.execute(
            "SELECT username, expires_at FROM app_sessions WHERE token = ?",
            (token,)
        )
        row = res.fetchone()
        if not row:
            return None
        
        try:
            expires_at = datetime.fromisoformat(row["expires_at"])
            if expires_at < datetime.utcnow():
                # Session expired, clean up database
                cursor.execute("DELETE FROM app_sessions WHERE token = ?", (token,))
                conn.commit()
                return None
            return row["username"]
        except Exception:
            return None

def delete_session(token: str):
    """Delete an active session token (logout)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM app_sessions WHERE token = ?", (token,))
        conn.commit()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """Dependency to secure FastAPI endpoints with Bearer tokens."""
    token = credentials.credentials
    username = verify_session(token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return username
