/**
 * Background Web Worker to compute SHA-256 hash of large files
 * without freezing the browser UI main thread.
 */
self.onmessage = async (e) => {
  const { file, fileId } = e.data;
  if (!file) {
    self.postMessage({ fileId, success: false, error: 'No file provided' });
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    self.postMessage({
      fileId,
      success: true,
      hash: hashHex,
      sizeBytes: file.size
    });
  } catch (err) {
    self.postMessage({
      fileId,
      success: false,
      error: err?.message || 'Error computing file hash'
    });
  }
};

