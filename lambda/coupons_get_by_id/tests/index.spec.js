const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const { handler } = require('../index.js');

const coupon = require('../../../samples/t2_coupons_get_by_id_response.json');

// Minimal API Gateway proxy event for GET /coupons/{id}
function apiGatewayEvent(id) {
  return {
    resource: '/coupons/{id}',
    path: `/coupons/${id}`,
    httpMethod: 'GET',
    headers: { Accept: 'application/json' },
    queryStringParameters: null,
    pathParameters: id === undefined ? null : { id },
    body: null,
    isBase64Encoded: false
  };
}

describe('Coupon get by id', () => {

  beforeAll(() => {
    AWSMock.setSDKInstance(AWS);
  });

  afterEach(() => {
    AWSMock.restore('DynamoDB.DocumentClient');
  });

  test('Should return the coupon matching the id', async () => {
    let requestedParams;
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      requestedParams = params;
      callback(null, { Item: coupon });
    });

    const response = await handler(apiGatewayEvent(coupon.coupon_id), null);

    expect(requestedParams).toStrictEqual({ TableName: 'coupons', Key: { coupon_id: coupon.coupon_id } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(response.body)).toStrictEqual(coupon);
  });

  test('Should return 404 when the coupon does not exist', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {});
    });

    const response = await handler(apiGatewayEvent('does-not-exist'), null);

    expect(response.statusCode).toBe(404);
  });

  test('Should return 400 when the id path parameter is missing', async () => {
    const response = await handler(apiGatewayEvent(undefined), null);

    expect(response.statusCode).toBe(400);
  });

  test('Should return 500 when DynamoDB fails', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(new Error('DynamoDB unavailable'));
    });

    const response = await handler(apiGatewayEvent(coupon.coupon_id), null);

    expect(response.statusCode).toBe(500);
  });
});
