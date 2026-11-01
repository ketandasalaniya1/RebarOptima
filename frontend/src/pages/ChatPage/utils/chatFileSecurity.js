/**
 * Chat File Security & Validation Helper
 * Ensures files uploaded to chat:
 * 1. Are individual files, NOT directories/folders.
 * 2. Do not contain dangerous executables or scripts (.exe, .bat, .sh, .vbs, .dll, etc.).
 * 3. Do not exceed the safe file size limit (15MB) to prevent browser memory exhaustion,
 *    MongoDB 16MB document limit rejection, or server crashes.
 */

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 Megabytes
export const MAX_FILE_SIZE_LABEL = '15 MB';

export const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.php', '.dll', '.scr',
  '.msi', '.jar', '.jsp', '.py', '.com', '.pif', '.reg', '.app',
  '.dmg', '.bin', '.iso', '.apk', '.wsf', '.cpl', '.gadget', '.hta'
];

// Allowed accept string for input file elements (strictly files, no folders)
export const CHAT_FILE_ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.zip,.txt,.csv';

export function validateChatFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // 1. Check for folder/directory selection
  // Folders selected/dragged into browser typically have 0 size and empty mime type without a valid extension
  if (file.size === 0 && file.type === '' && !file.name.includes('.')) {
    return {
      valid: false,
      error: `Folder selection is not permitted. Please select files only.`,
    };
  }

  const name = file.name || '';
  const lowerName = name.toLowerCase();

  // 2. Block dangerous executables and scripts
  const isDangerous = BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (isDangerous) {
    return {
      valid: false,
      error: `Security Alert: "${name}" cannot be uploaded. Executable and script files (.exe, .bat, etc.) are blocked for server and account safety.`,
    };
  }

  // 3. Block executable MIME types
  const lowerType = (file.type || '').toLowerCase();
  if (
    lowerType.includes('executable') ||
    lowerType.includes('x-msdownload') ||
    lowerType.includes('x-sh') ||
    lowerType.includes('x-bat')
  ) {
    return {
      valid: false,
      error: `Security Alert: "${name}" is an executable file and cannot be uploaded.`,
    };
  }

  // 4. File size check to prevent server / memory crashes
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File "${name}" exceeds the size limit (${sizeMB} MB). Maximum allowed size is ${MAX_FILE_SIZE_LABEL} to ensure server stability.`,
    };
  }

  return { valid: true };
}
