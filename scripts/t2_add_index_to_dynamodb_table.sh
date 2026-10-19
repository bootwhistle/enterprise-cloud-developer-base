#!/bin/bash

# Global secondary index so coupons can be queried by provider and campaign
# (e.g. "all FAIRMONT coupons in the CHRISTMAS2022 campaign") without a table scan.
TABLE_NAME="coupons"
INDEX_NAME="provider_id-campaign_id-index"
READ_CAPACITY=25
WRITE_CAPACITY=10

function fail() {
  echo $2
  exit 1
}

echo "Adding index ${INDEX_NAME} to ${TABLE_NAME} table"
awslocal dynamodb update-table \
    --table-name "${TABLE_NAME}" \
    --attribute-definitions \
        AttributeName=provider_id,AttributeType=S \
        AttributeName=campaign_id,AttributeType=S \
    --global-secondary-index-updates "[
      {
        \"Create\": {
          \"IndexName\": \"${INDEX_NAME}\",
          \"KeySchema\": [
            {\"AttributeName\": \"provider_id\", \"KeyType\": \"HASH\"},
            {\"AttributeName\": \"campaign_id\", \"KeyType\": \"RANGE\"}
          ],
          \"Projection\": {\"ProjectionType\": \"ALL\"},
          \"ProvisionedThroughput\": {\"ReadCapacityUnits\": ${READ_CAPACITY}, \"WriteCapacityUnits\": ${WRITE_CAPACITY}}
        }
      }
    ]"
[ $? == 0 ] || fail 1 "Failed to add index"

echo "Waiting for ${TABLE_NAME} table to become active"
awslocal dynamodb wait table-exists --table-name "${TABLE_NAME}"
[ $? == 0 ] || fail 2 "Table did not become active"

echo "Index ${INDEX_NAME} added successfully"
