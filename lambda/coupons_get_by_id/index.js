const AWS = require('aws-sdk');

const TABLE_NAME = process.env.COUPONS_TABLE || 'coupons';

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

// GET /coupons/{id} - returns the coupon whose coupon_id matches the path parameter "id"
exports.handler = async function(event) {
  const id = event && event.pathParameters ? event.pathParameters.id : undefined;

  if (!id) {
    return response(400, { message: 'Path parameter id is required' });
  }

  const documentClient = new AWS.DynamoDB.DocumentClient({ endpoint: dynamoEndpoint() });

  try {
    const result = await documentClient.get({
      TableName: TABLE_NAME,
      Key: { coupon_id: id }
    }).promise();

    if (!result.Item) {
      return response(404, { message: `Coupon ${id} not found` });
    }

    return response(200, result.Item);
  } catch (error) {
    console.error('Failed to get coupon', error);
    return response(500, { message: 'Failed to retrieve coupon' });
  }
};
