import jwt
import requests

# 1. Define your security credentials
# The CUBE_SECRET must match the CUBEJS_API_SECRET in your docker-compose file
CUBE_SECRET = "my_super_secret_key_12345"
CUBE_URL = "http://localhost:4000/cubejs-api/v1/load"

# 2. Package the target database credentials dynamically into the payload
target_database_payload = {
    "db_type": "postgres",
    "db_host": "postgres_test",        # Name of your DB service in docker-compose
    "db_name": "bi_testing_db",
    "db_user": "dev_admin",
    "db_pass": "SecretPassword123",
    "exp": 1811883800                  # Token expiration timestamp
}

# 3. Encrypt the credentials into a JWT token
# token = jwt.encode(target_database_payload, CUBE_SECRET, algorithm="HS256")

# 4. Build your semantic query (using the measures & dimensions in your model)
query_payload = {
    "query": {
        "measures": ["order_items.total_unit_price"],
        "dimensions": ["stores.name"]
    }
}

# 5. Establish the connection and query Cube through the API
# headers = {"Authorization": token}
response = requests.post(CUBE_URL, json=query_payload)

print(response.text)

# 6. View your results
data = response.json().get("data")
print(data)
