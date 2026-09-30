#!/bin/bash

FUNCTION_NAME="coupons_list"
ROLE_ARN="arn:aws:iam::000000000000:role/coupons_lambda_role"
RUNTIME="${LAMBDA_RUNTIME:-nodejs14.x}"

function fail() {
  echo $2
  exit 1
}

echo "Creating deployment package for ${FUNCTION_NAME} function"
# The handler has no runtime dependencies, so only index.js is packaged
# (node_modules only holds dev dependencies: jest/eslint).
PROJECT_DIR=$(pwd)
rm -f "${PROJECT_DIR}/${FUNCTION_NAME}.zip"
cd ./lambda/${FUNCTION_NAME}
zip -r "${PROJECT_DIR}/${FUNCTION_NAME}.zip" index.js
[ $? == 0 ] || fail 1 "Failed to create deployment package"
cd $PROJECT_DIR

echo "Creating ${FUNCTION_NAME} function"
awslocal lambda create-function \
    --function-name "${FUNCTION_NAME}" \
    --runtime "${RUNTIME}" \
    --zip-file fileb://${FUNCTION_NAME}.zip \
    --handler "index.handler" \
    --role "${ROLE_ARN}"
[ $? == 0 ] || fail 2 "Failed to create function"

echo "Waiting for ${FUNCTION_NAME} function to become active"
awslocal lambda wait function-active-v2 --function-name "${FUNCTION_NAME}"
[ $? == 0 ] || fail 3 "Function did not become active"

echo "${FUNCTION_NAME} function created successfully"
