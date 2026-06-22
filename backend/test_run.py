import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent import agent_runner
from dotenv import load_dotenv

# Load env variables from backend/.env
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path)

async def main():
    try:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        async for chunk in agent_runner.run_query("hello", [], "gemini", gemini_key, "testuser"):
            print("Chunk:", chunk)
    except Exception as e:
        import traceback
        print("EXCEPTION RAISED:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
