import redis
import os
from dotenv import load_dotenv
import json

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)

def cache_query(account_id: str, query: str, result: dict):

    redis_client.set(f"{account_id}:{query}", json.dumps(result), ex=60*30)
    return True

def get_cached_query(account_id: str, query: str):
    result = redis_client.get(f"{account_id}:{query}")
    if result:
        return json.loads(result)
    return None