// API Gateway (AWS_PROXY) expects { statusCode, headers, body } with body as a JSON string
exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Coupons API is working successfully'
    })
  };
};
