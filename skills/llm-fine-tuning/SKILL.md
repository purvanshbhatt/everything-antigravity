---
name: llm-fine-tuning
description: >-
  Decides when to fine-tune an LLM instead of prompting or RAG, then does it:
  baseline evals, dataset design and cleaning, supervised tuning of Gemini on
  Vertex AI, LoRA and QLoRA on open models such as Gemma with PEFT and TRL,
  starting hyperparameters, overfitting checks, evaluation against the
  prompted baseline, and serving adapters. Use when the user asks to
  fine-tune, train a model on their data, or distill into a smaller model.
---

# LLM Fine-Tuning

Fine-tuning changes behaviour: format, style, a narrow skill, or the same
quality from a smaller and cheaper model. It is a poor way to add facts. Prove
that prompting and retrieval fall short on a fixed eval set before spending on
data and accelerators.

## When to use

- "Fine-tune Gemini or Gemma on our data", "train a model for this task", "distill this into something cheaper".
- A prompted model misses the format or style target despite schemas and examples.
- A high-volume narrow task where a small tuned model could replace a larger prompted one.

## When not to use

- Facts that change or must be cited: `rag-pipelines`.
- Prompt and schema improvements: `prompt-engineering`. Model routing for cost: `llm-cost-routing`.
- Generic training-loop bugs: `pytorch-training`. Serving the result: `model-serving` or `vertex-ai`.
- Running Gemma locally without tuning: `gemma-local-models`.

## Workflow

1. **Decide with an eval, not a hunch.**

   | Symptom | Try first | Tune when |
   | :--- | :--- | :--- |
   | Wrong or stale facts | RAG | Not for facts alone |
   | Inconsistent output format | Schema output plus few-shot | Format still fails often with a schema |
   | Domain tone or style | System instruction plus examples | The long prompt is too costly per call |
   | Narrow task at high volume | Flash-Lite with a good prompt | A tuned small model matches a larger prompted one |
   | Offline or on-device | Small open model | Usually (Gemma with LoRA) |

   Build 100-300 held-out cases with graders (`agent-evals`) and score the best prompted baseline.

   **Check:** baseline scores, a target metric and a pass threshold are recorded.

2. **Build the dataset.** Quality beats quantity: start with a few hundred to a few thousand clean examples that match the production input distribution, including hard and negative cases. Deduplicate (exact and near), remove PII and secrets, balance labels, and keep train, validation and test disjoint by source so paraphrases don't leak. If a stronger model generates synthetic examples, confirm its terms allow training use and review samples by hand.

   Vertex AI Gemini supervised tuning reads JSONL like this (check the current dataset-format page):

   ```json
   {"systemInstruction": {"role": "system", "parts": [{"text": "Classify support tickets."}]}, "contents": [{"role": "user", "parts": [{"text": "I was charged twice"}]}, {"role": "model", "parts": [{"text": "{\"category\": \"billing\"}"}]}]}
   ```

   Open models use chat `messages` rendered with the model's own template (`tokenizer.apply_chat_template`).

   **Check:** a validation script passes every line (schema, token length, non-empty answer), and `eag shield --file train.jsonl` reports no secrets.

3. **Option A: supervised tuning of Gemini on Vertex AI.** Which base models accept tuning changes; read the "supported models" page. Tuning is billed by training tokens times epochs, so state the estimate and get user confirmation before starting.

   ```python
   from google import genai
   from google.genai import types

   client = genai.Client(vertexai=True, project=PROJECT, location=REGION)
   job = client.tunings.tune(
       base_model=BASE_MODEL,                       # from the supported-models page
       training_dataset=types.TuningDataset(gcs_uri="gs://<BUCKET>/train.jsonl"),
       config=types.CreateTuningJobConfig(
           tuned_model_display_name="ticket-classifier-v1",
           validation_dataset=types.TuningValidationDataset(gcs_uri="gs://<BUCKET>/val.jsonl"),
           epoch_count=3,
       ),
   )
   job = client.tunings.get(name=job.name)          # poll until the state is terminal
   # Then call: client.models.generate_content(model=job.tuned_model.endpoint, contents=...)
   ```

   Verify field names against your installed SDK. Tuning availability on the Gemini Developer API has changed over time; check its docs before planning on it.

   **Check:** the job succeeded and validation loss flattened rather than rising.

4. **Option B: LoRA or QLoRA on an open model.** Accept the model license on Hugging Face (Gemma is governed by the Gemma Terms of Use) and load `HF_TOKEN` from a secret store. Starting points: LoRA rank 8-16, alpha twice the rank, dropout 0.05, all linear projections, learning rate 1e-4 to 2e-4, 1-3 epochs, bf16, max sequence length from the data's p99. Use 4-bit QLoRA when memory is tight. Alternatives: KerasHub (`backbone.enable_lora(rank=...)`), Unsloth for single-GPU speed, or Vertex custom jobs and Model Garden tuning notebooks for managed GPUs.

   **Check:** training loss falls, validation loss is logged every eval step, and the best checkpoint is the validation minimum.

5. **Evaluate against the baseline.** Same held-out set, same graders. Also run regression probes: a few dozen unrelated general prompts, safety prompts (`responsible-ai`) and format checks. Compare cost and latency per request.

   **Check:** the tuned model beats the baseline by the pre-set margin with no safety regression, and results are logged (`ml-experiment-tracking`).

6. **Ship and maintain.** Gemini: call the tuned endpoint, version dataset and config together, and plan to retune when the base model is deprecated. Open models: serve the adapter with vLLM (`--enable-lora --lora-modules <name>=<path>`) or merge it (`model.merge_and_unload()` in PEFT) and quantize; pin base and adapter versions.

   **Check:** a smoke run of the eval subset passes against the deployed artifact.

## Patterns

### QLoRA with TRL and PEFT

```python
import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer

MODEL_ID = "<gemma-instruct-model-id>"    # from the model card; license acceptance required
tok = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID, torch_dtype=torch.bfloat16,
    quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                           bnb_4bit_compute_dtype=torch.bfloat16),  # omit for plain LoRA
)
data = load_dataset("json", data_files={"train": "train.jsonl", "validation": "val.jsonl"})
trainer = SFTTrainer(
    model=model, processing_class=tok,
    train_dataset=data["train"], eval_dataset=data["validation"],
    peft_config=LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05,
                           target_modules="all-linear", task_type="CAUSAL_LM"),
    args=SFTConfig(output_dir="out/lora", num_train_epochs=2, learning_rate=2e-4,
                   per_device_train_batch_size=4, gradient_accumulation_steps=4, bf16=True,
                   eval_strategy="steps", eval_steps=50, save_strategy="steps", save_steps=50,
                   logging_steps=10, load_best_model_at_end=True),
)
trainer.train()
trainer.save_model("out/lora")   # saves the adapter only
```

TRL and Transformers rename arguments often (`processing_class` versus `tokenizer`, `torch_dtype` versus `dtype`, sequence-length options); check against the installed versions.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Tune to teach facts | Use RAG | Facts drift; tuned models state them confidently and wrongly |
| Evaluate on examples like the training set | Source-disjoint held-out set | Leakage inflates scores |
| Scale data before checking quality | 200 clean examples first | The model learns the noise |
| Train until training loss nears zero | Stop at the validation minimum | Memorization and format collapse |
| Ignore base-model and synthetic-data terms | Check both licenses | Legal exposure |
| Forget the base model's lifecycle | Keep the dataset and retune on deprecation | The tuned model retires with its base |

## Verification checklist

- [ ] A prompted baseline was scored on a fixed held-out set before tuning.
- [ ] The dataset is deduplicated, PII-free, source-disjoint and validated line by line.
- [ ] Cost-bearing tuning jobs had user confirmation.
- [ ] The best checkpoint was chosen on validation, not training loss.
- [ ] The tuned model beats the baseline with no safety or general-capability regression.
- [ ] Base model, adapter, dataset and config versions are pinned and logged.

## Related

- Knowledge: `prompt-engineering`, `rag-pipelines`, `agent-evals`, `ml-evaluation`, `pytorch-training`, `vertex-ai`, `gemma-local-models`, `model-serving`, `ml-experiment-tracking`, `responsible-ai`.
- Agents: `ml-engineer`, `gemini-ai-engineer`.
