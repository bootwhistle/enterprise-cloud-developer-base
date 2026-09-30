const { handler } = require('../index.js');
const expectedCoupons = require('../../../samples/t1_sample_coupons_list_response.json');

// Minimal API Gateway proxy event for GET /coupons_poc
const apiGatewayEvent = {
  resource: '/coupons_poc',
  path: '/coupons_poc',
  httpMethod: 'GET',
  headers: { Accept: 'application/json' },
  queryStringParameters: null,
  pathParameters: null,
  body: null,
  isBase64Encoded: false
};

describe('Coupon list', () => {

  test('Should return a 200 status code', async () => {
    const response = await handler(apiGatewayEvent, null);

    expect(response.statusCode).toBe(200);
  });

  test('Should return a JSON content type', async () => {
    const response = await handler(apiGatewayEvent, null);

    expect(response.headers['Content-Type']).toBe('application/json');
  });

  test('Should return the body as a JSON string', async () => {
    const response = await handler(apiGatewayEvent, null);

    expect(typeof response.body).toBe('string');
  });

  test('Should return the sample coupons list', async () => {
    const response = await handler(apiGatewayEvent, null);
    const responseParsed = JSON.parse(response.body);

    expect(responseParsed).toStrictEqual(expectedCoupons);
  });
});
