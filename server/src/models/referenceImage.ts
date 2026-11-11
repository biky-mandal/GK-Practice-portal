import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

const MAX_IMAGE_BYTES = 512 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32;
const MESSAGE = 'Reference image must be a PNG, JPEG or WebP image up to 512 KB.';

export const referenceImageSchema = z.string().max(MAX_DATA_URL_LENGTH, MESSAGE).refine((value) => {
  if (value.length > MAX_DATA_URL_LENGTH) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return false;
  switch (match[1]) {
    case 'png':
      return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'jpeg':
      return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case 'webp':
      return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    default:
      return false;
  }
}, MESSAGE).nullable().optional();

export const validateReferenceImage = (value: unknown): string | null | undefined => {
  const result = referenceImageSchema.safeParse(value);
  if (!result.success) throw new ApiError(400, MESSAGE);
  return result.data;
};
