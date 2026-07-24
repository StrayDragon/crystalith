import {
  SOURCE_UPLOAD_SUPPORTED_EXTENSIONS,
  SOURCE_UPLOAD_SUPPORTED_MIME_TYPES,
} from '../../../shared/uploadTypes';

export function splitUploadFiles(files: File[]) {
  const supported: File[] = [];
  const unsupported: File[] = [];

  files.forEach((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const type = (file.type || '').toLowerCase();
    const isSupported =
      SOURCE_UPLOAD_SUPPORTED_EXTENSIONS.has(extension) ||
      SOURCE_UPLOAD_SUPPORTED_MIME_TYPES.has(type);

    if (isSupported) {
      supported.push(file);
    } else {
      unsupported.push(file);
    }
  });

  return { supported, unsupported };
}
