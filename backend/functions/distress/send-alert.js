/**
 * Send distress alert (admin only)
 * POST /admin/distress-alert
 */

const { requireAdmin } = require('../../shared/auth');
const { TABLES, getItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');

// TODO: Integrate with SES or SNS for actual notification sending
// For now, just log and store the alert

exports.handler = async (event) => {
  try {
    const admin = await requireAdmin(event);
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.distressAlert, body);
    
    const { userId, level, message } = validatedData;
    
    // Verify user exists
    const user = await getItem(TABLES.users, { id: userId });
    
    if (!user) {
      return error('User not found', 404);
    }
    
    // Log distress alert (for HIPAA audit)
    console.log('Distress Alert:', {
      userId,
      userEmail: user.email,
      level,
      message,
      alertedBy: admin.userId,
      timestamp: new Date().toISOString()
    });
    
    // TODO: Store in distress_reports table when created
    // TODO: Send notification via SES/SNS
    
    // TODO: Send notification via SES/SNS
    // For now, we'll just return success
    // In production, you'd:
    // 1. Send email to support team
    // 2. Send SMS if configured
    // 3. Store alert in database for tracking
    
    return success({
      message: 'Distress alert sent',
      userId: userId,
      level: level,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Distress alert error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    if (err.message.includes('Admin access required')) {
      return error('Forbidden: Admin access required', 403);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400);
    }
    
    return error('Failed to send distress alert', 500);
  }
};

