import { getGenerateApiBase, getSeedreamApiBase, getGptImage2ApiBase } from './runtimeConfig';

const SEEDREAM_MODELS = new Set(['doubao-seedream-5-0-260128'])

const SEEDREAM_SIZE_MAP = {
  '2K': {
    '1:1': '2048x2048', '4:3': '2304x1728', '3:4': '1728x2304',
    '16:9': '2848x1600', '9:16': '1600x2848', '3:2': '2496x1664',
    '2:3': '1664x2496', '21:9': '3136x1344',
  },
  '3K': {
    '1:1': '3072x3072', '4:3': '3456x2592', '3:4': '2592x3456',
    '16:9': '4096x2304', '9:16': '2304x4096', '3:2': '3744x2496',
    '2:3': '2496x3744', '21:9': '4704x2016',
  },
}

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateImage = async (targetImages, prompt, aspectRatio = '3:4', imageSize = '2K', model = 'gemini-3-pro-image-preview') => {
  const images = Array.isArray(targetImages) ? targetImages.filter(Boolean) : (targetImages ? [targetImages] : [])

  if (model === 'gpt-image-2') {
    const result = await generateGptImage2Image({
      prompt,
      images: images.length > 0 ? images : null,
      aspectRatio,
      imageSize,
    })
    const img = result.generated_image
    return { generated_image: img.includes(',') ? img.split(',')[1] : img }
  }

  if (SEEDREAM_MODELS.has(model)) {
    const sizeKey = imageSize === '3K' ? '3K' : '2K'
    const size = SEEDREAM_SIZE_MAP[sizeKey]?.[aspectRatio] || sizeKey
    const image = images.length === 0 ? null : images.length === 1 ? images[0] : images
    const result = await generateSeedreamImage({ prompt, image, size, outputFormat: 'png', watermark: false, model })
    const img = result.generated_image
    return { generated_image: img.includes(',') ? img.split(',')[1] : img }
  }

  // Gemini: single image only
  const targetImage = images[0] || null
  const response = await fetch(`${getGenerateApiBase()}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_image: targetImage, prompt, aspect_ratio: aspectRatio, image_size: imageSize, model }),
  });
  if (!response.ok) {
    let detail = '图片生成失败';
    try { const error = await response.json(); detail = error.detail || detail; } catch {}
    throw new Error(detail);
  }
  return response.json();
};

export const downloadBase64Image = (base64Data, filename = 'generated-image.png') => {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64Data}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const streamPost = async (url, body, onChunk, onDone, onError, signal) => {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError(err);
    return;
  }

  if (!response.ok) {
    let detail = '请求失败';
    try { const error = await response.json(); detail = error.detail || detail; } catch {}
    onError(new Error(detail));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.done === true) { onDone(); return; }
          if (parsed.error) { onError(new Error(parsed.error)); return; }
          if (parsed.content !== undefined) onChunk(parsed.content);
        } catch {}
      }
    }
    onDone();
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError(err);
  }
};

export const analyzeImageStream = (imageBase64, onChunk, onDone, onError, signal) =>
  streamPost(`${getGenerateApiBase()}/analyze`, { image: imageBase64 }, onChunk, onDone, onError, signal);

export const fusePromptStream = (analysisResult, productInfo, onChunk, onDone, onError, signal) =>
  streamPost(`${getGenerateApiBase()}/fuse-prompt`, { analysis_result: analysisResult, product_info: productInfo }, onChunk, onDone, onError, signal);

export const recognizeProductStream = (imageBase64, onChunk, onDone, onError, signal) =>
  streamPost(`${getGenerateApiBase()}/recognize-product`, { image: imageBase64 }, onChunk, onDone, onError, signal);

export const generateSeedreamImage = async ({
  prompt,
  image = null,
  size = '2K',
  outputFormat = 'png',
  watermark = false,
  model = null,
}) => {
  let response;
  try {
    response = await fetch(`${getSeedreamApiBase()}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image,
        size,
        output_format: outputFormat,
        response_format: 'b64_json',
        watermark,
        ...(model ? { model } : {}),
      }),
    });
  } catch (error) {
    throw new Error('无法连接 Seedream 服务，请确认前后端服务正在运行。');
  }

  if (!response.ok) {
    let detail = '豆包图片生成失败';
    try { const error = await response.json(); detail = error.detail || detail; } catch {}
    throw new Error(detail);
  }

  return response.json();
};

export const generateGptImage2Image = async ({
  prompt,
  images = null,
  aspectRatio = '1:1',
  imageSize = '1K',
  quality = 'auto',
  outputFormat = 'png',
}) => {
  let response;
  try {
    response = await fetch(`${getGptImage2ApiBase()}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        images: images && images.length > 0 ? images : null,
        aspect_ratio: aspectRatio,
        image_size: imageSize,
        quality,
        output_format: outputFormat,
      }),
    });
  } catch (error) {
    throw new Error('无法连接 GPT Image 2 服务，请确认前后端服务正在运行。');
  }

  if (!response.ok) {
    let detail = 'GPT Image 2 生成失败';
    try { const error = await response.json(); detail = error.detail || detail; } catch {}
    throw new Error(detail);
  }

  return response.json();
};
