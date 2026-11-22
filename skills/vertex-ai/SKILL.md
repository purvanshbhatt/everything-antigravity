---
name: vertex-ai
description: >-
  Uses Google Cloud's Vertex AI platform (parts now branded Gemini Enterprise
  Agent Platform): project setup, service accounts and IAM, Gemini through
  Vertex, Model Garden deployments, custom training jobs, Model Registry,
  online endpoints with traffic splits, batch prediction, Vertex AI Pipelines,
  quotas, regions and cost control. Use when training or deploying models on
  Google Cloud, or when Vertex calls fail on permissions, quota or region.
---

# Vertex AI

Run training, deployment and batch inference on Google Cloud without idle GPUs
on the bill. Console names have shifted, so this skill relies on the stable
surfaces: the `aiplatform.googleapis.com` API, `gcloud ai` and the Python SDKs.
Check current docs for per-region model and accelerator availability.

## When to use

- Calling Gemini through Google Cloud for data residency, VPC Service Controls, CMEK, provisioned throughput or enterprise billing.
- Deploying an open or custom model to a managed endpoint, including Model Garden deployments of Gemma.
- Custom training jobs, pipelines and batch prediction.
- Errors such as `PERMISSION_DENIED`, `RESOURCE_EXHAUSTED` or "model not found" in a region.

## When not to use

- Gemini call code (structured output, tools, streaming): `gemini-api`; the same code runs on Vertex with a different client setup.
- ADK agents and Agent Runtime deployment: `google-adk`.
- Self-managed serving on GKE or Cloud Run and vLLM tuning: `model-serving`.
- IAM design in general: `gcp-iam`. Provisioning with code: `terraform-iac`.

## Workflow

1. **Set project, region and APIs.**

   ```bash
   gcloud config set project <PROJECT_ID>
   gcloud services enable aiplatform.googleapis.com storage.googleapis.com artifactregistry.googleapis.com
   gcloud auth application-default login          # local development only
   ```

   Pick one region for data and compute (for example `us-central1` or `europe-west4`) and keep buckets there. Gemini on Vertex also offers a `global` location for some models.

   **Check:** `gcloud ai models list --region=<REGION>` returns without error (an empty list is fine).

2. **Use least-privilege identities.** One service account per workload with `roles/aiplatform.user` and bucket-level storage roles; never the Compute Engine default account or `roles/editor`. The Vertex AI service agent (`service-<PROJECT_NUMBER>@gcp-sa-aiplatform.iam.gserviceaccount.com`) needs read access to images and buckets in other projects. Locally, impersonate instead of downloading keys: `gcloud auth application-default login --impersonate-service-account=<SA_EMAIL>`.

   **Check:** `gcloud projects get-iam-policy <PROJECT_ID> --flatten="bindings[].members" --filter="bindings.members:<SA_EMAIL>" --format="table(bindings.role)"` lists only the intended roles.

3. **Call Gemini through Vertex with google-genai.** `genai.Client(vertexai=True, project=..., location=...)`, or set `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` (newer SDKs also document an `enterprise` flag; see `gemini-api`). The generative modules of the older Vertex AI SDK (`vertexai.generative_models`) are deprecated with a scheduled removal; migrate rather than start new code there. Capacity defaults to shared quota; Provisioned Throughput reserves capacity but is a paid commitment, so get explicit user approval before purchasing.

   **Check:** one call succeeds as the workload's service account, using a model ID listed for that location.

4. **Deploy an open model from Model Garden.** Some models are offered as managed APIs (billed per token, nothing idle) and others as self-deploy (billed per node-hour). Prefer managed APIs for bursty traffic.

   ```bash
   gcloud ai model-garden models list --help      # confirm filter and deploy flags for your gcloud version
   gcloud ai model-garden models list
   gcloud ai model-garden models deploy --help
   ```

   A self-deploy needs the model ID, region, machine, accelerator and license acceptance. State the hourly cost in the implementation plan and get user confirmation first.

   **Check:** the endpoint shows the deployed model and a test prediction returns.

5. **Run a custom training job.** Push the trainer image to Artifact Registry, then:

   ```bash
   gcloud ai custom-jobs create --region=<REGION> --display-name=train-v1 \
     --service-account=<SA_EMAIL> \
     --worker-pool-spec=machine-type=<MACHINE>,replica-count=1,accelerator-type=<ACCEL>,accelerator-count=1,container-image-uri=<REGION>-docker.pkg.dev/<PROJECT>/<REPO>/trainer:<TAG>
   gcloud ai custom-jobs stream-logs <JOB_ID> --region=<REGION>
   ```

   Check accelerator availability per zone with `gcloud compute accelerator-types list --filter="zone~<REGION>"`. Write outputs to GCS (the job sets `AIP_MODEL_DIR` when a base output directory is configured) and log runs to Vertex AI Experiments (`ml-experiment-tracking`).

   **Check:** `gcloud ai custom-jobs describe <JOB_ID> --region=<REGION> --format="value(state)"` prints `JOB_STATE_SUCCEEDED` and the artifacts exist in GCS.

6. **Register, deploy and canary.**

   ```bash
   gcloud ai models upload --region=<REGION> --display-name=churn-v3 \
     --container-image-uri=<SERVING_IMAGE> --artifact-uri=gs://<BUCKET>/models/churn/v3
   gcloud ai endpoints create --region=<REGION> --display-name=churn
   gcloud ai endpoints deploy-model <ENDPOINT_ID> --region=<REGION> --model=<MODEL_ID> \
     --display-name=churn-v3 --machine-type=<MACHINE> --min-replica-count=1 --max-replica-count=3 \
     --traffic-split=0=10,<CURRENT_DEPLOYED_MODEL_ID>=90
   gcloud ai endpoints predict <ENDPOINT_ID> --region=<REGION> --json-request=request.json
   ```

   In `--traffic-split`, `0` means the model being deployed. Use Google's prebuilt serving containers where they fit. Confirm with the user before shifting production traffic.

   **Check:** the new deployed model's latency and error metrics are healthy at 10% before raising its share.

7. **Use batch prediction for offline volume.** No endpoint, nothing idle. Gemini: `client.batches.create(model=..., src="gs://<BUCKET>/in.jsonl", config=types.CreateBatchJobConfig(dest="gs://<BUCKET>/out/"))` with a Vertex client (BigQuery `bq://` sources also work). Custom models: `aiplatform.Model(<MODEL_ID>).batch_predict(job_display_name=..., gcs_source=..., gcs_destination_prefix=..., machine_type=...)`.

   **Check:** output rows equal input rows, and the errors output was inspected.

8. **Make repeatable workflows pipelines.**

   ```python
   from kfp import compiler, dsl
   from google.cloud import aiplatform

   @dsl.component(base_image="python:3.12")
   def check_rows(rows: int) -> bool:
       return rows > 0

   @dsl.pipeline(name="train-eval")
   def pipeline(rows: int = 1000):
       check_rows(rows=rows)

   compiler.Compiler().compile(pipeline, "pipeline.yaml")
   aiplatform.init(project=PROJECT, location=REGION, staging_bucket=f"gs://{BUCKET}")
   aiplatform.PipelineJob(display_name="train-eval", template_path="pipeline.yaml",
                          pipeline_root=f"gs://{BUCKET}/pipeline-root",
                          parameter_values={"rows": 5000}).submit(service_account=SA_EMAIL)
   ```

   **Check:** the run succeeds, and a rerun with identical inputs reuses cached steps.

9. **Control quota and cost.** View quotas under IAM and Admin > Quotas, filtered to `aiplatform.googleapis.com`. GPU quotas are per region and accelerator type; request increases early. Endpoints bill per node-hour even with zero traffic: list them and, after the user confirms, run `gcloud ai endpoints undeploy-model <ENDPOINT_ID> --region=<REGION> --deployed-model-id=<ID>`. Label every resource and set budget alerts (`finops-cost`).

   **Check:** `gcloud ai endpoints list --region=<REGION>` shows only endpoints with an owner label and a purpose.

## Error map

| Error | Usual cause | Fix |
| :--- | :--- | :--- |
| 403 on predict or generate | Caller lacks `roles/aiplatform.user` | Grant it to the calling service account |
| 403 reading GCS or Artifact Registry in a job | Job SA or service agent lacks read access | Grant bucket or repository reader to that identity |
| 429 `RESOURCE_EXHAUSTED` | Quota or shared capacity | Backoff with jitter, request quota, Provisioned Throughput, or another region |
| 404 model not found | Model unavailable in that location, or wrong ID | List models for the region; try `global` where supported |
| Deployment fails for capacity | Accelerator stockout | Another region or machine type, or a reservation |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Leave dev endpoints deployed | Undeploy, or use batch prediction | Billed per node-hour while idle |
| Run jobs as the default compute SA with Editor | Per-workload SA with `roles/aiplatform.user` | Limits blast radius |
| Split data and compute across regions | Co-locate them | Egress cost, latency and residency |
| Move 100% of traffic at once | Traffic-split canary | Rollback is a split change, not a redeploy |

## Verification checklist

- [ ] Region chosen; data and compute co-located; model IDs verified for it.
- [ ] Workloads use dedicated service accounts with minimal roles; no key files.
- [ ] Cost-bearing actions (deploys, Provisioned Throughput, traffic shifts, undeploys) had user confirmation.
- [ ] Endpoints are labeled with an owner; budget alerts exist.
- [ ] Batch jobs reconcile input and output counts.

## Related

- Knowledge: `gemini-api`, `google-adk`, `model-serving`, `llm-fine-tuning`, `ml-experiment-tracking`, `gcp-iam`, `terraform-iac`, `finops-cost`, `vector-databases`.
- Agents: `ml-engineer`, `cloud-devops-engineer`, `gemini-ai-engineer`.
