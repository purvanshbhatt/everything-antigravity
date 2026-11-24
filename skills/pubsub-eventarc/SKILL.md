---
name: pubsub-eventarc
disable-model-invocation: true
description: >-
  Builds event plumbing on Google Cloud with Pub/Sub and Eventarc: pull, push
  and export subscriptions, retry policy, ordering keys, exactly-once
  delivery, dead-letter topics, replay with seek and snapshots, authenticated
  push to Cloud Run, Eventarc triggers and emulator testing. Use when wiring
  async messaging or event triggers, or debugging stuck, duplicate or lost
  messages.
---

# Pub/Sub and Eventarc

Design for at-least-once delivery: idempotent handlers, a dead-letter topic on
every subscription, bounded retries, authenticated push and backlog-age alerts.
Eventarc for events from Google services; Pub/Sub when your code publishes.

## When to use

- Decoupling services with a topic, fan-out to several consumers, buffering spikes.
- Triggering Cloud Run on uploads, Pub/Sub messages or audit-log events.
- Messages piling up, looping, arriving out of order or vanishing; replay after a bad deploy.

## When not to use

- Broker comparisons (Kafka, RabbitMQ, SQS) and general semantics: use `message-queues`.
- Event schema design, sagas and choreography: use `event-driven-architecture`.
- Per-task rate limits and scheduled delivery to one handler: Cloud Tasks via `background-jobs`.
- Continuous stream analytics with windows: use `stream-processing`.

## Workflow

Bash continuations (`\`) become a backtick in PowerShell. Get `PROJECT_NUMBER` from `gcloud projects describe PROJECT_ID --format="value(projectNumber)"`.

1. **Choose the mechanism.** Your code publishes to many consumers: a Pub/Sub topic with one subscription per consumer. A Google service emits the event (Storage, audit logs): an Eventarc trigger. One rate-limited target per task: Cloud Tasks (`background-jobs`). Landing data with no code: a BigQuery or Cloud Storage subscription.

   **Check:** No subscription is shared by consumers with different purposes.

2. **Create the topic, a dead-letter topic and a subscription with bounded retries.**

   ```bash
   gcloud pubsub topics create orders
   gcloud pubsub topics create orders-dlq
   gcloud pubsub subscriptions create orders-dlq-hold --topic=orders-dlq --message-retention-duration=7d
   gcloud pubsub subscriptions create orders-worker --topic=orders \
     --ack-deadline=60 --message-retention-duration=7d \
     --min-retry-delay=10s --max-retry-delay=600s \
     --dead-letter-topic=orders-dlq --max-delivery-attempts=10
   ```

   The Pub/Sub service agent must be able to move messages:

   ```bash
   PUBSUB_SA="serviceAccount:service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com"
   gcloud pubsub topics add-iam-policy-binding orders-dlq --member="$PUBSUB_SA" --role=roles/pubsub.publisher
   gcloud pubsub subscriptions add-iam-policy-binding orders-worker --member="$PUBSUB_SA" --role=roles/pubsub.subscriber
   ```

   **Check:** The dead-letter topic has its own subscription (topics without one drop messages); `describe` on `orders-worker` shows the dead-letter policy.

3. **Pick delivery guarantees deliberately.**
   - Ordering: `--enable-message-ordering` on the subscription plus an ordering key set by a publisher with ordering enabled. Order holds per key; a failed publish pauses that key until the client resumes it.
   - Exactly-once: `--enable-exactly-once-delivery` (pull only). Check ack results; it stops redelivery after a successful ack, not duplicate publishes.
   - Filters: `--message-filter='attributes.type = "order.created"'` on create; filters cannot be changed later.

   **Check:** Handlers stay idempotent anyway: dedupe on message ID or business key, or upsert.

4. **Authenticate push to Cloud Run.** Keep the service private and let Pub/Sub sign requests.

   ```bash
   gcloud pubsub subscriptions create orders-push --topic=orders \
     --push-endpoint=https://SERVICE_URL/pubsub \
     --push-auth-service-account=pubsub-push@PROJECT_ID.iam.gserviceaccount.com \
     --push-auth-token-audience=https://SERVICE_URL \
     --dead-letter-topic=orders-dlq --max-delivery-attempts=10
   gcloud run services add-iam-policy-binding SERVICE --region=REGION \
     --member="serviceAccount:pubsub-push@PROJECT_ID.iam.gserviceaccount.com" --role=roles/run.invoker
   ```

   Return 2xx only after the work is durable; anything else is a nack and retries with backoff. Make IAM grants here and in step 2 only after user confirmation.

   **Check:** The service rejects anonymous calls (403) and processes a test publish.

5. **Wire Eventarc triggers.** Example: Cloud Storage uploads to a Cloud Run service.

   ```bash
   GCS_AGENT=$(gcloud storage service-agent --project=PROJECT_ID)
   gcloud projects add-iam-policy-binding PROJECT_ID --member="serviceAccount:$GCS_AGENT" --role=roles/pubsub.publisher
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:eventarc-trigger@PROJECT_ID.iam.gserviceaccount.com" --role=roles/eventarc.eventReceiver
   gcloud eventarc triggers create uploads-trigger --location=REGION \
     --destination-run-service=processor --destination-run-region=REGION --destination-run-path=/events \
     --event-filters="type=google.cloud.storage.object.v1.finalized" \
     --event-filters="bucket=PROJECT_ID-uploads" \
     --service-account=eventarc-trigger@PROJECT_ID.iam.gserviceaccount.com
   ```

   The trigger account also needs `roles/run.invoker` on `processor`; trigger and bucket locations must match. Other sources: `type=google.cloud.pubsub.topic.v1.messagePublished` with `--transport-topic=projects/PROJECT_ID/topics/orders`, or `type=google.cloud.audit.log.v1.written` with `serviceName` and `methodName` filters (Data Access audit logs must be enabled for that service). List event types with `gcloud eventarc providers describe storage.googleapis.com --location=REGION`.

   Events arrive as CloudEvents over HTTP (`ce-id`, `ce-type`, `ce-source` headers); new triggers take a few minutes to activate.

   **Check:** A test upload yields one `processor` log line with the expected `ce-type`.

6. **Add dead-lettering to Eventarc too.** Find the trigger's underlying subscription and update it (verify against current Eventarc docs):

   ```bash
   SUB=$(gcloud eventarc triggers describe uploads-trigger --location=REGION --format="value(transport.pubsub.subscription)")
   gcloud pubsub subscriptions update "$SUB" --dead-letter-topic=orders-dlq --max-delivery-attempts=10
   ```

   **Check:** A handler that always returns 500 sends the event to the dead-letter subscription, not an endless loop.

7. **Monitor and replay.** Alert on `subscription/oldest_unacked_message_age` and `subscription/dead_letter_message_count`; watch `num_undelivered_messages`. To replay after a bad deploy:

   ```bash
   gcloud pubsub snapshots create pre-deploy --subscription=orders-worker   # before deploying
   gcloud pubsub subscriptions seek orders-worker --snapshot=pre-deploy     # roll back delivery
   gcloud pubsub subscriptions seek orders-worker --time=2026-11-20T10:00:00Z   # needs --retain-acked-messages
   ```

   Seeking re-delivers messages: confirm with the user and ensure handlers are idempotent first.

   **Check:** Backlog age returns to baseline and every dead-lettered message is explained.

8. **Test with the emulator.**

   ```bash
   gcloud beta emulators pubsub start --project=local-test
   $(gcloud beta emulators pubsub env-init)   # PowerShell: $env:PUBSUB_EMULATOR_HOST = "localhost:8085"
   ```

   Client libraries honour `PUBSUB_EMULATOR_HOST`; `gcloud pubsub` commands always hit the real service, so smoke-test in a dev project with `gcloud pubsub topics publish orders --message='{"id":"42"}'` and `gcloud pubsub subscriptions pull orders-worker --limit=5` (without `--auto-ack`, pulled messages redeliver).

   **Check:** Integration tests run against the emulator with no cloud credentials.

## Reference

Ack deadline is 10-600 s (default 10 s; client libraries extend leases), max delivery attempts 5-100, subscription retention 10 minutes to 31 days (default 7 days), push success codes 102, 200, 201, 202, 204. Verify limits in the current docs before relying on edge values.

### Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Same message processed repeatedly | Handler slower than ack deadline, or crash before ack | Raise `--ack-deadline`, ack after durable write, dedupe |
| Backlog grows, no errors | Push endpoint slow or flow control too tight | Scale consumers, raise outstanding-message limits |
| Dead-letter topic empty despite failures | Service agent lacks publisher/subscriber roles | Grant roles from step 2 |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Assume exactly-once processing | Idempotent handlers keyed on message ID | Redelivery happens on timeouts and restarts |
| Subscriptions without dead-letter topics | Dead-letter plus alert on its count | Poison messages retry forever and block ordered keys |
| Unauthenticated push endpoints | Push auth service account plus invoker IAM | Anyone can forge events otherwise |
| Ack first, then process | Process, persist, then ack (or return 2xx) | Crashes after ack lose messages |

## Verification checklist

- [ ] Every subscription has a dead-letter topic with its own subscription and bounded retries.
- [ ] Handlers are idempotent and ack only after durable work.
- [ ] Push and Eventarc deliveries are authenticated; services stay private.
- [ ] Alerts exist on oldest unacked message age and dead-letter count.
- [ ] IAM grants and replays (`seek`) were confirmed by the user.

## Related

- Knowledge: `message-queues`, `event-driven-architecture`, `background-jobs`, `stream-processing`, `cloud-run`, `cloud-storage-gcs`, `gcp-iam`, `webhooks`, `observability-otel`.
- Agents: `backend-engineer`, `cloud-devops-engineer`, `sre-engineer`.
