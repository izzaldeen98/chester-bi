import redis
import os
from dotenv import load_dotenv
import json

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_CACHE_TTL = os.getenv("REDIS_CACHE_TTL")

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)

def cache_query(key: str, result: dict):
    redis_client.set(key, json.dumps(result), ex=int(REDIS_CACHE_TTL))
    return True

def get_cached_query(key: str):
    result = redis_client.get(key)
    if result:
        return json.loads(result)
    return None