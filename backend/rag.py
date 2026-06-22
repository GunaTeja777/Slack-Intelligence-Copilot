import os
import json
import logging
import re
import time
import numpy as np  
from typing import Dict, Any, List, Optional, Tuple
# pyrefly: ignore [missing-import]
from google import genai
from google.genai import types
from openai import OpenAI
from config import settings
from db import get_db_connection

logger = logging.getLogger("rag")

class LocalKnowledgeLayer:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or settings.DB_PATH
        self._init_db()

    def _get_connection(self):
        return get_db_connection()

    def _init_db(self):
        """Initialize the SQLite database schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Channels table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS channels (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    topic TEXT,
                    purpose TEXT,
                    num_members INTEGER DEFAULT 0
                )
            """)
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    real_name TEXT,
                    display_name TEXT,
                    avatar TEXT,
                    email TEXT
                )
            """)
            
            # Messages table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    ts TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    user_id TEXT,
                    text TEXT NOT NULL,
                    thread_ts TEXT,
                    reply_count INTEGER DEFAULT 0,
                    json_data TEXT,
                    FOREIGN KEY (channel_id) REFERENCES channels(id)
                )
            """)
            
            # Embeddings table (stores 1D float32 array as BLOB)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS message_embeddings (
                    ts TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    embedding BLOB NOT NULL,
                    FOREIGN KEY (ts) REFERENCES messages(ts)
                )
            """)
            
            # Audit Logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    action TEXT NOT NULL,
                    details TEXT NOT NULL
                )
            """)
            
            # Settings table (for persistent backend settings)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS api_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            
            conn.commit()
            logger.info("Database initialized successfully.")

    def log_audit(self, action: str, details: str):
        """Write an entry to the secure audit logs."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO audit_logs (action, details) VALUES (?, ?)",
                    (action, details)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")

    # Settings accessors
    def get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                res = cursor.execute("SELECT value FROM api_settings WHERE key = ?", (key,)).fetchone()
                return res["value"] if res else default
        except Exception:
            return default

    def set_setting(self, key: str, value: str):
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO api_settings (key, value) VALUES (?, ?)",
                    (key, value)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to set setting {key}: {e}")

    # Data Sync and Storage API
    def save_channels(self, channels: List[Dict[str, Any]]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for ch in channels:
                cursor.execute("""
                    INSERT OR REPLACE INTO channels (id, name, topic, purpose, num_members)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    ch["id"], 
                    ch["name"], 
                    ch.get("topic", ""), 
                    ch.get("purpose", ""), 
                    ch.get("num_members", 0)
                ))
            conn.commit()
        self.log_audit("SYNC_CHANNELS", f"Synced {len(channels)} channels.")

    def save_users(self, users: List[Dict[str, Any]]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for u in users:
                cursor.execute("""
                    INSERT OR REPLACE INTO users (id, name, real_name, display_name, avatar, email)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    u["id"],
                    u["name"],
                    u.get("real_name", ""),
                    u.get("profile", {}).get("display_name", ""),
                    u.get("profile", {}).get("image_72", ""),
                    u.get("profile", {}).get("email", "")
                ))
            conn.commit()
        self.log_audit("SYNC_USERS", f"Synced {len(users)} users.")

    def save_messages(self, channel_id: str, messages: List[Dict[str, Any]]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for msg in messages:
                cursor.execute("""
                    INSERT OR REPLACE INTO messages (ts, channel_id, user_id, text, thread_ts, reply_count, json_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    msg["ts"],
                    channel_id,
                    msg.get("user", ""),
                    msg.get("text", ""),
                    msg.get("thread_ts"),
                    msg.get("reply_count", 0),
                    json.dumps(msg)
                ))
            conn.commit()
        self.log_audit("SYNC_MESSAGES", f"Synced {len(messages)} messages for channel {channel_id}.")

    def get_cached_channels(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM channels").fetchall()
            return [dict(r) for r in rows]

    def get_cached_users(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT * FROM users").fetchall()
            return [dict(r) for r in rows]

    def get_cached_messages(self, channel_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if channel_id:
                rows = cursor.execute(
                    "SELECT m.*, u.real_name, u.display_name, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id WHERE m.channel_id = ? ORDER BY m.ts DESC LIMIT ?",
                    (channel_id, limit)
                ).fetchall()
            else:
                rows = cursor.execute(
                    "SELECT m.*, u.real_name, u.display_name, u.avatar FROM messages m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.ts DESC LIMIT ?",
                    (limit,)
                ).fetchall()
            return [dict(r) for r in rows]

    # Embeddings and Semantic Search
    def get_embedding(self, text: str, provider: str, api_key: str) -> Optional[List[float]]:
        """Compute message embeddings via selected provider (Gemini or OpenAI)."""
        if not text or not text.strip():
            return None
            
        try:
            if provider == "gemini":
                client = genai.Client(api_key=api_key)
                result = client.models.embed_content(
                    model="gemini-embedding-2",
                    contents=text
                )
                if result.embeddings:
                    return result.embeddings[0].values
                return None
            elif provider == "openai":
                client = OpenAI(api_key=api_key)
                response = client.embeddings.create(
                    input=[text],
                    model="text-embedding-3-small"
                )
                return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error generating embedding via {provider}: {e}")
        return None

    def get_embeddings_batch(self, texts: List[str], provider: str, api_key: str) -> List[Optional[List[float]]]:
        """Compute message embeddings in batch via selected provider (Gemini or OpenAI) with 429 rate limit retries."""
        if not texts:
            return []
            
        retries = 3
        delay = 2
        for attempt in range(retries):
            try:
                if provider == "gemini":
                    client = genai.Client(api_key=api_key)
                    
                    # Format texts as a list of types.Content objects
                    contents = [
                        types.Content(parts=[types.Part.from_text(text=t if t.strip() else "[empty]")])
                        for t in texts
                    ]
                    
                    result = client.models.embed_content(
                        model="gemini-embedding-2",
                        contents=contents
                    )
                    
                    embeddings_list = []
                    if result.embeddings:
                        for emb in result.embeddings:
                            embeddings_list.append(emb.values)
                    # Ensure the length matches the input texts
                    if len(embeddings_list) == len(texts):
                        return embeddings_list
                    else:
                        logger.warning("Batch embedding length mismatch, falling back to sequential.")
                        return [self.get_embedding(t, provider, api_key) for t in texts]
                        
                elif provider == "openai":
                    client = OpenAI(api_key=api_key)
                    # Handle empty strings by replacing them with space or placeholder
                    cleaned_texts = [t if t.strip() else " " for t in texts]
                    response = client.embeddings.create(
                        input=cleaned_texts,
                        model="text-embedding-3-small"
                    )
                    embeddings_list = [item.embedding for item in response.data]
                    if len(embeddings_list) == len(texts):
                        return embeddings_list
                    else:
                        logger.warning("Batch embedding length mismatch for OpenAI, falling back to sequential.")
                        return [self.get_embedding(t, provider, api_key) for t in texts]
            except Exception as e:
                is_rate_limit = any(term in str(e).lower() for term in ["429", "quota", "limit", "exhausted", "resource_exhausted"])
                # Detect daily quota limit (which won't recover with brief sleeping)
                is_daily_limit = any(term in str(e).lower() for term in ["perday", "daily"]) or ("limit: 0" in str(e).lower() and "requests" in str(e).lower())
                
                if is_rate_limit:
                    if is_daily_limit:
                        logger.error(f"Daily quota limit hit in get_embeddings_batch. Failing fast: {e}")
                        # Return empty lists immediately so indexing doesn't hang
                        return [None] * len(texts)
                        
                    if attempt < retries - 1:
                        wait_time = delay
                        # Try to extract delay from error message (e.g., "retry in 30.05s" or similar)
                        match = re.search(r"(?:retry in|retrydelay|after)\s*\'?\"?([\d\.]+)", str(e), re.IGNORECASE)
                        if match:
                            wait_time = float(match.group(1)) + 1
                        logger.warning(f"Rate limit hit during get_embeddings_batch. Waiting {wait_time}s before retrying (Attempt {attempt+1}/{retries})... Error: {e}")
                        time.sleep(wait_time)
                        delay *= 2
                        continue
                
                # If we exhausted retries, log error and fallback to sequential
                logger.error(f"Error generating batch embeddings via {provider} after retries: {e}")
                try:
                    return [self.get_embedding(t, provider, api_key) for t in texts]
                except Exception:
                    return [None] * len(texts)

    def index_messages(self, provider: str, api_key: str) -> int:
        """Find unindexed messages and compute their embeddings in batches."""
        if not api_key:
            logger.warning("No API key provided, skipping indexing.")
            return 0
            
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Find messages that don't have embeddings yet
            unindexed = cursor.execute("""
                SELECT ts, channel_id, text FROM messages 
                WHERE ts NOT IN (SELECT ts FROM message_embeddings)
            """).fetchall()
            
            if not unindexed:
                return 0
                
            # Filter out empty/whitespace texts to avoid API issues and save queries
            valid_rows = []
            for r in unindexed:
                text = r["text"]
                if text and text.strip():
                    valid_rows.append(r)
                else:
                    # Mark empty/whitespace messages as indexed with a zero vector
                    dim = 3072 if provider == "gemini" else 1536
                    dummy_emb = np.zeros(dim, dtype=np.float32).tobytes()
                    cursor.execute("""
                        INSERT OR REPLACE INTO message_embeddings (ts, channel_id, embedding)
                        VALUES (?, ?, ?)
                    """, (r["ts"], r["channel_id"], dummy_emb))
            
            if not valid_rows:
                conn.commit()
                return 0
                
            indexed_count = 0
            batch_size = 100
            
            for i in range(0, len(valid_rows), batch_size):
                batch = valid_rows[i:i+batch_size]
                batch_texts = [r["text"] for r in batch]
                
                embeddings = self.get_embeddings_batch(batch_texts, provider, api_key)
                
                for row, emb in zip(batch, embeddings):
                    if emb:
                        emb_blob = np.array(emb, dtype=np.float32).tobytes()
                        cursor.execute("""
                            INSERT OR REPLACE INTO message_embeddings (ts, channel_id, embedding)
                            VALUES (?, ?, ?)
                        """, (row["ts"], row["channel_id"], emb_blob))
                        indexed_count += 1
                        
            conn.commit()
            if indexed_count > 0:
                self.log_audit("INDEX_EMBEDDINGS", f"Computed embeddings for {indexed_count} messages in batches.")
            return indexed_count

    def search_semantic(
        self, 
        query: str, 
        provider: str, 
        api_key: str, 
        channel_id: Optional[str] = None, 
        user_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Perform semantic search using vector embeddings."""
        query_emb = self.get_embedding(query, provider, api_key)
        if not query_emb:
            logger.warning("Could not generate query embedding, falling back to keyword search.")
            return self.search_keyword(query, channel_id, user_id, limit)
            
        query_vector = np.array(query_emb, dtype=np.float32)
        
        # Load all candidate embeddings from DB
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            sql = """
                SELECT me.ts, me.embedding, m.text, m.channel_id, m.user_id, c.name as channel_name, u.real_name as user_name
                FROM message_embeddings me
                JOIN messages m ON me.ts = m.ts
                JOIN channels c ON m.channel_id = c.id
                LEFT JOIN users u ON m.user_id = u.id
                WHERE 1=1
            """
            params = []
            if channel_id:
                sql += " AND m.channel_id = ?"
                params.append(channel_id)
            if user_id:
                sql += " AND m.user_id = ?"
                params.append(user_id)
                
            rows = cursor.execute(sql, params).fetchall()
            
            results = []
            for row in rows:
                db_emb_bytes = row["embedding"]
                db_vector = np.frombuffer(db_emb_bytes, dtype=np.float32)
                
                # Check dimensions match
                if len(db_vector) != len(query_vector):
                    continue
                    
                # Cosine similarity
                dot_prod = np.dot(query_vector, db_vector)
                norm_q = np.linalg.norm(query_vector)
                norm_db = np.linalg.norm(db_vector)
                if norm_q > 0 and norm_db > 0:
                    similarity = float(dot_prod / (norm_q * norm_db))
                else:
                    similarity = 0.0
                    
                results.append({
                    "ts": row["ts"],
                    "text": row["text"],
                    "channel_id": row["channel_id"],
                    "channel_name": row["channel_name"],
                    "user_id": row["user_id"],
                    "user_name": row["user_name"] or "Unknown User",
                    "score": similarity
                })
                
            # Sort by similarity score descending
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:limit]

    def search_keyword(
        self, 
        query: str, 
        channel_id: Optional[str] = None, 
        user_id: Optional[str] = None, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Perform standard FTS/keyword search in SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            sql = """
                SELECT m.ts, m.text, m.channel_id, m.user_id, c.name as channel_name, u.real_name as user_name
                FROM messages m
                JOIN channels c ON m.channel_id = c.id
                LEFT JOIN users u ON m.user_id = u.id
                WHERE m.text LIKE ?
            """
            params = [f"%{query}%"]
            
            if channel_id:
                sql += " AND m.channel_id = ?"
                params.append(channel_id)
            if user_id:
                sql += " AND m.user_id = ?"
                params.append(user_id)
                
            sql += " ORDER BY m.ts DESC LIMIT ?"
            params.append(limit)
            
            rows = cursor.execute(sql, params).fetchall()
            return [{
                "ts": r["ts"],
                "text": r["text"],
                "channel_id": r["channel_id"],
                "channel_name": r["channel_name"],
                "user_id": r["user_id"],
                "user_name": r["user_name"] or "Unknown User",
                "score": 1.0 # default score for simple keyword match
            } for r in rows]

# Singleton instance
rag_layer = LocalKnowledgeLayer()
