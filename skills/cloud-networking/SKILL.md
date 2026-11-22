---
name: cloud-networking
description: >-
  Designs and troubleshoots cloud networks, Google Cloud first with AWS and
  Azure equivalents: custom-mode VPCs and IP plans, subnets, firewall rules,
  Cloud NAT and static egress, load balancer choice and the HTTPS load
  balancer chain for Cloud Run, Private Google Access, Private Service Connect,
  Shared VPC and Connectivity Tests. Use when building a VPC, exposing or
  privately connecting services, or debugging timeouts and blocked traffic.
---

# Cloud Networking

Plan address space once, keep workloads on private IPs, open the firewall by
identity or tag rather than by "allow all", give egress a fixed address only
when a partner needs it, and prove reachability with Connectivity Tests
instead of trial and error.

## When to use

- New VPC, subnet or IP plan; connecting projects, clouds or on-prem.
- Exposing a service through a load balancer with a custom domain.
- Private access to Cloud SQL, Google APIs or a partner's service.
- Timeouts, "connection refused", or traffic blocked between tiers.

## When not to use

- DNS records and certificates: use `dns-tls`.
- CDN cache rules, WAF and edge code: use `cdn-edge-cloudflare`.
- Cloud Run service settings: use `cloud-run`; Kubernetes networking inside a cluster: use `kubernetes-gke`.
- Network IaC modules: use `terraform-iac` once the design is settled.

## Workflow

Commands use bash continuations (`\`). In PowerShell use a backtick or one line. Networking changes can cut production traffic and NAT, load balancers and static IPs bill hourly: confirm each create, update and delete with the user.

1. **Write the IP plan first.** Pick non-overlapping RFC 1918 ranges per environment and region, leaving room for GKE secondary ranges, peered VPCs and on-prem. VPCs are global in Google Cloud; subnets are regional.

   **Check:** A table of CIDRs exists and none overlap with on-prem or other VPCs you may peer with.

2. **Create a custom-mode VPC and subnets.**

   ```bash
   gcloud compute networks create app-vpc --subnet-mode=custom
   gcloud compute networks subnets create app-REGION --network=app-vpc --region=REGION \
     --range=10.10.0.0/20 --enable-private-ip-google-access --enable-flow-logs \
     --secondary-range=pods=10.20.0.0/16,services=10.30.0.0/20
   ```

   **Check:** `gcloud compute networks subnets list --network=app-vpc` shows the ranges; the `default` auto-mode network is not used for production.

3. **Write firewall rules narrowly.** Ingress is denied by default; egress is allowed by default.

   ```bash
   gcloud compute firewall-rules create allow-iap-ssh --network=app-vpc --direction=INGRESS \
     --action=allow --rules=tcp:22 --source-ranges=35.235.240.0/20 \
     --target-service-accounts=bastion@PROJECT_ID.iam.gserviceaccount.com --enable-logging
   gcloud compute firewall-rules create allow-lb-health --network=app-vpc --direction=INGRESS \
     --action=allow --rules=tcp:8080 --source-ranges=130.211.0.0/22,35.191.0.0/16 --target-tags=web
   ```

   `35.235.240.0/20` is IAP TCP forwarding; `130.211.0.0/22` and `35.191.0.0/16` are Google health checkers. For many projects, prefer hierarchical or network firewall policies.

   **Check:** No rule allows `0.0.0.0/0` on admin ports (22, 3389, database ports).

4. **Give private workloads egress with Cloud NAT.**

   ```bash
   gcloud compute routers create nat-router --network=app-vpc --region=REGION
   gcloud compute routers nats create nat-config --router=nat-router --region=REGION \
     --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges --enable-logging
   ```

   When a partner must allowlist you, reserve addresses (`gcloud compute addresses create nat-ip-1 --region=REGION`) and use `--nat-external-ip-pool=nat-ip-1` instead of auto-allocation. For port exhaustion errors, raise `--min-ports-per-vm` or use `--enable-dynamic-port-allocation`. Cloud Run reaches NAT through Direct VPC egress with `--vpc-egress=all-traffic`.

   **Check:** From a private VM, `curl -s https://ifconfig.me` returns the NAT address.

5. **Expose services through the right load balancer.** Global external Application Load Balancer for public HTTPS (Cloud Run via a serverless NEG):

   ```bash
   gcloud compute network-endpoint-groups create api-neg --region=REGION \
     --network-endpoint-type=serverless --cloud-run-service=api
   gcloud compute backend-services create api-be --global --load-balancing-scheme=EXTERNAL_MANAGED
   gcloud compute backend-services add-backend api-be --global \
     --network-endpoint-group=api-neg --network-endpoint-group-region=REGION
   gcloud compute url-maps create api-um --default-service=api-be
   gcloud compute ssl-certificates create api-cert --domains=api.example.com --global
   gcloud compute target-https-proxies create api-proxy --url-map=api-um --ssl-certificates=api-cert
   gcloud compute addresses create api-ip --global
   gcloud compute forwarding-rules create api-fr --global --load-balancing-scheme=EXTERNAL_MANAGED \
     --address=api-ip --target-https-proxy=api-proxy --ports=443
   ```

   Then point DNS at the address (`dns-tls`), attach Cloud Armor to the backend service if needed, and set the Cloud Run ingress to `internal-and-cloud-load-balancing`.

   **Check:** `gcloud compute ssl-certificates describe api-cert --global --format="get(managed.status)"` reaches `ACTIVE`, and the `run.app` URL no longer accepts direct traffic.

6. **Reach Google and partner services privately.**
   - Google APIs from private subnets: Private Google Access (step 2), or a Private Service Connect endpoint:

     ```bash
     gcloud compute addresses create psc-apis-ip --global --purpose=PRIVATE_SERVICE_CONNECT \
       --addresses=10.255.255.254 --network=app-vpc
     gcloud compute forwarding-rules create pscapis --global --network=app-vpc \
       --address=psc-apis-ip --target-google-apis-bundle=all-apis
     ```

   - Managed services (Cloud SQL, AlloyDB, Memorystore): private services access peering or PSC (see `cloud-sql-alloydb`).
   - A partner's or another team's service: PSC consumer endpoint to their service attachment; no CIDR coordination needed.

   **Check:** Name resolution and a TCP connect to the private endpoint succeed from the workload's subnet.

7. **Connect projects and sites.** Shared VPC (one host project, service projects attach) for an organization; VPC peering for a few VPCs (non-transitive, no overlapping ranges); HA VPN or Interconnect for on-prem with Cloud Router BGP.

   **Check:** The design doc names which option and why; overlapping ranges were ruled out.

8. **Prove reachability, then debug.**

   ```bash
   gcloud network-management connectivity-tests create db-path \
     --source-instance=projects/PROJECT_ID/zones/ZONE/instances/app-vm \
     --destination-ip-address=10.10.0.5 --destination-port=5432 --protocol=TCP
   gcloud network-management connectivity-tests describe db-path
   ```

   Then read VPC flow logs and firewall logs in Cloud Logging for the exact 5-tuple.

   **Check:** The test result is `REACHABLE`, or the blocking hop (firewall rule, route, missing NAT) is named.

## Reference

### Load balancer choice

| Traffic | Google Cloud | AWS | Azure |
| :--- | :--- | :--- | :--- |
| Public HTTP(S), global | Global external Application LB | CloudFront plus ALB | Front Door |
| Public HTTP(S), one region | Regional external Application LB | ALB | Application Gateway |
| Internal HTTP(S) | Internal Application LB | Internal ALB | Internal Application Gateway |
| TCP/UDP, keep client IP | External passthrough Network LB | NLB | Azure Load Balancer |

### Concept map

| Google Cloud | AWS | Azure |
| :--- | :--- | :--- |
| Global VPC, regional subnets | Regional VPC, zonal subnets | Regional VNet, subnets |
| Firewall rules and policies | Security groups and NACLs | Network security groups |
| Cloud NAT | NAT gateway | NAT Gateway |
| Private Service Connect | PrivateLink | Private Endpoint / Private Link |
| Shared VPC | Shared subnets via RAM | Hub-and-spoke VNet peering |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Use the auto-mode `default` network | Custom-mode VPC with a planned IP map | Default ranges overlap everywhere and auto-expand |
| Public IPs on VMs for outbound access | Cloud NAT | Each public IP is an attack surface |
| SSH open to `0.0.0.0/0` | IAP TCP forwarding (`gcloud compute ssh VM --tunnel-through-iap`) | Bots scan port 22 constantly |
| Peer everything to everything | Shared VPC or PSC | Peering is non-transitive and needs non-overlapping ranges |
| Debug by loosening firewall rules | Connectivity Tests and flow logs | Loosened rules tend to stay loose |

## Verification checklist

- [ ] An IP plan exists and ranges do not overlap with peers or on-prem.
- [ ] Production uses a custom-mode VPC; subnets have Private Google Access and flow logs where needed.
- [ ] No admin ports open to the internet; firewall rules target tags or service accounts.
- [ ] Egress goes through Cloud NAT, with static IPs only when allowlisting requires it.
- [ ] Public services sit behind a load balancer with a managed certificate.
- [ ] Every billable or traffic-affecting change was confirmed by the user.

## Related

- Knowledge: `dns-tls`, `cdn-edge-cloudflare`, `cloud-run`, `cloud-sql-alloydb`, `kubernetes-gke`, `terraform-iac`, `aws-essentials`, `azure-essentials`, `cloud-security-posture`.
- Agents: `cloud-devops-engineer`, `sre-engineer`.
