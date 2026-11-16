---
name: cloud-devops
description: "Deploy and manage containerized cloud applications on Google Cloud Platform (Cloud Run, GKE), Terraform, and GitHub Actions CI/CD."
---

# Cloud DevOps & Infrastructure Engineering

## Overview
Manage cloud environments, continuous delivery pipelines, and container infrastructure with a strong emphasis on Google Cloud Platform (GCP).

## Cloud Architecture Standards
1. **Serverless Containers (Google Cloud Run)**:
   - Stateless HTTP services scaling automatically from 0 to N instances.
   - Concurrency tuning and CPU allocation during request processing.
   - Secure private communication using Serverless VPC Access.
2. **Infrastructure as Code (Terraform)**:
   - Modular, reusable Terraform configurations with state stored in encrypted GCS buckets.
   - Declarative IAM role bindings using the principle of least privilege.
3. **CI/CD Automation (GitHub Actions)**:
   - Hermetic multi-stage Docker builds.
   - Automated testing, linting, and vulnerability scanning on every PR.
   - Zero-downtime blue/green or canary rollouts.
4. **Observability & SRE**:
   - Structured JSON logging with standardized trace IDs compatible with Cloud Trace.
   - Metric alerts on error rates (HTTP 5xx) and latency percentiles (p95, p99).
