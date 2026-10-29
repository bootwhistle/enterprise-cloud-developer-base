#!/bin/bash

FUNCTION_NAME="coupons_get_token"

function fail() {
  echo $2
  exit 1
}

# The package needs index.js plus its runtime dependencies: bcryptjs (password check) and jsonwebtoken (signing).
# node_modules in the lambda folder also holds jest/eslint, so production
# dependencies are installed into a clean build folder and zipped from there.
PROJECT_DIR=$(pwd)
BUILD_DIR="${PROJECT_DIR}/build/${FUNCTION_NAME}"

echo "Installing production dependencies for ${FUNCTION_NAME}"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cp ./lambda/${FUNCTION_NAME}/index.js ./lambda/${FUNCTION_NAME}/package.json ./lambda/${FUNCTION_NAME}/package-lock.json "${BUILD_DIR}/"
npm ci --omit=dev --prefix "${BUILD_DIR}"
[ $? == 0 ] || fail 1 "Failed to install dependencies"

echo "Creating deployment package for ${FUNCTION_NAME} function"
rm -f "${PROJECT_DIR}/${FUNCTION_NAME}.zip"
cd "${BUILD_DIR}"
zip -r "${PROJECT_DIR}/${FUNCTION_NAME}.zip" index.js node_modules
[ $? == 0 ] || fail 2 "Failed to create deployment package"
cd $PROJECT_DIR

echo "Updating ${FUNCTION_NAME} function code"
awslocal lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file fileb://${FUNCTION_NAME}.zip
[ $? == 0 ] || fail 3 "Failed to update function code"

echo "Waiting for ${FUNCTION_NAME} function update to finish"
awslocal lambda wait function-updated-v2 --function-name "${FUNCTION_NAME}"
[ $? == 0 ] || fail 4 "Function update did not finish"

echo "${FUNCTION_NAME} function updated successfully"
