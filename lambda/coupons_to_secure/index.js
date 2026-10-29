const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '0HXc4w5NEzA61HkV';

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

// Header names are case-insensitive, and API Gateway passes them through as the client sent them.
function bearerToken(event) {
  const headers = (event && event.headers) || {};
  const name = Object.keys(headers).find((key) => key.toLowerCase() === 'authorization');
  const value = name ? headers[name] : undefined;

  if (typeof value !== 'string') return null;

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// GET /coupons/to_secure - only answers when the request carries a valid token
// from POST /token in the "Authorization: Bearer <token>" header.
exports.handler = async function(event) {
  const token = bearerToken(event);

  if (!token) {
    return response(403, { message: 'Missing bearer token' });
  }

  try {
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    return response(200, {
      message: 'Token is valid, access granted',
      username: claims.sub
    });
  } catch (error) {
    // TokenExpiredError, JsonWebTokenError (bad signature, malformed token) all end here
    return response(403, { message: `Token validation failed: ${error.message}` });
  }
};
