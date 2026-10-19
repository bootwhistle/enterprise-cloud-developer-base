const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const { handler } = require('../index.js');

const coupon = require('../../../samples/t2_coupons_get_by_id_response.json');

// Minimal API Gateway proxy event for PUT /coupons/{id}
function apiGatewayEvent(id, body) {
  return {
    resource: '/coupons/{id}',
    path: `/coupons/${id}`,
    httpMethod: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    queryStringParameters: null,
    pathParameters: id === undefined ? null : { id },
    body: body === undefined ? null : body,
    isBase64Encoded: false
  };
}

describe('Coupon update', () => {

  beforeAll(() => {
    AWSMock.setSDKInstance(AWS);
  });

  afterEach(() => {
    AWSMock.restore('DynamoDB.DocumentClient');
  });

  test('Should update the coupon and return the new version', async () => {
    let requestedParams;
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      requestedParams = params;
      callback(null, { Attributes: { ...coupon, title: 'Save 25% on Fairmont hotels', coupon_code: 'SAVE25' } });
    });

    const body = JSON.stringify({ title: 'Save 25% on Fairmont hotels', coupon_code: 'SAVE25' });
    const response = await handler(apiGatewayEvent(coupon.coupon_id, body), null);

    expect(requestedParams.TableName).toBe('coupons');
    expect(requestedParams.Key).toStrictEqual({ coupon_id: coupon.coupon_id });
    expect(requestedParams.UpdateExpression).toBe('SET #title = :title, #coupon_code = :coupon_code');
    expect(requestedParams.ExpressionAttributeValues).toStrictEqual({ ':title': 'Save 25% on Fairmont hotels', ':coupon_code': 'SAVE25' });
    expect(requestedParams.ConditionExpression).toBe('attribute_exists(coupon_id)');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).coupon_code).toBe('SAVE25');
  });

  test('Should ignore fields that are not allowed to change', async () => {
    let requestedParams;
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      requestedParams = params;
      callback(null, { Attributes: coupon });
    });

    const body = JSON.stringify({ coupon_id: 'hacked', title: 'New title' });
    await handler(apiGatewayEvent(coupon.coupon_id, body), null);

    expect(requestedParams.UpdateExpression).toBe('SET #title = :title');
  });

  test('Should return 404 when the coupon does not exist', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      const error = new Error('The conditional request failed');
      error.code = 'ConditionalCheckFailedException';
      callback(error);
    });

    const response = await handler(apiGatewayEvent('does-not-exist', JSON.stringify({ title: 'x' })), null);

    expect(response.statusCode).toBe(404);
  });

  test('Should return 400 when the id path parameter is missing', async () => {
    const response = await handler(apiGatewayEvent(undefined, JSON.stringify({ title: 'x' })), null);

    expect(response.statusCode).toBe(400);
  });

  test('Should return 400 when the body is not valid JSON', async () => {
    const response = await handler(apiGatewayEvent(coupon.coupon_id, '{not json'), null);

    expect(response.statusCode).toBe(400);
  });

  test('Should return 400 when the body has no updatable fields', async () => {
    const response = await handler(apiGatewayEvent(coupon.coupon_id, JSON.stringify({ foo: 'bar' })), null);

    expect(response.statusCode).toBe(400);
  });
});
