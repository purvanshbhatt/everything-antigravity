---
name: message-queues
description: >-
  Chooses and operates message brokers (Google Cloud Pub/Sub, Apache Kafka,
  RabbitMQ, Amazon SQS): delivery semantics, acknowledgements and deadlines,
  ordering keys and partitions, dead-letter queues, retry backoff, consumer
  concurrency, backpressure and lag monitoring. Use when picking a broker,
  configuring subscriptions or consumer groups, or fixing redelivery storms,
  poison messages, growing lag or lost messages.
---

# Message Queues and Brokers

Brokers fail in predictable ways: messages acknowledged before work is done
are lost, deadlines shorter than processing cause redelivery storms, one
poison message stalls an ordered stream, and nobody notices a backlog until
it is hours old. This skill picks the broker and then configures producers,
consumers and alerts so none of that happens silently.

## When to use

- Choosing between Pub/Sub, Kafka, RabbitMQ and SQS for a workload.
- Creating topics, subscriptions, queues or consumer groups.
- Duplicate processing, messages stuck in redelivery loops, lag that keeps growing, or a dead-letter queue nobody drains.

## When not to use

- What to publish and how to version it: use `event-driven-architecture`.
- Per-task scheduling, rate-limited HTTP jobs or cron: use `background-jobs`.
- Windowed aggregation and joins on streams: use `stream-processing`.
- Pub/Sub and Eventarc wiring in depth on Google Cloud: use `pubsub-eventarc`.

## Workflow

1. **Write the requirements down.** Peak messages per second, payload size, ordering scope, replay need, fan-out count, latency target, retention and which cloud you run on. Pick from the matrix below; default to the managed broker of your platform unless a requirement rules it out.

   **Check:** The choice cites at least one requirement the alternatives fail.

2. **Name and own the topology.** Topics are named for domain facts (`orders.order-placed`). Give each consuming service its own subscription, queue or consumer group: two services sharing one subscription each see only part of the stream. Record the owner of every topic and DLQ.

   **Check:** No subscription or consumer group is shared by two different services.

3. **Make producers safe.** Wait for publish confirmation before reporting success, batch for throughput, retry transient errors, and put the trace context and schema version in message attributes. Kafka: `enable.idempotence=true` and `acks=all`. Use an outbox when the publish must match a database write.

   **Check:** A broker outage during publish surfaces as an error or an outbox backlog, never as silent loss.

4. **Acknowledge after the work commits.** Set the ack deadline or visibility timeout above p99 processing time (Pub/Sub client libraries extend leases automatically up to a configured maximum). Kafka: disable `enable.auto.commit`, commit offsets after processing, and keep each poll loop under `max.poll.interval.ms` or the consumer is evicted from the group. RabbitMQ: manual acks with a bounded prefetch (`basic.qos`). Make handlers idempotent, because every broker redelivers.

   **Check:** Killing a consumer mid-message results in redelivery, not loss.

5. **Separate transient from permanent failures.** Retry transient errors with exponential backoff (Pub/Sub retry policy, RabbitMQ TTL plus dead-letter-exchange delay queues, Kafka retry topics). Send permanent failures (schema violations, missing referenced data) straight to the DLQ. Every DLQ has an alert and a documented redrive procedure. Redriving into production is outward-facing: confirm the message set and target with the user before running it.

   **Check:** A deliberately malformed message reaches the DLQ after the configured attempts while others keep flowing.

6. **Apply backpressure to the real bottleneck.** Bound in-flight messages per consumer (Pub/Sub flow control, RabbitMQ prefetch, Kafka `max.poll.records`) to what the downstream database pool or API quota can absorb. Scale consumers on backlog age, not CPU alone (Cloud Run for push subscriptions, KEDA or HPA external metrics on GKE).

   **Check:** A load test at 2x peak grows the backlog and then drains it without downstream errors.

7. **Alert on age, not just count.** Monitor oldest unacked message age (`subscription/oldest_unacked_message_age` in Pub/Sub), consumer lag per partition, DLQ depth, redelivery rate and publish errors. Page when age exceeds the business latency budget.

   **Check:** A stopped consumer triggers an alert within the latency budget.

## Reference

### Broker matrix (verify limits against current docs)

| | Pub/Sub | Kafka | RabbitMQ | SQS |
| :--- | :--- | :--- | :--- | :--- |
| Model | Topic with push, pull, BigQuery or Cloud Storage subscriptions | Partitioned log with consumer groups | Exchanges route to queues | Standard or FIFO queues |
| Ordering | Per ordering key (enabled on the subscription) | Per partition | Per queue with one consumer | Per message group (FIFO) |
| Replay | Seek to a timestamp or snapshot within retention | Reset offsets within retention | Streams only | No |
| Dead letters | Dead-letter topic with max delivery attempts | Application retry and DLQ topics | Dead-letter exchange | Redrive policy (`maxReceiveCount`) |
| Operations | Serverless | Heavy (or Managed Service for Apache Kafka, Confluent Cloud) | Moderate; prefer quorum queues | Serverless (AWS) |
| Choose when | Google Cloud default, fan-out, push to Cloud Run | High throughput, long retention, stream processing | Complex routing, work queues, on-premises | AWS-native work queues |

### Commands

```bash
# Pub/Sub: worker subscription with ordering, DLQ and backoff
gcloud pubsub topics create orders-dlq
gcloud pubsub subscriptions create orders-worker --topic=orders \
  --ack-deadline=60 --enable-message-ordering \
  --dead-letter-topic=orders-dlq --max-delivery-attempts=5 \
  --min-retry-delay=10s --max-retry-delay=600s
# Grant the Pub/Sub service agent publisher on orders-dlq and subscriber on orders-worker,
# otherwise failed messages are never forwarded to the DLQ.

# Kafka: lag per partition for a group
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group orders-worker

# RabbitMQ: ready vs unacknowledged messages per queue
rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers

# SQS: visible and in-flight counts
aws sqs get-queue-attributes --queue-url "$QUEUE_URL" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible
```

In PowerShell, replace the trailing `\` with a backtick for line continuation and use `$env:QUEUE_URL`.

### Large payloads

Use the claim-check pattern: store the payload in Cloud Storage or S3, publish its key and checksum, and set a lifecycle rule on the bucket. Brokers have per-message size caps, and big messages slow every consumer.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Auto-ack on receipt | Ack after the work commits | A crash loses the message |
| Share a subscription between services | One subscription or group per service | Each service sees only some messages |
| Ack deadline below processing time | Deadline above p99, with lease extension | Redelivery storms and duplicate work |
| Retry poison messages forever | Bounded attempts, then a DLQ | One message blocks an ordered key or fills logs |
| Unbounded prefetch or concurrency | Flow control sized to downstream capacity | Memory blowups and database pool exhaustion |
| One ordering key or partition for everything | Key per entity | Throughput is capped at one consumer |
| Alert only on queue length | Alert on oldest message age and DLQ depth | Length ignores how stale the work is |

## Verification checklist

- [ ] Broker choice is justified by written requirements.
- [ ] Each consuming service has its own subscription, queue or group.
- [ ] Acks happen after commit; handlers are idempotent and tested with duplicates.
- [ ] Retry policy, max attempts and DLQ are configured, with DLQ permissions verified.
- [ ] Concurrency is bounded by downstream capacity and load-tested at 2x peak.
- [ ] Alerts cover message age, lag and DLQ depth.

## Related

- Knowledge: `event-driven-architecture`, `pubsub-eventarc`, `background-jobs`, `stream-processing`, `observability-otel`, `load-testing`.
- Agents: `backend-engineer`, `sre-engineer`, `silent-failure-hunter`.
