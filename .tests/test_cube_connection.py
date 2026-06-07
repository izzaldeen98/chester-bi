# backend/cube/test_query.py
import os
import time
import jwt
import requests
from dotenv import load_dotenv

load_dotenv()

CUBE_SECRET = os.getenv("CUBE_SECRET")
CUBE_HOST   = os.getenv("CUBE_HOST", "localhost")
CUBE_PORT   = os.getenv("CUBE_PORT", "4000")
CUBE_URL    = f"http://{CUBE_HOST}:{CUBE_PORT}/cubejs-api/v1/load"

if not CUBE_SECRET:
    raise EnvironmentError("CUBE_SECRET is not set in your .env file")

now = int(time.time())

token_payload = {
        # <-- THIS wrapper is what was missing
        "tenant_id": "customer_acme_corp_42",
        "db_type":   "postgres",
        "db_host":   "host.docker.internal",
        "db_name":   "bi_testing_db",
        "db_user":   "dev_admin",
        "db_pass":   "SecretPassword123",
        "db_port":   5432,

}

token = jwt.encode(token_payload, CUBE_SECRET, algorithm="HS256")

query_payload = {
    "query": {
        "dimensions": ["stores.name"],
    }
}

headers = {
    "Authorization": token,
    "Content-Type":  "application/json",
}

print(f"[test] Hitting: {CUBE_URL}")
response = requests.post(CUBE_URL, json=query_payload, headers=headers)

try:
    response.raise_for_status()
    print("[test] Success:", response.json())
except requests.HTTPError:
    print(f"[test] HTTP {response.status_code} error:", response.text)
except Exception as e:
    print("[test] Unexpected error:", e)