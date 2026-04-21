from pydantic import BaseModel, Field
from typing import List, Optional, Union


class AnalyzeRequest(BaseModel):
    image: str = Field(..., description="Base64编码的图片数据")


class GenerateRequest(BaseModel):
    target_image: Optional[str] = Field(default=None)
    prompt: str = Field(...)
    aspect_ratio: Optional[str] = Field(default="1:1")
    image_size: Optional[str] = Field(default="1K")
    model: Optional[str] = Field(default="gemini-3-pro-image-preview")


class GenerateResponse(BaseModel):
    generated_image: str
    status: str = "success"


class ErrorResponse(BaseModel):
    error: str
    status: str = "error"


class FusePromptRequest(BaseModel):
    analysis_result: str
    product_info: str


class RecognizeProductRequest(BaseModel):
    image: str


class SeedreamGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    image: Optional[Union[str, List[str]]] = Field(default=None)
    size: Optional[str] = Field(default="2K")
    output_format: Optional[str] = Field(default="png")
    response_format: Optional[str] = Field(default="b64_json")
    watermark: Optional[bool] = Field(default=False)


class SeedreamGenerateResponse(BaseModel):
    generated_image: str
    status: str = "success"
