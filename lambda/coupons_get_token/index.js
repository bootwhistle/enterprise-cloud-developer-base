const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const USERS_TABLE = process.env.USERS_TABLE || 'users';
const JWT_SECRET = process.env.JWT_SECRET || '0HXc4w5NEzA61HkV';
const TOKEN_EXPIRES_IN = 3600; // seconds

// Inside LocalStack the lambda reaches DynamoDB through the LocalStack host;
// on real AWS neither variable is set and the SDK uses its default endpoint.
function dynamoEndpoint() {
  if (process.env.AWS_ENDPOINT_URL) return process.env.AWS_ENDPOINT_URL;
  if (process.env.LOCALSTACK_HOSTNAME) {
    return `http://${process.env.LOCALSTACK_HOSTNAME}:${process.env.EDGE_PORT || 4566}`;
  }
  return undefined;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

// API Gateway sends the request body as a string (base64 when isBase64Encoded);
// direct invokes may pass an object. Returns null when the body is not valid JSON.
function parseBody(event) {
  if (!event || event.body === undefined || event.body === null) return null;
  if (typeof event.body === 'object') return event.body;

  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

// POST /token - checks username/password against the users table (bcrypt hashes)
// and returns a signed JWT with its expiration time in seconds.
exports.handler = async function(event) {
  const body = parseBody(event);

  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    return response(400, { message: 'Request body must be JSON with username and password' });
  }

  const documentClient = new AWS.DynamoDB.DocumentClient({ endpoint: dynamoEndpoint() });

  let user;
  try {
    const result = await documentClient.get({
      TableName: USERS_TABLE,
      Key: { username: body.username }
    }).promise();
    user = result.Item;
  } catch (error) {
    console.error('Failed to read user', error);
    return response(500, { message: 'Failed to verify credentials' });
  }

  // Same 403 for an unknown user and a wrong password, so the response
  // doesn't reveal which usernames exist.
  const passwordMatches = user ? await bcrypt.compare(body.password, user.password) : false;
  if (!passwordMatches) {
    return response(403, { message: 'Invalid username or password' });
  }

  const token = jwt.sign({ sub: user.username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

  return response(200, { token, expiresIn: TOKEN_EXPIRES_IN });
};
