/**
 * Generate presigned URL for file upload
 * POST /files/upload
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { authenticateUser } = require('../../shared/auth');
const { success, error } = require('../../shared/response');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  try {
    const user = await authenticateUser(event);
    const body = JSON.parse(event.body || '{}');
    
    const { fileName, contentType } = body;
    
    if (!fileName) {
      return error('File name is required', 400);
    }
    
    // Generate S3 key (user-specific folder)
    const fileKey = `${user.userId}/${Date.now()}-${fileName}`;
    const bucketName = process.env.USER_UPLOADS_BUCKET || 'sharepairs-dev-user-uploads';
    
    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: contentType || 'application/octet-stream'
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    
    return success({
      uploadUrl: presignedUrl,
      fileKey: fileKey,
      expiresIn: 3600
    });
    
  } catch (err) {
    console.error('File upload error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    return error('Failed to generate upload URL', 500);
  }
};

