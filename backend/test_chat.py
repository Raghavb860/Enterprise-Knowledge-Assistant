import httpx
import json

base_url = "http://localhost:8000/api/v1"

# 1. Login
login_resp = httpx.post(f"{base_url}/auth/login", json={"email": "admin@eka.local", "password": "Admin@123"})
if login_resp.status_code != 200:
    print(f"Login failed: {login_resp.text}")
    exit(1)

token = login_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Create session
session_resp = httpx.post(f"{base_url}/chat/sessions", json={}, headers=headers)
if session_resp.status_code != 201:
    print(f"Create session failed: {session_resp.text}")
    exit(1)

session_id = session_resp.json()["id"]
print(f"Created session {session_id}")

# 3. Send message
message = "What is the core problem addressed by the AI-Assisted Platform?"
print(f"Sending message: {message}")
chat_resp = httpx.post(
    f"{base_url}/chat/message",
    json={"session_id": session_id, "message": message},
    headers=headers,
    timeout=120.0
)

if chat_resp.status_code != 200:
    print(f"Chat failed: {chat_resp.text}")
else:
    print(f"Chat Response: {json.dumps(chat_resp.json(), indent=2)}")
