import requests
import json
import os
from typing import Any, List
from dotenv import load_dotenv


load_dotenv()

MALLOY_HOST = os.getenv("MALLOY_HOST")
MALLOY_PORT = os.getenv("MALLOY_PORT")

MALLOY_URL = f"http://{MALLOY_HOST}:{MALLOY_PORT}"




def parse_source_infos(source_infos: list) -> list:
    # Initialize the list inside the function
    output_data = []

    for source_info in source_infos:
        output_data.append(json.loads(source_info))
    # Return the data back to your main script
    return output_data


class MalloyConnection:

    def __init__(self, **kwargs) -> None:
        if not all(key in kwargs for key in ["name", "type", "resource", "attributes"]):
            raise Exception("Missing required arguments")
        self.name = kwargs.get("name")
        self.type = kwargs.get("type")
        self.resource = kwargs.get("resource")
        self.attributes = kwargs.get("attributes")
        self.connection_credentials = kwargs.get("connection_credentials")

    def update(
        self,
        host: str,
        port: int,
        databaseName: str,
        userName: str,
        password: str,
    ):
        payload = {}
        if self.type == "postgres":
            payload = {
                "postgresConnection": {
                    "host": host,
                    "port": port,
                    "databaseName": databaseName,
                    "userName": userName,
                    "password": password,
                }
            }
        response = requests.put(f"{MALLOY_URL}{self.resource}", json=payload)
        if response.status_code != 200:
            raise Exception(f"Failed to update connection: {response.text}")
        self.connection_credentials = {
            "host": host,
            "port": port,
            "databaseName": databaseName,
            "userName": userName,
            "password": "********",
        }

    def delete(self):
        response = requests.delete(f"{MALLOY_URL}{self.resource}")
        if response.status_code != 200:
            raise Exception(f"Failed to delete connection: {response.text}")
        self.connection_credentials = {}

    def __str__(self):
        return f"MalloyConnection(name={self.name}, type={self.type}, resource={self.resource}, attributes={self.attributes}, connection_credentials={self.connection_credentials})"

    def __repr__(self):
        return f"MalloyConnection(name={self.name}, type={self.type}, resource={self.resource}, attributes={self.attributes}, connection_credentials={self.connection_credentials})"


class MalloyPackage:

    def __init__(self, **kwargs) -> None:
        

        if not all(key in kwargs for key in ["name", "resource"]):
            missing_keys = [key for key in ["name", "resource"] if key not in kwargs]
            raise ValueError(f"Missing required arguments: {', '.join(missing_keys)}")
            
        self.name = kwargs.get("name")
        self.description = kwargs.get("description")
        
        self.resource = kwargs.get("resource")
        self.location = kwargs.get("location")
        self.models: List[MalloyModel] = []

        self.__load_models()


    def __load_models(self):
        response = requests.get(f"{MALLOY_URL}{self.resource}/models")
        if response.status_code != 200:
            raise Exception(f"Failed to load models: {response.text}")
        data = response.json()
        if data != []:
            for model in data:
                self.models.append(
                    MalloyModel(
                        name=model["packageName"],
                        path=model["path"],
                        resource=model.get("resource", f"{self.resource}/models"),
                    )
                )

    def update(self, name: str, description: str):
        response = requests.put(
            f"{MALLOY_URL}{self.resource}",
            json={"name": name, "description": description},
        )
        if response.status_code != 200:
            raise Exception(f"Failed to update package: {response.text}")
        return response.json()

    def delete(self):
        response = requests.delete(f"{MALLOY_URL}{self.resource}")
        if response.status_code != 200:
            raise Exception(f"Failed to delete package: {response.text}")
        return {"message": "Package deleted successfully"}
    
    def get_model_by_name(self, name: str):
        for model in self.models:
            if model.name == name:
                return model
        raise Exception(f"Model {name} not found in package {self.name}")
    def get_model_by_path(self, path: str):
        for model in self.models:
            if model.path == path:
                return model
        raise Exception(f"Model {path} not found in package {self.name}")

    def __str__(self):
        return f"MalloyPackage(name={self.name}, description={self.description}, resource={self.resource} , models={self.models})"

    def __repr__(self):
        return f"MalloyPackage(name={self.name}, description={self.description}, resource={self.resource} , models={self.models})"


class MalloyModel:
    def __init__(self, **kwargs) -> None:
        if not all(key in kwargs for key in ["name", "path", "resource"]):
            raise Exception("Missing required arguments")
        self.name = kwargs.get("name")
        self.path = kwargs.get("path")
        self.resource = kwargs.get("resource")


    def query(self, query: str , compact_json: bool = True , givens : dict = None):
        response = requests.post(
            f"{MALLOY_URL}{self.resource}/{self.path}/query",
            json={"query": query , "compactJson": compact_json , "givens": givens},
        )
        if response.status_code != 200:
            raise Exception(f"Failed to query model: {response.text}")
        data = response.json()
        return {
            "result": json.loads(data["result"]),
            "resource": data["resource"],
            "query" : query
        }
    def get_compiled_model(self):
        url = f"{MALLOY_URL}{self.resource}/{self.path}"
        print(url)
        response = requests.get(url)
        if response.status_code != 200:
            raise Exception(f"Failed to get compiled model: {response.text}")
        data = response.json()
        
        return {
            "type": data["type"],
            "package_name": data["packageName"],
            "model_path": data.get("path", None),
            "malloy_version": data["malloyVersion"],
            "sources": parse_source_infos(data["sourceInfos"]),
        }

    def compile(self, includeSql: bool = True, sourceName: str = None):
        response = requests.post(
            f"{MALLOY_URL}{self.resource}/compile",
            json={
                "includeSql": includeSql,
                "sourceName": sourceName if sourceName else self.name,
            },
        )
        if response.status_code != 200:
            raise Exception(f"Failed to compile model: {response.text}")
        return response.json()
    def get_compiled_model_raw(self):
        url = f"{MALLOY_URL}{self.resource}/{self.path}"
        print(url)
        response = requests.get(url)
        if response.status_code != 200:
            raise Exception(f"Failed to get compiled model: {response.text}")
        data = response.json()

        
        
        return data

    def load(self):
        response = requests.get(
            f"{MALLOY_URL}{self.resource}/load",
        )
        if response.status_code != 200:
            raise Exception(f"Failed to load model: {response.text}")
        return response.json()

    def __str__(self):
        return (
            f"MalloyModel(name={self.name}, path={self.path}, resource={self.resource} )"
        )

    def __repr__(self):
        return (
            f"MalloyModel(name={self.name}, path={self.path}, resource={self.resource} )"
        )


class Malloy:
    """
        example :
    {
       "resource":"/api/v0/environments/test",
       "name":"test",
       "location":"/publisher/publisher_data/test",
       "readme":"# test\n",
       "connections":[
          {
             "name":"test_db",
             "type":"postgres",
             "resource":"/api/v0/connections/test_db",
             "postgresConnection":{
                "host":"host.docker.internal",
                "port":"5432",
                "databaseName":"bi_testing_db",
                "userName":"dev_admin",
                "password":"SecretPassword123"
             },
             "attributes":{
                "dialectName":"postgres",
                "isPool":false,
                "canPersist":true,
                "canStream":true
             }
          }
       ],
       "packages":[
          {
             "name":"model_a",
             "description":"Order analytics semantic models",
             "resource":"/api/v0/environments/test/packages/model_a"
          }
       ]
    }"""

    def __init__(self, envid: str = None, location: str = None) -> None:
        self.connections: List[MalloyConnection] = []
        self.packages: List[MalloyPackage] = []
        self.envid = envid
        self.location = location
        if envid:
            self.__load_environment(envid)

    def __load_environment(self, envid: str):
        response = requests.get(f"{MALLOY_URL}/api/v0/environments/{envid}")
        if response.status_code != 200:
            raise Exception(f"Failed to get environment: {response.text}")
        data = response.json()
        self.envid = envid
        self.location = data["location"]
        self.resource = data["resource"]
        if data["connections"] != []:
            for connection in data["connections"]:
                if connection["type"] == "postgres":
                    connection_credentials = {
                        "host": connection["postgresConnection"]["host"],
                        "port": connection["postgresConnection"]["port"],
                        "databaseName": connection["postgresConnection"][
                            "databaseName"
                        ],
                        "userName": connection["postgresConnection"]["userName"],
                        "password": "********",
                    }

                self.connections.append(
                    MalloyConnection(
                        name=connection["name"],
                        type=connection["type"],
                        resource=connection.get(
                            "resource",
                            f"{self.resource}/connections/{connection['name']}",
                        ),
                        attributes=connection["attributes"],
                        connection_credentials=connection_credentials,
                    )
                )
        if data["packages"] != []:
            for package in data["packages"]:
                self.packages.append(
                    MalloyPackage(
                        name=package["name"],
                        description=package.get("description", None),
                        resource=package.get(
                            "resource", f"{self.resource}/packages/{package['name']}"
                        ),
                    )
                )
    def delete_environment(self):
        response = requests.delete(f"{MALLOY_URL}{self.resource}")
        if response.status_code != 200:
            raise Exception(f"Failed to delete environment: {response.text}")
        return {"message": "Environment deleted successfully"}
    def create_environment(self, name: str, description: str = None):
        response = requests.post(
            f"{MALLOY_URL}/api/v0/environments",
            json={"name": name, "description": description if description else "No description"},
        )
        if response.status_code != 200:
            raise Exception(f"Failed to create environment: {response.text}")
        data = response.json()
        self.env_id = data["name"]
        self.location = data["location"]
        self.resource = data["resource"]

    def _create_mysql_postgres_connection(self, name: str,type:str, **kwargs):
        payload = {
            "type": type,
            "name": name,
            "attributes": {
                "dialectName": kwargs.get("dialectName", "default"),
                "isPool": kwargs.get("isPool", True),
                "canPersist": kwargs.get("canPersist", True),
                "canStream": kwargs.get("canStream", True),
            }
         }
        if type == "postgres":
            payload["postgresConnection"] = {
                "host": kwargs.get("host"),
                "port": kwargs.get("port"),
                "databaseName": kwargs.get("database"),
                "userName": kwargs.get("username"),
                "password": kwargs.get("password"),
            }
        elif type == "mysql":
            payload["mysqlConnection"] = {
                "host": kwargs.get("host"),
                "port": kwargs.get("port"),
                "database": kwargs.get("database"),
                "user": kwargs.get("username"),
                "password": kwargs.get("password"),
            }
        else:
            raise Exception(f"Invalid database type: {type}")
        return payload
    

    def _create_snowflake_connection(self, name: str, type: str, **kwargs):
        password_connection = False
        private_key_connection = False
        if "password" in kwargs:
            password_connection = True
        if "private_key" in kwargs:
            private_key_connection = True
        if not password_connection and not private_key_connection:
            raise Exception("Missing password or private key")
        payload = {
            "type": type,
            "name": name,
            "attributes": {
                "dialectName": kwargs.get("dialectName", "default"),
                "isPool": kwargs.get("isPool", True),
                "canPersist": kwargs.get("canPersist", True),
                "canStream": kwargs.get("canStream", True),
            }
        }
        snowflake_attributes = {
            "warehouse" : kwargs.get("warehouse"),
            "database" : kwargs.get("database"),
            "schema" : kwargs.get("schema"),
            "username" : kwargs.get("username"),
        }
        if password_connection:
            snowflake_attributes["password"] = kwargs.get("password")
        if private_key_connection:
            snowflake_attributes["privateKey"] = kwargs.get("private_key")
            snowflake_attributes["privateKeyPassphrase"] = kwargs.get("private_key_passphrase")
        payload["snowflakeConnection"] = snowflake_attributes
        return payload

    def _create_bigquery_connection(self, name: str, type: str, **kwargs):
        payload = {
            "type": type,
            "name": name,
            "attributes": {
                "dialectName": kwargs.get("dialectName", "default"),
                "isPool": kwargs.get("isPool", True),
                "canPersist": kwargs.get("canPersist", True),
                "canStream": kwargs.get("canStream", True),
            }
        }
        bigquery_attributes = {
            "projectId" : kwargs.get("project_id"),
            "serviceAccountJson" : kwargs.get("service_account_json"),
        }
        payload["bigqueryConnection"] = bigquery_attributes
        return payload
    def create_connection(
        self,
        name: str,
        type: str,
        **kwargs,
    ):
        payload = {}
        if type == "postgres" or type == "mysql":
            payload = self._create_mysql_postgres_connection(name, type, **kwargs)
        elif type == "snowflake":
            payload = self._create_snowflake_connection(name, type, **kwargs)
        elif type == "bigquery":
            payload = self._create_bigquery_connection(name, type, **kwargs)
        else:
            raise Exception(f"Invalid database type: {type}")
        test_connection = requests.post(
            f"{MALLOY_URL}/api/v0/connections/test", json=payload
        )
        if test_connection.status_code != 200:
            raise Exception(f"Failed to test connection: {test_connection.text}")
        response = requests.post(
            f"{MALLOY_URL}{self.resource}/connections/{name}",
            json=payload,
        )
        if response.status_code != 201:
            raise Exception(f"Failed to create connection: {response.text}")
        connection_data = requests.get(
            f"{MALLOY_URL}{self.resource}/connections/{name}"
        )
        data = connection_data.json()
        self.connections.append(
            MalloyConnection(
                name=name,
                type=type,
                resource=data.get("resource", f"{self.resource}/connections/{name}"),
                attributes=data.get("attributes", {}),
                connection_credentials={},
            )
        )
        return True

    def create_package(self, name: str, description: str, location: str):
        payload = {
            "name": name,
            "resource": f"{self.resource}/packages/{name}",
            "description": description,
            "location": location,
        }
        response = requests.post(f"{MALLOY_URL}{self.resource}/packages", json=payload)
        data = response.json()
        if response.status_code != 200:
            raise Exception(f"Failed to create package: {response.text}")
        self.packages.append(
            MalloyPackage(
                name=name, description=description, resource=data["resource"] , location=location
            )
        )
        return True
    
    def get_package_by_name(self, name: str):
        for package in self.packages:
            if package.name == name:
                return package
        return None
    def get_connection_by_name(self, name: str):
        for connection in self.connections:
            if connection.name == name:
                return connection
        return None
    @classmethod
    def test_connection(cls , type: str, host: str, port: int, databaseName: str, userName: str, password: str):
        payload = {
            "type": type,
            "postgresConnection": {
            "host": host,
            "port": port,
            "databaseName": databaseName,
            "userName": userName,
            "password": password,}
        }

        response = requests.post(f"{MALLOY_URL}/api/v0/connections/test", json=payload)
        if response.status_code != 200:
            raise Exception(f"Failed to test connection: {response.text}")
        return True

    
    def __str__(self):
        return f"Malloy(envid={self.envid}, location={self.location}, resource={self.resource} , connections={self.connections} , packages={self.packages})"
    
    def __repr__(self):
        return f"Malloy(envid={self.envid}, location={self.location}, resource={self.resource} , connections={self.connections} , packages={self.packages})"


    def get_connection_schemas(self, connection: str):
        uri = f"{MALLOY_URL}{self.resource}/connections/{connection}/schemas"
        response = requests.get(uri)
        if response.status_code != 200:
            raise Exception(f"Failed to get connection schemas: {response.text}")
        return response.json()

    def get_schema_tables(self, connection: str, schema: str):
        uri = f"{MALLOY_URL}{self.resource}/connections/{connection}/schemas/{schema}/tables"
        response = requests.get(uri)
        if response.status_code != 200:
            raise Exception(f"Failed to get schema tables: {response.text}")
        return response.json()



if __name__ == "__main__":
    malloy = Malloy(envid='eb71743a-c41b-4a3e-aef2-c771f8ce54e2')

    schemas = malloy.get_connection_schemas("public_database3")
    tables = malloy.get_schema_tables("public_database3" , "rnacen")

    print("SCHEMAS: " , schemas)
    print("TABLES: " , tables)




    
