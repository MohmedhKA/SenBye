import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = crypto.randomUUID();
    cb(null, `${id}${ext}`);
  },
});

export const uploadPhotos = multer({
  storage,
  limits: {
    fileSize: config.rules.maxPhotoSize,
    files: config.rules.maxPhotos,
  },
  fileFilter: (_req, file, cb) => {
    if ((config.rules.allowedPhotoMimes as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'VALIDATION', 'Invalid image type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});
