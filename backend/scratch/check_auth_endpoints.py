import requests
import random
import string
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def run_tests():
    # 1. Generate credentials
    test_user = f"test_{random_string(6)}"
    test_pass = "SecurePass123!"
    
    print(f"--- Auth End-to-End Test ---")
    print(f"Targeting: {BASE_URL}")
    print(f"Testing credentials: username='{test_user}', password='{test_pass}'")
    
    # 2. Test Signup
    print("\n1. Testing Signup Endpoint...")
    signup_url = f"{BASE_URL}/auth/signup"
    signup_payload = {"username": test_user, "password": test_pass}
    
    try:
        r_signup = requests.post(signup_url, json=signup_payload)
        print(f"Status Code: {r_signup.status_code}")
        print(f"Response: {r_signup.json()}")
        if r_signup.status_code != 200 or not r_signup.json().get("ok"):
            print("❌ Signup failed!")
            sys.exit(1)
        print("✅ Signup successful!")
    except Exception as e:
        print(f"❌ Failed to reach signup endpoint: {e}")
        sys.exit(1)
        
    # 3. Test Signup Duplicate
    print("\n2. Testing Duplicate Signup Endpoint...")
    try:
        r_dup = requests.post(signup_url, json=signup_payload)
        print(f"Status Code: {r_dup.status_code}")
        print(f"Response: {r_dup.json()}")
        if r_dup.status_code == 200:
            print("❌ Duplicate signup allowed (should have failed)!")
            sys.exit(1)
        print("✅ Duplicate signup correctly rejected!")
    except Exception as e:
        print(f"❌ Duplicate test request failed: {e}")
        sys.exit(1)

    # 4. Test Login (Correct credentials)
    print("\n3. Testing Login Endpoint (Correct Credentials)...")
    login_url = f"{BASE_URL}/auth/login"
    login_payload = {"username": test_user, "password": test_pass}
    
    token = None
    try:
        r_login = requests.post(login_url, json=login_payload)
        print(f"Status Code: {r_login.status_code}")
        print(f"Response: {r_login.json()}")
        if r_login.status_code != 200 or not r_login.json().get("ok"):
            print("❌ Login failed!")
            sys.exit(1)
        token = r_login.json().get("token")
        print("✅ Login successful! Token retrieved.")
    except Exception as e:
        print(f"❌ Failed to reach login endpoint: {e}")
        sys.exit(1)

    # 5. Test Login (Incorrect credentials)
    print("\n4. Testing Login Endpoint (Incorrect Credentials)...")
    bad_login_payload = {"username": test_user, "password": "WrongPassword"}
    try:
        r_bad_login = requests.post(login_url, json=bad_login_payload)
        print(f"Status Code: {r_bad_login.status_code}")
        print(f"Response: {r_bad_login.json()}")
        if r_bad_login.status_code == 200:
            print("❌ Login succeeded with invalid credentials!")
            sys.exit(1)
        print("✅ Bad login correctly rejected!")
    except Exception as e:
        print(f"❌ Bad login request failed: {e}")
        sys.exit(1)

    # 6. Test Protected Endpoint Access
    print("\n5. Testing Protected Endpoint Access...")
    protected_url = f"{BASE_URL}/chat/history" # Get list of history or a common protected resource
    
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r_protected = requests.get(protected_url, headers=headers)
        print(f"Status Code: {r_protected.status_code}")
        print(f"Response: {r_protected.json() if r_protected.status_code == 200 else r_protected.text}")
        if r_protected.status_code != 200:
            print("❌ Protected access failed!")
            sys.exit(1)
        print("✅ Protected access successful!")
    except Exception as e:
        print(f"❌ Failed to reach protected endpoint: {e}")
        sys.exit(1)

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Auth endpoints are fully functional on Supabase.")

if __name__ == "__main__":
    run_tests()
