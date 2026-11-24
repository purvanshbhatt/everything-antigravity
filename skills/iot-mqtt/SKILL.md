---
name: iot-mqtt
disable-model-invocation: true
description: >-
  Builds IoT backends on MQTT: topic and payload design, QoS, retained
  messages and last will, MQTT 5 features, broker choice, per-device X.509
  identity and ACLs, fleet provisioning, signed OTA updates with staged
  rollout, and telemetry pipelines into Pub/Sub and BigQuery. Use when
  designing or reviewing device-to-cloud messaging, onboarding a device
  fleet, or debugging MQTT connectivity and message loss.
---

# IoT Backends with MQTT

Give every device its own identity and its own slice of the topic tree,
design payloads that survive retries and clock drift, and treat firmware
updates as the most dangerous deploy you run.

## When to use

- Designing topic structure, payloads and QoS for a device fleet.
- Choosing or configuring a broker (self-hosted or managed) and its auth.
- Building device provisioning, certificate rotation or OTA update flows.
- Moving telemetry into streaming and analytics; debugging drops or duplicates.

## When not to use

- Firmware internals (RTOS, drivers, bootloaders): use `embedded-firmware`.
- Robot middleware and control loops: use `robotics-ros2`.
- Generic stream processing after ingestion: use `stream-processing` and `pubsub-eventarc`.
- Browser realtime features: use `realtime-websockets`.

## Workflow

1. **Design the topic tree.** Hierarchical, no leading slash, identity in the path so ACLs can match it, and separate directions.

   ```text
   <tenant>/<site>/<device_id>/telemetry        device -> cloud, QoS 0 or 1
   <tenant>/<site>/<device_id>/state            device -> cloud, retained
   <tenant>/<site>/<device_id>/cmd/<name>       cloud -> device, QoS 1
   <tenant>/<site>/<device_id>/cmd/<name>/ack   device -> cloud
   ```

   `+` matches one level, `#` matches the rest (last position only). Topics beginning with `$` are reserved by brokers.

   **Check:** A device's ACL can be written as a pattern using its own client ID; no device needs `#`.

2. **Design payloads for an unreliable network.** Include schema version, device ID, monotonic sequence number, device timestamp, and let the backend add receive time. Use JSON for low volume, CBOR or Protocol Buffers for constrained links.

   ```json
   {"v": 2, "dev": "pump-0042", "seq": 18734, "ts": "2026-03-01T09:30:00Z", "temp_c": 41.7, "rpm": 1480}
   ```

   **Check:** The backend can deduplicate by `(dev, seq)` and detect gaps.

3. **Pick QoS and session semantics deliberately.** QoS 0 for high-rate telemetry you can lose, QoS 1 with idempotent handlers for commands and important events, QoS 2 rarely (it is per hop and costly). Use retained messages for last-known state, Last Will for unexpected disconnects, and persistent sessions only where offline command queueing is needed. Prefer MQTT 5 for reason codes, session and message expiry, shared subscriptions (`$share/<group>/<filter>`) and user properties.

   **Check:** Every consumer is idempotent, because QoS 1 delivers duplicates.

4. **Give each device a unique identity.** Generate the key on the device (ideally in a secure element or TPM), issue an X.509 certificate from your device CA via CSR, use mutual TLS on port 8883, and map certificate identity to client ID. Disable anonymous access and shared fleet credentials.

   ```text
   # mosquitto.conf excerpt
   listener 8883
   cafile /etc/mosquitto/ca.crt
   certfile /etc/mosquitto/server.crt
   keyfile /etc/mosquitto/server.key
   require_certificate true
   use_identity_as_username true
   allow_anonymous false
   acl_file /etc/mosquitto/acl
   # acl: each device may only touch its own subtree
   pattern readwrite acme/+/%u/#
   ```

   **Check:** A device certificate cannot publish or subscribe outside its subtree (test with a second device's certificate).

5. **Provision and rotate at fleet scale.** Use a manufacturing or first-boot provisioning flow (claim certificate exchanged for a unique one, or just-in-time registration), keep a device registry (ID, cert fingerprint, firmware version, owner), support certificate rotation before expiry, and revoke on decommission.

   **Check:** Revoking one device blocks only that device within minutes.

6. **Ship OTA updates safely.** Sign firmware images, verify signatures on the device before activation, use A/B partitions with automatic rollback on failed health checks, and roll out in stages (internal, 1%, 10%, 50%, 100%) with automatic pause on error-rate increase. Ask the user for explicit confirmation before each stage that targets customer devices.

   **Check:** A deliberately broken image in the canary stage rolls back automatically and halts the rollout.

7. **Build the telemetry pipeline.** Broker, then a bridge or connector to Pub/Sub or Kafka, then stream processing (validation, dedup, enrichment), then BigQuery or a time-series database, with a dead-letter path for malformed messages. Google Cloud IoT Core was retired in 2023; use a self-managed or partner broker bridged to Pub/Sub.

   **Check:** End-to-end latency and drop rate are measured per stage; malformed messages land in the dead-letter path.

8. **Debug with the CLI tools.**

   ```bash
   mosquitto_sub -h <broker> -p 8883 --cafile ca.crt --cert dev.crt --key dev.key -V mqttv5 -t 'acme/+/+/telemetry' -v
   mosquitto_pub -h <broker> -p 8883 --cafile ca.crt --cert dev.crt --key dev.key -q 1 -t 'acme/s1/pump-0042/cmd/reboot' -m '{"id":"c-91"}'
   ```

   Use test devices and test topics; publishing to production command topics affects real hardware.

## Reference

### Broker options

| Option | Notes |
| :--- | :--- |
| Eclipse Mosquitto | Lightweight, simple ACLs, good for single node and edge gateways |
| EMQX, HiveMQ, VerneMQ | Clustering, rule engines, bridges, enterprise auth |
| AWS IoT Core, Azure IoT Hub / Event Grid MQTT | Managed; check protocol feature limits per service |

### Security checklist (OWASP IoT Top 10 themes)

No default or shared credentials; encrypted transport everywhere; signed and verified updates; minimal exposed services on devices; secure boot; per-device revocation; rate limits and payload validation at the broker and backend.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| One username and password for the whole fleet | Unique per-device certificates | One extracted device compromises every device |
| Subscribe devices to `#` | Narrow per-device topic filters and ACLs | Devices see and can affect each other |
| Trust device timestamps alone | Store device time and receive time; tolerate drift | Device clocks reset and drift |
| Assume exactly-once from QoS | Idempotent consumers keyed by sequence | QoS guarantees are per hop, not end to end |
| Push firmware to 100% at once | Staged rollout with automatic rollback | A bad image can brick the fleet |
| Put commands on retained topics | Non-retained commands with acks and expiry | Retained commands replay on every reconnect |

## Verification checklist

- [ ] Topic tree encodes identity; ACLs restrict each device to its subtree.
- [ ] Payloads carry version, device ID, sequence and timestamp; consumers are idempotent.
- [ ] Devices use unique keys and certificates over mTLS; anonymous access is off.
- [ ] Provisioning, rotation and revocation are tested.
- [ ] OTA images are signed, A/B with rollback, staged with user-confirmed stages.
- [ ] The pipeline has a dead-letter path and per-stage metrics.

## Related

- Knowledge: `embedded-firmware`, `robotics-ros2`, `pubsub-eventarc`, `stream-processing`, `message-queues`, `bigquery`, `cryptography`, `observability-otel`.
- Workflows: `/threat-modeling`, `/release-management`.
- Agents: `backend-engineer`, `data-engineer`, `security-guard`.
