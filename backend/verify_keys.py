import os
import sys
from dotenv import load_dotenv

# Load env variables from backend/.env
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path)

print("--- DIAGNOSTIC SCRIPT FOR API KEYS ---")
print(f"Loading env from: {dotenv_path}")

slack_token = os.environ.get("SLACK_BOT_TOKEN")
gemini_key = os.environ.get("GEMINI_API_KEY")

print(f"SLACK_BOT_TOKEN set: {'Yes (length ' + str(len(slack_token)) + ')' if slack_token else 'No'}")
print(f"GEMINI_API_KEY set: {'Yes (length ' + str(len(gemini_key)) + ')' if gemini_key else 'No'}")

errors = 0

# 1. Test Slack Bot Token
if slack_token:
    print("\n[1/2] Testing Slack Bot Token...")
    try:
        from slack_sdk import WebClient
        client = WebClient(token=slack_token)
        auth_test = client.auth_test()
        print("SUCCESS: Slack Token is VALID!")
        print(f"  - Bot User: {auth_test.get('user')}")
        print(f"  - Bot ID: {auth_test.get('user_id')}")
        print(f"  - Workspace/Team: {auth_test.get('team')}")
    except Exception as e:
        print("ERROR: Slack Token is INVALID or connection failed!")
        print(f"  Error: {e}")
        errors += 1
else:
    print("\n[1/2] Slack Bot Token not found in environment!")
    errors += 1

# 2. Test Gemini API Key
if gemini_key:
    print("\n[2/2] Testing Gemini API Key...")
    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents="Say 'API is active!'",
        )
        print("SUCCESS: Gemini API Key is VALID!")
        print(f"  - Response received: {response.text.strip()}")
    except Exception as e:
        print("ERROR: Gemini API Key is INVALID or connection failed!")
        print(f"  Error: {e}")
        errors += 1
else:
    print("\n[2/2] Gemini API Key not found in environment!")
    errors += 1

print("\n--- DIAGNOSTICS COMPLETE ---")
if errors == 0:
    print("All keys verified successfully!")
    sys.exit(0)
else:
    print(f"Completed with {errors} error(s).")
    sys.exit(1)
