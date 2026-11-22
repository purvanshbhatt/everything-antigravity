---
name: pytorch-training
description: >-
  Builds and debugs PyTorch training code: Dataset and DataLoader setup, a
  correct train and eval loop, mixed precision with autocast, gradient
  clipping, resumable checkpoints, torch.compile, multi-GPU with torchrun and
  DDP, determinism, and a triage procedure for NaN or exploding losses. Use
  when writing a training script, when loss is NaN or flat, or when training
  is slow or not reproducible.
---

# PyTorch Training

Write training code that is correct first, fast second and resumable always.
Most "the model won't learn" bugs are loop bugs (eval mode, gradient zeroing,
wrong loss inputs), not architecture bugs, so prove the loop on one batch
before scaling anything.

## When to use

- Writing or reviewing `train.py`, a custom loop, a `Dataset` or a `collate_fn`.
- Loss is NaN, inf, flat or diverging; GPU utilization is low; runs differ from each other.
- Adding mixed precision, checkpoint and resume, `torch.compile` or multi-GPU training.

## When not to use

- LLM fine-tuning with adapters: `llm-fine-tuning` (TRL and PEFT wrap this loop for you).
- Logging and comparing runs: `ml-experiment-tracking`. Choosing metrics and splits: `ml-evaluation`.
- Managed training jobs on Google Cloud: `vertex-ai`. Serving the trained model: `model-serving`.

## Workflow

1. **Pin the environment and confirm the device.**

   ```bash
   python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.backends.mps.is_available())"
   nvidia-smi
   ```

   Install the wheel for your CUDA version from the selector on pytorch.org (the index URL differs per CUDA build; copy it from there, don't guess). Pin `torch` in `requirements.txt` or `pyproject.toml`.

   **Check:** the accelerator you expect prints `True`, and the version is pinned.

2. **Build the data path and inspect one batch.** Decode and augment inside `Dataset.__getitem__` so the work runs in worker processes. DataLoader: `num_workers` above 0 (start near CPU cores per GPU, rarely above 8), `pin_memory=True` on CUDA, `persistent_workers=True`, `drop_last=True` for training with BatchNorm. Seed workers through `worker_init_fn` and a `torch.Generator`. Print shapes, dtypes, min/max and the label histogram of one batch, and decode a few samples back to images or text.

   **Check:** shapes match the loss contract, e.g. `CrossEntropyLoss` takes raw logits `[N, C]` and int64 targets `[N]`.

3. **Write the loop with the invariants in the pattern below.** `model.train()` before training, `model.eval()` plus `torch.inference_mode()` for evaluation, one `zero_grad` per optimizer step.

   **Check:** a code read confirms each invariant; delegate to the `python-reviewer` subagent for a second pass on large loops.

4. **Overfit one batch.** Train about 200 steps on a single fixed batch with augmentation and dropout off. If loss does not approach zero, the defect is in the model, loss or labels, not in data volume or hyperparameters.

   **Check:** single-batch loss drops by more than 90%.

5. **Scale to the full data with a baseline config.** Run a short learning-rate range test (raise LR exponentially for a few hundred steps; choose about one tenth of the LR where loss explodes), then warmup plus cosine or one-cycle. Log train and val loss, LR, gradient norm and samples per second every N steps.

   **Check:** val loss falls during the first epoch, and gradient norm is finite and not rising steadily.

6. **Add speed only after correctness.** Use bf16 autocast on GPUs and TPUs that support it (no scaler needed); fp16 needs `torch.amp.GradScaler`. Then try `torch.compile(model)` (the first steps are slow while it compiles), `channels_last` for CNNs and the largest batch that fits. If GPU utilization stays under ~70%, profile with `torch.profiler` and look at the data loader first.

   **Check:** throughput improved, and the final val metric is within noise of the fp32 run.

7. **Make runs resumable.** Save model, optimizer, scheduler, scaler, epoch, step, RNG states and the resolved config. Write to a temp file, then rename. Load with `torch.load(path, map_location=device, weights_only=True)`; recent releases default to `weights_only=True` (check your version), and full checkpoints that need `weights_only=False` must be files you produced yourself.

   **Check:** kill a run mid-epoch, resume, and the loss curve continues without a jump.

8. **Go multi-GPU last.** `torchrun --standalone --nproc_per_node=<gpus> train.py`, wrap the model in `DistributedDataParallel`, use `DistributedSampler` and call `sampler.set_epoch(epoch)` every epoch, save and log from rank 0 only, and scale LR with the global batch. Use FSDP when the model does not fit on one GPU.

   **Check:** scaling efficiency is at least ~80%, and the val metric matches single-GPU training at the same global batch.

## Patterns

### Training step (bf16, accumulation, clipping)

```python
import torch
from torch import nn

def train_epoch(model, loader, optimizer, scheduler, device, accum_steps: int = 1, max_norm: float = 1.0) -> None:
    model.train()
    loss_fn = nn.CrossEntropyLoss()
    optimizer.zero_grad(set_to_none=True)
    for step, (x, y) in enumerate(loader, start=1):
        x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
        with torch.autocast(device_type=device.type, dtype=torch.bfloat16):
            loss = loss_fn(model(x), y) / accum_steps
        loss.backward()
        if step % accum_steps == 0:
            norm = torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)
            if not torch.isfinite(norm):
                raise FloatingPointError(f"non-finite grad norm at step {step}")
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)

@torch.inference_mode()
def evaluate(model, loader, device) -> float:
    model.eval()
    correct = total = 0
    for x, y in loader:
        pred = model(x.to(device)).argmax(dim=1)
        correct += (pred == y.to(device)).sum().item()
        total += y.numel()
    return correct / total
```

fp16 instead: `scaler = torch.amp.GradScaler("cuda")`, `scaler.scale(loss).backward()`, `scaler.unscale_(optimizer)` before clipping, then `scaler.step(optimizer)` and `scaler.update()`. The scaler skips steps with inf gradients, so drop the NaN guard in that mode.

### NaN and divergence triage

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| NaN at step 0 or 1 | NaN or inf in inputs or labels, `log(0)`, division by zero | Assert `torch.isfinite(x).all()` on a batch; use `log_softmax` or the fused loss; add epsilons |
| NaN after N steps, grad norm climbing | LR too high, no warmup, no clipping | Lower LR 3-10x, add warmup, clip at 1.0 |
| NaN only in fp16 | Overflow | Switch to bf16 or use GradScaler; keep softmax and loss in fp32 |
| Loss flat from the start | Labels misaligned with inputs, frozen params, softmax before CE, LR near zero | Overfit one batch; check `requires_grad` and optimizer param groups |
| Val diverges from train early | Leakage, overfitting, eval mode missing | Check splits (`ml-evaluation`), regularize, call `model.eval()` |
| Need the exact op | | `torch.autograd.set_detect_anomaly(True)` for a few steps only (slow) |

### Reproducibility

```python
import os, random
import numpy as np
import torch

def seed_everything(seed: int) -> None:
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"   # set before the first CUDA call
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)            # raises on nondeterministic ops
    torch.backends.cudnn.benchmark = False
```

Use deterministic mode for debugging and baselines; it costs speed.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Tune hyperparameters before the one-batch overfit | Prove the loop first | No LR fixes a loop bug |
| Call `loss.item()` every step | Log every N steps | Each call forces a GPU sync |
| Append `loss` tensors to a list | Append `loss.detach()` or a float | Keeps every graph alive: a memory leak |
| Softmax, then `CrossEntropyLoss` | Pass raw logits | The loss already applies log-softmax |
| Save only `model.state_dict()` | Save optimizer, scheduler, scaler, step and RNG | Resume otherwise resets momentum and schedule |
| `torch.load` an untrusted file with `weights_only=False` | `weights_only=True` or safetensors | Pickle runs arbitrary code |

## Verification checklist

- [ ] `torch` and the CUDA build are pinned; the device was confirmed.
- [ ] The one-batch overfit passed.
- [ ] Train and eval modes, `zero_grad` placement and `inference_mode` are correct.
- [ ] Gradient norm is logged, clipping is on, and the NaN guard names the step.
- [ ] A mid-epoch kill and resume continues the curve.
- [ ] Seed, config, git SHA and data version are logged per run.
- [ ] Mixed-precision results match fp32 within noise.

## Related

- Knowledge: `ml-experiment-tracking`, `ml-evaluation`, `llm-fine-tuning`, `computer-vision`, `vertex-ai`, `model-serving`, `profiling`, `python-patterns`.
- Agents: `ml-engineer`, `python-reviewer`, `performance-optimizer`.
