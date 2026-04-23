import base64
import io
from typing import List, Optional

import httpx

from config import Settings


GPT_IMAGE2_SIZE_MAP = {
    '1:1':  '1024x1024',
    '4:3':  '1536x1024',
    '3:4':  '1024x1536',
    '16:9': '1536x1024',
    '9:16': '1024x1536',
    '3:2':  '1536x1024',
    '2:3':  '1024x1536',
    '21:9': '1536x1024',
}

GPT_IMAGE2_SIZE_MAP_2K = {
    '1:1':  '2048x2048',
    '4:3':  '2048x1152',
    '3:4':  '1152x2048',
    '16:9': '2048x1152',
    '9:16': '1152x2048',
    '3:2':  '2048x1152',
    '2:3':  '1152x2048',
    '21:9': '2048x1152',
}

GPT_IMAGE2_SIZE_MAP_4K = {
    '1:1':  '3840x2160',
    '4:3':  '3840x2160',
    '3:4':  '2160x3840',
    '16:9': '3840x2160',
    '9:16': '2160x3840',
    '3:2':  '3840x2160',
    '2:3':  '2160x3840',
    '21:9': '3840x2160',
}


def map_size(aspect_ratio: str, image_size: str) -> str:
    if image_size == '4K':
        return GPT_IMAGE2_SIZE_MAP_4K.get(aspect_ratio, '3840x2160')
    if image_size == '2K':
        return GPT_IMAGE2_SIZE_MAP_2K.get(aspect_ratio, '2048x2048')
    return GPT_IMAGE2_SIZE_MAP.get(aspect_ratio, '1024x1024')


def _decode_image(img_data: str):
    """Return (bytes, mime, ext) from a data URL or raw base64 string."""
    mime = 'image/png'
    raw = img_data
    if ',' in raw:
        header, raw = raw.split(',', 1)
        if ':' in header and ';' in header:
            mime = header.split(':')[1].split(';')[0]
    ext = mime.split('/')[-1]
    if ext == 'jpeg':
        ext = 'jpg'
    return base64.b64decode(raw), mime, ext


class GptImage2Client:
    def __init__(self, settings: Settings):
        self.base_url = settings.doubao_base_url.rstrip('/')
        self.api_key = settings.doubao_api_key.get_secret_value() if settings.doubao_api_key else ''

    def _auth_header(self) -> dict:
        return {'Authorization': f'Bearer {self.api_key}'}

    def _base(self) -> str:
        return self.base_url if self.base_url.endswith('/v1') else f'{self.base_url}/v1'

    async def generate_text_to_image(
        self,
        prompt: str,
        aspect_ratio: str = '1:1',
        image_size: str = '1K',
        quality: str = 'auto',
        output_format: str = 'png',
        n: int = 1,
    ) -> str:
        payload = {
            'model': 'gpt-image-2',
            'prompt': prompt,
            'size': map_size(aspect_ratio, image_size),
            'quality': quality,
            'format': output_format,
            'n': n,
        }
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f'{self._base()}/images/generations',
                headers={**self._auth_header(), 'Content-Type': 'application/json'},
                json=payload,
            )
            if not resp.is_success:
                raise httpx.HTTPStatusError(
                    f'HTTP {resp.status_code}: {resp.text}', request=resp.request, response=resp
                )
            return await self._extract_b64(resp.json())

    async def edit_with_images(
        self,
        prompt: str,
        images: List[str],
        aspect_ratio: str = '1:1',
        image_size: str = '1K',
        quality: str = 'auto',
        n: int = 1,
    ) -> str:
        files = []
        for i, img_data in enumerate(images):
            img_bytes, mime, ext = _decode_image(img_data)
            files.append(('image', (f'image_{i}.{ext}', io.BytesIO(img_bytes), mime)))

        data = {
            'model': 'gpt-image-2',
            'prompt': prompt,
            'size': map_size(aspect_ratio, image_size),
            'quality': quality,
            'n': str(n),
        }
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f'{self._base()}/images/edits',
                headers=self._auth_header(),
                data=data,
                files=files,
            )
            if not resp.is_success:
                raise httpx.HTTPStatusError(
                    f'HTTP {resp.status_code}: {resp.text}', request=resp.request, response=resp
                )
            return await self._extract_b64(resp.json())

    async def _extract_b64(self, result: dict) -> str:
        data = result.get('data', [])
        if not data:
            raise ValueError(f'API 响应中未找到图像数据: {result}')
        item = data[0]
        b64 = item.get('b64_json', '')
        if b64:
            return b64
        url = item.get('url', '')
        if url:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.get(url)
                r.raise_for_status()
                return base64.b64encode(r.content).decode()
        raise ValueError(f'API 响应中未找到图像 (b64_json/url): {result}')
