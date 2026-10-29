#!/bin/bash

# LocalStack-only workaround - not needed on real AWS.
#
# LocalStack 2.3.2 picks the FIRST matching API Gateway resource in creation
# order instead of preferring a literal path over a path parameter. The
# bootstrap creates /coupons/{id} before /coupons/to_secure (and the other
# /coupons/* resources), so GET /coupons/to_secure was routed to
# coupons_get_by_id with id = "to_secure".
#
# This script deletes /coupons/{id} and recreates it, with the same GET and
# PUT methods and integrations as the bootstrap, so it becomes the LAST
# resource and every literal /coupons/* path is matched first. Run it once
# after the bootstrap.

REGION="us-east-1"
STAGE="local"

function fail() {
  echo $2
  exit 1
}

API_ID=$(awslocal apigateway get-rest-apis --region ${REGION} --query "items[?name==\`coupons\`].id" --output text)
[ -n "${API_ID}" ] || fail 1 "coupons API not found - run the bootstrap first"

COUPONS_RESOURCE_ID=$(awslocal apigateway get-resources --region ${REGION} --rest-api-id ${API_ID} --query 'items[?path==`/coupons`].id' --output text)
OLD_ID_RESOURCE_ID=$(awslocal apigateway get-resources --region ${REGION} --rest-api-id ${API_ID} --query 'items[?path==`/coupons/{id}`].id' --output text)

if [ -n "${OLD_ID_RESOURCE_ID}" ]; then
  echo "Deleting /coupons/{id} resource ${OLD_ID_RESOURCE_ID}"
  awslocal apigateway delete-resource --region ${REGION} --rest-api-id ${API_ID} --resource-id ${OLD_ID_RESOURCE_ID}
  [ $? == 0 ] || fail 2 "Failed to delete resource"
fi

echo "Recreating /coupons/{id} resource"
COUPONS_ID_RESOURCE_ID=$(awslocal apigateway create-resource \
    --region ${REGION} \
    --rest-api-id ${API_ID} \
    --parent-id ${COUPONS_RESOURCE_ID} \
    --path-part "{id}" \
    --query 'id' --output text)
[ $? == 0 ] || fail 3 "Failed to create resource"

for METHOD_AND_LAMBDA in "GET coupons_get_by_id" "PUT coupons_update"; do
  set -- ${METHOD_AND_LAMBDA}
  HTTP_METHOD=$1
  FUNCTION_NAME=$2

  echo "Creating ${HTTP_METHOD} /coupons/{id} -> ${FUNCTION_NAME}"
  awslocal apigateway put-method \
      --region ${REGION} \
      --rest-api-id ${API_ID} \
      --resource-id ${COUPONS_ID_RESOURCE_ID} \
      --request-parameters method.request.path.id=true \
      --http-method ${HTTP_METHOD} \
      --authorization-type "NONE" > /dev/null
  [ $? == 0 ] || fail 4 "Failed to create ${HTTP_METHOD} method"

  LAMBDA_ARN=$(awslocal lambda list-functions --region ${REGION} --query "Functions[?FunctionName==\`${FUNCTION_NAME}\`].FunctionArn" --output text)

  awslocal apigateway put-integration \
      --region ${REGION} \
      --rest-api-id ${API_ID} \
      --resource-id ${COUPONS_ID_RESOURCE_ID} \
      --http-method ${HTTP_METHOD} \
      --type AWS_PROXY \
      --integration-http-method POST \
      --uri arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations \
      --passthrough-behavior WHEN_NO_MATCH > /dev/null
  [ $? == 0 ] || fail 5 "Failed to create ${HTTP_METHOD} integration"
done

echo "Redeploying stage ${STAGE}"
awslocal apigateway create-deployment --region ${REGION} --rest-api-id ${API_ID} --stage-name ${STAGE} > /dev/null
[ $? == 0 ] || fail 6 "Failed to create deployment"

echo "Route order fixed: /coupons/{id} is now matched after the literal /coupons/* paths"
