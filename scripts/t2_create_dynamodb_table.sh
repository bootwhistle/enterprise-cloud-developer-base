#!/bin/bash

# Capacity planning (provisioned mode, 1 KB average item size):
#   Reads : 1 RCU = 2 eventually consistent reads/s of up to 4 KB
#           50 eventually consistent reads/s x 1 KB -> 50 / 2 = 25 RCU
#   Writes: 1 WCU = 1 write/s of up to 1 KB
#           10 writes/s x 1 KB                     -> 10 WCU
TABLE_NAME="coupons"
READ_CAPACITY=25
WRITE_CAPACITY=10

function fail() {
  echo $2
  exit 1
}

echo "Creating DynamoDB table ${TABLE_NAME}"
awslocal dynamodb create-table \
    --table-name "${TABLE_NAME}" \
    --attribute-definitions AttributeName=coupon_id,AttributeType=S \
    --key-schema AttributeName=coupon_id,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=${READ_CAPACITY},WriteCapacityUnits=${WRITE_CAPACITY}
[ $? == 0 ] || fail 1 "Failed to create DynamoDB table"

echo "Waiting for ${TABLE_NAME} table to become active"
awslocal dynamodb wait table-exists --table-name "${TABLE_NAME}"
[ $? == 0 ] || fail 2 "Table did not become active"

echo "Adding sample coupon to ${TABLE_NAME}"
awslocal dynamodb put-item \
    --table-name "${TABLE_NAME}" \
    --item '{
      "coupon_id":     {"S": "319326de971100158f6fa0daeec978fba1f17e4b"},
      "title":         {"S": "Save 20% on Fairmont hotels"},
      "description":   {"S": "Save 20% on Fairmont hotels when you book your stay through December 2022"},
      "coupon_code":   {"S": "SAVE20"},
      "campaign_id":   {"S": "CHRISTMAS2022"},
      "provider_id":   {"S": "FAIRMONT"},
      "provider_name": {"S": "Fairmont Hotels and Resorts"},
      "start_date":    {"S": "1669852800"},
      "end_date":      {"S": "1672444800"}
    }'
[ $? == 0 ] || fail 3 "Failed to add sample coupon"

echo "${TABLE_NAME} table created successfully"
