import requests
import json
import os
from typing import Any, List
from dotenv import load_dotenv


load_dotenv()

MALLOY_HOST = os.getenv("MALLOY_HOST")
MALLOY_PORT = os.getenv("MALLOY_PORT")

MALLOY_URL = f"http://{MALLOY_HOST}:{MALLOY_PORT}"


def _get_from_list(list: list, key: str, value: Any):
    for item in list:
        if item[key] == value:
            return item
    return None


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
        return None

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

        source_infos = data["sourceInfos"]
        source_infos_return = []
        for source_info in source_infos:
            source_infos_return.append(json.loads(source_info))
        # return data
        return {
            "type": data["type"],
            "packageName": data["packageName"],
            "modelPath": data["modelPath"],
            "malloyVersion": data["malloyVersion"],
            "sourceInfos" : source_infos_return,
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
    def create_environment(self, name: str, description: str):
        response = requests.post(
            f"{MALLOY_URL}/api/v0/environments",
            json={"name": name, "description": description},
        )
        if response.status_code != 200:
            raise Exception(f"Failed to create environment: {response.text}")
        data = response.json()
        self.env_id = data["name"]
        self.location = data["location"]
        self.resource = data["resource"]

    def create_connection(
        self,
        name: str,
        type: str,
        host: str,
        port: int,
        databaseName: str,
        userName: str,
        password: str,
        **kwargs,
    ):
        payload = {
            "type": type,
            "name": name,
            "attributes": {
                "dialectName": kwargs.get("dialectName", "default"),
                "isPool": kwargs.get("isPool", True),
                "canPersist": kwargs.get("canPersist", True),
                "canStream": kwargs.get("canStream", True),
            },
            "postgresConnection": (
                {
                    "host": host,
                    "port": port,
                    "databaseName": databaseName,
                    "userName": userName,
                    "password": password,
                }
                if type == "postgres"
                else None
            ),
        }
        test_connection = requests.post(
            f"{MALLOY_URL}/api/v0/connections/test", json=payload
        )
        if test_connection.status_code != 200:
            raise Exception(f"Failed to test connection: {test_connection.text}")
        response = requests.post(
            f"{MALLOY_URL}{self.resource}/connections/{name}",
            json={
                "type": type,
                "name": name,
                "resource": f"{self.resource}/connections/{name}",
                "attributes": {
                    "dialectName": kwargs.get("dialectName", "default"),
                    "isPool": kwargs.get("isPool", True),
                    "canPersist": kwargs.get("canPersist", True),
                    "canStream": kwargs.get("canStream", True),
                },
                "postgresConnection": (
                    {
                        "host": host,
                        "port": port,
                        "databaseName": databaseName,
                        "userName": userName,
                        "password": password,
                    }
                    if type == "postgres"
                    else None
                ),
            },
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
                resource=data["resource"],
                attributes=data["attributes"],
                connection_credentials={
                    "host": host,
                    "port": port,
                    "databaseName": databaseName,
                    "userName": userName,
                    "password": "********",
                },
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


if __name__ == "__main__":
    malloy = Malloy(envid="izzaldeen_radaideh")

    # malloy.create_environment(name="", description="test environment")

    # malloy.create_connection(name="test_db", type="postgres", host="host.docker.internal", port=5432, databaseName="bi_testing_db", userName="dev_admin", password="SecretPassword123")
    # malloy.packages[0].delete()
    # malloy.create_package(name="pos", description="Order analytics semantic models", location="/publisher/publisher_data/test/model_a")
    query = """
    run: order_items -> {group_by: Category aggregate: `Total Revenue`}


"""
    package = malloy.get_package_by_name("pos")
    # print(package)
    model = package.get_model_by_name("pos")
    # print(model)

    # print(model.query(query))
    with open("C:/dev/chester-bi/.tests/model.json", "w" , encoding="utf-8") as f:
        f.write(json.dumps(model.get_compiled_model(), indent=4 , ensure_ascii=False))
    
    

    
