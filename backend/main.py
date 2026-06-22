import os
import sys
import json
import logging
import asyncio

# Ensure backend directory is in the sys.path so direct imports work
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from mcp_client import mcp_manager
from rag import rag_layer
from dashboard import dashboard_manager
from agent import agent_runner
from auth import (
    init_auth_db,
    create_user,
    check_user_exists,
    create_session,
    delete_session,
    verify_password,
    get_current_user,
    get_db_connection
)

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up FastAPI application...")
    
    # Initialize Auth DB tables
    init_auth_db()
    
    yield
    
    logger.info("Shutting down FastAPI application...")
    await mcp_manager.disconnect_all()

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class ConnectRequest(BaseModel):
    command: str
    args: List[str]
    slack_token: Optional[str] = None

class MessageHistoryItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    history: List[MessageHistoryItem]
    provider: Optional[str] = None
    api_key: Optional[str] = None

class ConfirmRequest(BaseModel):
    tool: str
    arguments: Dict[str, Any]

class SearchRequest(BaseModel):
    query: str
    channel_id: Optional[str] = None
    user_id: Optional[str] = None
    semantic: bool = False
    limit: Optional[int] = 10

class SettingsUpdateRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    slack_token: Optional[str] = None
    server_command: Optional[str] = None
    server_args: Optional[str] = None

class TestSettingsRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    slack_token: Optional[str] = None

class SignupRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

# Background Task for Syncing
async def run_sync_task(username: str):
    rag_layer.log_audit(username, "SYNC_START", "Initiating background sync from Slack API...")
    manager = mcp_manager.get(username)
    if not manager.connected:
        logger.error(f"Sync failed: Not connected to MCP server for user {username}.")
        rag_layer.log_audit(username, "SYNC_ERROR", "Sync failed: Not connected to MCP server.")
        return
        
    try:
        # 1. Fetch and Sync Channels
        channels_res = await manager.call_tool("slack_get_channels", {})
        if channels_res.get("ok"):
            channels = channels_res.get("channels", [])
            rag_layer.save_channels(username, channels)
            
            # 2. Fetch and Sync Messages for active channels
            for ch in channels[:5]:  # Sync top 5 channels to avoid token rate limits during demo
                history_res = await manager.call_tool("slack_get_history", {"channel_id": ch["id"], "limit": 50})
                if history_res.get("ok"):
                    messages = history_res.get("messages", [])
                    rag_layer.save_messages(username, ch["id"], messages)
                    
                    # If messages have threads, sync replies
                    for msg in messages:
                        if msg.get("reply_count", 0) > 0 and msg.get("thread_ts"):
                            thread_res = await manager.call_tool(
                                "slack_get_thread", 
                                {"channel_id": ch["id"], "thread_ts": msg["thread_ts"], "limit": 20}
                            )
                            if thread_res.get("ok"):
                                thread_messages = thread_res.get("messages", [])
                                # Save thread replies as well (same table, channel_id matches)
                                rag_layer.save_messages(username, ch["id"], thread_messages)
        
        # 3. Fetch and Sync Users
        users_res = await manager.call_tool("slack_get_users", {})
        if users_res.get("ok"):
            users = users_res.get("users", [])
            rag_layer.save_users(username, users)

        # 4. Trigger Vector Indexing if API keys are set
        provider = rag_layer.get_user_setting(username, "provider", settings.LLM_PROVIDER)
        api_key = rag_layer.get_user_setting(username, "api_key")
        if api_key:
            indexed = rag_layer.index_messages(username, provider, api_key)
            logger.info(f"Automatically indexed {indexed} messages for user {username}.")
            
        rag_layer.log_audit(username, "SYNC_COMPLETE", "Successfully completed full workspace sync.")
    except Exception as e:
        logger.error(f"Error in sync task for user {username}: {e}")
        rag_layer.log_audit(username, "SYNC_ERROR", f"Error during sync: {e}")

# API Endpoints Helper
def mask_token(token: Optional[str]) -> str:
    if not token:
        return ""
    if len(token) <= 8:
        return "••••••••"
    return f"{token[:6]}••••{token[-4:]}"

# --- Authentication Routes ---

@app.post("/api/v1/auth/signup")
async def signup(req: SignupRequest):
    username = req.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    if check_user_exists(username):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    success = create_user(username, req.password)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create user")
        
    token = create_session(username)
    return {"token": token, "username": username}

@app.post("/api/v1/auth/login")
async def login(req: LoginRequest):
    username = req.username.strip().lower()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT password_hash, salt FROM app_users WHERE username = ?",
            (username,)
        ).fetchone()
        
    if not row or not verify_password(req.password, row["password_hash"], row["salt"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    token = create_session(username)
    return {"token": token, "username": username}

@app.post("/api/v1/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        delete_session(token)
    return {"status": "success", "message": "Logged out successfully"}

@app.get("/api/v1/auth/me")
async def get_me(current_user: str = Depends(get_current_user)):
    return {"username": current_user}

# --- Secure Core API Routes ---

@app.get("/api/v1/status")
async def get_status(current_user: str = Depends(get_current_user)):
    """Return connection status, logs, and list of discovered tools for current user."""
    slack_token = rag_layer.get_user_setting(current_user, "slack_token")
    provider = rag_layer.get_user_setting(current_user, "provider", settings.LLM_PROVIDER)
    api_key = rag_layer.get_user_setting(current_user, "api_key")
    
    manager = mcp_manager.get(current_user)
    if not manager.connected and slack_token:
        logger.info(f"Auto-connecting MCP server for user {current_user}...")
        cmd = settings.MCP_SERVER_COMMAND
        server_args = settings.MCP_SERVER_ARGS
        if isinstance(server_args, str):
            import shlex
            args = shlex.split(server_args, posix=False) if os.name == 'nt' else shlex.split(server_args)
            args = [a.strip('"\'') for a in args]
        else:
            args = server_args
        env = {"SLACK_BOT_TOKEN": slack_token}
        await manager.connect(command=cmd, args=args, env_override=env)
        
    return {
        "connected": manager.connected,
        "tools": manager.tools,
        "logs": manager.logs,
        "config": {
            "server_command": manager.server_command,
            "server_args": manager.server_args,
            "provider": provider,
            "has_api_key": bool(api_key),
            "slack_token_configured": bool(slack_token),
            "masked_api_key": mask_token(api_key),
            "masked_slack_token": mask_token(slack_token)
        }
    }

@app.post("/api/v1/connect")
async def connect_mcp(req: ConnectRequest, current_user: str = Depends(get_current_user)):
    """Manually connect or reconnect to an MCP server."""
    slack_token = req.slack_token or rag_layer.get_user_setting(current_user, "slack_token")
    if slack_token:
        rag_layer.set_user_setting(current_user, "slack_token", slack_token)
        
    env = {}
    if slack_token:
        env["SLACK_BOT_TOKEN"] = slack_token
        
    manager = mcp_manager.get(current_user)
    success = await manager.connect(command=req.command, args=req.args, env_override=env)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to connect to MCP server. Check logs.")
        
    return {"status": "connected", "tools": manager.tools}

@app.post("/api/v1/chat")
async def chat(req: ChatRequest, current_user: str = Depends(get_current_user)):
    """Interact with the Agent, streaming thoughts, tool calls, and final answers."""
    provider = req.provider or rag_layer.get_user_setting(current_user, "provider") or settings.LLM_PROVIDER
    api_key = req.api_key or rag_layer.get_user_setting(current_user, "api_key")
    
    if not api_key:
        if provider == "gemini":
            api_key = settings.GEMINI_API_KEY
        elif provider == "openai":
            api_key = settings.OPENAI_API_KEY

    if provider != "local" and not api_key:
        raise HTTPException(
            status_code=400, 
            detail=f"API Key for provider '{provider}' is missing. Please save it in the settings panel first."
        )

    history_dicts = [{"role": h.role, "content": h.content} for h in req.history]

    async def event_generator():
        try:
            async for chunk in agent_runner.run_query(req.query, history_dicts, provider, api_key, current_user):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"Error in chat event stream: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/v1/confirm")
async def confirm_action(req: ConfirmRequest, current_user: str = Depends(get_current_user)):
    """Execute a pending write action after user confirmation."""
    tool_name = req.tool
    arguments = req.arguments
    
    details = f"User confirmed write action: {tool_name} with arguments: {json.dumps(arguments)}"
    rag_layer.log_audit(current_user, "WRITE_CONFIRMED", details)
    
    res = await mcp_manager.get(current_user).call_tool(tool_name, arguments)
    
    rag_layer.log_audit(current_user, "WRITE_EXECUTED", f"Write action result: {json.dumps(res)}")
    return res

@app.post("/api/v1/sync")
async def trigger_sync(background_tasks: BackgroundTasks, current_user: str = Depends(get_current_user)):
    """Trigger background sync of Slack workspace."""
    manager = mcp_manager.get(current_user)
    if not manager.connected:
        raise HTTPException(status_code=400, detail="Cannot sync: not connected to Slack MCP server.")
        
    background_tasks.add_task(run_sync_task, current_user)
    return {"status": "sync_started", "message": "Slack workspace sync started in the background."}

@app.post("/api/v1/search")
async def search_workspace(req: SearchRequest, current_user: str = Depends(get_current_user)):
    """Search cached messages using keyword or semantic vector search."""
    provider = rag_layer.get_user_setting(current_user, "provider") or settings.LLM_PROVIDER
    api_key = rag_layer.get_user_setting(current_user, "api_key")
    if not api_key:
        if provider == "gemini":
            api_key = settings.GEMINI_API_KEY
        elif provider == "openai":
            api_key = settings.OPENAI_API_KEY
    
    if req.semantic:
        if not api_key and provider != "local":
            raise HTTPException(
                status_code=400, 
                detail="API Key is required to run semantic search. Please configure it first."
            )
        results = rag_layer.search_semantic(
            username=current_user,
            query=req.query,
            provider=provider,
            api_key=api_key,
            channel_id=req.channel_id,
            user_id=req.user_id,
            limit=req.limit
        )
    else:
        results = rag_layer.search_keyword(
            username=current_user,
            query=req.query,
            channel_id=req.channel_id,
            user_id=req.user_id,
            limit=req.limit
        )
        
    return {"query": req.query, "semantic": req.semantic, "results": results}

@app.get("/api/v1/dashboard")
async def get_dashboard(current_user: str = Depends(get_current_user)):
    """Return dashboard analytics charts and metrics."""
    stats = dashboard_manager.get_stats(current_user)
    return stats

@app.get("/api/v1/channels")
async def get_channels(current_user: str = Depends(get_current_user)):
    """Return cached channels."""
    return {"channels": rag_layer.get_cached_channels(current_user)}

@app.get("/api/v1/users")
async def get_users(current_user: str = Depends(get_current_user)):
    """Return cached users."""
    return {"users": rag_layer.get_cached_users(current_user)}

@app.get("/api/v1/messages")
async def get_messages(channel_id: Optional[str] = None, limit: Optional[int] = 100, current_user: str = Depends(get_current_user)):
    """Return cached messages."""
    return {"messages": rag_layer.get_cached_messages(current_user, channel_id, limit)}

@app.get("/api/v1/audit-logs")
async def get_audit_logs(current_user: str = Depends(get_current_user)):
    """Return secure write actions audit trail."""
    with rag_layer._get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM audit_logs WHERE username = ? ORDER BY id DESC LIMIT 100", (current_user,)).fetchall()
        return {"logs": [dict(r) for r in rows]}

@app.post("/api/v1/settings")
async def update_settings(req: SettingsUpdateRequest, current_user: str = Depends(get_current_user)):
    """Save API keys, provider choice, and custom MCP details."""
    reconnect_needed = False
    
    rag_layer.set_user_setting(current_user, "provider", req.provider)
    
    if req.api_key:
        rag_layer.set_user_setting(current_user, "api_key", req.api_key)
        
    if req.slack_token:
        current_slack_token = rag_layer.get_user_setting(current_user, "slack_token")
        if req.slack_token != current_slack_token:
            rag_layer.set_user_setting(current_user, "slack_token", req.slack_token)
            reconnect_needed = True
        
    if req.server_command:
        current_cmd = rag_layer.get_user_setting(current_user, "server_command", settings.MCP_SERVER_COMMAND)
        if req.server_command != current_cmd:
            rag_layer.set_user_setting(current_user, "server_command", req.server_command)
            reconnect_needed = True
        
    if req.server_args:
        current_args = rag_layer.get_user_setting(current_user, "server_args", str(settings.MCP_SERVER_ARGS))
        if req.server_args != current_args:
            rag_layer.set_user_setting(current_user, "server_args", req.server_args)
            reconnect_needed = True

    rag_layer.log_audit(current_user, "SETTINGS_UPDATED", f"Provider updated to '{req.provider}'")
    
    manager = mcp_manager.get(current_user)
    if reconnect_needed or not manager.connected:
        logger.info(f"Settings update requires MCP server reconnect for user {current_user}. Reconnecting...")
        cmd = req.server_command or rag_layer.get_user_setting(current_user, "server_command", settings.MCP_SERVER_COMMAND)
        server_args = req.server_args or rag_layer.get_user_setting(current_user, "server_args", str(settings.MCP_SERVER_ARGS))
        
        if isinstance(server_args, str):
            import shlex
            if os.path.exists(server_args):
                args = [server_args]
            else:
                args = shlex.split(server_args, posix=False) if os.name == 'nt' else shlex.split(server_args)
                args = [a.strip('"\'') for a in args]
        else:
            args = server_args
            
        slack_token = req.slack_token or rag_layer.get_user_setting(current_user, "slack_token")
        env = {"SLACK_BOT_TOKEN": slack_token or ""}
        success = await manager.connect(command=cmd, args=args, env_override=env)
        if not success:
            logger.error(f"Failed to reconnect to MCP server for user {current_user} after settings update.")
            rag_layer.log_audit(current_user, "MCP_RECONNECT_FAILED", "Failed to reconnect to MCP server with updated configuration.")
        else:
            rag_layer.log_audit(current_user, "MCP_RECONNECTED", "Successfully reconnected to MCP server with updated configuration.")

    return {"status": "success", "message": "Settings updated successfully."}

@app.post("/api/v1/settings/test")
async def test_settings(req: TestSettingsRequest, current_user: str = Depends(get_current_user)):
    """Test LLM and Slack API keys/tokens before saving them."""
    provider = req.provider
    api_key = req.api_key
    slack_token = req.slack_token

    # Fallbacks for LLM keys if not provided in payload but already exist
    if not api_key:
        api_key = rag_layer.get_user_setting(current_user, "api_key")
        if not api_key:
            if provider == "gemini":
                api_key = settings.GEMINI_API_KEY
            elif provider == "openai":
                api_key = settings.OPENAI_API_KEY

    # Fallback for Slack token if not provided in payload but already exists
    if not slack_token:
        slack_token = rag_layer.get_user_setting(current_user, "slack_token")

    test_results = {
        "llm": {"status": "skipped", "message": "No key to test or local provider selected."},
        "slack": {"status": "skipped", "message": "No token to test."}
    }

    # 1. Test LLM Connection
    if provider == "local":
        import requests
        try:
            res = await asyncio.to_thread(requests.get, f"{settings.OLLAMA_API_URL}/api/tags", timeout=5)
            if res.status_code == 200:
                test_results["llm"] = {
                    "status": "success",
                    "message": f"Successfully connected to Ollama at {settings.OLLAMA_API_URL}."
                }
            else:
                test_results["llm"] = {
                    "status": "error",
                    "message": f"Ollama returned status code {res.status_code}."
                }
        except Exception as e:
            test_results["llm"] = {
                "status": "error",
                "message": f"Could not connect to Ollama: {str(e)}"
            }
    elif api_key:
        if provider == "gemini":
            try:
                from google import genai
                client = genai.Client(api_key=api_key)
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=settings.GEMINI_MODEL,
                    contents="Say 'API active'"
                )
                if response.text:
                    test_results["llm"] = {
                        "status": "success",
                        "message": "Gemini API key is valid!"
                    }
                else:
                    test_results["llm"] = {
                        "status": "error",
                        "message": "Gemini API returned an empty response."
                    }
            except Exception as e:
                test_results["llm"] = {
                    "status": "error",
                    "message": f"Gemini verification failed: {str(e)}"
                }
        elif provider == "openai":
            try:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                response = await asyncio.to_thread(
                    client.chat.completions.create,
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": "Say active"}],
                    max_tokens=5
                )
                if response.choices[0].message.content:
                    test_results["llm"] = {
                        "status": "success",
                        "message": "OpenAI API key is valid!"
                    }
                else:
                    test_results["llm"] = {
                        "status": "error",
                        "message": "OpenAI API returned an empty response."
                    }
            except Exception as e:
                test_results["llm"] = {
                    "status": "error",
                    "message": f"OpenAI verification failed: {str(e)}"
                }
    else:
        test_results["llm"] = {
            "status": "error",
            "message": f"API key is missing for provider '{provider}'."
        }

    # 2. Test Slack Connection
    if slack_token:
        try:
            from slack_sdk import WebClient
            client = WebClient(token=slack_token)
            auth_test = await asyncio.to_thread(client.auth_test)
            test_results["slack"] = {
                "status": "success",
                "message": f"Slack token is valid! Authorized as bot user '{auth_test.get('user')}' in team '{auth_test.get('team')}'."
            }
        except Exception as e:
            test_results["slack"] = {
                "status": "error",
                "message": f"Slack token verification failed: {str(e)}"
            }
    else:
        test_results["slack"] = {
            "status": "error",
            "message": "Slack token is missing."
        }

    return test_results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
