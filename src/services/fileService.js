import { apiPost, apiGet } from '../api';

/**
 * Request a presigned upload URL for S3.
 * Backend: POST /files/upload-url
 */
export async function getUploadUrl({ fileName, contentType, fileSize }) {
  if (!fileName || !contentType) {
    throw new Error('fileName and contentType are required');
  }
  return apiPost('/files/upload-url', {
    fileName,
    contentType,
    fileSize,
  });
}

/**
 * High-level helper: upload a browser File/Blob using a presigned URL.
 * - Calls getUploadUrl to register the file and obtain the presigned S3 URL.
 * - Performs a PUT directly to S3 (no auth headers).
 * Returns file metadata from the backend (including fileId) on success.
 */
export async function uploadFile(file, { signal } = {}) {
  if (!file) {
    throw new Error('file is required');
  }

  const contentType = file.type || 'application/octet-stream';
  const fileName = file.name || 'upload';
  const fileSize = typeof file.size === 'number' ? file.size : undefined;

  const { uploadUrl, fileId, fileKey, expiresIn } = await getUploadUrl({
    fileName,
    contentType,
    fileSize,
  });

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: file,
    signal,
  });

  if (!res.ok) {
    const err = new Error(`Upload failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return {
    fileId,
    fileKey,
    expiresIn,
    fileName,
    contentType,
    fileSize,
  };
}

/**
 * Request a presigned download URL for a previously uploaded file.
 * Backend: GET /files/{fileId}/download-url
 */
export async function getDownloadUrl(fileId) {
  if (!fileId) {
    throw new Error('fileId is required');
  }
  return apiGet(`/files/${encodeURIComponent(fileId)}/download-url`);
}

/**
 * Convenience helper: resolve a direct download URL for a fileId.
 * Returns the presigned URL string so callers can use it in <a href>, window.open, etc.
 */
export async function resolveDownloadUrl(fileId) {
  const meta = await getDownloadUrl(fileId);
  return meta?.downloadUrl;
}

