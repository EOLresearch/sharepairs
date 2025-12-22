/**
 * Delete a file
 * DELETE /files/{fileKey}
 */

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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
    
    // Delete file from S3
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileKey
    });
    
    await s3Client.send(command);
    
    return success({
      message: 'File deleted successfully',
      fileKey: fileKey
    });
    
  } catch (err) {
    console.error('File delete error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    return error('Failed to delete file', 500);
  }
};

