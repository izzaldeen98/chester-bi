from abc import ABC, abstractmethod
import sqlalchemy
from sqlalchemy import text # Required for safe raw query text execution
from sqlalchemy.orm import sessionmaker

class Warehouse(ABC):
    @abstractmethod
    def execute_query(self, query: str, params: dict) -> list[dict]:
        pass

    @abstractmethod
    def get_tables_metadata(self) -> dict:
        pass


class PostgresWarehouse(Warehouse):
    # Map the class type objects accurately
    DATA_TYPE_MAP = {
        sqlalchemy.Integer: "integer",
        sqlalchemy.String: "string",
        sqlalchemy.Float: "double",
        sqlalchemy.Numeric: "double",
        sqlalchemy.Boolean: "boolean",
        sqlalchemy.DateTime: "timestamp",
        sqlalchemy.Date: "date",
        sqlalchemy.Time: "time",
        sqlalchemy.TIMESTAMP: "timestamp",
        sqlalchemy.Interval: "interval",
        sqlalchemy.JSON: "object",
        sqlalchemy.UUID: "string",
        sqlalchemy.Text: "string",
        sqlalchemy.Enum: "string",
        sqlalchemy.DECIMAL: "double",
    }

    def __init__(self, **kwargs):
        if not all(key in kwargs for key in ["host", "port", "username", "password", "database"]):
            raise ValueError("Missing required connection parameters")

        self.database = kwargs['database']
        
        self.engine = sqlalchemy.create_engine(
            f"postgresql://{kwargs['username']}:{kwargs['password']}@{kwargs['host']}:{kwargs['port']}/{kwargs['database']}"
        )
        self.session = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

    def execute_query(self, query: str, params: dict = None) -> list[dict]:
        """Safely executes raw query strings against the engine using text blocks."""
        if params is None:
            params = {}
        with self.session() as session:
            # 🚀 Wrap string inside text() to protect against SQL injections
            result = session.execute(text(query), params)
            # Mappings convert SQL tuples instantly into clean python dictionaries
            return [dict(row) for row in result.mappings().all()]

    def _normalize_type(self, column_type) -> str:
        """Evaluates database columns using inheritance safety chains."""
        # 🚀 Use isinstance to catch all child and dialect variations
        if isinstance(column_type, sqlalchemy.Integer):
            return "integer"
        if isinstance(column_type, (sqlalchemy.String, sqlalchemy.Text, sqlalchemy.UUID, sqlalchemy.Enum)):
            return "string"
        if isinstance(column_type, (sqlalchemy.Float, sqlalchemy.Numeric, sqlalchemy.DECIMAL)):
            return "double"
        if isinstance(column_type, sqlalchemy.Boolean):
            return "boolean"
        if isinstance(column_type, (sqlalchemy.DateTime, sqlalchemy.TIMESTAMP)):
            return "timestamp"
        if isinstance(column_type, sqlalchemy.Date):
            return "date"
        if isinstance(column_type, sqlalchemy.Time):
            return "time"
        if isinstance(column_type, sqlalchemy.JSON):
            return "object"
        if isinstance(column_type, sqlalchemy.Interval):
            return "interval"
            
        # Fallback to string representation of the type if it's completely custom
        return str(column_type).lower()

    def get_tables_metadata(self) -> dict:
        metadata = sqlalchemy.MetaData()
        with self.engine.connect() as connection:
            metadata.reflect(bind=connection)

        db_metadata = {
            "database": self.database,
            "tables": []
        }
        
        for table_name, table_object in metadata.tables.items():
            table_metadata = {
                "name": table_name,
                "columns": []
            }
            
            for column in table_object.columns:
                # 🚀 FIXED: Call the normalization helper instead of direct dictionary lookup
                unified_type = self._normalize_type(column.type)
                
                column_metadata = {
                    "name": column.name,
                    "type": unified_type
                }
                table_metadata["columns"].append(column_metadata)
                
            db_metadata["tables"].append(table_metadata)
            
        return db_metadata
if __name__ == "__main__":
    # Test connection setup targeting your local BI Postgres Compose container block
    warehouse = PostgresWarehouse(
        host="localhost", 
        port=5432, 
        username="dev_admin", 
        password="SecretPassword123", 
        database="bi_testing_db"
    )
    
    # 1. Print structured schema metadata definitions
    print("--- METADATA SHAPE ---")
    print(warehouse.get_tables_metadata())
    
    # 2. Test dynamic raw query parameters execution
    print("\n--- SAMPLE QUERY DATA EXECUTION ---")
    test_query = "SELECT id, name, region FROM stores WHERE region = :target_region"
    query_results = warehouse.execute_query(test_query, {"target_region": "North"})
    print(query_results)
