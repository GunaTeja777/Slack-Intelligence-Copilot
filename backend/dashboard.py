import json
import logging
from collections import Counter
import re
from typing import Dict, Any, List, Optional
from config import settings
from db import get_db_connection

logger = logging.getLogger("dashboard")

class DashboardManager:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or settings.DB_PATH

    def _get_connection(self):
        return get_db_connection()

    def get_stats(self) -> Dict[str, Any]:
        """Calculate and return dashboard statistics."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # 1. Active Channels (Message counts)
                channel_counts = cursor.execute("""
                    SELECT c.id, c.name, c.num_members, COUNT(m.ts) as msg_count
                    FROM channels c
                    LEFT JOIN messages m ON c.id = m.channel_id
                    GROUP BY c.id, c.name, c.num_members
                    ORDER BY msg_count DESC
                """).fetchall()
                
                active_channels = [
                    {
                        "id": row["id"],
                        "name": row["name"],
                        "message_count": row["msg_count"],
                        "members": row["num_members"]
                    }
                    for row in channel_counts
                ]
                
                # 2. Active Users (Message counts)
                user_counts = cursor.execute("""
                    SELECT u.id, u.real_name, u.display_name, u.avatar, COUNT(m.ts) as msg_count
                    FROM users u
                    JOIN messages m ON u.id = m.user_id
                    GROUP BY u.id, u.real_name, u.display_name, u.avatar
                    ORDER BY msg_count DESC
                    LIMIT 10
                """).fetchall()
                
                active_users = [
                    {
                        "id": row["id"],
                        "name": row["real_name"] or row["display_name"] or "Unknown",
                        "avatar": row["avatar"],
                        "message_count": row["msg_count"]
                    }
                    for row in user_counts
                ]
                
                # 3. Message Volume over time (grouped by day)
                # In Slack, 'ts' is a unix timestamp as string (e.g. '1718873099.123456')
                if settings.DATABASE_URL:
                    volume_query = """
                        SELECT DATE(TO_TIMESTAMP(CAST(ts AS DOUBLE PRECISION))) as day, COUNT(*) as count
                        FROM messages
                        GROUP BY day
                        ORDER BY day ASC
                        LIMIT 30
                    """
                else:
                    volume_query = """
                        SELECT date(datetime(CAST(ts AS REAL), 'unixepoch')) as day, COUNT(*) as count
                        FROM messages
                        GROUP BY day
                        ORDER BY day ASC
                        LIMIT 30
                    """
                volume_rows = cursor.execute(volume_query).fetchall()
                
                message_volume = [
                    {"date": row["day"], "count": row["count"]}
                    for row in volume_rows if row["day"]
                ]
                
                # 4. Open Action Items
                # Search for messages containing actionable words
                action_keywords = ["action item", "todo", "to-do", "need to", "must do", "follow up", "assign"]
                action_pattern = "|".join(action_keywords)
                
                action_rows = cursor.execute(f"""
                    SELECT m.ts, m.text, m.channel_id, c.name as channel_name, m.user_id, u.real_name
                    FROM messages m
                    JOIN channels c ON m.channel_id = c.id
                    LEFT JOIN users u ON m.user_id = u.id
                    WHERE m.text LIKE '%todo%' 
                       OR m.text LIKE '%action item%'
                       OR m.text LIKE '%need to%'
                       OR m.text LIKE '%follow up%'
                    ORDER BY m.ts DESC
                    LIMIT 20
                """).fetchall()
                
                action_items = []
                for row in action_rows:
                    text = row["text"]
                    # Extract the actual action task using regex or substring
                    extracted_task = text
                    for keyword in action_keywords:
                        match = re.search(rf"(?i){keyword}[:\-\s]*(.*)", text)
                        if match:
                            candidate = match.group(1).strip()
                            if len(candidate) > 5 and len(candidate) < 150:
                                extracted_task = candidate
                                break
                                
                    action_items.append({
                        "ts": row["ts"],
                        "channel_id": row["channel_id"],
                        "channel_name": row["channel_name"],
                        "user_id": row["user_id"],
                        "user_name": row["real_name"] or "Unknown User",
                        "text": text,
                        "task": extracted_task[:100] + ("..." if len(extracted_task) > 100 else ""),
                        "status": "pending"
                    })
                
                # 5. Trending Topics / Keywords
                # Collect all message texts
                message_texts = cursor.execute("SELECT text FROM messages").fetchall()
                all_text = " ".join([r["text"] for r in message_texts])
                
                # Basic tokenization
                words = re.findall(r"\b[a-zA-Z]{4,15}\b", all_text.lower())
                
                # Filter stopwords
                stopwords = {
                    "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent",
                    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
                    "cant", "cannot", "could", "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont",
                    "down", "during", "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt", "have",
                    "havent", "having", "he", "hed", "hell", "hes", "her", "here", "heres", "hers", "herself", "him",
                    "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in", "into", "is", "isnt",
                    "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not",
                    "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
                    "over", "own", "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some",
                    "such", "than", "that", "thats", "the", "their", "theirs", "them", "themselves", "then", "there",
                    "theres", "these", "they", "theyd", "theyll", "theyre", "theyve", "this", "those", "through", "to",
                    "too", "under", "until", "up", "very", "was", "wasnt", "we", "wed", "well", "were", "weve", "werent",
                    "what", "whats", "when", "whens", "where", "wheres", "which", "while", "who", "whos", "whom", "why",
                    "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll", "youre", "youve", "your", "yours",
                    "yourself", "yourselves", "slack", "message", "channel", "user", "post", "reply"
                }
                
                filtered_words = [w for w in words if w not in stopwords]
                word_counts = Counter(filtered_words).most_common(10)
                
                trending_topics = [
                    {"topic": word, "frequency": count}
                    for word, count in word_counts
                ]
                
                # 6. Team Sentiment Trends
                # Simple sentiment analyser based on keywords (positive vs negative)
                pos_words = {"good", "great", "excellent", "perfect", "awesome", "thanks", "thank", "agree", "done", "solved", "fixed", "success", "resolved", "love", "nice"}
                neg_words = {"bad", "error", "fail", "failed", "bug", "issue", "blocker", "broken", "risk", "delay", "problem", "wrong", "cannot", "unable", "sorry"}
                
                sentiment_scores = []
                for r in message_texts:
                    txt = r["text"].lower()
                    words_in_txt = set(re.findall(r"\b[a-zA-Z]+\b", txt))
                    pos_count = len(words_in_txt.intersection(pos_words))
                    neg_count = len(words_in_txt.intersection(neg_words))
                    
                    if pos_count > neg_count:
                        sentiment_scores.append(1) # positive
                    elif neg_count > pos_count:
                        sentiment_scores.append(-1) # negative
                    else:
                        sentiment_scores.append(0) # neutral
                
                avg_sentiment = 0.0
                if sentiment_scores:
                    avg_sentiment = float(sum(sentiment_scores) / len(sentiment_scores))
                
                # Scale from -1..1 to 0..100 (50 is neutral, >50 positive, <50 negative)
                sentiment_percentage = int((avg_sentiment + 1) * 50)
                
                # Calculate additional stats expected by the frontend
                total_messages = cursor.execute("SELECT COUNT(*) as cnt FROM messages").fetchone()["cnt"] or 0
                active_users_count = cursor.execute("SELECT COUNT(DISTINCT user_id) as cnt FROM messages").fetchone()["cnt"] or 0
                if active_users_count == 0:
                    active_users_count = cursor.execute("SELECT COUNT(*) as cnt FROM users").fetchone()["cnt"] or 0
                channel_count = cursor.execute("SELECT COUNT(*) as cnt FROM channels").fetchone()["cnt"] or 0
                rag_doc_count = cursor.execute("SELECT COUNT(*) as cnt FROM message_embeddings").fetchone()["cnt"] or 0

                top_users = [
                    {
                        "user_name": u["name"],
                        "message_count": u["message_count"]
                    }
                    for u in active_users
                ]

                return {
                    "ok": True,
                    "active_channels": active_channels,
                    "active_users": active_users_count,
                    "active_users_list": active_users,
                    "message_volume": message_volume,
                    "trending_topics": trending_topics,
                    "sentiment_score": sentiment_percentage,
                    "open_action_items": action_items,
                    
                    # Fields expected by the frontend Dashboard component
                    "total_messages": total_messages,
                    "channel_count": channel_count,
                    "rag_doc_count": rag_doc_count,
                    "top_users": top_users,
                    "message_volume_trend": message_volume
                }
        except Exception as e:
            logger.error(f"Error compiling stats: {e}")
            return {"ok": False, "error": str(e)}

# Singleton manager
dashboard_manager = DashboardManager()
