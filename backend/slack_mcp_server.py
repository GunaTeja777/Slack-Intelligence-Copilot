import os
import sys
import json
import logging
from typing import Optional, List, Dict, Any
from mcp.server.fastmcp import FastMCP
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)] # Log to stderr so stdout remains clean for JSON-RPC
)
logger = logging.getLogger("slack_mcp_server")

# Load token
slack_token = os.environ.get("SLACK_BOT_TOKEN")
if not slack_token:
    from dotenv import load_dotenv
    load_dotenv()
    slack_token = os.environ.get("SLACK_BOT_TOKEN")

# Initialize Slack Client
slack_client = WebClient(token=slack_token) if slack_token else None

mcp = FastMCP("Slack")

def get_client() -> WebClient:
    global slack_client
    if not slack_client:
        token = os.environ.get("SLACK_BOT_TOKEN")
        if not token:
            from dotenv import load_dotenv
            load_dotenv()
            token = os.environ.get("SLACK_BOT_TOKEN")
        if not token:
            raise ValueError("SLACK_BOT_TOKEN environment variable not set. Please configure it in your settings.")
        slack_client = WebClient(token=token)
    return slack_client

@mcp.tool()
def slack_get_channels(limit: int = 100) -> str:
    """Retrieve the list of public channels in the Slack workspace.
    
    Args:
        limit: Maximum number of channels to return (default 100).
    """
    try:
        client = get_client()
        response = client.conversations_list(types="public_channel", limit=limit)
        channels = []
        for ch in response.get("channels", []):
            channels.append({
                "id": ch["id"],
                "name": ch["name"],
                "is_channel": ch.get("is_channel", True),
                "num_members": ch.get("num_members", 0),
                "topic": ch.get("topic", {}).get("value", ""),
                "purpose": ch.get("purpose", {}).get("value", "")
            })
        return json.dumps({"ok": True, "channels": channels}, indent=2)
    except Exception as e:
        logger.error(f"Error in slack_get_channels: {e}")
        return json.dumps({"ok": False, "error": str(e)})

@mcp.tool()
def slack_get_users(limit: int = 100) -> str:
    """Retrieve the list of users in the Slack workspace.
    
    Args:
        limit: Maximum number of users to return.
    """
    try:
        client = get_client()
        response = client.users_list(limit=limit)
        users = []
        for member in response.get("members", []):
            if member.get("deleted"):
                continue
            users.append({
                "id": member["id"],
                "name": member["name"],
                "real_name": member.get("real_name", ""),
                "tz": member.get("tz", ""),
                "is_bot": member.get("is_bot", False),
                "is_admin": member.get("is_admin", False),
                "profile": {
                    "email": member.get("profile", {}).get("email", ""),
                    "image_72": member.get("profile", {}).get("image_72", ""),
                    "status_text": member.get("profile", {}).get("status_text", ""),
                    "display_name": member.get("profile", {}).get("display_name", "")
                }
            })
        return json.dumps({"ok": True, "users": users}, indent=2)
    except Exception as e:
        logger.error(f"Error in slack_get_users: {e}")
        return json.dumps({"ok": False, "error": str(e)})

@mcp.tool()
def slack_get_history(channel_id: str, limit: int = 50, oldest: Optional[str] = None, latest: Optional[str] = None) -> str:
    """Retrieve message history for a specific Slack channel.
    
    Args:
        channel_id: The ID of the channel (e.g. 'C0BC5R8LQ92').
        limit: Number of messages to retrieve (default 50).
        oldest: Start time of messages to retrieve (epoch timestamp).
        latest: End time of messages to retrieve (epoch timestamp).
    """
    try:
        client = get_client()
        params = {
            "channel": channel_id,
            "limit": limit
        }
        if oldest:
            params["oldest"] = oldest
        if latest:
            params["latest"] = latest
            
        try:
            response = client.conversations_history(**params)
        except SlackApiError as e:
            if e.response.get("error") == "not_in_channel":
                logger.info(f"Bot not in channel {channel_id}, attempting to join before reading history...")
                try:
                    client.conversations_join(channel=channel_id)
                    response = client.conversations_history(**params)
                except Exception as join_err:
                    logger.error(f"Failed to join channel {channel_id}: {join_err}")
                    bot_name = "@just_for_fun"
                    try:
                        auth = client.auth_test()
                        bot_name = f"@{auth.get('user', 'just_for_fun')}"
                    except Exception:
                        pass
                    return json.dumps({
                        "ok": False,
                        "error": f"The bot {bot_name} is not in this channel. To read history, please invite the bot by typing '/invite {bot_name}' in the Slack channel."
                    })
            else:
                raise e
                
        messages = []
        for msg in response.get("messages", []):
            messages.append({
                "ts": msg["ts"],
                "user": msg.get("user", ""),
                "text": msg.get("text", ""),
                "thread_ts": msg.get("thread_ts"),
                "reply_count": msg.get("reply_count", 0),
                "reactions": [
                    {"name": r["name"], "count": r["count"], "users": r.get("users", [])}
                    for r in msg.get("reactions", [])
                ] if "reactions" in msg else []
            })
        return json.dumps({"ok": True, "channel_id": channel_id, "messages": messages}, indent=2)
    except Exception as e:
        logger.error(f"Error in slack_get_history: {e}")
        return json.dumps({"ok": False, "error": str(e)})

@mcp.tool()
def slack_get_thread(channel_id: str, thread_ts: str, limit: int = 50) -> str:
    """Retrieve all replies in a specific Slack thread.
    
    Args:
        channel_id: The ID of the channel containing the thread.
        thread_ts: The timestamp of the parent message (e.g. '1718873099.123456').
        limit: Maximum number of replies to retrieve.
    """
    try:
        client = get_client()
        try:
            response = client.conversations_replies(channel=channel_id, ts=thread_ts, limit=limit)
        except SlackApiError as e:
            if e.response.get("error") == "not_in_channel":
                logger.info(f"Bot not in channel {channel_id}, attempting to join before reading thread...")
                try:
                    client.conversations_join(channel=channel_id)
                    response = client.conversations_replies(channel=channel_id, ts=thread_ts, limit=limit)
                except Exception as join_err:
                    logger.error(f"Failed to join channel {channel_id}: {join_err}")
                    bot_name = "@just_for_fun"
                    try:
                        auth = client.auth_test()
                        bot_name = f"@{auth.get('user', 'just_for_fun')}"
                    except Exception:
                        pass
                    return json.dumps({
                        "ok": False,
                        "error": f"The bot {bot_name} is not in this channel. To read thread replies, please invite the bot by typing '/invite {bot_name}' in the Slack channel."
                    })
            else:
                raise e
                
        messages = []
        for msg in response.get("messages", []):
            messages.append({
                "ts": msg["ts"],
                "user": msg.get("user", ""),
                "text": msg.get("text", ""),
                "thread_ts": msg.get("thread_ts")
            })
        return json.dumps({"ok": True, "channel_id": channel_id, "thread_ts": thread_ts, "messages": messages}, indent=2)
    except Exception as e:
        logger.error(f"Error in slack_get_thread: {e}")
        return json.dumps({"ok": False, "error": str(e)})

@mcp.tool()
def slack_post_message(channel_id: str, text: str, thread_ts: Optional[str] = None) -> str:
    """Post a message or a reply to a Slack channel.
    
    Args:
        channel_id: The ID of the channel to post to.
        text: The text content of the message.
        thread_ts: The parent message timestamp (if replying to a thread).
    """
    try:
        client = get_client()
        params = {
            "channel": channel_id,
            "text": text
        }
        if thread_ts:
            params["thread_ts"] = thread_ts
            
        try:
            response = client.chat_postMessage(**params)
        except SlackApiError as e:
            if e.response.get("error") == "not_in_channel":
                logger.info(f"Bot not in channel {channel_id}, attempting to join before posting message...")
                try:
                    client.conversations_join(channel=channel_id)
                    response = client.chat_postMessage(**params)
                except Exception as join_err:
                    logger.error(f"Failed to join channel {channel_id}: {join_err}")
                    bot_name = "@just_for_fun"
                    try:
                        auth = client.auth_test()
                        bot_name = f"@{auth.get('user', 'just_for_fun')}"
                    except Exception:
                        pass
                    return json.dumps({
                        "ok": False,
                        "error": f"The bot {bot_name} is not in this channel. To post messages, please invite the bot by typing '/invite {bot_name}' in the Slack channel."
                    })
            else:
                raise e
                
        return json.dumps({
            "ok": True,
            "channel": response.get("channel"),
            "ts": response.get("ts"),
            "message": {
                "text": response.get("message", {}).get("text"),
                "user": response.get("message", {}).get("user")
            }
        }, indent=2)
    except Exception as e:
        logger.error(f"Error in slack_post_message: {e}")
        return json.dumps({"ok": False, "error": str(e)})

@mcp.tool()
def slack_search_messages(query: str, count: int = 20) -> str:
    """Search for messages matching a text query in the Slack workspace.
    
    Args:
        query: The search term or filter syntax (e.g. 'project status in:#general').
        count: Number of results to return (default 20).
    """
    try:
        client = get_client()
        response = client.search_messages(query=query, count=count)
        matches = []
        for match in response.get("messages", {}).get("matches", []):
            matches.append({
                "iid": match.get("iid"),
                "channel": {
                    "id": match.get("channel", {}).get("id"),
                    "name": match.get("channel", {}).get("name")
                },
                "user": match.get("user"),
                "username": match.get("username"),
                "text": match.get("text"),
                "ts": match.get("ts"),
                "permalink": match.get("permalink")
            })
        return json.dumps({"ok": True, "query": query, "messages": matches}, indent=2)
    except Exception as e:
        logger.error(f"Error in slack_search_messages: {e}")
        return json.dumps({"ok": False, "error": str(e)})

@mcp.tool()
def slack_get_user_profile(user_id: str) -> str:
    """Retrieve detailed profile information for a specific Slack user.
    
    Args:
        user_id: The ID of the user (e.g. 'U0BBYQ88AA1').
    """
    try:
        client = get_client()
        response = client.users_profile_get(user=user_id)
        profile = response.get("profile", {})
        return json.dumps({
            "ok": True,
            "user_id": user_id,
            "profile": {
                "real_name": profile.get("real_name", ""),
                "display_name": profile.get("display_name", ""),
                "avatar_hash": profile.get("avatar_hash", ""),
                "email": profile.get("email", ""),
                "image_72": profile.get("image_72", ""),
                "status_text": profile.get("status_text", ""),
                "status_emoji": profile.get("status_emoji", "")
            }
        }, indent=2)
    except Exception as e:
        logger.error(f"Error in slack_get_user_profile: {e}")
        return json.dumps({"ok": False, "error": str(e)})

if __name__ == "__main__":
    # Start FastMCP server
    mcp.run()
