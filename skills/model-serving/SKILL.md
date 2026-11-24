---
name: model-serving
disable-model-invocation: true
description: >-
  Serves ML models and open LLMs in production: deciding whether to
  self-host, latency SLOs (TTFT, inter-token latency, p95), memory and KV-cache
  sizing, dynamic and continuous batching, quantization, vLLM and other
  inference servers, GPUs on GKE, Cloud Run or Vertex AI, autoscaling signals,
  load tests and canary rollouts. Use when putting a model behind an API, or
  when inference is slow, runs out of memory or costs too much.
---

# Model Serving

Serving is a capacity problem with a latency contract. Write the SLO, measure
the model's real throughput on the target hardware with real traffic shapes,
then choose the cheapest stack and scaling signal that holds the SLO.

## When to use

- Putting a classic model, an embedding model or an open LLM such as Gemma behind an API.
- p95 latency or cost per request is too high, GPUs sit underused, or the server runs out of memory under load.
- Choosing between a hosted API, a managed endpoint and self-hosting.

## When not to use

- Calling Gemini: no serving needed; see `gemini-api` and `llm-cost-routing`.
- Vertex AI endpoint commands (upload, deploy, traffic split): `vertex-ai`.
- A single user running a model on a laptop: `gemma-local-models`.
- Cluster and service basics: `kubernetes-gke`, `cloud-run`.

## Workflow

1. **Decide whether to self-host.**

   | Option | Choose when |
   | :--- | :--- |
   | Hosted API (Gemini) | Quality per dollar wins and data may leave your boundary under the provider's terms |
   | Managed endpoint (Vertex Model Garden, managed APIs) | You need an open model without running GPUs yourself |
   | Self-host (GKE, Cloud Run with GPUs, VMs) | Custom weights or adapters, strict latency, or sustained utilization that makes GPU hours cheaper than tokens |

   **Check:** a written comparison at expected volume: hosted price per 1M tokens versus GPU price per hour divided by measured tokens per hour.

2. **Write the SLO and workload model.** For LLMs: p95 time to first token (TTFT), p95 inter-token latency, peak requests per second, concurrency, and input and output token distributions (p50 and p95). For classic models: p95 latency, RPS and payload size. Capture a sample of real or realistic requests for load tests.

   **Check:** an SLO artifact with numbers and a replayable request set exists.

3. **Size memory before buying hardware.**
   - Weights: parameters x bytes per parameter (bf16 = 2, int8 or fp8 = 1, 4-bit about 0.5-0.6).
   - KV cache per token: 2 x layers x KV heads x head dim x bytes per element.
   - KV total: per-token size x max context x concurrent sequences. Keep 10-20% headroom.

   If it doesn't fit: quantize, shard with tensor parallelism, cap the context, or use a smaller model.

   **Check:** the computed footprint is below GPU memory times the server's memory fraction.

4. **Pick the server.**

   | Workload | Server |
   | :--- | :--- |
   | Open LLMs, many concurrent users | vLLM (continuous batching, paged KV cache, prefix caching, OpenAI-compatible API) or SGLang |
   | NVIDIA-optimized, mixed frameworks | Triton Inference Server, TensorRT-LLM |
   | Small sklearn, XGBoost or PyTorch models | FastAPI or BentoML on Cloud Run, KServe on GKE, or Vertex prebuilt containers |
   | TPUs | Check current Google docs for supported LLM servers on TPU |

   Hugging Face TGI and TorchServe: check each project's maintenance status before adopting.

   **Check:** the choice and its reason are in the design doc.

5. **Start the server and measure.**

   ```bash
   vllm serve <hf-model-id> --max-model-len 8192 --gpu-memory-utilization 0.90 \
     --max-num-seqs 64 --enable-prefix-caching --port 8000
   curl -s localhost:8000/v1/models
   curl -s localhost:8000/metrics | grep -E "num_requests_(running|waiting)"
   ```

   Flags change between releases; confirm with `vllm serve --help`. Gated models such as Gemma need license acceptance on Hugging Face and `HF_TOKEN` from a secret store. Benchmark with your request set: recent vLLM ships `vllm bench serve` (check `vllm bench --help`), or drive the OpenAI-compatible endpoint with k6 or Locust (`load-testing`). Sweep concurrency 1, 4, 16, 64 and record TTFT p50/p95, inter-token latency, output tokens per second and errors.

   **Check:** a table of concurrency versus TTFT p95 and throughput identifies the knee where the SLO breaks.

6. **Tune one lever at a time.**

   | Lever | Effect | Watch |
   | :--- | :--- | :--- |
   | Batch size (`--max-num-seqs`; dynamic batching delay in Triton) | Throughput up | TTFT up |
   | Quantization (fp8, AWQ, GPTQ, int8) | Memory down, more concurrency | Quality: rerun evals |
   | Prefix caching | Faster shared system prompts | Memory |
   | Lower max context | More concurrent sequences | Truncation of long inputs |
   | Tensor parallelism | Fits bigger models, lower latency | Interconnect overhead |
   | Speculative decoding | Lower latency at low load | Gains vary by workload |

   **Check:** after each change, the benchmark and the quality eval (`ml-evaluation` or `agent-evals`) are rerun and within tolerance.

7. **Autoscale on the right signal.** LLM servers are GPU-bound, so CPU is the wrong metric. Scale on queue depth (vLLM exposes `vllm:num_requests_waiting`) or KV-cache use via custom metrics on GKE (check current GKE inference routing features as well). Cloud Run with GPUs: set concurrency and max instances; cold starts include model load, so keep minimum instances at 1 or more for latency-sensitive paths and bake weights into the image or stream them from GCS. Vertex endpoints: min and max replicas.

   **Check:** a ramp test shows scale-out before the SLO breaks, and scale-in drains in-flight requests (grace period longer than the longest generation).

8. **Roll out with a canary.** Send 5-10% of traffic (or shadow traffic) to the new version, compare latency, errors and sampled quality, then ramp. Keep the old version deployed until the ramp finishes. Cloud Run: `gcloud run services update-traffic <SERVICE> --to-revisions=<NEW_REVISION>=10`. Confirm with the user before shifting production traffic.

   **Check:** rollback was exercised once by shifting traffic back.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Autoscale LLM pods on CPU | Queue depth or KV-cache use | CPU stays low while requests queue |
| Benchmark one short prompt | Replay the real length distribution | Batching and KV behaviour depend on lengths |
| Quantize without evals | Eval before and after | Quality loss hides in edge cases |
| Set max context to the model maximum | Use the real p99 need | KV cache consumes concurrency |
| Download weights on every cold start | Bake into the image or cache in GCS | Minutes of cold start and rate limits |
| Expose the inference server directly | Authenticating gateway, rate limits, request size caps | Open GPU endpoints get abused |

## Verification checklist

- [ ] SLO and workload model are written, with a replayable request set.
- [ ] Memory math matches observed usage.
- [ ] A concurrency sweep found the SLO knee on target hardware.
- [ ] Quality evals passed after quantization or config changes.
- [ ] Autoscaling uses queue or KV signals and was ramp-tested.
- [ ] Canary and rollback were tested; traffic shifts were user-approved.
- [ ] The endpoint requires auth and enforces size and rate limits.

## Related

- Knowledge: `vertex-ai`, `gemma-local-models`, `llm-fine-tuning`, `kubernetes-gke`, `cloud-run`, `load-testing`, `observability-otel`, `llm-observability`, `llm-cost-routing`, `finops-cost`.
- Agents: `ml-engineer`, `sre-engineer`, `performance-optimizer`.
