import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticateUser } from '../../shared/auth.js';
import { success, error } from '../../shared/response.js';
import { getItem } from '../../shared/database.js';
import { TABLES } from '../../shared/database.js';
import { auditEvents } from '../../shared/audit.js';

// AWS_REGION is automatically provided by Lambda runtime
const s3Client = new S3Client({});
const BUCKET_NAME = process.env.USER_UPLOADS_BUCKET || 'sharepairs-dev-user-uploads';
const URL_EXPIRATION_SECONDS = parseInt(process.env.DOWNLOAD_URL_EXPIRATION || '900', 10); // Default 15 minutes

/**
 * Generate a presigned URL for downloading a file from S3
 * GET /files/{fileId}/download-url
 */
export const handler = async (event) => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);

    // Extract fileId from path parameters
    const fileId = event.pathParameters?.fileId;
    
    if (!fileId) {
      return error('Missing fileId in path', 400);
    }

    // Get file metadata from database
    const fileRecord = await getItem(TABLES.FILES, { id: fileId });

    if (!fileRecord) {
      return error('File not found', 404);
    }

    // Check if file is deleted
    if (fileRecord.status === 'deleted') {
      return error('File has been deleted', 404);
    }

    // Check permissions: user can only download their own files or files in conversations they're part of
    // For now, simple check: user can download their own files
    // TODO: Add conversation-based permission checks
    if (fileRecord.user_id !== user.userId && !user.isAdmin) {
      // Check if file is in a conversation the user is part of
      // This would require querying the conversations table
      // For now, only allow own files or admin access
      return error('Access denied', 403);
    }

    const fileKey = fileRecord.file_key;

    // Create S3 GetObject command
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey
    });

    // Generate presigned URL (expires in 15 minutes by default)
    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION_SECONDS
    });

    // Audit log: file download requested
    await auditEvents.fileDownloadRequested(user.userId, fileId, fileKey);

    return success({
      downloadUrl,
      fileName: fileRecord.file_name,
      contentType: fileRecord.content_type,
      fileSize: fileRecord.file_size,
      expiresIn: URL_EXPIRATION_SECONDS
    });
  } catch (err) {
    console.error('Error generating download URL:', err);
    
    if (err.message.includes('Authentication failed') || err.message.includes('Missing')) {
      return error(err.message, 401);
    }

    return error('Internal server error', 500);
  }
};

