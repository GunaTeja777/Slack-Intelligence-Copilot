import os
import sqlite3

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "slack_copilot.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT key, value FROM api_settings")
        rows = cursor.fetchall()
        print("Database settings:")
        for row in rows:
            # Mask API key/Slack token
            val = row[1]
            if len(val) > 10:
                val = val[:5] + "..." + val[-5:]
            print(f"  {row[0]}: {val}")
    except Exception as e:
        print(f"Error querying settings: {e}")
    finally:
        conn.close()
else:
    print(f"Database file {db_path} does not exist yet.")
