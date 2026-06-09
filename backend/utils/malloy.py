import requests
import json
import os
from dotenv import load_dotenv


load_dotenv()

MALLOY_HOST = os.getenv("MALLOY_HOST")
MALLOY_PORT = os.getenv("MALLOY_PORT")

MALLOY_URL = f"http://{MALLOY_HOST}:{MALLOY_PORT}"


class MalloyEnvironment:
    def __init__(self) -> None:
        self.path = "/api/v0/environments"

    def list(self):
        response = requests.get(f"{MALLOY_URL}{self.path}")
        if response.status_code != 200:
            raise Exception(f"Failed to list environments: {response.text}")
        return response.json()

    def get(self, id: str):
        response = requests.get(f"{MALLOY_URL}{self.path}/{id}")
        if response.status_code != 200:
            raise Exception(f"Failed to get environment: {response.text}")
        return response.json()

    def create(self, name: str, description: str):
        response = requests.post(
            f"{MALLOY_URL}{self.path}", json={"name": name, "description": description}
        )
        if response.status_code != 200:
            raise Exception(f"Failed to create environment: {response.text}")
        return response.json()

    def update(self, id: str, name: str, description: str):
        response = requests.put(
            f"{MALLOY_URL}{self.path}/{id}",
            json={"name": name, "description": description},
        )
        if response.status_code != 200:
            raise Exception(f"Failed to update environment: {response.text}")
        return response.json()

    def delete(self, id: str):
        response = requests.delete(f"{MALLOY_URL}{self.path}/{id}")
        if response.status_code != 200:
            raise Exception(f"Failed to delete environment: {response.text}")
        return response.json()


class MalloyConnection:

    def __init__(self, envid: str) -> None:
        self.envid = envid
        self.path = f"/api/v0/environments/{envid}/connections"

    def list(self):
        response = requests.get(f"{MALLOY_URL}{self.path}")
        if response.status_code != 200:
            raise Exception(f"Failed to list connections: {response.text}")
        return response.json()

    def get(self, id: str):
        response = requests.get(f"{MALLOY_URL}{self.path}/{id}")
        if response.status_code != 200:
            raise Exception(f"Failed to get connection: {response.text}")
        return response.json()

    def create(
        self,
        name: str,
        type: str,
        **kwargs
    ):
        response = requests.post(
            f"{MALLOY_URL}{self.path}/{name}",
            json={
                "type": type,
                "name": name,
                "attributes": {
                    "dialectName": kwargs.get("dialectName" , 'default'),
                    "isPool": True,
                    "canPersist": True,
                    "canStream": True,
                },
                "postgresConnection": {
                    "host": kwargs.get("host"),
                    "port": kwargs.get("port"),
                    "databaseName": kwargs.get("databaseName"),
                    "userName": kwargs.get("userName"),
                    "password": kwargs.get("password"),
                } if type == "postgres" else None,

            },
        )
        if response.status_code != 201:
            raise Exception(f"Failed to create connection: {response.text}")
        return response.json()

    def update(
        self,
        id: str,
        name: str,
        description: str,
        type: str,
        host: str,
        port: int,
        username: str,
        password: str,
        namespace: str,
        schema: str,
        database: str,
    ):
        response = requests.put(
            f"{MALLOY_URL}{self.path}/{id}/{name}",
            json={
                "description": description,
                "type": type,
                "host": host,
                "port": port,
                "username": username,
                "password": password,
                "namespace": namespace,
                "schema": schema,
                "database": database,
            },
        )
        if response.status_code != 200:
            raise Exception(f"Failed to update connection: {response.text}")
        return response.json()

    def delete(self, id: str):
        response = requests.delete(f"{MALLOY_URL}{self.path}/{id}")
        if response.status_code != 200:
            raise Exception(f"Failed to delete connection: {response.text}")
        return response.json()

class MalloyPackage:
    def __init__(self, envid: str) -> None:
        self.envid = envid
        self.path = f"/api/v0/environments/{envid}/packages"
    
    def list(self):
        response = requests.get(f"{MALLOY_URL}{self.path}")
        if response.status_code != 200:
            raise Exception(f"Failed to list packages: {response.text}")
        return response.json()
    
    def get(self, id: str):
        response = requests.get(f"{MALLOY_URL}{self.path}/{id}")
        if response.status_code != 200:
            raise Exception(f"Failed to get package: {response.text}")
        return response.json()
    
    def create(self, name: str, description: str , auto_load_manifest: bool = False):
        response = requests.post(f"{MALLOY_URL}{self.path}", json={"name": name, "description": description , "location": "./packages/bi-models"} , params={"autoLoadManifest": auto_load_manifest})
        print(response.url)
        if response.status_code != 201:
            raise Exception(f"Failed to create package: {response.text}")
        return response.json()
    def update(self, id: str, name: str, description: str):
        response = requests.put(f"{MALLOY_URL}{self.path}/{id}", json={"name": name, "description": description})
        if response.status_code != 200:
            raise Exception(f"Failed to update package: {response.text}")
        return response.json()
    def delete(self, id: str):
        response = requests.delete(f"{MALLOY_URL}{self.path}/{id}")
        if response.status_code != 200:
            raise Exception(f"Failed to delete package: {response.text}")
        return response.json()

class MalloyModel:
    


class MalloyAPI:
    def __init__(self , envid: str) -> None:
        self.environment = MalloyEnvironment()
        self.connection = MalloyConnection(envid)
        self.package = MalloyPackage(envid)

if __name__ == "__main__":
    malloy = MalloyAPI(envid="test")
    # print(malloy.environment.list())
    # print(malloy.connection.list())
    # # print(malloy.connection.create(name="test4", type="postgres", host="host.docker.internal", port=5432, databaseName="bi_testing_db", userName="dev_admin", password="SecretPassword123"))
    # print(malloy.connection.get(id="test4"))
    # print(malloy.connection.delete(id="test4"))
    # print(malloy.connection.list())
    print(malloy.package.list())



    # print(malloy.connection.create(name="test4", type="postgres", host="host.docker.internal", port=5432, databaseName="bi_testing_db", userName="dev_admin", password="SecretPassword123"))

