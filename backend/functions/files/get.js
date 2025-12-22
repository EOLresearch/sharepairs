/**
 * Generate presigned URL for file download
 * GET /files/{fileKey}
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { authenticateUser } = require('../../shared/auth');
const { success, error } = require('../../shared/response');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  try {
    const user = await authenticateUser(event);
    const fileKey = decodeURIComponent(event.pathParameters?.fileKey || '');
    
    if (!fileKey) {
      return error('File key is required', 400);
    }
    
    // Verify user owns the file (fileKey starts with userId/)
    if (!fileKey.startsWith(`${user.userId}/`)) {
      return error('Access denied', 403);
    }
    
    const bucketName = process.env.USER_UPLOADS_BUCKET || 'sharepairs-dev-user-uploads';
    
    // Create presigned URL for download
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    
    return success({
      downloadUrl: presignedUrl,
      fileKey: fileKey,
      expiresIn: 3600
    });
    
  } catch (err) {
    console.error('File get error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    if (err.name === 'NoSuchKey') {
      return error('File not found', 404);
    }
    
    return error('Failed to generate download URL', 500);
  }
};

