---
name: computer-vision
description: >-
  Builds computer vision systems: framing classification, detection and
  segmentation tasks, testing Gemini zero-shot before training, dataset
  collection and labeling guidelines, leakage-safe splits, transfer learning
  and augmentation, metrics such as mAP, IoU and per-class recall, export to
  ONNX or LiteRT, and cloud or edge deployment with monitoring. Use when
  training or shipping an image or video model, or deciding whether one is
  needed.
---

# Computer Vision

Start from the decision the model supports, and test whether a zero-shot
multimodal model already meets the bar on your images. Train only for lower
latency or cost, offline or edge inference, or accuracy that prompting cannot
reach. After that, the dataset decides the outcome more than the
architecture.

## When to use

- Classifying, detecting, segmenting or tracking objects in images or video.
- Planning a labeling effort, or a model that is too slow, too costly or wrong in production.
- Exporting a model for mobile, browser or edge devices.

## When not to use

- One-off image questions, captions or coarse boxes: `multimodal-understanding`.
- Image generation: `ai-image-generation`. Image manipulation in apps: `image-processing-canvas`.
- Training-loop bugs, NaNs and speed: `pytorch-training`.

## Workflow

1. **Frame the task and its operating point.**

   | Task | Output | Typical metric |
   | :--- | :--- | :--- |
   | Classification (single or multi-label) | Labels per image | Per-class precision and recall, macro-F1 |
   | Detection | Boxes and classes | mAP@[.5:.95], AP50, recall at threshold |
   | Segmentation (semantic or instance) | Masks | mIoU, Dice, mask AP |
   | Keypoints or pose | Points | PCK, OKS-based AP |
   | Tracking | Identities across frames | HOTA, IDF1 |
   | Similarity search | Embeddings | Recall@k |

   Decide which error costs more (missed defect or false alarm), the minimum object size in pixels, and the latency budget on target hardware.

   **Check:** a one-paragraph spec names the metric and threshold, e.g. "defect recall at least 0.95 at precision at least 0.8".

2. **Run a zero-shot baseline.** Score Gemini on 100-200 labeled images with schema output (`multimodal-understanding`) using the same metric, and record cost per 1,000 images and latency.

   **Check:** if the baseline meets the spec within budget, stop here and ship that.

3. **Collect and label.** Sample from the deployment distribution: same cameras, lighting, angles and resolution; deliberately cover rare classes. Write labeling guidelines with edge-case examples, label in Label Studio or CVAT, double-label a 5-10% overlap to measure agreement, and use model-assisted pre-labels that humans correct. Pick one annotation format (COCO JSON, YOLO txt or Pascal VOC) and convert with a tested script.

   **Check:** the guideline document, agreement score and per-class counts table exist.

4. **Split without leakage.** Group by source (video, site, device, patient, day) so near-duplicate frames never cross splits; detect near-duplicates with perceptual hashing (`imagehash`). Use time-based splits when drift is expected. Touch the test set once, at the end.

   **Check:** an assertion confirms no group ID appears in two splits, and the cross-split near-duplicate scan is clean.

5. **Train with transfer learning.** Start from pretrained weights: `torchvision` or `timm` for classification; torchvision detection models, Detectron2 or Ultralytics YOLO for detection (Ultralytics is AGPL-3.0 unless commercially licensed; check before shipping); SAM-family models for promptable segmentation and faster labeling. Augment to match reality with `albumentations` or `torchvision.transforms.v2` (both transform boxes and masks with the image): flips only when semantics allow (not for text or left/right classes), color jitter and blur for camera variance, scale and crop for distance. For managed training on Google Cloud, use Vertex AI custom jobs (`vertex-ai`).

   **Check:** curves are logged (`ml-experiment-tracking`) and the one-batch overfit passes.

6. **Evaluate properly.** Use library metrics (`pycocotools`, or `torchmetrics.detection.MeanAveragePrecision`), not hand-rolled ones. Slice by object size, lighting, camera and site. Pick the confidence threshold on validation for the operating point, then report test once with confidence intervals (`ml-evaluation`).

   **Check:** an error gallery of the top false positives and false negatives is saved as an artifact and reviewed.

7. **Export and deploy.** Export with `torch.onnx.export` and check numerical parity on 100 images; run with ONNX Runtime or TensorRT on servers; LiteRT (formerly TensorFlow Lite) or MediaPipe on mobile and edge. Quantize to int8 with a calibration set, then re-evaluate. Share one preprocessing function between training and serving (resize mode, normalization, RGB versus BGR).

   **Check:** the exported model's metric is within 0.5 points of the PyTorch model, and a unit test compares preprocessing outputs tensor for tensor.

8. **Monitor in production.** Log input statistics (brightness, resolution, blur), prediction and confidence distributions; route a sample to human review; define retraining triggers for drift.

   **Check:** the dashboard and review queue exist with an owner.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Randomly split frames from the same video | Group split by source | Near-duplicates inflate scores |
| Train before trying zero-shot | Baseline first | Training may be unnecessary |
| Report accuracy on imbalanced classes | Per-class precision and recall | Accuracy hides the rare class |
| Re-implement preprocessing for serving | One shared function with a parity test | Silent accuracy loss (BGR versus RGB, resize mode) |
| Use augmentations that change the label | Semantics-aware augmentation | Teaches the wrong thing |
| Ignore model and dataset licenses | Check before shipping | AGPL and non-commercial terms bite late |

## Verification checklist

- [ ] The spec defines the metric, threshold and latency budget.
- [ ] A zero-shot baseline was measured.
- [ ] Labeling guidelines and agreement exist; splits are grouped and deduplicated.
- [ ] Metrics come from standard libraries and are sliced; the threshold was set on validation.
- [ ] Export parity and shared preprocessing are tested.
- [ ] Production monitoring and a review queue are in place.

## Related

- Knowledge: `multimodal-understanding`, `pytorch-training`, `ml-evaluation`, `ml-experiment-tracking`, `model-serving`, `vertex-ai`, `responsible-ai`, `mobile-performance`.
- Agents: `ml-engineer`, `data-engineer`.
