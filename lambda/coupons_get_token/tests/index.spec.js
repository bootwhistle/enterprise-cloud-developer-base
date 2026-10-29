const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const jwt = require('jsonwebtoken');
const { handler } = require('../index.js');

const credentials = require('../../../samples/t3_sample_coupons_get_token_event.json');

// Same item the bootstrap puts in the users table (bcrypt, 12 rounds)
const tester1 = {
  username: 'tester1',
  password: '$2a$12$wCqYSCDDoHdlUCI7rBBHO..c4KleiSzZqH8NXMHdLIcLsVxFmvG7C'
};

const SECRET = '0HXc4w5NEzA61HkV';

// Minimal API Gateway proxy event for POST /token
function apiGatewayEvent(body) {
  return {
    resource: '/token',
    path: '/token',
    httpMethod: 'POST',
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false
  };
}

function mockUsersTable(item) {
  let requestedParams;
  AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
    requestedParams = params;
    callback(null, item ? { Item: item } : {});
  });
  return () => requestedParams;
}

describe('Coupon get token', () => {

  // bcrypt with 12 rounds takes a moment in pure JS
  jest.setTimeout(20000);

  beforeAll(() => {
    AWSMock.setSDKInstance(AWS);
  });

  afterEach(() => {
    AWSMock.restore('DynamoDB.DocumentClient');
  });

  test('Should return a signed token and expiration for valid credentials', async () => {
    const requestedParams = mockUsersTable(tester1);

    const response = await handler(apiGatewayEvent(credentials), null);
    const body = JSON.parse(response.body);

    expect(requestedParams()).toStrictEqual({ TableName: 'users', Key: { username: 'tester1' } });
    expect(response.statusCode).toBe(200);
    expect(body.expiresIn).toBe(3600);

    const claims = jwt.verify(body.token, SECRET);
    expect(claims.sub).toBe('tester1');
    expect(claims.exp - claims.iat).toBe(3600);
  });

  test('Should return 403 when the password is wrong', async () => {
    mockUsersTable(tester1);

    const response = await handler(apiGatewayEvent({ username: 'tester1', password: 'wrong-password' }), null);

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).token).toBeUndefined();
  });

  test('Should return 403 when the user does not exist', async () => {
    mockUsersTable(null);

    const response = await handler(apiGatewayEvent({ username: 'nobody', password: 'Pc4RM0AMKy5aSGfD' }), null);

    expect(response.statusCode).toBe(403);
  });

  test('Should return 400 when the body is not valid JSON', async () => {
    const response = await handler(apiGatewayEvent('{not json'), null);

    expect(response.statusCode).toBe(400);
  });

  test('Should return 400 when username or password is missing', async () => {
    const response = await handler(apiGatewayEvent({ username: 'tester1' }), null);

    expect(response.statusCode).toBe(400);
  });

  test('Should return 500 when DynamoDB fails', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(new Error('DynamoDB unavailable'));
    });

    const response = await handler(apiGatewayEvent(credentials), null);

    expect(response.statusCode).toBe(500);
  });
});
