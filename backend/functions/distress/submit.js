import { authenticateUser } from '../../shared/auth.js';
import { success, error } from '../../shared/response.js';
import { validate, schemas } from '../../shared/validation.js';
import { auditEvents } from '../../shared/audit.js';
import { putItem, query } from '../../shared/database.js';
import { TABLES } from '../../shared/database.js';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const sqsClient = new SQSClient({});
const DISTRESS_THRESHOLD = parseInt(process.env.DISTRESS_THRESHOLD || '70', 10); // Default 70
const RATE_LIMIT_MINUTES = parseInt(process.env.DISTRESS_RATE_LIMIT_MINUTES || '15', 10); // Default 15 minutes
const QUEUE_URL = process.env.DISTRESS_QUEUE_URL || '';

/**
 * Submit a distress alert
 * POST /distress
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

    const validated = validate(schemas.distressSubmit, body);
    const { score, message, context } = validated;

    // Validate score range
    if (score < 0 || score > 100) {
      return error('Score must be between 0 and 100', 400);
    }

    // Rate limiting: Check if user has submitted high-distress alert recently
    if (score >= DISTRESS_THRESHOLD) {
      const rateLimitWindow = Date.now() - (RATE_LIMIT_MINUTES * 60 * 1000);
      const recentAlerts = await query(TABLES.DISTRESS_EVENTS, {
        IndexName: 'user-index',
        KeyConditionExpression: 'user_id = :userId',
        FilterExpression: 'created_at > :window AND score >= :threshold',
        ExpressionAttributeValues: {
          ':userId': user.userId,
          ':window': rateLimitWindow,
          ':threshold': DISTRESS_THRESHOLD
        }
      });

      if (recentAlerts.length > 0) {
        return error(`Rate limit: Only one high-distress alert allowed per ${RATE_LIMIT_MINUTES} minutes`, 429);
      }
    }

    // Create distress event
    const eventId = crypto.randomUUID();
    const timestamp = Date.now();
    
    const distressEvent = {
      id: eventId,
      user_id: user.userId,
      score: score,
      message: message || null,
      context: context || null,
      status: score >= DISTRESS_THRESHOLD ? 'queued' : 'recorded', // Only queue if above threshold
      created_at: timestamp,
      updated_at: timestamp
    };

    // Write to database
    await putItem(TABLES.DISTRESS_EVENTS, distressEvent);

    // Audit log
    await auditEvents.distressSubmitted(user.userId, eventId, score, score >= DISTRESS_THRESHOLD);

    // If score >= threshold, enqueue to SQS for email notification
    if (score >= DISTRESS_THRESHOLD && QUEUE_URL) {
      try {
        const sqsMessage = {
          eventId,
          userId: user.userId,
          score,
          timestamp,
          message,
          context
        };

        const command = new SendMessageCommand({
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify(sqsMessage),
          MessageAttributes: {
            eventId: {
              DataType: 'String',
              StringValue: eventId
            },
            userId: {
              DataType: 'String',
              StringValue: user.userId
            },
            score: {
              DataType: 'Number',
              StringValue: score.toString()
            }
          }
        });

        await sqsClient.send(command);
      } catch (sqsError) {
        console.error('Failed to enqueue distress alert:', sqsError);
        // Don't fail the request - event is already recorded in DB
        // Update status to indicate queue failure
        await putItem(TABLES.DISTRESS_EVENTS, {
          ...distressEvent,
          status: 'queue_failed',
          queue_error: sqsError.message
        });
      }
    }

    return success({
      eventId,
      score,
      status: distressEvent.status,
      message: score >= DISTRESS_THRESHOLD 
        ? 'Distress alert submitted and notification queued'
        : 'Distress score recorded'
    });
  } catch (err) {
    console.error('Error submitting distress alert:', err);
    
    if (err.message.includes('Authentication failed') || err.message.includes('Missing')) {
      return error(err.message, 401);
    }
    
    if (err.message.includes('Validation error')) {
      return error(err.message, 400);
    }

    if (err.message.includes('Rate limit')) {
      return error(err.message, 429);
    }

    return error('Internal server error', 500);
  }
};

