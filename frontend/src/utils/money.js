/**
 * Currency & Text Formatting Utilities for Construction Financial Modules
 */

/**
 * Format a number into Indian Rupee (INR) representation.
 * Whole numbers omit decimal places (e.g. ₹ 1,25,000).
 * Decimals are preserved up to 2 decimal places (e.g. ₹ 1,250.50).
 *
 * @param {number|string} amount
 * @param {boolean} includeSymbol - Whether to prepend the ₹ symbol (default true)
 * @returns {string}
 */
export function formatINR(amount, includeSymbol = true) {
  const num = Number(amount);
  if (isNaN(num)) return includeSymbol ? '₹ 0' : '0';

  const isWhole = Math.abs(num - Math.round(num)) < 0.001;
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2
  });

  const formatted = formatter.format(num);
  return includeSymbol ? `₹ ${formatted}` : formatted;
}

/**
 * Pluralize a count with singular and plural forms.
 * E.g. plural(1, 'entry', 'entries') => '1 entry'
 *      plural(3, 'entry', 'entries') => '3 entries'
 *
 * @param {number} count
 * @param {string} singular
 * @param {string} pluralForm
 * @returns {string}
 */
export function plural(count, singular = 'entry', pluralForm = 'entries') {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Client-side image compression using HTML5 Canvas.
 * Scales down large smartphone camera photos (often 5-12MB) to max width/height
 * and re-encodes as JPEG 0.75 quality, bringing file size down to ~80-200KB.
 *
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @param {number} quality (0 to 1)
 * @returns {Promise<{ dataUrl: string, name: string, size: number }>}
 */
export function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    // If not an image, resolve with original base64
    if (!file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result, name: file.name, size: file.size });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ dataUrl: e.target.result, name: file.name, size: file.size });
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with specified quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Approximate byte size from base64 length
        const base64Length = compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1);
        const approxSize = Math.round((base64Length * 3) / 4);

        resolve({
          dataUrl: compressedDataUrl,
          name: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
          size: approxSize
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Format a number into short Indian Lakh / Crore form for dashboard KPI cards.
 * E.g. 14200000 => '₹ 1.42 Cr'
 *       8500000 => '₹ 85.0 L'
 *         25000 => '₹ 25 k'
 *
 * @param {number|string} amount
 * @param {boolean} includeSymbol
 * @returns {string}
 */
export function formatShortINR(amount, includeSymbol = true) {
  const num = Number(amount);
  if (isNaN(num) || num === 0) return includeSymbol ? '₹ 0' : '0';

  const prefix = includeSymbol ? '₹ ' : '';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 10000000) {
    const cr = (abs / 10000000).toFixed(2).replace(/\.00$/, '');
    return `${sign}${prefix}${cr} Cr`;
  }
  if (abs >= 100000) {
    const lk = (abs / 100000).toFixed(2).replace(/\.00$/, '');
    return `${sign}${prefix}${lk} L`;
  }
  if (abs >= 1000) {
    const k = (abs / 1000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${prefix}${k} k`;
  }

  return formatINR(num, includeSymbol);
}


