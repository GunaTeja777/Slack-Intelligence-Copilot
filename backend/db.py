import os
import sys
import sqlite3
import logging
from typing import Any, Dict, List, Optional
from config import settings

logger = logging.getLogger("db")

# Lazy import psycopg2 to avoid hard dependency if not used
psycopg2 = None
psycopg2_extras = None

def _init_postgres():
    global psycopg2, psycopg2_extras
    if psycopg2 is None:
        try:
            import psycopg2 as pg
            import psycopg2.extras as pg_extras
            psycopg2 = pg
            psycopg2_extras = pg_extras
        except ImportError as e:
            logger.error("psycopg2-binary is not installed but DATABASE_URL was specified!")
            raise e

class SafeCursor:
    def __init__(self, raw_cursor, is_postgres: bool):
        self.raw_cursor = raw_cursor
        self.is_postgres = is_postgres

    def execute(self, query: str, params: tuple = ()):
        if self.is_postgres:
            # 1. Translate placeholders ? to %s
            query = query.replace('?', '%s')
            
            # 2. Translate SQLite-specific dialects to PostgreSQL
            query = query.replace('AUTOINCREMENT', '')
            query = query.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
            query = query.replace('BLOB', 'BYTEA')
            query = query.replace('DATETIME', 'TIMESTAMP')
            
            # Translate SQLite-specific INSERT OR REPLACE to PostgreSQL ON CONFLICT
            if 'INSERT OR REPLACE INTO channels' in query:
                query = """
                    INSERT INTO channels (username, id, name, topic, purpose, num_members)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (username, id) DO UPDATE SET
                        name = EXCLUDED.name,
                        topic = EXCLUDED.topic,
                        purpose = EXCLUDED.purpose,
                        num_members = EXCLUDED.num_members
                """
            elif 'INSERT OR REPLACE INTO users' in query:
                query = """
                    INSERT INTO users (username, id, name, real_name, display_name, avatar, email)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (username, id) DO UPDATE SET
                        name = EXCLUDED.name,
                        real_name = EXCLUDED.real_name,
                        display_name = EXCLUDED.display_name,
                        avatar = EXCLUDED.avatar,
                        email = EXCLUDED.email
                """
            elif 'INSERT OR REPLACE INTO messages' in query:
                query = """
                    INSERT INTO messages (username, ts, channel_id, user_id, text, thread_ts, reply_count, json_data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (username, ts) DO UPDATE SET
                        channel_id = EXCLUDED.channel_id,
                        user_id = EXCLUDED.user_id,
                        text = EXCLUDED.text,
                        thread_ts = EXCLUDED.thread_ts,
                        reply_count = EXCLUDED.reply_count,
                        json_data = EXCLUDED.json_data
                """
            elif 'INSERT OR REPLACE INTO message_embeddings' in query:
                query = """
                    INSERT INTO message_embeddings (username, ts, channel_id, embedding)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (username, ts) DO UPDATE SET
                        channel_id = EXCLUDED.channel_id,
                        embedding = EXCLUDED.embedding
                """
            elif 'INSERT OR REPLACE INTO api_settings' in query:
                query = """
                    INSERT INTO api_settings (key, value)
                    VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET
                        value = EXCLUDED.value
                """
            elif 'INSERT OR REPLACE INTO app_users' in query:
                query = """
                    INSERT INTO app_users (username, password_hash, salt)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (username) DO UPDATE SET
                        password_hash = EXCLUDED.password_hash,
                        salt = EXCLUDED.salt
                """
            elif 'INSERT OR REPLACE INTO app_sessions' in query:
                query = """
                    INSERT INTO app_sessions (token, username, expires_at)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (token) DO UPDATE SET
                        username = EXCLUDED.username,
                        expires_at = EXCLUDED.expires_at
                """
            elif 'INSERT OR REPLACE INTO user_settings' in query:
                query = """
                    INSERT INTO user_settings (username, key, value)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (username, key) DO UPDATE SET
                        value = EXCLUDED.value
                """
            
            # Case-insensitive LIKE dialect translation
            # (SQLite LIKE is case-insensitive, PostgreSQL is case-sensitive. Let's make PostgreSQL use ILIKE!)
            query = query.replace('LIKE', 'ILIKE')

        self.raw_cursor.execute(query, params)
        return self

    def fetchone(self):
        row = self.raw_cursor.fetchone()
        if row is None:
            return None
        if self.is_postgres:
            return dict(row)
        return row

    def fetchall(self):
        rows = self.raw_cursor.fetchall()
        if self.is_postgres:
            return [dict(r) for r in rows]
        return rows

    def __getattr__(self, name):
        return getattr(self.raw_cursor, name)

class SafeConnection:
    def __init__(self, raw_conn, is_postgres: bool):
        self.raw_conn = raw_conn
        self.is_postgres = is_postgres

    def cursor(self):
        if self.is_postgres:
            _init_postgres()
            raw_cursor = self.raw_conn.cursor(cursor_factory=psycopg2_extras.RealDictCursor)
        else:
            raw_cursor = self.raw_conn.cursor()
        return SafeCursor(raw_cursor, self.is_postgres)

    def execute(self, query: str, params: tuple = ()):
        cursor = self.cursor()
        cursor.execute(query, params)
        return cursor

    def commit(self):
        self.raw_conn.commit()

    def rollback(self):
        self.raw_conn.rollback()

    def close(self):
        self.raw_conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()

def get_db_connection() -> SafeConnection:
    if settings.DATABASE_URL:
        _init_postgres()
        import urllib.parse
        db_url = settings.DATABASE_URL.strip("'\"\r\n \t")
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
            
        # Extract project ref from environment (variables, JWT tokens, or fallback) to auto-heal pooler usernames
        project_ref = None
        pg_host = os.environ.get("POSTGRES_HOST")
        if pg_host and ".supabase.co" in pg_host:
            project_ref = pg_host.split(".supabase.co")[0]
            if "." in project_ref:
                project_ref = project_ref.split(".")[-1]
        if not project_ref:
            sub_url = os.environ.get("SUPABASE_URL")
            if sub_url and "supabase.co" in sub_url:
                project_ref = sub_url.replace("https://", "").replace("http://", "").split(".supabase.co")[0]
        if not project_ref:
            # Try to decode JWT from keys
            import base64
            import json
            for key_name in ["SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]:
                token = os.environ.get(key_name)
                if token:
                    try:
                        parts = token.split('.')
                        if len(parts) >= 2:
                            payload_b64 = parts[1]
                            # Add base64 padding
                            payload_b64 += '=' * (4 - len(payload_b64) % 4)
                            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode('utf-8'))
                            ref = payload.get("ref")
                            if ref:
                                project_ref = ref
                                break
                    except Exception as e:
                        logger.warning(f"Failed decoding JWT from {key_name}: {e}")
        if not project_ref:
            # Fallback to the known project reference
            project_ref = "tkmhawkynnveqckwllyl"
                
        # Parse, decode, and properly encode the password to prevent authentication errors
        if "://" in db_url:
            scheme, rest = db_url.split("://", 1)
            if "@" in rest:
                userinfo, hostinfo = rest.rsplit("@", 1)
                username = userinfo
                password = None
                if ":" in userinfo:
                    username, password = userinfo.split(":", 1)
                
                postgres_pass = os.environ.get("POSTGRES_PASSWORD") or os.environ.get("DB_PASSWORD")
                if postgres_pass:
                    password = urllib.parse.quote(postgres_pass, safe='')
                elif password:
                    password = urllib.parse.quote(urllib.parse.unquote(password), safe='')
                
                if "pooler.supabase.com" in hostinfo and project_ref:
                    if "." not in username:
                        username = f"{username}.{project_ref}"
                        
                if password:
                    db_url = f"{scheme}://{username}:{password}@{hostinfo}"
                else:
                    db_url = f"{scheme}://{username}@{hostinfo}"

        raw_conn = psycopg2.connect(db_url)
        return SafeConnection(raw_conn, is_postgres=True)
    else:
        raw_conn = sqlite3.connect(settings.DB_PATH)
        raw_conn.row_factory = sqlite3.Row
        return SafeConnection(raw_conn, is_postgres=False)
