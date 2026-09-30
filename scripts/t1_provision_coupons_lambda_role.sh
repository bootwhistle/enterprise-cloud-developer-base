#!/bin/bash

ROLE_NAME="coupons_lambda_role"
POLICY_NAME="coupons_lambda_policy"
ACCOUNT_ID="000000000000"

function fail() {
  echo $2
  exit 1
}

echo "Creating ${POLICY_NAME} policy (CloudWatch: /aws/lambda/coupons*, DynamoDB: coupons table)"
awslocal iam create-policy \
  --policy-name "${POLICY_NAME}" \
  --policy-document file://scripts/coupons_lambda_role_policy.json
[ $? == 0 ] || fail 1 "Failed to create ${POLICY_NAME} policy"

echo "Creating ${ROLE_NAME} role for lambda functions"
awslocal iam create-role \
  --role-name "${ROLE_NAME}" \
  --assume-role-policy-document file://scripts/coupons_lambda_role_assume_role_policy.json
[ $? == 0 ] || fail 2 "Failed to create ${ROLE_NAME} role"

echo "Attaching ${POLICY_NAME} policy to ${ROLE_NAME} role"
awslocal iam attach-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
[ $? == 0 ] || fail 3 "Failed to attach policy to role"

echo "${ROLE_NAME} role created successfully"
