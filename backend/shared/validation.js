/**
 * Request validation using Joi
 */

const Joi = require('joi');

const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    displayName: Joi.string().min(2).max(100).required(),
    preferredLanguage: Joi.string().valid('en', 'tr').default('en'),
    timezone: Joi.string().default('UTC')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
  }),

  updateProfile: Joi.object({
    displayName: Joi.string().min(2).max(100).optional(),
    preferredLanguage: Joi.string().valid('en', 'tr').optional(),
    timezone: Joi.string().optional()
  }),

  sendMessage: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    clientMessageId: Joi.string().optional()
  }),

  createConversation: Joi.object({
    userId1: Joi.string().uuid().required(),
    userId2: Joi.string().uuid().required()
  }),

  distressAlert: Joi.object({
    userId: Joi.string().uuid().required(),
    level: Joi.number().integer().min(1).max(10).required(),
    message: Joi.string().optional()
  })
};

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
  }
  
  return value;
};

module.exports = {
  schemas,
  validate
};

