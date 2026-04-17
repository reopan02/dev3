from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr, computed_field, Field, AliasChoices
from typing import Optional
from pathlib import Path

_ROOT_ENV = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # === Generate Tool ===
    gemini_analyze_api_key: Optional[SecretStr] = Field(
        default=None,
        validation_alias=AliasChoices("gemini_analyze_api_key", "GEMINI_ANALYZE_API_KEY")
    )
    gemini_analyze_base_url: str = Field(
        default="https://yunwu.ai",
        validation_alias=AliasChoices("gemini_analyze_base_url", "GEMINI_ANALYZE_BASE_URL")
    )
    llm_model: str = Field(
        default="gemini-2.5-pro",
        validation_alias=AliasChoices("llm_model", "GEMINI_ANALYZE_MODEL", "gemini_analyze_model")
    )
    gemini_image_api_key: Optional[SecretStr] = Field(
        default=None,
        validation_alias=AliasChoices("gemini_image_api_key", "GEMINI_IMAGE_API_KEY")
    )
    gemini_image_base_url: str = Field(
        default="https://yunwu.ai",
        validation_alias=AliasChoices("gemini_image_base_url", "GEMINI_IMAGE_BASE_URL")
    )
    image_model: str = Field(
        default="gemini-3-pro-image-preview",
        validation_alias=AliasChoices("image_model", "GEMINI_IMAGE_MODEL", "gemini_image_model")
    )
    llm_temperature: float = 0.7
    llm_recognize_temperature: float = 0.3
    llm_timeout: int = 180

    # === Watermark Tool ===
    grok_api_key: Optional[SecretStr] = Field(
        default=None,
        validation_alias=AliasChoices("grok_api_key", "GROK_API_KEY")
    )
    grok_base_url: str = Field(
        default="https://yunwu.ai/v1",
        validation_alias=AliasChoices("grok_base_url", "GROK_BASE_URL")
    )
    grok_model: str = Field(
        default="grok-4.2-image",
        validation_alias=AliasChoices("grok_model", "GROK_MODEL")
    )

    # === Refer2Result Tool ===
    refer_base_url: str = Field(
        default="",
        validation_alias=AliasChoices("refer_base_url", "REFER_BASE_URL", "BASE_URL")
    )
    refer_image_api_key: Optional[SecretStr] = Field(
        default=None,
        validation_alias=AliasChoices("refer_image_api_key", "REFER_IMAGE_API_KEY")
    )
    refer_recognize_api_key: Optional[SecretStr] = Field(
        default=None,
        validation_alias=AliasChoices("refer_recognize_api_key", "REFER_RECOGNIZE_API_KEY")
    )
    refer_model: str = Field(
        default="gemini-3-pro-image-preview",
        validation_alias=AliasChoices("refer_model", "REFER_MODEL")
    )
    refer_recognize_model: str = Field(
        default="gemini-3.1-flash-lite-preview",
        validation_alias=AliasChoices("refer_recognize_model", "REFER_RECOGNIZE_MODEL")
    )

    # === Frontend Runtime Config ===
    frontend_generate_api_path: str = Field(
        default="/api/generate",
        validation_alias=AliasChoices("frontend_generate_api_path", "FRONTEND_GENERATE_API_PATH")
    )
    frontend_refer_api_path: str = Field(
        default="/api/refer",
        validation_alias=AliasChoices("frontend_refer_api_path", "FRONTEND_REFER_API_PATH")
    )
    frontend_watermark_api_path: str = Field(
        default="/api/watermark",
        validation_alias=AliasChoices("frontend_watermark_api_path", "FRONTEND_WATERMARK_API_PATH")
    )

    # === Server ===
    port: int = Field(default=8000, validation_alias=AliasChoices("port", "PORT"))
    host: str = Field(default="0.0.0.0", validation_alias=AliasChoices("host", "HOST"))

    @computed_field
    @property
    def analyze_openai_base_url(self) -> str:
        return f"{self.gemini_analyze_base_url}/v1"


def get_settings() -> Settings:
    return Settings()
