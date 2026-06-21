import sys
import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App Config
    APP_NAME: str = "Slack Intelligence Copilot"
    API_V1_STR: str = "/api/v1"
    
    # Slack Configuration
    SLACK_BOT_TOKEN: Optional[str] = os.environ.get("SLACK_BOT_TOKEN")
    DEFAULT_CHANNEL_ID: str = "C0BC5R8LQ92"
    SLACK_TEAM_ID: str = "T0BBYQ88AA1"
    
    # LLM Settings (User can override via UI, which gets saved here or in DB)
    LLM_PROVIDER: str = "gemini"  # gemini, openai, or local (ollama)
    GEMINI_API_KEY: Optional[str] = os.environ.get("GEMINI_API_KEY")
    OPENAI_API_KEY: Optional[str] = os.environ.get("OPENAI_API_KEY")
    OLLAMA_API_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    # Database Settings
    DB_PATH: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "slack_copilot.db")
    
    # MCP Connection Settings
    MCP_SERVER_COMMAND: str = sys.executable
    MCP_SERVER_ARGS: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "slack_mcp_server.py")

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        env_file_encoding = "utf-8"

settings = Settings()
