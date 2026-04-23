import traceback

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from config import get_settings
from services.gptimage2_client import GptImage2Client

router = APIRouter(prefix="/api/gptimage2", tags=["gptimage2"])

_settings = get_settings()

try:
    _client = GptImage2Client(_settings)
except Exception as e:
    print(f"[gptimage2] Warning: client not initialized: {e}")
    _client = None


def _require_client():
    if _client is None or not _client.api_key:
        raise HTTPException(status_code=503, detail="GPT Image 2 not configured: check DOUBAO_API_KEY")


class GptImage2GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    images: Optional[List[str]] = Field(default=None)
    aspect_ratio: Optional[str] = Field(default="1:1")
    image_size: Optional[str] = Field(default="1K")
    quality: Optional[str] = Field(default="auto")
    output_format: Optional[str] = Field(default="png")


class GptImage2GenerateResponse(BaseModel):
    generated_image: str
    status: str = "success"


def _to_data_url(b64: str, fmt: str) -> str:
    mime = "jpeg" if fmt == "jpeg" else ("webp" if fmt == "webp" else "png")
    if b64.startswith("data:image/"):
        return b64
    return f"data:image/{mime};base64,{b64}"


@router.post("/generate", response_model=GptImage2GenerateResponse)
async def generate_gptimage2(request: GptImage2GenerateRequest):
    _require_client()
    try:
        if request.images:
            b64 = await _client.edit_with_images(
                prompt=request.prompt,
                images=request.images,
                aspect_ratio=request.aspect_ratio,
                image_size=request.image_size,
                quality=request.quality,
            )
        else:
            b64 = await _client.generate_text_to_image(
                prompt=request.prompt,
                aspect_ratio=request.aspect_ratio,
                image_size=request.image_size,
                quality=request.quality,
                output_format=request.output_format,
            )
        return GptImage2GenerateResponse(
            generated_image=_to_data_url(b64, request.output_format or "png")
        )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        body = e.response.text
        print(f"[gptimage2] API HTTP error {e.response.status_code}: {body}")
        raise HTTPException(status_code=500, detail=f"GPT Image 2 API 错误 {e.response.status_code}: {body}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"GPT Image 2 生成失败: {str(e)}")
