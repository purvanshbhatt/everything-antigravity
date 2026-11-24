---
name: aws-essentials
disable-model-invocation: true
description: >-
  Covers AWS core services for application teams: IAM Identity Center and
  workload roles, VPC layout, choosing EC2, ECS on Fargate or Lambda, S3, RDS,
  CloudWatch, keyless CI with OIDC, and CDK or Terraform, with real aws CLI
  commands. Use when deploying an app to AWS, mapping Google Cloud concepts to
  AWS, fixing AccessDenied errors, or reviewing a new AWS account setup.
---

# AWS Essentials

Give an application team a safe, boring AWS baseline: humans through IAM
Identity Center, workloads through roles, private subnets for compute and data,
encrypted storage with public access blocked, logs with retention, and every
long-lived resource in code.

## When to use

- First workload on AWS, or a team used to Google Cloud now shipping to AWS.
- `AccessDenied`, `UnauthorizedOperation` or "not authorized to perform" errors.
- Choosing between EC2, ECS on Fargate and Lambda for a service.
- Reviewing an account for public buckets, IAM users with keys, or public databases.

## When not to use

- Google Cloud deploys: use `cloud-devops` and `cloud-run`. Azure: use `azure-essentials`.
- Module design, state and drift for Terraform: use `terraform-iac`.
- Kubernetes on EKS in depth: use `kubernetes-gke` for the Kubernetes parts; EKS specifics are out of scope here.
- Cost optimisation programmes: use `finops-cost`.

## Workflow

Commands use bash continuations (`\`). In PowerShell use a backtick or one line, and set profiles with `$env:AWS_PROFILE = "dev"` instead of `export AWS_PROFILE=dev`.

1. **Confirm identity, account and region.**

   ```bash
   aws configure sso                      # once per profile, browser-based login
   aws sso login --profile dev
   aws sts get-caller-identity --profile dev
   aws configure get region --profile dev
   ```

   **Check:** The `Account` and role ARN match what the user intends. Never act on a guessed account; ask.

2. **Audit the account baseline.** Humans use Identity Center (SSO) roles, not IAM users with access keys. The root user has MFA and no access keys.

   ```bash
   aws iam get-account-summary --query "SummaryMap.{rootMFA:AccountMFAEnabled,rootKeys:AccountAccessKeysPresent,users:Users}"
   aws iam list-users --query "Users[].UserName"
   aws iam list-access-keys --user-name USER
   aws accessanalyzer create-analyzer --analyzer-name account --type ACCOUNT   # external-access findings
   ```

   **Check:** `rootMFA` is 1, `rootKeys` is 0, and every remaining access key has an owner and a rotation date.

3. **Lay out the network.** One VPC per environment across at least two Availability Zones: public subnets for load balancers and NAT, private subnets for compute and databases. Add an S3 gateway endpoint so S3 traffic skips the NAT gateway.

   ```bash
   aws ec2 describe-vpcs --query "Vpcs[].{id:VpcId,cidr:CidrBlock,default:IsDefault}"
   aws ec2 describe-subnets --filters Name=vpc-id,Values=VPC_ID \
     --query "Subnets[].{id:SubnetId,az:AvailabilityZone,cidr:CidrBlock,public:MapPublicIpOnLaunch}"
   ```

   **Check:** Databases and tasks sit in subnets with no route to an internet gateway. Do not deploy into the default VPC for production.

4. **Pick compute** using the table below, then give each workload its own role. ECS uses a *task execution role* (pull images, write logs, read secrets at start) and a separate *task role* (what the app calls). Lambda uses an execution role.

   **Check:** No workload role has `AdministratorAccess` or `*:*`; policies name specific actions and resource ARNs.

5. **Debug permissions with evidence, not guesses.**

   ```bash
   aws iam simulate-principal-policy --policy-source-arn ROLE_ARN \
     --action-names s3:GetObject --resource-arns arn:aws:s3:::BUCKET/key.txt
   aws sts decode-authorization-message --encoded-message ENCODED   # for EC2-style encoded errors
   ```

   Check, in order: identity policy, resource policy (bucket, KMS key, queue), permissions boundary, SCPs from Organizations, and session policies.

   **Check:** The simulator returns `allowed` for the exact action and ARN before you change anything. Confirm IAM changes with the user.

6. **Secure S3.** Keep Block Public Access on, enable versioning for anything you cannot regenerate, and hand out presigned URLs instead of public objects.

   ```bash
   aws s3api put-public-access-block --bucket BUCKET --public-access-block-configuration \
     BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws s3api put-bucket-versioning --bucket BUCKET --versioning-configuration Status=Enabled
   aws s3 presign s3://BUCKET/report.pdf --expires-in 900
   ```

   **Check:** `aws s3api get-public-access-block --bucket BUCKET` shows all four flags `true`.

7. **Run RDS privately.** Multi-AZ for production, automated backups, encryption, deletion protection, and a Secrets Manager-managed master password (`--manage-master-user-password` on create) so nobody types it.

   ```bash
   aws rds describe-db-instances --query \
     "DBInstances[].{id:DBInstanceIdentifier,multiAZ:MultiAZ,public:PubliclyAccessible,encrypted:StorageEncrypted,backupDays:BackupRetentionPeriod,protect:DeletionProtection}"
   ```

   **Check:** `public` is false and `backupDays` is at least 7 for anything that matters.

8. **Make logs useful and bounded.**

   ```bash
   aws logs tail /aws/lambda/FUNCTION --follow --since 15m
   aws logs put-retention-policy --log-group-name /aws/lambda/FUNCTION --retention-in-days 30
   ```

   **Check:** No log group has "Never expire" unless compliance requires it; an alarm exists for 5xx or error count on each public entry point.

9. **Keyless CI.** Register the CI provider as an OIDC identity provider and let pipelines assume a deploy role whose trust policy pins the repository and branch.

   ```bash
   aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

   Trust policy condition: `"StringEquals": {"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"}` plus `"StringLike": {"token.actions.githubusercontent.com:sub": "repo:OWNER/REPO:ref:refs/heads/main"}`. Verify the current thumbprint guidance in the AWS docs.

   **Check:** CI secrets contain no `AWS_SECRET_ACCESS_KEY`.

10. **Codify and deploy with confirmation.** CDK: `npx cdk bootstrap aws://ACCOUNT_ID/REGION` once, then `npx cdk diff` and `npx cdk deploy`. Terraform: `terraform plan -out=tfplan` then `terraform apply tfplan`. Show the diff or plan to the user and get an explicit yes before any deploy, destroy or IAM change.

    **Check:** The applied change equals the reviewed diff; nothing was created by hand that is not in code.

## Reference

### Compute choice

| Workload | Use | Watch out for |
| :--- | :--- | :--- |
| HTTP service, steady traffic, containers | ECS on Fargate behind an ALB | NAT and ALB hourly costs; set task CPU/memory deliberately |
| Spiky or event-driven, short tasks | Lambda | 15-minute max duration, cold starts, concurrency limits per account |
| Needs OS access, GPUs, licensed software | EC2 in an Auto Scaling group | Patching is yours; use SSM Session Manager instead of SSH keys |
| Kubernetes already standard in the org | EKS | Control plane fee plus operational load |

### Google Cloud to AWS map

| Google Cloud | AWS |
| :--- | :--- |
| Project | Account (grouped under Organizations) |
| Service account | IAM role assumed by the workload |
| Workload Identity Federation | IAM OIDC identity provider plus role trust policy |
| Cloud Run | ECS on Fargate or Lambda |
| Cloud Storage | S3 |
| Cloud SQL / AlloyDB | RDS / Aurora |
| Pub/Sub | SNS plus SQS, or EventBridge |
| Secret Manager | Secrets Manager or SSM Parameter Store |
| Cloud Logging and Monitoring | CloudWatch Logs, Metrics, Alarms |
| Organization policies | Service control policies (SCPs) |

### Cost visibility

```bash
aws ce get-cost-and-usage --time-period Start=2026-11-01,End=2026-11-22 \
  --granularity MONTHLY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE
```

Create budgets with `aws budgets create-budget --account-id ACCOUNT_ID --budget file://budget.json --notifications-with-subscribers file://notify.json`; confirm amounts and recipients with the user.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| IAM users with long-lived access keys for people | Identity Center roles with short sessions | Leaked keys are the most common AWS breach path |
| Attach `AdministratorAccess` to get unblocked | Simulate, then grant the exact action and ARN | Broad grants persist long after the incident |
| Put RDS in public subnets with `PubliclyAccessible` | Private subnets, reach it via the app or SSM | Databases on the internet get brute-forced |
| Store secrets in Lambda or task env vars as plain text | Secrets Manager or SSM `SecureString` references | Plain env vars show up in consoles and describe calls |
| Leave log groups on "Never expire" | 14-90 day retention by default | Log storage quietly becomes a top cost line |
| Route all S3 traffic through NAT | S3 gateway endpoint | NAT data processing charges add up per GB |

## Verification checklist

- [ ] Account, region and role were confirmed before any change.
- [ ] Root has MFA and no keys; humans use Identity Center.
- [ ] Each workload has its own least-privilege role.
- [ ] Buckets have Block Public Access; RDS is private, encrypted, backed up.
- [ ] Log groups have retention and key alarms exist.
- [ ] CI uses OIDC, not access keys.
- [ ] Deploys, deletes and IAM changes were shown as a diff and confirmed by the user.

## Related

- Knowledge: `terraform-iac`, `cloud-networking`, `dns-tls`, `secrets-management`, `finops-cost`, `serverless-functions`, `docker-containers`, `azure-essentials`, `cloud-devops`.
- Workflows: `/security-scan`, `/verify`.
- Agents: `cloud-devops-engineer`, `security-guard`, `sre-engineer`.
