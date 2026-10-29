const jwt = require('jsonwebtoken');
const { handler } = require('../index.js');

const SECRET = '0HXc4w5NEzA61HkV';

// Minimal API Gateway proxy event for GET /coupons/to_secure
function apiGatewayEvent(headers) {
  return {
    resource: '/coupons/to_secure',
    path: '/coupons/to_secure',
    httpMethod: 'GET',
    headers,
    pathParameters: null,
    body: null,
    isBase64Encoded: false
  };
}

describe('Coupon to secure', () => {

  test('Should return 200 for a valid bearer token', async () => {
    const token = jwt.sign({ sub: 'tester1' }, SECRET, { expiresIn: 3600 });

    const response = await handler(apiGatewayEvent({ Authorization: `Bearer ${token}` }), null);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).username).toBe('tester1');
  });

  test('Should accept a lowercase authorization header', async () => {
    const token = jwt.sign({ sub: 'tester2' }, SECRET, { expiresIn: 3600 });

    const response = await handler(apiGatewayEvent({ authorization: `Bearer ${token}` }), null);

    expect(response.statusCode).toBe(200);
  });

  test('Should return 403 when the Authorization header is missing', async () => {
    const response = await handler(apiGatewayEvent({ Accept: 'application/json' }), null);

    expect(response.statusCode).toBe(403);
  });

  test('Should return 403 when the header is not a bearer token', async () => {
    const response = await handler(apiGatewayEvent({ Authorization: 'Basic dGVzdGVyMTpwYXNz' }), null);

    expect(response.statusCode).toBe(403);
  });

  test('Should return 403 when the token is signed with another secret', async () => {
    const token = jwt.sign({ sub: 'tester1' }, 'not-the-real-secret', { expiresIn: 3600 });

    const response = await handler(apiGatewayEvent({ Authorization: `Bearer ${token}` }), null);

    expect(response.statusCode).toBe(403);
  });

  test('Should return 403 when the token has expired', async () => {
    const issuedTwoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    const token = jwt.sign({ sub: 'tester1', iat: issuedTwoHoursAgo }, SECRET, { expiresIn: 3600 });

    const response = await handler(apiGatewayEvent({ Authorization: `Bearer ${token}` }), null);

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).message).toMatch(/expired/);
  });

  test('Should return 403 when the token is malformed', async () => {
    const response = await handler(apiGatewayEvent({ Authorization: 'Bearer not.a.token' }), null);

    expect(response.statusCode).toBe(403);
  });
});
