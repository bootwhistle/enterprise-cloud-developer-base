#!/bin/bash

API_NAME="coupons"
REGION="us-east-1"
STAGE="local"
PATH_PART="coupons_poc"
FUNCTION_NAME="coupons_list"

function fail() {
  echo $2
  exit 1
}

echo "Retrieving Api id"
API_ID=$(awslocal apigateway get-rest-apis --region ${REGION} --query "items[?name==\`${API_NAME}\`].id" --output text)
[ $? == 0 ] && [ -n "${API_ID}" ] || fail 1 "Failed to retrieve Api id"
echo "Api id ${API_ID}"

echo "Retrieving root resource id"
ROOT_RESOURCE_ID=$(awslocal apigateway get-resources --rest-api-id ${API_ID} --query 'items[?path==`/`].id' --output text --region ${REGION})
[ $? == 0 ] || fail 2 "Failed to retrieve root resource id"
echo "Root resource id ${ROOT_RESOURCE_ID}"

echo "Creating /${PATH_PART} resource"
awslocal apigateway create-resource \
    --region ${REGION} \
    --rest-api-id ${API_ID} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "${PATH_PART}"
[ $? == 0 ] || fail 3 "Failed to create resource"

echo "Retrieving /${PATH_PART} resource id"
COUPONS_POC_RESOURCE_ID=$(awslocal apigateway get-resources --region ${REGION} --rest-api-id ${API_ID} --query "items[?path==\`/${PATH_PART}\`].id" --output text)
[ $? == 0 ] || fail 4 "Failed to retrieve resource id"
echo "/${PATH_PART} resource id ${COUPONS_POC_RESOURCE_ID}"

echo "Creating GET method for /${PATH_PART} resource"
awslocal apigateway put-method \
    --region ${REGION} \
    --rest-api-id ${API_ID} \
    --resource-id ${COUPONS_POC_RESOURCE_ID} \
    --http-method GET \
    --authorization-type "NONE"
[ $? == 0 ] || fail 5 "Failed to create GET method"

echo "Retrieving ${FUNCTION_NAME} lambda Arn"
COUPONS_LIST_LAMBDA_ARN=$(awslocal lambda list-functions --region ${REGION} --query "Functions[?FunctionName==\`${FUNCTION_NAME}\`].FunctionArn" --output text)
[ $? == 0 ] && [ -n "${COUPONS_LIST_LAMBDA_ARN}" ] || fail 6 "Failed to retrieve lambda ARN"
echo "${FUNCTION_NAME} lambda Arn ${COUPONS_LIST_LAMBDA_ARN}"

echo "Creating integration for ${FUNCTION_NAME}"
awslocal apigateway put-integration \
    --region ${REGION} \
    --rest-api-id ${API_ID} \
    --resource-id ${COUPONS_POC_RESOURCE_ID} \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${COUPONS_LIST_LAMBDA_ARN}/invocations \
    --passthrough-behavior WHEN_NO_MATCH
[ $? == 0 ] || fail 7 "Failed to create integration"

echo "Granting API Gateway permission to invoke ${FUNCTION_NAME}"
awslocal lambda add-permission \
    --region ${REGION} \
    --function-name "${FUNCTION_NAME}" \
    --statement-id "apigateway-get-${PATH_PART}" \
    --action "lambda:InvokeFunction" \
    --principal "apigateway.amazonaws.com" \
    --source-arn "arn:aws:execute-api:${REGION}:000000000000:${API_ID}/*/GET/${PATH_PART}"
[ $? == 0 ] || fail 8 "Failed to add invoke permission"

echo "Creating deployment"
awslocal apigateway create-deployment \
    --region ${REGION} \
    --rest-api-id ${API_ID} \
    --stage-name ${STAGE}
[ $? == 0 ] || fail 9 "Failed to create deployment"

ENDPOINT="http://${API_ID}.execute-api.localhost.localstack.cloud:4566/${STAGE}/${PATH_PART}"

echo "API URL: ${ENDPOINT}"
echo "API ID: ${API_ID}"

echo "GET /${PATH_PART} endpoint created successfully"
