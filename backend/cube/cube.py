# backend/cube/cube.py
from cube import config

def dynamic_driver(context):
    security_context = context.get('security_context', {})
    
    db_type = security_context.get('db_type', 'postgres')
    db_host = security_context.get('db_host')
    db_name = security_context.get('db_name')
    db_user = security_context.get('db_user')
    db_pass = security_context.get('db_pass')
    
    # Dev Playground Local Fallback (Matches your postgres_test credentials)
    if not all([db_host, db_name, db_user, db_pass]):
        return {
            "type": "postgres",
            "host": "postgres_test",      # Exact docker service name
            "database": "bi_testing_db",
            "user": "dev_admin",
            "password": "SecretPassword123"
        }
        
    return {
        "type": db_type,
        "host": db_host,
        "database": db_name,
        "user": db_user,
        "password": db_pass
    }

def dynamic_cache_pool(context):
    security_context = context.get('security_context', {})
    db_host = security_context.get('db_host', 'dev_host')
    db_name = security_context.get('db_name', 'dev_db')
    
    return f"pool__{db_host}__{db_name}"

# Register the functions explicitly to the config object properties
config.driver_factory = dynamic_driver
config.context_to_orchestrator_id = dynamic_cache_pool
