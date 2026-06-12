import os
from abc import ABC, abstractmethod
import boto3
from botocore.exceptions import ClientError
import aiofiles
from io import BytesIO
from fastapi import HTTPException
from dotenv import load_dotenv
load_dotenv()


LOCAL_DIR = os.getenv("LOCAL_DIR", "./.local/")

# Abstract Base Class enforcing an identical code interface for both storage types
class BaseStorage(ABC):
    @abstractmethod
    async def upload_file(self, file: BytesIO,path: str,file_name : str ) -> str:
        """Uploads a file and returns its public path or URL string"""
        pass

    @abstractmethod
    async def delete_file(self, path: str,file_name : str ) -> bool:
        """Deletes a file from storage"""
        pass

    @abstractmethod
    async def get_file(self, path: str,file_name : str ) -> BytesIO:
        """Gets a file from storage"""
        pass

    @abstractmethod
    async def rollback_file(self, path: str,file_name : str ) -> bool:
        """Rollbacks a file from storage"""
        pass
    
    # @abstractmethod
    # async def copy_file(self, *args) -> bool:
    #     """Copies a file from storage"""
    #     pass

# ☁️ STRATEGY A: AWS S3 Storage Provider
class S3Storage(BaseStorage):
    def __init__(self):
        self.bucket_name = os.getenv("AWS_STORAGE_BUCKET_NAME")
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1")
        )

    # 🛠️ FIXED: Signature matched to BaseStorage abstract method
    async def upload_file(self, file: BytesIO, path: str,file_name : str ) -> str:
        s3_key = path + "/" + file_name
        # Note: In production, consider using aioboto3 to avoid blocking threads here
        self.s3_client.upload_fileobj(file, self.bucket_name, s3_key)
        # 🛠️ FIXED: Corrected URL schema template syntax
        return f"https://{self.bucket_name}.s3.{os.getenv('AWS_REGION', 'us-east-1')}://{s3_key}"

    async def delete_file(self, path: str,file_name : str ) -> bool:
        try:
            key = path + "/" + file_name
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError:
            return False

    async def get_file(self, path: str,file_name : str ) -> BytesIO:
        try:
            key = path + "/" + file_name
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            return BytesIO(response['Body'].read())
        except ClientError:
            return None

    async def rollback_file(self, path: str,file_name : str ) -> bool:
        try:
            key = path + "/" + file_name
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError:
            return False

    # async def copy_file(self, *args) -> bool:

    #     try:
    #         key = "/".join(args)
    #         self.s3_client.copy_object(Bucket=self.bucket_name, Key=destination_file, CopySource=source_file)
    #         return True
    #     except Exception as e:
    #         raise HTTPException(status_code=500, detail=f"Failed to copy file: {str(e)}")



# 💻 STRATEGY B: Local Machine Storage Provider
class LocalStorage(BaseStorage):
    def __init__(self):
        self.base_dir = LOCAL_DIR
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)

    async def upload_file(self, file: BytesIO, path: str, file_name: str) -> str:
        try:
            # Create target directory
            target_dir = os.path.join(self.base_dir, path)
            os.makedirs(target_dir, exist_ok=True)

            # Final file path
            file_path = os.path.join(target_dir, file_name)

            # Save file
            async with aiofiles.open(file_path, "wb") as out_file:
                await out_file.write(file.getvalue())

            return f"file://{file_path}"

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Local disk save failed: {str(e)}"
            )
    async def get_file(self, path: str,file_name : str ) -> BytesIO:
        file_path = os.path.join(self.base_dir, path + "/" + file_name)
        if os.path.exists(file_path):
            # 🛠️ FIXED: Used aiofiles to avoid blocking main execution threads on read
            async with aiofiles.open(file_path, 'rb') as f:
                content = await f.read()
            return BytesIO(content)
        return None

    async def rollback_file(self, path: str,file_name : str ) -> bool:
        file_path = os.path.join(self.base_dir, path + "/" + file_name)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False # 🛠️ FIXED: Return False explicitly instead of implicit None

    # 🛠️ FIXED: Arg parameter changed from 'folder' to 'path' to match standard base interface
    async def delete_file(self, path: str,file_name : str ) -> bool:
        file_path = os.path.join(self.base_dir, path + "/" + file_name)

        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False

    # async def copy_file(self, source_file: str, destination_file: str) -> bool:
    #     try:
    #         shutil.copy(source_file, destination_file)
    #         return True
    #     except Exception as e:
    #         raise HTTPException(status_code=500, detail=f"Failed to copy file: {str(e)}")

# 🏭 THE FACTORY CONTEXT ENGINE
def get_storage_provider() -> BaseStorage:
    has_s3_keys = all([
        os.getenv("AWS_ACCESS_KEY_ID"),
        os.getenv("AWS_SECRET_ACCESS_KEY"),
        os.getenv("AWS_STORAGE_BUCKET_NAME")
    ])
    
    if has_s3_keys:
        return S3Storage()
    return LocalStorage()

# Instantiated single client instance to reuse resource pools efficiently
storage = get_storage_provider()
