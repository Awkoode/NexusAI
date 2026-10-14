"""Central configuration for the NexusAI ML service (loaded from environment)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    SERVICE_NAME: str = "nexusai-ml"
    SERVICE_VERSION: str = "0.1.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"

    # Shared secret expected on internal requests (X-ML-Service-Key header).
    ML_SERVICE_KEY: str = "dev-ml-service-key"

    # Safety limits for training workloads.
    MAX_TRAIN_ROWS: int = 200_000
    MAX_TRAIN_COLUMNS: int = 200
    MAX_FEATURES: int = 100


settings = Settings()
