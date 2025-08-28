import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://enescitak@localhost:5432/workorder_db"
    api_host: str = "0.0.0.0"
    api_port: int = 5002
    
    class Config:
        env_file = ".env"

settings = Settings()
