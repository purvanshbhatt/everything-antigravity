---
name: file-storage-uploads
disable-model-invocation: true
description: >-
  Handles user file uploads and storage safely: direct-to-bucket uploads with
  V4 signed URLs, resumable and multipart uploads, size and content-type
  validation, malware scanning with quarantine, image and media processing,
  private serving via signed URLs or CDN, and lifecycle, retention and
  deletion rules. Use when building upload flows, serving user files, or
  cutting storage costs on Cloud Storage or S3.
---

# File Storage and Uploads

Uploads combine untrusted bytes, large payloads and long-lived storage costs.
Proxying files through app servers wastes memory and time; trusting the
client's content type invites stored XSS and malware; forgetting lifecycle
rules leaves orphaned files billing forever. Upload directly to a private
bucket with short-lived signed URLs, validate and scan before use, and serve
through controlled URLs.

## When to use

- Avatars, documents, attachments, media libraries, CSV imports, data exports.
- Large files that time out or exhaust memory when sent through the API.
- Serving private files to authorized users only, or through a CDN.
- Storage bills growing from temp files, versions or incomplete uploads.

## When not to use

- Bucket administration, IAM and transfer services in depth: use `cloud-storage-gcs`.
- Image manipulation techniques (cropping, compositing, canvas): use `image-processing-canvas`.
- Video transcoding pipelines: use `ffmpeg-multimedia` or `video-production-pipeline`.
- Backup strategy for the whole system: use `backup-dr`.

## Workflow

1. **Write the constraints.** Allowed types (by content, not extension), maximum size, who may read each file, retention period, expected volume, and whether files contain personal data.

   **Check:** Every upload type has an allowlist, a size cap and a read policy.

2. **Prepare private buckets.** Separate buckets (or at least prefixes) for incoming and clean files; uniform bucket-level access and public access prevention on both; CORS only for your app origins and the methods you use. Changing settings on existing buckets can break production access: confirm with the user first.

   ```bash
   gcloud storage buckets create gs://acme-uploads-incoming --location=us-central1 \
     --uniform-bucket-level-access --public-access-prevention
   gcloud storage buckets update gs://acme-uploads-incoming --cors-file=cors.json
   ```

   **Check:** An anonymous request for any object returns 401 or 403.

3. **Issue upload URLs after authorization.** The API checks permissions, picks a random object name (never the user's filename), records a `pending` upload row, and returns a V4 signed URL valid for minutes with the content type and size range bound into the signature (example below). On Cloud Run, signing uses the IAM `signBlob` API, so the runtime service account needs `iam.serviceAccounts.signBlob` on itself (Service Account Token Creator) rather than a key file.

   **Check:** Uploading with a different content type or a larger body than requested is rejected by the bucket.

4. **Use resumable uploads for large files.** Cloud Storage resumable sessions (signed `POST` with `x-goog-resumable: start`), S3 multipart uploads, or the tus protocol (for example with Uppy) let clients resume after network drops. Add a lifecycle rule that aborts incomplete multipart uploads.

   **Check:** Killing the network mid-upload of a 1 GB file and resuming completes without restarting from zero.

5. **Validate and scan before use.** Trigger on object finalize (Eventarc `google.cloud.storage.object.v1.finalized`, or S3 event notifications). Check size, sniff magic bytes (`file-type` in Node, `python-magic`), confirm the pending row exists for that uploader, scan with ClamAV or a managed scanner, then move the object to the clean bucket or to quarantine and update the row to `ready` or `rejected`.

   **Check:** An EICAR test file ends up in quarantine and never becomes readable through the app.

6. **Process media defensively.** Decode with pixel limits (sharp `limitInputPixels`, Pillow `Image.MAX_IMAGE_PIXELS`) to stop decompression bombs; re-encode images, which also strips EXIF location data; generate fixed variants (thumbnail, medium) under deterministic keys; never shell out with user-controlled filenames.

   **Check:** A 50,000 x 50,000 pixel PNG is rejected quickly without exhausting memory.

7. **Serve files through controlled URLs.** Short-lived signed GET URLs, or Cloud CDN with signed URLs or signed cookies for heavy traffic. Serve user content from a separate domain, set the stored `Content-Type`, `X-Content-Type-Options: nosniff`, and `Content-Disposition: attachment` for anything that is not an image you re-encoded.

   **Check:** An uploaded HTML or SVG file downloads as an attachment instead of executing in your app's origin.

8. **Set lifecycle, retention and deletion.** Delete temp and rejected objects after a day, transition cold data to cheaper classes, abort incomplete uploads, and delete files when their owning record or account is deleted. Know your platform's soft-delete and versioning behaviour, which keeps deleted bytes billable for a period. Bulk deletion is irreversible: list what will be removed and get explicit confirmation.

   ```json
   { "rule": [
     { "action": { "type": "Delete" }, "condition": { "age": 1, "matchesPrefix": ["tmp/", "rejected/"] } },
     { "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" }, "condition": { "age": 30, "matchesPrefix": ["archive/"] } },
     { "action": { "type": "AbortIncompleteMultipartUpload" }, "condition": { "age": 7 } } ] }
   ```

   Apply with `gcloud storage buckets update gs://BUCKET --lifecycle-file=lifecycle.json`.

   **Check:** A storage report shows no growth from orphaned, temp or incomplete objects.

## Patterns

### Signed upload URL (Node, Cloud Storage)

```ts
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';

const storage = new Storage();
const ALLOWED = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024;

export async function createUploadUrl(userId: string, contentType: string, size: number) {
  if (!ALLOWED.has(contentType)) throw new Error('Unsupported file type');
  if (!Number.isInteger(size) || size < 1 || size > MAX_BYTES) throw new Error('Invalid file size');
  const objectName = `incoming/${userId}/${randomUUID()}`;
  const range = `0,${size}`;
  const [url] = await storage.bucket(process.env.UPLOAD_BUCKET!).file(objectName).getSignedUrl({
    version: 'v4', action: 'write', expires: Date.now() + 10 * 60 * 1000,
    contentType, extensionHeaders: { 'x-goog-content-length-range': range },
  });
  await db.uploads.insert({ objectName, userId, contentType, status: 'pending' });
  return { url, objectName, headers: { 'Content-Type': contentType, 'x-goog-content-length-range': range } };
}
```

The client must send exactly those headers with its `PUT`. On S3, the equivalent is a presigned POST policy with a `content-length-range` condition.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Stream uploads through API servers | Direct-to-bucket signed URLs | Memory, timeouts and cost |
| Use the client's filename as the object key | Random keys; store the name in the database | Path traversal, collisions, enumeration |
| Trust `Content-Type` or the extension | Sniff magic bytes after upload | Disguised HTML, scripts and executables |
| Make the bucket public for convenience | Private bucket with signed URLs or CDN signing | Every file becomes world-readable and indexable |
| Serve user files from your app origin | Separate domain, `nosniff`, attachment disposition | Stored XSS against your users |
| Signed URLs valid for days | Minutes for uploads, short for downloads | Leaked URLs grant lasting access |
| No lifecycle rules | Delete temp, abort incomplete, tier cold data | Silent, compounding storage costs |

## Verification checklist

- [ ] Buckets are private with uniform access and public access prevention.
- [ ] Upload URLs are short-lived and bind content type and size.
- [ ] Files are sniffed and scanned before becoming readable; quarantine works.
- [ ] Media processing enforces pixel and size limits and strips metadata.
- [ ] Downloads use signed URLs or CDN signing from a separate domain with safe headers.
- [ ] Lifecycle rules cover temp, rejected and incomplete objects; deletions follow record deletion.

## Related

- Knowledge: `cloud-storage-gcs`, `cdn-edge-cloudflare`, `image-processing-canvas`, `serverless-functions`, `api-security`, `backup-dr`, `finops-cost`, `gdpr-privacy`.
- Agents: `security-guard`, `cloud-devops-engineer`, `backend-engineer`.
