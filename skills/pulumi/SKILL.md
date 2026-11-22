---
name: pulumi
description: >-
  Builds and reviews infrastructure with Pulumi in TypeScript, Python or Go:
  stacks per environment, state backends (including GCS), config and encrypted
  secrets with Cloud KMS, component resources, resource options, imports,
  policy packs and preview-driven changes, plus when to pick Pulumi over
  Terraform. Use when writing Pulumi programs, before any pulumi up, when
  state drifts, or when converting Terraform to Pulumi.
---

# Pulumi

Infrastructure as real code, with the same discipline as any other IaC: one
stack per environment, secrets encrypted in config, and no `pulumi up` on a
shared stack until the user has seen the preview. The preview is the contract.

**Apply policy.** The agent may run `preview`, `stack ls`, `stack output`,
`config get` and `whoami` freely. `up`, `destroy`, `refresh` (which rewrites
state), `import`, `state delete`, `cancel` and any `--yes` on a shared stack
require the user's explicit yes after they have seen the preview summary.

## When to use

- Writing or reviewing a Pulumi program (`Pulumi.yaml`, `Pulumi.<stack>.yaml`, `index.ts`, `__main__.py`, `main.go`).
- Creating stacks, moving state backends, or setting config and secrets.
- Packaging reusable infrastructure as component resources.
- Adopting existing resources, renaming resources without replacement, or converting from Terraform.

## When not to use

- The team already runs Terraform or OpenTofu well: stay with `terraform-iac`; mixing tools per resource splits ownership.
- Host configuration inside VMs: use `ansible`.
- Kubernetes manifests delivered by GitOps: use `gitops-argocd` or `helm-charts`.
- Choosing which Google Cloud services to use: start with `cloud-devops`.

## Workflow

1. **Orient.** `view_file` `Pulumi.yaml` (runtime, backend) and every `Pulumi.<stack>.yaml`. Run `pulumi whoami -v` and `pulumi stack ls` to see the backend and the stacks.

   **Check:** You can name the backend URL, the runtime and the stack the request targets.

2. **Pick a backend and secrets provider.** Pulumi Cloud, or self-managed state in a versioned GCS bucket. With self-managed state, encrypt secrets with Cloud KMS instead of a passphrase.

   ```bash
   pulumi login gs://acme-pulumi-state
   pulumi stack init prod --secrets-provider="gcpkms://projects/acme-ops/locations/global/keyRings/pulumi/cryptoKeys/state"
   ```

   **Check:** `pulumi whoami -v` shows the intended backend, and the stack file contains an `encryptionsalt` or `secretsprovider` entry.

3. **Set config, never hardcode it.**

   ```bash
   pulumi config set gcp:project acme-prod
   pulumi config set gcp:region europe-west1
   pulumi config set --secret dbPassword          # prompts; value is stored encrypted
   ```

   Read it with `config.require("x")` and `config.requireSecret("dbPassword")`. Secret outputs stay masked in previews and logs.

   **Check:** `Pulumi.<stack>.yaml` contains `secure:` blocks for every secret and no plaintext credentials.

4. **Write components, not copy-paste.** Wrap a reusable unit (service plus account plus IAM) in a `ComponentResource` and pass `{ parent: this }` to every child (see Patterns).

   **Check:** The type-checker or linter passes (`npx tsc --noEmit`, `ruff check`, `go vet ./...`).

5. **Preview and review.**

   ```bash
   pulumi preview --diff --stack prod
   pulumi preview --stack prod --policy-pack ./policy   # if the team has policy packs
   ```

   Read every `replace` and `delete` operation. A replacement on a database, bucket or cluster means data loss unless the resource is protected.

   **Check:** You have shown the user the create, update, replace and delete counts plus every replaced or deleted URN.

6. **Apply after consent.** Run `pulumi up --stack prod` and let it show its own preview; answer yes only after the user agrees. Never use `--yes` on a shared stack without that consent.

   **Check:** The update succeeds and `pulumi preview --expect-no-changes --stack prod` exits zero afterwards.

7. **Refactor without replacement.** Rename with `aliases`, move into a component with `aliases` plus `parent`, and adopt existing resources with `pulumi import <type> <name> <id>`, which prints code to paste into the program.

   **Check:** The preview shows no `replace` or `delete` for renamed or imported resources.

8. **Detect drift.** Run `pulumi preview --refresh --expect-no-changes` on a schedule. When it fails, decide with the owner whether to codify the change or revert it; `pulumi refresh` rewrites state and needs consent.

   **Check:** Drift alerts reach the owning team, and each item ends in a code change or a revert.

## Patterns

### Component resource (TypeScript)

```ts
import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface WebServiceArgs {
  image: pulumi.Input<string>;
  region: string;
}

export class WebService extends pulumi.ComponentResource {
  public readonly url: pulumi.Output<string>;

  constructor(name: string, args: WebServiceArgs, opts?: pulumi.ComponentResourceOptions) {
    super("acme:platform:WebService", name, {}, opts);
    const sa = new gcp.serviceaccount.Account(`${name}-sa`, { accountId: `${name}-run` }, { parent: this });
    const svc = new gcp.cloudrunv2.Service(name, {
      location: args.region,
      template: { serviceAccount: sa.email, containers: [{ image: args.image }] },
    }, { parent: this, protect: true });
    this.url = svc.uri;
    this.registerOutputs({ url: this.url });
  }
}
```

### Resource options that prevent incidents

| Option | Use |
| :--- | :--- |
| `protect: true` | Stateful resources; delete and replace fail until it is removed |
| `aliases` | Rename or re-parent without destroy and create |
| `ignoreChanges` | Fields mutated outside Pulumi on purpose (autoscaled counts) |
| `retainOnDelete: true` | Stop managing without deleting the cloud resource |
| `dependsOn` | Ordering Pulumi cannot infer from outputs |

### Outputs

Outputs are promises. Combine them with `pulumi.interpolate` or `.apply()`, and never create resources inside `.apply()`, because previews cannot see them. Share values between stacks with `new pulumi.StackReference("org/project/stack")`.

### Pulumi or Terraform

| Factor | Pulumi | Terraform / OpenTofu |
| :--- | :--- | :--- |
| Language | TypeScript, Python, Go, C#, Java, YAML | HCL |
| Abstraction | Classes, loops, tests in the host language | Modules; logic is deliberately limited |
| Ecosystem | Many providers are bridged from Terraform | Largest provider and module ecosystem |
| Best fit | App teams who want IaC in their language | Platform teams standardizing on HCL |

`pulumi convert --from terraform --language typescript --out ./infra` drafts a program from HCL; review the output and import state rather than recreating resources. Verify current flags against the Pulumi docs.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `pulumi up --yes` on prod from a laptop | Preview, consent, then `up` (or a CI job with review) | The applied change may differ from anything a human read |
| Plaintext secrets in config or code | `config set --secret` with a KMS secrets provider | Stack files are committed |
| Resources created in `.apply()` | Create at top level and pass Outputs | Hidden from previews and dependency tracking |
| Renaming a resource's logical name | Add `aliases` | Pulumi treats a new name as delete plus create |
| One stack for all environments | One stack per environment, separate projects for prod | Blast radius and IAM separation |
| `pulumi state delete` to fix errors | `retainOnDelete` or `import`, with consent | State surgery is hard to review and to undo |

## Verification checklist

- [ ] Backend is versioned GCS or Pulumi Cloud, and secrets use KMS or the service's encryption.
- [ ] Every secret is a `secure:` config value; outputs holding secrets are marked secret.
- [ ] The preview was shown, with every replace and delete listed, before any `up` on a shared stack.
- [ ] Stateful resources have `protect: true`.
- [ ] A post-apply preview shows no changes.
- [ ] Program type-checks and any policy packs pass.

## Related

- Agents: `cloud-devops-engineer`, `security-guard` (IAM and secrets review), `code-reviewer`.
- Workflows: `/code-review`, `/checkpoint` before risky updates.
- Knowledge: `terraform-iac`, `cloud-devops`, `gcp-iam`, `secrets-management`, `ci-cd-github-actions`, `cloud-run`.
