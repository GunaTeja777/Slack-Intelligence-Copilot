import asyncio
import sys
import os

# Add the workspace directory to sys.path so we can import backend
sys.path.append(r"c:\Users\tejag\chat analyser")

from backend.agent import agent_runner

async def main():
    try:
        async for chunk in agent_runner.run_query("hello", [], "gemini", "fake_key"):
            print("Chunk:", chunk)
    except Exception as e:
        import traceback
        print("EXCEPTION RAISED:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
