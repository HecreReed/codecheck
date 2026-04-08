import * as crypto from 'crypto';
import * as fs from 'fs';

export function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function isBinaryFile(source: string): boolean {
  // Check for null bytes or high concentration of non-printable chars
  let nonPrintable = 0;
  const sample = source.slice(0, 8000);
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
    if (code < 8 || (code > 13 && code < 32)) nonPrintable++;
  }
  return nonPrintable / sample.length > 0.1;
}

export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
