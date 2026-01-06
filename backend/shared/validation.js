import Joi from 'joi';

/**
 * Validation schemas for API requests
 */

export const schemas = {
  // File upload URL request
  uploadUrlRequest: Joi.object({
    fileName: Joi.string().required().max(255),
    contentType: Joi.string().required().max(100),
    fileSize: Joi.number().integer().min(1).max(50 * 1024 * 1024).optional() // Max 50MB
  }),

  // File download URL request (no body, just path param)
  downloadUrlRequest: Joi.object({
    fileId: Joi.string().required()
  }),

  // Distress alert submission
  distressSubmit: Joi.object({
    score: Joi.number().integer().min(0).max(100).required(),
    message: Joi.string().max(1000).optional().allow(null, ''),
    context: Joi.object().optional().allow(null)
  })
};

/**
 * Validate request body against schema
 */
export function validate(schema, data) {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const details = error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    }));
    throw new Error(`Validation error: ${details.map(d => d.message).join(', ')}`);
  }
  
  return value;
}

