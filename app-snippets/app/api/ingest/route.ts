// POST /api/ingest — accept a usage event and BUFFER it on SQS.
//
// This is the swap described in V0_PROMPT.md: v0 generates a version that writes
// straight to the DB; this version enqueues to SQS instead so a traffic spike or
// a DB hiccup never drops a billable event. The drainer Lambda does the actual
// idempotent INSERT into DSQL.
//
// Deps: npm i @aws-sdk/client-sqs

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const sqs = new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const QUEUE_URL = process.env.SQS_QUEUE_URL!;

type UsageEvent = {
  customer_id: string;
  metric: string;
  quantity: number;
  event_time?: string;
  idempotency_key?: string;
};

export async function POST(req: Request) {
  let body: UsageEvent;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { customer_id, metric, quantity } = body;
  if (!customer_id || !metric || quantity == null || Number.isNaN(Number(quantity))) {
    return NextResponse.json(
      { error: "customer_id, metric, and numeric quantity are required" },
      { status: 400 },
    );
  }

  // Fill defaults so producers can stay terse. The idempotency_key is the
  // dedupe anchor — if the caller doesn't supply one, mint a unique key so the
  // event is still recorded exactly once.
  const event = {
    customer_id,
    metric,
    quantity: Number(quantity),
    event_time: body.event_time ?? new Date().toISOString(),
    idempotency_key: body.idempotency_key ?? randomUUID(),
  };

  if (!QUEUE_URL) {
    return NextResponse.json({ error: "SQS_QUEUE_URL not configured" }, { status: 500 });
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(event),
    }),
  );

  // 202: accepted and buffered, not yet committed to the ledger.
  return NextResponse.json({ accepted: true, idempotency_key: event.idempotency_key }, { status: 202 });
}
