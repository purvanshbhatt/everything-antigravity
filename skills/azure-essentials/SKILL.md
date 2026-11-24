---
name: azure-essentials
disable-model-invocation: true
description: >-
  Covers Azure core services for application teams: Entra ID and managed
  identities, subscriptions and resource groups, App Service, Container Apps
  and AKS, Azure Container Registry, Storage, Key Vault, keyless CI with
  federated credentials, and Bicep with what-if, using real az CLI commands.
  Use when deploying an app to Azure, mapping Google Cloud concepts to Azure,
  or fixing AuthorizationFailed and role-assignment errors.
---

# Azure Essentials

Run application workloads on Azure with identities instead of secrets, one
resource group per app and environment, private-by-default storage and Key
Vault, and infrastructure declared in Bicep that is previewed with `what-if`
before every deployment.

## When to use

- First deploy to Azure, or a team moving between Google Cloud and Azure.
- `AuthorizationFailed`, `Forbidden` or "does not have authorization to perform action" errors.
- Choosing between App Service, Container Apps, Functions and AKS.
- CI deploys without client secrets.

## When not to use

- Google Cloud deploys: use `cloud-devops` and `cloud-run`. AWS: use `aws-essentials`.
- Terraform modules and state (including the `azurerm` provider): use `terraform-iac`.
- Kubernetes manifests, autoscaling and debugging pods: use `kubernetes-gke` and `helm-charts`.
- Entra ID as an app login provider (OIDC flows, tokens): use `auth-patterns`.

## Workflow

Commands use bash continuations (`\`). In PowerShell use a backtick or one line. Container Apps commands need the extension: `az extension add --name containerapp --upgrade`.

1. **Confirm tenant and subscription.**

   ```bash
   az login
   az account list --output table
   az account set --subscription SUBSCRIPTION_ID
   az account show --query "{tenant:tenantId,sub:name,user:user.name}"
   ```

   **Check:** The subscription is the one the user named. Stop and ask if it is ambiguous.

2. **Create a resource group per app and environment, with tags.**

   ```bash
   az group create --name rg-api-dev --location westeurope --tags env=dev owner=platform app=api
   ```

   **Check:** `az group show --name rg-api-dev` shows the tags; cost reports can group by them later.

3. **Give the workload a managed identity and grant data-plane roles on the narrowest scope.** Prefer a user-assigned identity so it survives app re-creation and can be granted before deploy.

   ```bash
   az identity create --resource-group rg-api-dev --name id-api
   PRINCIPAL_ID=$(az identity show -g rg-api-dev -n id-api --query principalId -o tsv)
   az role assignment create --assignee-object-id "$PRINCIPAL_ID" \
     --assignee-principal-type ServicePrincipal \
     --role "Key Vault Secrets User" \
     --scope "$(az keyvault show -n kv-api-dev --query id -o tsv)"
   ```

   PowerShell: `$principalId = az identity show -g rg-api-dev -n id-api --query principalId -o tsv`.

   **Check:** `az role assignment list --assignee "$PRINCIPAL_ID" --all -o table` lists only the intended roles and scopes. Confirm role assignments with the user before creating them.

4. **Store images in ACR and pull with identity, not admin credentials.**

   ```bash
   az acr create -g rg-api-dev -n acrapidev --sku Basic
   az acr build --registry acrapidev --image api:$(git rev-parse --short HEAD) .
   ```

   **Check:** `az acr show -n acrapidev --query adminUserEnabled` is `false`.

5. **Deploy to Container Apps** (the default for stateless containers). Confirm before deploying to shared or production subscriptions.

   ```bash
   az containerapp env create --name cae-dev --resource-group rg-api-dev --location westeurope
   az containerapp create --name api --resource-group rg-api-dev --environment cae-dev \
     --image acrapidev.azurecr.io/api:TAG --target-port 8080 --ingress external \
     --user-assigned IDENTITY_RESOURCE_ID --registry-server acrapidev.azurecr.io \
     --registry-identity IDENTITY_RESOURCE_ID --min-replicas 0 --max-replicas 5
   ```

   The identity needs `AcrPull` on the registry. Reference Key Vault secrets instead of literal values:

   ```bash
   az containerapp secret set -n api -g rg-api-dev \
     --secrets "db-pass=keyvaultref:https://kv-api-dev.vault.azure.net/secrets/db-pass,identityref:IDENTITY_RESOURCE_ID"
   az containerapp update -n api -g rg-api-dev --set-env-vars DB_PASSWORD=secretref:db-pass
   ```

   **Check:** `az containerapp show -n api -g rg-api-dev --query properties.configuration.ingress.fqdn -o tsv` returns a URL that serves the health endpoint.

6. **Roll out with revisions.** Switch to multiple-revision mode, deploy a new revision, split traffic, then promote or roll back.

   ```bash
   az containerapp revision set-mode -n api -g rg-api-dev --mode multiple
   az containerapp update -n api -g rg-api-dev --image acrapidev.azurecr.io/api:NEW --revision-suffix v2
   az containerapp revision list -n api -g rg-api-dev -o table    # get the old revision name
   az containerapp ingress traffic set -n api -g rg-api-dev --revision-weight OLD_REVISION=90 api--v2=10
   ```

   App Service equivalent: deployment slots (`az webapp deployment slot create`, then `az webapp deployment slot swap --slot staging --target-slot production`).

   **Check:** The new revision is healthy and its error rate matches the old one before it takes 100%.

7. **Lock down Storage.**

   ```bash
   az storage account create -n stapidev -g rg-api-dev --sku Standard_LRS --kind StorageV2 \
     --allow-blob-public-access false --min-tls-version TLS1_2 --allow-shared-key-access false
   az storage blob list --account-name stapidev --container-name uploads --auth-mode login -o table
   ```

   For browser uploads issue a user delegation SAS (`az storage blob generate-sas --as-user --auth-mode login ...`) with a short expiry.

   **Check:** Data-plane commands work with `--auth-mode login` and the identity's `Storage Blob Data *` role; no account keys are in app config.

8. **Declare it in Bicep and preview every change.**

   ```bash
   az bicep build --file main.bicep
   az deployment group what-if -g rg-api-dev --template-file main.bicep --parameters main.bicepparam
   az deployment group create -g rg-api-dev --template-file main.bicep --parameters main.bicepparam
   ```

   **Check:** The user saw the `what-if` output and approved it; `Delete` or `Modify` entries on data resources were called out explicitly.

9. **Keyless CI with federated credentials.**

   ```bash
   az identity federated-credential create --name gh-main --identity-name id-ci -g rg-api-dev \
     --issuer https://token.actions.githubusercontent.com \
     --subject repo:OWNER/REPO:ref:refs/heads/main --audiences api://AzureADTokenExchange
   ```

   In the workflow, `azure/login` takes `client-id`, `tenant-id` and `subscription-id` and needs `id-token: write`; check its README for the current version.

   **Check:** No client secret is stored in CI.

10. **Observe and control cost.** `az containerapp logs show -n api -g rg-api-dev --follow`; Application Insights for traces; a Cost Management budget with alerts; `az advisor recommendation list --category Cost -o table`.

    **Check:** A budget alert exists for the subscription or resource group; `max-replicas` is set on every app.

## Reference

### Compute choice

| Workload | Use | Notes |
| :--- | :--- | :--- |
| Stateless containers, HTTP or queue-driven | Container Apps | Revisions, scale to zero, KEDA scalers built in |
| Classic web app, code deploy, slots | App Service | Plan is billed even when idle |
| Event glue, short functions | Azure Functions | Flex Consumption or Premium for VNet; verify current plans |
| Full Kubernetes control | AKS (`az aks create ... --enable-oidc-issuer --enable-workload-identity`) | You own upgrades and node pools |

### Google Cloud to Azure map

| Google Cloud | Azure |
| :--- | :--- |
| Organization, folder, project | Tenant, management group, subscription plus resource group |
| Service account | Managed identity (or app registration service principal) |
| Workload Identity Federation | Federated identity credential |
| Cloud Run | Container Apps |
| Artifact Registry | Azure Container Registry |
| Cloud Storage | Storage account (Blob) |
| Secret Manager | Key Vault |
| Pub/Sub | Service Bus or Event Grid |
| Cloud Logging and Monitoring | Azure Monitor, Log Analytics, Application Insights |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Service principals with client secrets in CI | Federated credentials on a managed identity | Secrets expire, leak and get copied |
| Assign `Owner` or `Contributor` at subscription scope to apps | Data-plane roles on the specific vault, account or registry | Contributor can read keys and change everything |
| Storage account keys and connection strings in config | `--auth-mode login` and RBAC; disable shared key | Keys grant full account access with no audit trail per user |
| Deploy Bicep without `what-if` | Review `what-if`, then create | Complete-mode or renamed resources can delete data |

## Verification checklist

- [ ] Tenant and subscription were confirmed before any change.
- [ ] Workloads use managed identities; no secrets or account keys in config or CI.
- [ ] Role assignments are on resource scope and were approved by the user.
- [ ] Storage blocks public blob access and requires TLS 1.2+.
- [ ] Every deployment was previewed with `what-if` and confirmed.
- [ ] Apps have max replicas, budgets and alerts exist.

## Related

- Knowledge: `terraform-iac`, `cloud-networking`, `dns-tls`, `secrets-management`, `kubernetes-gke`, `helm-charts`, `auth-patterns`, `aws-essentials`, `cloud-devops`, `finops-cost`.
- Workflows: `/security-scan`, `/verify`.
- Agents: `cloud-devops-engineer`, `security-guard`.
