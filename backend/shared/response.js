/**
 * Standardized API response helpers
 */

const success = (data, statusCode = 200) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(data)
  };
};

const error = (message, statusCode = 400, details = null) => {
  const response = {
    error: message,
    message: message
  };
  
  if (details) {
    response.details = details;
  }
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(response)
  };
};

module.exports = {
  success,
  error
};

