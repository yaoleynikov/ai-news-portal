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

    // If you have a custom domain attached to R2, you'd construct the URL like this:
    // This assumes the bucket is public or mapped to a custom domain.
    // In production, configure the public URL prefix in .env.
    const publicUrlPrefix = process.env.R2_PUBLIC_URL || `https://${config.media.r2.bucket}.r2.cloudflarestorage.com`;
    return `${publicUrlPrefix}/${filename}`;
  } catch (err) {
    console.error(`[UPLOADER] Failed to upload ${filename}:`, err.message);
    throw err;
  }
}
