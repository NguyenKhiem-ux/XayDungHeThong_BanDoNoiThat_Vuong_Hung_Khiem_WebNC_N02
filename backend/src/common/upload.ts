// file cấu hình upload ảnh dùng chung: chỉ nhận jpg/png/webp và tự đặt đuôi file theo mimetype.
import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';

// SVG/HTML bị loại vì được phục vụ trên cùng domain API qua /uploads và có thể chứa script.
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export function imageUpload(folder: 'products' | 'avatars', maxBytes: number): MulterOptions {
  return {
    storage: diskStorage({
      destination: `./uploads/${folder}`,
      // Đuôi lấy từ mimetype đã kiểm tra, không lấy từ originalname do người dùng đặt.
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${IMAGE_EXTENSIONS[file.mimetype]}`),
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => IMAGE_EXTENSIONS[file.mimetype]
      ? cb(null, true)
      : cb(new BadRequestException('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'), false),
  };
}
