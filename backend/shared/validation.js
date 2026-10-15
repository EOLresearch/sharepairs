import Joi from 'joi';
import { isLocalEnv } from './env.js';

/**
 * Validation schemas for API requests
 */

/** Cognito-aligned password: 8+ chars, upper, lower, number, symbol */
const studyPasswordSchema = Joi.string()
  .min(8)
  .max(256)
  .pattern(/[a-z]/)
  .pattern(/[A-Z]/)
  .pattern(/[0-9]/)
  .pattern(/[^A-Za-z0-9]/)
  .required()
  .messages({
    'string.pattern.base': 'Password must include uppercase, lowercase, number, and symbol',
    'string.min': 'Password must be at least 8 characters',
  });

/** Local: any non-empty password (e.g. 123) */
const localPasswordSchema = Joi.string().min(1).max(256).required();

/** Local: user1 or user1@local or a real email */
const localIdentitySchema = Joi.string().trim().min(1).max(320).required();

function isAtLeast18(birthDateStr) {
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 18;
}

function registerSchema() {
  const local = isLocalEnv();
  return Joi.object({
    email: local ? localIdentitySchema : Joi.string().email().required().max(320),
    password: local ? localPasswordSchema : studyPasswordSchema,
    displayName: Joi.string().trim().min(1).max(100).optional().allow(''),
    preferredLanguage: Joi.string().valid('en').optional(),
    timezone: Joi.string().max(64).optional(),
    photoURL: Joi.string().max(500).allow('').optional(),
    country: Joi.string().max(100).allow('').optional(),
    residence: Joi.string().max(100).allow('').optional(),
    birthDate: local
      ? Joi.string().max(32).allow('').optional()
      : Joi.string()
          .required()
          .custom((value, helpers) => {
            if (!isAtLeast18(value)) {
              return helpers.error('any.invalid');
            }
            return value;
          })
          .messages({ 'any.invalid': 'Must be 18 or older' }),
    race: Joi.string().max(100).allow('').optional(),
    ethnicity: Joi.string().max(100).allow('').optional(),
    bioSex: Joi.string().max(100).allow('').optional(),
    education: Joi.string().max(100).allow('').optional(),
    household: Joi.string().max(100).allow('').optional(),
    hobbies: Joi.string().max(2000).allow('').optional(),
    lossDate: Joi.string().max(32).allow('').optional(),
    kinship: Joi.string().max(100).allow('').optional(),
    cause: Joi.string().max(100).allow('').optional(),
    deceasedAge: Joi.alternatives().try(Joi.number(), Joi.string().max(10)).optional(),
    lossExp: Joi.string().max(5000).allow('').optional(),
    consent: Joi.boolean().optional(),
    inviteCode: Joi.string().trim().max(64).allow('').optional(),
    isAdmin: Joi.any().optional(),
    admin: Joi.any().optional(),
    cssrsIntake: Joi.string().valid('Yes', 'No').optional(),
    inqResponses: Joi.object()
      .pattern(/^inq_([1-9]|1[0-5])$/, Joi.string().valid('1', '2', '3', '4', '5', '6', '7'))
      .optional(),
  }).unknown(true);
}

export const schemas = {
  uploadUrlRequest: Joi.object({
    fileName: Joi.string().required().max(255),
    contentType: Joi.string().required().max(100),
    fileSize: Joi.number().integer().min(1).max(50 * 1024 * 1024).optional(),
  }),

  downloadUrlRequest: Joi.object({
    fileId: Joi.string().required(),
  }),

  distressSubmit: Joi.object({
    score: Joi.number().integer().min(0).max(100).required(),
    message: Joi.string().max(1000).optional().allow(null, ''),
    context: Joi.object().optional().allow(null),
  }),

  get register() {
    return registerSchema();
  },

  get changePassword() {
    const local = isLocalEnv();
    return Joi.object({
      currentPassword: Joi.string().min(1).max(256).required(),
      newPassword: local ? localPasswordSchema : studyPasswordSchema,
    });
  },

  verifyEmail: Joi.object({
    code: Joi.string().pattern(/^\d{6}$/).required().messages({
      'string.pattern.base': 'Verification code must be 6 digits',
    }),
    email: Joi.string().max(320).optional(),
  }),
};

/**
 * Validate request body against schema
 */
export function validate(schema, data) {
  const { error, value } = schema.validate(data, { abortEarly: false });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }));
    throw new Error(`Validation error: ${details.map((d) => d.message).join(', ')}`);
  }

  return value;
}
