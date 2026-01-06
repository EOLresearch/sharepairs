import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticateUser } from '../../shared/auth.js';
import { success, error } from '../../shared/response.js';
import { validate, schemas } from '../../shared/validation.js';
import { auditEvents } from '../../shared/audit.js';
import { putItem } from '../../shared/database.js';
import { TABLES } from '../../shared/database.js';
import crypto from 'crypto';

// AWS_REGION is automatically provided by Lambda runtime
const s3Client = new S3Client({});
const BUCKET_NAME = process.env.USER_UPLOADS_BUCKET || 'sharepairs-dev-user-uploads';
const URL_EXPIRATION_SECONDS = parseInt(process.env.UPLOAD_URL_EXPIRATION || '600', 10); // Default 10 minutes

/**
 * Generate a presigned URL for uploading a file to S3
 * POST /files/upload-url
 */
export const handler = async (event) => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);

    // Parse and validate request body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return error('Invalid JSON in request body', 400);
    }

    const validated = validate(schemas.uploadUrlRequest, body);
    const { fileName, contentType, fileSize } = validated;

    // Generate file key: uploads/{userId}/{uuid}.{ext}
    const fileExtension = fileName.split('.').pop() || '';
    const fileId = crypto.randomUUID();
    const fileKey = `uploads/${user.userId}/${fileId}.${fileExtension}`;

    // Create S3 PutObject command
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      // Add metadata for tracking
      Metadata: {
        userId: user.userId,
        fileName: fileName,
        uploadedAt: new Date().toISOString()
      }
    });

    // Generate presigned URL (expires in 10 minutes by default)
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION_SECONDS
    });

    // Store file metadata in database for tracking
    const fileRecord = {
      id: fileId,
      user_id: user.userId,
      file_key: fileKey,
      file_name: fileName,
      content_type: contentType,
      file_size: fileSize || null,
      status: 'pending', // pending -> uploaded -> deleted
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await putItem(TABLES.FILES, fileRecord);

    // Audit log: file upload requested
    await auditEvents.fileUploadRequested(user.userId, fileKey, fileName, contentType);

    return success({
      uploadUrl,
      fileId,
      fileKey,
      expiresIn: URL_EXPIRATION_SECONDS
    });
  } catch (err) {
    console.error('Error generating upload URL:', err);
    
    if (err.message.includes('Authentication failed') || err.message.includes('Missing')) {
      return error(err.message, 401);
    }
    
    if (err.message.includes('Validation error')) {
      return error(err.message, 400);
    }

    return error('Internal server error', 500);
  }
};

