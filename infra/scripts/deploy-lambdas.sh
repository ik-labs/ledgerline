#!/usr/bin/env bash
# Deploy the Ledgerline drainer + roll-up Lambdas and wire their triggers.
# Re-runnable: skips/updates resources that already exist.
set -uo pipefail

# ---- config -------------------------------------------------------------
ACCOUNT="904907793501"
REGION="us-east-1"
CLUSTER_ID="ijt4jtjkn7oxftooklnuliggna"
CLUSTER_ARN="arn:aws:dsql:${REGION}:${ACCOUNT}:cluster/${CLUSTER_ID}"
DSQL_ENDPOINT="${CLUSTER_ID}.dsql.${REGION}.on.aws"
QUEUE_ARN="arn:aws:sqs:${REGION}:${ACCOUNT}:ledgerline-usage-events"
RUNTIME="nodejs22.x"
LAMBDA_ROLE="ledgerline-lambda-role"
SCHED_ROLE="ledgerline-scheduler-role"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-}"   # optional

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENVVARS="Variables={DSQL_ENDPOINT=${DSQL_ENDPOINT},DSQL_DATABASE=postgres,DSQL_USER=admin${SNS_TOPIC_ARN:+,SNS_TOPIC_ARN=${SNS_TOPIC_ARN}}}"

say() { printf '\n=== %s ===\n' "$1"; }

# ---- 1. Lambda execution role ------------------------------------------
say "Lambda execution role"
aws iam create-role --role-name "$LAMBDA_ROLE" --region "$REGION" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  2>/dev/null && echo "created" || echo "exists"

aws iam attach-role-policy --role-name "$LAMBDA_ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null
aws iam attach-role-policy --role-name "$LAMBDA_ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole 2>/dev/null

# Inline policy: connect to DSQL as admin + publish SNS.
aws iam put-role-policy --role-name "$LAMBDA_ROLE" --policy-name ledgerline-dsql-sns \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"dsql:DbConnectAdmin\",\"Resource\":\"${CLUSTER_ARN}\"},{\"Effect\":\"Allow\",\"Action\":\"sns:Publish\",\"Resource\":\"*\"}]}" 2>/dev/null
echo "inline policy set"

LAMBDA_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${LAMBDA_ROLE}"
echo "waiting for role to propagate..."; sleep 12

# ---- 2. package + deploy a function -------------------------------------
deploy_fn() {
  local name="$1" dir="$2" timeout="$3"
  say "Package $name"
  ( cd "$dir" && rm -rf node_modules function.zip && npm install --omit=dev --silent && zip -qr function.zip index.mjs node_modules package.json )

  if aws lambda get-function --function-name "$name" --region "$REGION" >/dev/null 2>&1; then
    echo "updating code + config"
    aws lambda update-function-code --function-name "$name" --region "$REGION" \
      --zip-file "fileb://${dir}/function.zip" >/dev/null
    aws lambda wait function-updated --function-name "$name" --region "$REGION"
    aws lambda update-function-configuration --function-name "$name" --region "$REGION" \
      --timeout "$timeout" --environment "$ENVVARS" >/dev/null
  else
    echo "creating function"
    aws lambda create-function --function-name "$name" --region "$REGION" \
      --runtime "$RUNTIME" --handler index.handler --role "$LAMBDA_ROLE_ARN" \
      --timeout "$timeout" --memory-size 256 \
      --environment "$ENVVARS" \
      --zip-file "fileb://${dir}/function.zip" >/dev/null
  fi
  aws lambda wait function-active-v2 --function-name "$name" --region "$REGION" 2>/dev/null
  echo "$name ready"
}

deploy_fn "ledgerline-drainer" "${ROOT}/infra/lambdas/drainer" 60
deploy_fn "ledgerline-rollup"  "${ROOT}/infra/lambdas/rollup"  120

# ---- 3. SQS -> drainer trigger -----------------------------------------
say "SQS event source mapping -> drainer"
if aws lambda list-event-source-mappings --function-name ledgerline-drainer --region "$REGION" \
     --query 'EventSourceMappings[?EventSourceArn==`'"$QUEUE_ARN"'`].UUID' --output text 2>/dev/null | grep -q .; then
  echo "mapping exists"
else
  aws lambda create-event-source-mapping --function-name ledgerline-drainer --region "$REGION" \
    --event-source-arn "$QUEUE_ARN" --batch-size 10 \
    --function-response-types ReportBatchItemFailures >/dev/null && echo "mapping created"
fi

# ---- 4. EventBridge Scheduler -> roll-up --------------------------------
say "Scheduler role"
aws iam create-role --role-name "$SCHED_ROLE" --region "$REGION" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  2>/dev/null && echo "created" || echo "exists"
aws iam put-role-policy --role-name "$SCHED_ROLE" --policy-name invoke-rollup \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:${REGION}:${ACCOUNT}:function:ledgerline-rollup\"}]}" 2>/dev/null
SCHED_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${SCHED_ROLE}"
sleep 8

say "Schedule -> roll-up (daily 00:00 UTC)"
ROLLUP_FN_ARN="arn:aws:lambda:${REGION}:${ACCOUNT}:function:ledgerline-rollup"
aws scheduler create-schedule --name ledgerline-rollup-daily --region "$REGION" \
  --schedule-expression "cron(0 0 * * ? *)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{\"Arn\":\"${ROLLUP_FN_ARN}\",\"RoleArn\":\"${SCHED_ROLE_ARN}\"}" \
  2>/dev/null && echo "schedule created" || echo "schedule exists (or update with update-schedule)"

say "DONE"
echo "Test the drainer:  aws sqs send-message --queue-url <url> --message-body '{\"customer_id\":\"11111111-1111-1111-1111-111111111111\",\"metric\":\"api_call\",\"quantity\":100,\"idempotency_key\":\"smoke-1\"}'"
echo "Invoke roll-up:    aws lambda invoke --function-name ledgerline-rollup /dev/stdout"
