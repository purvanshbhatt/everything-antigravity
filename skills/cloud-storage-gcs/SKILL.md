---
name: cloud-storage-gcs
description: >-
  Manages Google Cloud Storage buckets: location and storage class choices,
  uniform IAM instead of ACLs, managed folders, public access prevention,
  keyless V4 signed URLs for uploads and downloads, CORS, lifecycle rules,
  soft delete and versioning, Cloud CDN backend buckets, Pub/Sub
  notifications and bulk data transfer. Use when creating or securing a bucket,
  issuing signed URLs, cutting storage cost, or moving data into GCS.
---

# Cloud Storage (GCS)

Create buckets that are private, uniformly governed by IAM and protected by
soft delete; give clients short-lived signed URLs instead of public objects or
keys; and let lifecycle rules, not people, move and delete data.

## When to use

- Creating a bucket or reviewing one for public exposure.
- Browser or mobile uploads and downloads via signed URLs.
- Storage costs growing; lifecycle, classes, Autoclass.
- Serving static assets through Cloud CDN, or moving data in from S3 or on-prem.

## When not to use

- Application upload flows end to end (virus scanning, image pipelines): use `file-storage-uploads`.
- CDN cache rules and edge logic in depth: use `cdn-edge-cloudflare`.
- Analytics over files: use `bigquery` or `duckdb-analytics`.
- Backup policy and restore drills across systems: use `backup-dr`.

## Workflow

Commands use bash continuations (`\`). In PowerShell use a backtick or one line. Use `gcloud storage`, not the legacy `gsutil`.

1. **Create the bucket private by default.**

   ```bash
   gcloud storage buckets create gs://PROJECT_ID-uploads --location=REGION \
     --uniform-bucket-level-access --public-access-prevention \
     --default-storage-class=STANDARD --soft-delete-duration=7d
   ```

   Location: a region next to the compute that reads it; dual-region or multi-region only when you need geo-redundancy or global reads, and accept the higher price.

   **Check:** `gcloud storage buckets describe gs://PROJECT_ID-uploads` shows uniform bucket-level access and public access prevention enforced.

2. **Grant IAM at bucket or managed-folder level.** Uniform access disables object ACLs; use IAM roles.

   ```bash
   gcloud storage buckets add-iam-policy-binding gs://PROJECT_ID-uploads \
     --member="serviceAccount:api-runtime@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.objectUser"
   gcloud storage managed-folders create gs://PROJECT_ID-uploads/tenant-a/
   gcloud storage managed-folders add-iam-policy-binding gs://PROJECT_ID-uploads/tenant-a/ \
     --member="group:tenant-a-admins@example.com" --role="roles/storage.objectViewer"
   ```

   Making anything public (`allUsers`) requires turning off public access prevention and explicit user confirmation.

   **Check:** `gcloud storage buckets get-iam-policy gs://PROJECT_ID-uploads` has no `allUsers` or `allAuthenticatedUsers` unless intended.

3. **Issue V4 signed URLs without keys.** The runtime service account signs through the IAM `signBlob` API, so it needs `roles/iam.serviceAccountTokenCreator` on itself.

   ```python
   from datetime import timedelta
   import google.auth
   from google.auth.transport.requests import Request
   from google.cloud import storage

   creds, _ = google.auth.default()
   creds.refresh(Request())
   blob = storage.Client().bucket("PROJECT_ID-uploads").blob(f"tenant-a/{upload_id}.png")
   url = blob.generate_signed_url(
       version="v4", expiration=timedelta(minutes=15), method="PUT",
       content_type="image/png",
       service_account_email=creds.service_account_email, access_token=creds.token,
   )
   ```

   Node: `file.getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000, contentType: "image/png" })`. CLI for ad hoc use: `gcloud storage sign-url gs://BUCKET/OBJECT --duration=15m --impersonate-service-account=SA_EMAIL` (verify flags with `gcloud storage sign-url --help`). V4 URLs last at most 7 days.

   **Check:** A `PUT` with the same `Content-Type` succeeds, a different type fails, and the URL stops working after expiry.

4. **Set CORS for browser uploads.**

   ```json
   [{"origin": ["https://app.example.com"], "method": ["PUT", "GET"],
     "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
   ```

   ```bash
   gcloud storage buckets update gs://PROJECT_ID-uploads --cors-file=cors.json
   ```

   **Check:** The browser preflight returns your origin in `Access-Control-Allow-Origin`; never use `"*"` for write methods.

5. **Automate retention and cost with lifecycle rules.**

   ```json
   {"rule": [
     {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"}, "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}},
     {"action": {"type": "Delete"}, "condition": {"age": 365}},
     {"action": {"type": "Delete"}, "condition": {"daysSinceNoncurrentTime": 30}},
     {"action": {"type": "AbortIncompleteMultipartUpload"}, "condition": {"age": 7}}
   ]}
   ```

   ```bash
   gcloud storage buckets update gs://PROJECT_ID-uploads --lifecycle-file=lifecycle.json
   gcloud storage buckets update gs://PROJECT_ID-uploads --versioning   # for data you cannot regenerate
   ```

   Delete rules destroy data: confirm ages with the user. Autoclass (`--enable-autoclass` on create or update) is simpler when access patterns are unknown.

   **Check:** `gcloud storage buckets describe gs://PROJECT_ID-uploads --format="json(lifecycle_config)"` shows the rules.

6. **Serve static assets through Cloud CDN.** Create a backend bucket and attach it to an external Application Load Balancer URL map (`cloud-networking` has the full chain).

   ```bash
   gcloud compute backend-buckets create static-bb --gcs-bucket-name=PROJECT_ID-static --enable-cdn
   gcloud storage rsync ./dist gs://PROJECT_ID-static --recursive \
     --cache-control="public, max-age=31536000, immutable"
   ```

   Use hashed filenames for long `max-age`; give `index.html` a short one. `--delete-unmatched-destination-objects` on `rsync` deletes remote files: confirm first.

   **Check:** `curl -sI https://static.example.com/app.HASH.js` shows the expected `cache-control` and an `age` header on repeat requests.

7. **React to uploads.**

   ```bash
   gcloud storage buckets notifications create gs://PROJECT_ID-uploads --topic=uploads --event-types=OBJECT_FINALIZE
   ```

   Or an Eventarc trigger on `google.cloud.storage.object.v1.finalized` (see `pubsub-eventarc`). Handlers must be idempotent; notifications can repeat.

   **Check:** Uploading a test object produces exactly one processed result even if the event is delivered twice.

8. **Move data at the right scale.**

   | Volume and source | Tool |
   | :--- | :--- |
   | Up to a few TB from a machine | `gcloud storage cp -r` or `rsync` |
   | S3, Azure Blob, HTTP lists, scheduled syncs | Storage Transfer Service: `gcloud transfer jobs create s3://SRC gs://DST --source-creds-file=creds.json` |
   | On-prem file systems, large | Storage Transfer Service with agents |
   | Hundreds of TB with limited bandwidth | Transfer Appliance |

   Egress from the source cloud is billed there; estimate it with the user first.

   **Check:** Object counts and total bytes match (`gcloud storage du gs://DST --summarize --readable-sizes`).

## Reference

### Storage classes

| Class | Minimum storage duration | Fits |
| :--- | :--- | :--- |
| Standard | none | Hot data, CDN origins |
| Nearline | 30 days | Accessed about monthly |
| Coldline | 90 days | Accessed about quarterly |
| Archive | 365 days | Compliance and DR copies |

Deleting or rewriting before the minimum incurs early-deletion charges; retrieval fees apply to colder classes.

### Recovery

- Soft delete keeps deleted objects for the configured window: `gcloud storage ls --soft-deleted gs://BUCKET/**`, then `gcloud storage restore gs://BUCKET/OBJECT#GENERATION`.
- Object versioning keeps noncurrent versions until lifecycle removes them.
- Bucket Lock (retention policy lock) is irreversible; never apply it without written user approval.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Fine-grained ACLs per object | Uniform access with IAM and managed folders | ACLs are invisible in IAM audits |
| Public buckets for user uploads | Signed URLs with short expiry | Public buckets leak data and attract abuse |
| Service account key files to sign URLs | IAM `signBlob` with `serviceAccountTokenCreator` | Keys leak; keyless signing is auditable |
| `"origin": ["*"]` CORS with `PUT` | Exact origins | Any site can drive uploads with a user's URL |
| Manual cleanup scripts | Lifecycle rules | Rules are reviewable and never forget |
| Coldline for data read daily | Standard or Autoclass | Retrieval fees exceed storage savings |

## Verification checklist

- [ ] Buckets have uniform access, public access prevention and soft delete.
- [ ] Access is granted by IAM on bucket or managed folder; no unintended public members.
- [ ] Signed URLs are keyless, short-lived and scoped to method and content type.
- [ ] Lifecycle rules exist and their deletion ages were confirmed by the user.
- [ ] Destructive operations (`rm -r`, `rsync` deletes, Bucket Lock) were confirmed.

## Related

- Knowledge: `file-storage-uploads`, `cdn-edge-cloudflare`, `cloud-networking`, `pubsub-eventarc`, `gcp-iam`, `backup-dr`, `finops-cost`, `cloud-devops`.
- Agents: `cloud-devops-engineer`, `security-guard`.
