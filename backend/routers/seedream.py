import base64
import re

from fastapi import APIRouter, HTTPException, status

from config import get_settings
from models.schemas import SeedreamGenerateRequest, SeedreamGenerateResponse
from services.doubao_client import DoubaoClient
from services.gemini_client import GeminiClient

router = APIRouter(prefix="/api/seedream", tags=["seedream"])
_SIZE_PATTERN = re.compile(r"^(\d+)x(\d+)$")

_settings = get_settings()

try:
    _doubao_client = DoubaoClient(_settings)
    _gemini_client = GeminiClient(_settings)
except Exception as e:
    print(f"[seedream] Warning: clients not initialized: {e}")
    _doubao_client = None
    _gemini_client = None


def _require_clients():
    if _doubao_client is None or _gemini_client is None or not _doubao_client.api_key:
        raise HTTPException(status_code=503, detail="Seedream tool not configured: check DOUBAO_API_KEY")


def _validate_seedream_size(size: str):
    if size in {"2K", "3K"}:
        return

    match = _SIZE_PATTERN.match(size)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="size 仅支持 2K、3K 或宽x高格式，例如 1728x2304",
        )

    width = int(match.group(1))
    height = int(match.group(2))
    total_pixels = width * height
    ratio = width / height

    if total_pixels < 2560 * 1440 or total_pixels > int(3072 * 3072 * 1.1025):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="size 像素总量超出文档允许范围",
        )

    if ratio < (1 / 16) or ratio > 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="size 宽高比超出文档允许范围",
        )


def _to_data_url(image_base64: str, output_format: str) -> str:
    mime_subtype = "jpeg" if output_format == "jpeg" else "png"
    if image_base64.startswith("data:image/"):
        return image_base64
    return f"data:image/{mime_subtype};base64,{image_base64}"


@router.post("/generate", response_model=SeedreamGenerateResponse)
async def generate_seedream_image(request: SeedreamGenerateRequest):
    _require_clients()

    if request.image:
        images = request.image if isinstance(request.image, list) else [request.image]
        for image in images:
            is_valid, error_msg = _gemini_client.validate_image_base64(image)
            if not is_valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    _validate_seedream_size(request.size)

    if request.output_format not in {"png", "jpeg"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="output_format 仅支持 png 或 jpeg")

    if request.response_format != "b64_json":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="response_format 目前仅支持 b64_json")

    try:
        generated_image = await _doubao_client.generate_image(
            prompt=request.prompt,
            image=request.image,
            size=request.size,
            output_format=request.output_format,
            response_format=request.response_format,
            watermark=request.watermark,
            model=request.model,
        )
        if isinstance(generated_image, bytes):
            generated_image = base64.b64encode(generated_image).decode("utf-8")
        return SeedreamGenerateResponse(
            generated_image=_to_data_url(generated_image, request.output_format)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"豆包图片生成失败: {str(e)}")
