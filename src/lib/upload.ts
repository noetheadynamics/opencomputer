/**
 * Upload utilities — file upload handling with progress tracking.
 */

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileType(filename: string): 'file' | 'image' | 'code' | 'document' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'toml', 'sh', 'bash', 'sql', 'rb', 'php'];
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'];

  if (imageExts.includes(ext)) return 'image';
  if (codeExts.includes(ext)) return 'code';
  if (docExts.includes(ext)) return 'document';
  return 'file';
}

export function createFilePreview(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    } else {
      resolve(undefined);
    }
  });
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ id: string; name: string; type: string; size: number; url?: string; content?: string; thumbnail?: string }> {
  const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const fileType = getFileType(file.name);
  const thumbnail = await createFilePreview(file);

  if (fileType === 'code' || (fileType === 'file' && file.size < 100000)) {
    const content = await readFileAsText(file, onProgress);
    return { id, name: file.name, type: fileType, size: file.size, content, thumbnail };
  }

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
  return { id, name: file.name, type: fileType, size: file.size, thumbnail };
}

function readFileAsText(file: File, onProgress?: (progress: UploadProgress) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
      }
    };
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
