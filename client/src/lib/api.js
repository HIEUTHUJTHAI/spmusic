export async function api(path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...rest,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'Máy chủ trả về dữ liệu không hợp lệ.' }));
  if (!response.ok)
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || data.message || 'Không thể hoàn tất thao tác.',
    );
  return data;
}
export function upload(path, formData, onProgress, method = 'POST') {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, '/api' + path);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Mất kết nối. Vui lòng thử lại.'));
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error('Phản hồi máy chủ không hợp lệ.'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else
        reject(
          new Error(
            typeof data.error === 'string'
              ? data.error
              : data.error?.message || data.message || 'Tải lên thất bại.',
          ),
        );
    };
    xhr.send(formData);
  });
}
