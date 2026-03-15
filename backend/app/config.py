from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://recipes_user:recipes_pass@db:5432/recipes"
    SECRET_KEY: str = "super-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    OPENAI_API_KEY: str = ""
    USER1_NAME: str = "user1"
    USER1_PASSWORD: str = "password1"
    USER2_NAME: str = "user2"
    USER2_PASSWORD: str = "password2"

    class Config:
        env_file = ".env"

settings = Settings()
