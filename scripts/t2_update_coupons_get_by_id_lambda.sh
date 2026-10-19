#!/bin/bash

FUNCTION_NAME="coupons_get_by_id"

function fail() {
  echo $2
  exit 1
}

echo "Creating deployment package for ${FUNCTION_NAME} function"
# aws-sdk (v2) is provided by the nodejs14.x runtime and node_modules only holds
# dev dependencies (jest/eslint/aws-sdk-mock), so only index.js is packaged.
PROJECT_DIR=$(pwd)
rm -f "${PROJECT_DIR}/${FUNCTION_NAME}.zip"
cd ./lambda/${FUNCTION_NAME}
zip -r "${PROJECT_DIR}/${FUNCTION_NAME}.zip" index.js
[ $? == 0 ] || fail 1 "Failed to create deployment package"
cd $PROJECT_DIR

echo "Updating ${FUNCTION_NAME} function code"
awslocal lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file fileb://${FUNCTION_NAME}.zip
[ $? == 0 ] || fail 2 "Failed to update function code"

echo "Waiting for ${FUNCTION_NAME} function update to finish"
awslocal lambda wait function-updated-v2 --function-name "${FUNCTION_NAME}"
[ $? == 0 ] || fail 3 "Function update did not finish"

echo "${FUNCTION_NAME} function updated successfully"
