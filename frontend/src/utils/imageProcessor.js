
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * 验证图片格式和基本大小限制
 * @param {File} file 
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateImage = (file) => {
  if (!file) {
    return { valid: false, error: '未选择文件' };
  }
  
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: '不支持的文件格式 (支持 JPG, PNG, GIF, WebP)' };
  }

  // 这里的 50MB 是为了防止浏览器处理过大的文件导致崩溃
  // 实际上传限制会在 processImage 中处理到 10MB
  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: '原始文件过大，请上传小于 50MB 的图片' };
  }

  return { valid: true };
};

/**
 * 处理图片：调整尺寸和压缩
 * @param {File} file 
 * @returns {Promise<File>}
 */
export const processImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      const MAX_DIMENSION = 2048;
      let width = img.width;
      let height = img.height;

      // 如果尺寸在范围内且文件大小小于限制，直接返回原文件
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size <= MAX_FILE_SIZE) {
        resolve(file);
        return;
      }

      // 计算新尺寸
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      
      // 尝试压缩
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('图片处理失败'));
            return;
          }

          if (blob.size > MAX_FILE_SIZE) {
            // 如果仍然过大，尝试更低质量（仅针对JPEG/WebP）
            if (outputType !== 'image/png') {
              canvas.toBlob((blob2) => {
                if (blob2 && blob2.size <= MAX_FILE_SIZE) {
                  resolve(new File([blob2], file.name, { type: outputType, lastModified: Date.now() }));
                } else {
                  reject(new Error('无法将图片压缩到 10MB 以下，请尝试上传更小的图片'));
                }
              }, outputType, 0.6);
            } else {
              reject(new Error('图片过大且无法压缩 (PNG)，请尝试上传更小的图片'));
            }
          } else {
            resolve(new File([blob], file.name, { type: outputType, lastModified: Date.now() }));
          }
        },
        outputType,
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法加载图片'));
    };
  });
};
