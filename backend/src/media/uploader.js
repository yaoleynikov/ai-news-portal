import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';

let s3Client = null;

function getClient() {
  if (!s3Client) {
    if (!config.media.r2.endpoint) {
      throw new Error("R2 Endpoint configuration missing.");
    }
    s3Client = new S3Client({
      region: 'auto',
      endpoint: config.media.r2.endpoint,
      credentials: {
        accessKeyId: config.media.r2.accessKeyId,
        secretAccessKey: config.media.r2.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export async function uploadToR2(buffer, filename, mimeType = 'image/webp') {
  try {
    const client = getClient();
    
    const command = new PutObjectCommand({
      Bucket: config.media.r2.bucket,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
      // For images, we typically want them publicly readable depending on the R2 settings
      // Though R2 often manages public access via bucket policy or public domains.
    });

    await client.send(command);

    const fromEnv = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
    const fallback = `https://${config.media.r2.bucket}.r2.cloudflarestorage.com`;
    const publicUrlPrefix = fromEnv || fallback;
    if (!fromEnv) {
      console.warn(
        '[UPLOADER] R2_PUBLIC_URL не задан — в cover_url попадёт S3 API host (*.r2.cloudflarestorage.com), браузер часто не отдаёт объект. ' +
          'Укажите публичный URL бакета (R2 → Public access → r2.dev или свой домен), например https://pub-xxxx.r2.dev'
      );
    }
    const path = filename.startsWith('/') ? filename : `/${filename}`;
    return `${publicUrlPrefix.replace(/\/$/, '')}${path}`;
  } catch (err) {
    console.error(`[UPLOADER] Failed to upload ${filename}:`, err.message);
    throw err;
  }
}
