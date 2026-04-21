import { getGenerateApiBase } from './runtimeConfig';
import { getSeedreamApiBase } from './runtimeConfig';

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

export const generateImage = async (targetImageBase64, prompt, aspectRatio = '3:4', imageSize = '2K', model = 'gemini-3-pro-image-preview') => {
  const response = await fetch(`${getGenerateApiBase()}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_image: targetImageBase64, prompt, aspect_ratio: aspectRatio, image_size: imageSize, model }),
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
