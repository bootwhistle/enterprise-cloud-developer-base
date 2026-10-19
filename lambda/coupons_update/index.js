const AWS = require('aws-sdk');

const TABLE_NAME = process.env.COUPONS_TABLE || 'coupons';

// Fields a client is allowed to change. coupon_id is the key and comes from the path.
const UPDATABLE_FIELDS = [
  'title',
  'description',
  'coupon_code',
  'campaign_id',
  'provider_id',
  'provider_name',
  'start_date',
  'end_date'
];

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

function parseBody(event) {
  if (!event.body) return {};
  if (typeof event.body === 'object') return event.body;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  return JSON.parse(raw);
}

// PUT /coupons/{id} - updates the coupon whose coupon_id matches the path parameter "id"
exports.handler = async function(event) {
  const id = event && event.pathParameters ? event.pathParameters.id : undefined;

  if (!id) {
    return response(400, { message: 'Path parameter id is required' });
  }

  let changes;
  try {
    changes = parseBody(event);
  } catch (error) {
    return response(400, { message: 'Request body must be valid JSON' });
  }

  const fields = UPDATABLE_FIELDS.filter((field) => changes[field] !== undefined);

  if (fields.length === 0) {
    return response(400, { message: `Provide at least one of: ${UPDATABLE_FIELDS.join(', ')}` });
  }

  // e.g. SET #title = :title, #coupon_code = :coupon_code
  const params = {
    TableName: TABLE_NAME,
    Key: { coupon_id: id },
    UpdateExpression: 'SET ' + fields.map((field) => `#${field} = :${field}`).join(', '),
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: {},
    ConditionExpression: 'attribute_exists(coupon_id)',
    ReturnValues: 'ALL_NEW'
  };

  fields.forEach((field) => {
    params.ExpressionAttributeNames[`#${field}`] = field;
    params.ExpressionAttributeValues[`:${field}`] = changes[field];
  });

  const documentClient = new AWS.DynamoDB.DocumentClient({ endpoint: dynamoEndpoint() });

  try {
    const result = await documentClient.update(params).promise();
    return response(200, result.Attributes);
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return response(404, { message: `Coupon ${id} not found` });
    }
    console.error('Failed to update coupon', error);
    return response(500, { message: 'Failed to update coupon' });
  }
};
