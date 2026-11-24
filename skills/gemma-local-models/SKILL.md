---
name: gemma-local-models
disable-model-invocation: true
description: >-
  Runs open models such as Gemma locally or on-premises with Ollama,
  llama.cpp, LM Studio, MLX or Transformers: sizing model and GGUF
  quantization to the hardware, memory math, setting context length,
  OpenAI-compatible local endpoints, structured output, evaluating against a
  hosted model, licensing, and securing the local server. Use when the user
  wants a local or offline LLM, or asks which model fits their GPU or laptop.
---

# Gemma and Local Models

Local models trade some quality for privacy, offline use and zero per-token
cost. Size the model to the hardware first, set the context length
explicitly, and evaluate on your own task before replacing a hosted model.

## When to use

- "Run Gemma locally", "offline LLM", "which model fits my 16 GB GPU or my Mac", "set up Ollama or llama.cpp".
- Prototyping against a local OpenAI-compatible endpoint, or data that must not leave the machine.
- Choosing a model for on-device or edge features.

## When not to use

- Multi-user production serving with SLOs: `model-serving` (vLLM on GPUs) or `vertex-ai` (Model Garden).
- Training or adapting the model: `llm-fine-tuning`.
- Hosted Gemini: `gemini-api`. Choosing between hosted tiers for cost: `llm-cost-routing`.

## Workflow

1. **Inventory the hardware.**

   ```bash
   nvidia-smi --query-gpu=name,memory.total --format=csv     # NVIDIA, any OS
   system_profiler SPHardwareDataType | grep -E "Chip|Memory" # macOS unified memory
   ```

   On Windows without `nvidia-smi`, `Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM` works but `AdapterRAM` under-reports cards above 4 GB on many drivers.

   **Check:** you know the VRAM or unified memory and which GPU backend applies (CUDA, Metal, ROCm or Vulkan).

2. **Size the model.** Memory ≈ parameters x bytes per parameter + KV cache (grows with context) + 1-2 GB overhead.

   | Quantization | Bytes per parameter | Quality |
   | :--- | :--- | :--- |
   | BF16 / F16 | 2 | Reference |
   | Q8_0 | ~1.06 | Near-lossless |
   | Q5_K_M | ~0.7 | Small loss |
   | Q4_K_M | ~0.6 | Common default |
   | Q3 and below | under 0.5 | Noticeable loss; last resort |

   Example: 12B parameters at Q4_K_M is about 7.2 GB of weights, which fits a 12 GB GPU with moderate context. Check `https://ai.google.dev/gemma` for the current Gemma generation and sizes (including mobile-first variants), and pick the smallest size that passes your eval.

   **Check:** the estimate leaves at least 15% headroom.

3. **Run with Ollama (simplest path).**

   ```bash
   ollama pull gemma3:4b        # tags change; check ollama.com/library for current Gemma tags
   ollama run gemma3:4b "Summarize in one line: ..."
   ollama ps                    # loaded models, size, and CPU/GPU split
   ```

   Ollama's default context window is much smaller than the model's maximum, and longer prompts are truncated silently. Set it explicitly: `OLLAMA_CONTEXT_LENGTH=8192` for the server, `"options": {"num_ctx": 8192}` per request, or `PARAMETER num_ctx 8192` in a Modelfile. Endpoints: native `POST http://127.0.0.1:11434/api/chat` and OpenAI-compatible `/v1/chat/completions`.

   **Check:** `ollama ps` shows `100% GPU` for the model, and a prompt longer than the default window keeps its ending.

4. **Use llama.cpp when you need control.**

   ```bash
   llama-server -hf <hf-user>/<gemma-gguf-repo>:Q4_K_M -c 8192 -ngl 99 --host 127.0.0.1 --port 8080
   llama-server -m ./model-Q4_K_M.gguf -c 8192 -ngl 99 --host 127.0.0.1 --port 8080
   ```

   `-c` sets context, `-ngl` offloads layers to the GPU (99 means all). It serves an OpenAI-compatible API on `/v1/chat/completions`. On Apple silicon, MLX is fast (`pip install mlx-lm`, then `mlx_lm.generate --model <mlx-community-repo> --prompt "..."`). LM Studio offers a GUI and a local server on all three desktop platforms.

   **Check:** server logs report tokens per second, and GPU memory rose by about the estimated amount.

5. **Point the app at a local endpoint behind one interface.** Keep base URL and model name in config so the same code runs against local and hosted models.

   ```python
   import httpx

   def chat_local(prompt: str, model: str, base_url: str = "http://127.0.0.1:11434") -> str:
       """Call an OpenAI-compatible local server (Ollama, llama.cpp, LM Studio)."""
       r = httpx.post(f"{base_url}/v1/chat/completions", timeout=120.0,
                      json={"model": model, "messages": [{"role": "user", "content": prompt}]})
       r.raise_for_status()
       return r.json()["choices"][0]["message"]["content"]
   ```

   For JSON, constrain decoding: Ollama accepts a JSON Schema in `format`, and llama.cpp's server accepts JSON schemas and grammars. Validate the result anyway; small models break formats more often.

   **Check:** one config switch runs the same eval against local and hosted backends.

6. **Evaluate before committing.** Run your eval set (`agent-evals`) on each local candidate and the current hosted model; record quality, tokens per second, time to first token and peak memory. Test tool calling and long inputs specifically.

   **Check:** a decision table states which tasks run locally and which stay hosted.

7. **Secure and license.** Keep servers on `127.0.0.1`. Ollama binds there by default; setting `OLLAMA_HOST=0.0.0.0` exposes an unauthenticated API, so only do it behind an authenticating reverse proxy on a trusted network, and only with user approval. Download weights only from trusted publishers, preferring GGUF or safetensors over pickle `.bin` files. Gemma use is governed by the Gemma Terms of Use and its prohibited use policy; record the license for every model you ship.

   **Check:** `Get-NetTCPConnection -LocalPort 11434` (PowerShell) or `ss -ltn | grep 11434` (Linux) shows a listener on 127.0.0.1 only.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Trust the default context length | Set `num_ctx` or `-c` | Silent truncation of long prompts |
| Load the largest model that barely fits | Smallest model that passes the eval | Partial CPU offload cuts speed sharply |
| Bind to `0.0.0.0` | Localhost or an authenticating proxy | No auth: anyone on the network can use or pull models |
| Compare local and hosted by feel | Same eval set and graders | Anecdotes miss regressions |
| Load arbitrary pickle checkpoints | GGUF or safetensors from trusted sources | Pickle executes code |
| Assume Gemini-style tool calling works the same | Test the model's chat template and constrain output | Small models drift from formats |

## Verification checklist

- [ ] Hardware inventoried; memory estimate leaves headroom.
- [ ] Context length set explicitly and tested with a long prompt.
- [ ] The model runs fully on the GPU, or the CPU split is accepted knowingly.
- [ ] App code switches between local and hosted by config.
- [ ] The eval comparison is recorded with quality, speed and memory.
- [ ] Server listens on localhost only; model sources and licenses are recorded.

## Related

- Knowledge: `gemini-api`, `model-serving`, `llm-fine-tuning`, `llm-cost-routing`, `agent-evals`, `structured-extraction`, `responsible-ai`.
- Agents: `ml-engineer`, `security-guard`.
