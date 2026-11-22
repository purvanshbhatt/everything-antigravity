---
name: dns-tls
description: >-
  Manages DNS and TLS end to end: record types and apex limits, TTL planning
  for migrations, Cloud DNS, Route 53 and Azure DNS commands, propagation and
  delegation checks with dig and Resolve-DnsName, managed and ACME
  certificates, CAA, HSTS rollout, and diagnosing certificate errors and stuck
  managed certificates. Use when pointing a domain at a service, migrating DNS,
  issuing or renewing certificates, or debugging resolution and TLS errors.
---

# DNS and TLS

Change DNS with a plan (lower TTLs first, verify at authoritative servers,
keep the old target alive), automate every certificate, restrict issuers with
CAA, and roll out HSTS gradually. Most "DNS is broken" reports are caching or
delegation, so check the authoritative answer before changing anything.

## When to use

- Pointing a domain or subdomain at a load balancer, Cloud Run, CDN or SaaS.
- Moving DNS hosting or registrars, or changing a record with zero downtime.
- Issuing, renewing or debugging certificates (managed, ACME, cert-manager).
- Errors such as `NXDOMAIN`, `SERVFAIL`, `ERR_CERT_COMMON_NAME_INVALID`, or a managed cert stuck provisioning.

## When not to use

- Email authentication records in depth (SPF, DKIM, DMARC): use `transactional-email`.
- Load balancer and private DNS architecture: use `cloud-networking`.
- CDN caching and edge rules: use `cdn-edge-cloudflare`.
- Choosing cipher suites or crypto primitives for your own code: use `cryptography`.

## Workflow

Commands use bash; PowerShell equivalents are shown where they differ. DNS changes can take a site or mail offline: confirm each record change, delegation change and zone deletion with the user.

1. **Read what the world sees, authoritative first.**

   ```bash
   dig +short NS example.com
   dig @ns-cloud-a1.googledomains.com api.example.com A      # ask an authoritative server directly
   dig +short api.example.com A @8.8.8.8                       # a public resolver
   dig +trace api.example.com                                  # follow delegation from the root
   ```

   PowerShell: `Resolve-DnsName api.example.com -Type A -Server 8.8.8.8` and `Resolve-DnsName example.com -Type NS`.

   **Check:** The authoritative answer is correct before you blame propagation; if authoritative is wrong, fix the zone, not caches.

2. **Plan TTLs before a migration.** Lower the record's TTL (for example to 300) at least one old-TTL period before the change, make the change, verify, then raise it again. Delegation (NS at the registrar) changes are governed by the parent zone's TTL, often up to 48 hours.

   **Check:** The old target stays up until the old TTL has fully expired after the switch.

3. **Create records with the provider CLI.**

   ```bash
   # Cloud DNS
   gcloud dns managed-zones create app-zone --dns-name="example.com." --description="app" --dnssec-state=on
   gcloud dns record-sets create api.example.com. --zone=app-zone --type=A --ttl=300 --rrdatas=203.0.113.10
   gcloud dns record-sets update api.example.com. --zone=app-zone --type=A --ttl=300 --rrdatas=203.0.113.20
   # Route 53
   aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch file://change.json
   # Azure DNS
   az network dns record-set a add-record -g rg-dns -z example.com -n api -a 203.0.113.10
   ```

   Use the provider's alias/flattening feature (Route 53 alias, Cloudflare CNAME flattening) for the zone apex; a plain CNAME at the apex is invalid.

   **Check:** `dig @AUTHORITATIVE_NS api.example.com` returns the new value with the planned TTL.

4. **Set CAA to restrict who can issue.**

   ```bash
   gcloud dns record-sets create example.com. --zone=app-zone --type=CAA --ttl=3600 \
     --rrdatas='0 issue "pki.goog"','0 issue "letsencrypt.org"'
   ```

   Include every CA you actually use (`amazon.com` for ACM, `digicert.com` for some Azure certs; verify per provider). A missing entry blocks issuance and renewal.

   **Check:** `dig +short CAA example.com` lists exactly the CAs in use.

5. **Issue certificates automatically.**

   | Platform | Method |
   | :--- | :--- |
   | Google Cloud load balancer | Google-managed cert (`gcloud compute ssl-certificates create ... --domains=`) or Certificate Manager with DNS authorization for wildcards |
   | AWS | ACM: `aws acm request-certificate --domain-name example.com --subject-alternative-names "*.example.com" --validation-method DNS` |
   | Azure App Service / Container Apps | Free managed certificates; Key Vault certificates for custom needs |
   | Kubernetes | cert-manager with a Let's Encrypt `ClusterIssuer`; test against the staging issuer first |
   | VM with Nginx or Caddy | Caddy (automatic) or `certbot --nginx -d example.com`; test renewal with `certbot renew --dry-run` |

   Public certificate lifetimes are being shortened by CA/Browser Forum rules over the next few years; verify current maximums and make sure nothing depends on manual renewal.

   **Check:** The renewal path is automated and was exercised (dry run or staging issuance).

6. **Inspect the served certificate.**

   ```bash
   openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null 2>/dev/null \
     | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
   curl -vI https://api.example.com 2>&1 | grep -iE "subject|issuer|expire|SSL"
   ```

   PowerShell: `curl.exe -vI https://api.example.com`. Add `-showcerts` to `s_client` to inspect the chain.

   **Check:** The SAN list includes the hostname, the chain is complete, and expiry is more than 14 days away (or renewal is proven automatic).

7. **Debug stuck Google-managed certificates.**

   ```bash
   gcloud compute ssl-certificates describe api-cert --global --format="get(managed.status,managed.domainStatus)"
   ```

   | Domain status | Meaning | Fix |
   | :--- | :--- | :--- |
   | `PROVISIONING` | Waiting; can take up to about an hour after DNS is right | Wait; confirm the A record points at the LB IP |
   | `FAILED_NOT_VISIBLE` | DNS does not resolve to the load balancer | Fix the A/AAAA record; remove stale AAAA records |
   | `FAILED_CAA_CHECKING` / `FAILED_CAA_FORBIDDEN` | CAA lookup failed or forbids Google | Fix the CAA record (step 4) |
   | `FAILED_RATE_LIMITED` | CA rate limit | Wait, avoid repeated recreate |

   **Check:** Status becomes `ACTIVE` and the browser shows the new certificate.

8. **Roll out HSTS in stages.** Start with `Strict-Transport-Security: max-age=300`, then a week at `86400`, then `31536000; includeSubDomains` once every subdomain serves HTTPS. Add `preload` and submit to the preload list only with explicit user approval: removal takes months.

   **Check:** `curl -sI https://example.com | grep -i strict-transport` shows the intended stage.

## Reference

| Record | Use | Gotcha |
| :--- | :--- | :--- |
| A / AAAA | Name to IPv4 / IPv6 | A stale AAAA breaks IPv6 clients and managed certs |
| CNAME | Alias to another name | Not at the apex; no other records at the same name |
| MX | Mail servers | Must point to a hostname, not an IP or CNAME |
| TXT | Verification, SPF, DMARC | One SPF record only; mind 255-character string limits |
| CAA | Allowed certificate issuers | Missing CA blocks renewals |
| NS | Delegation | Registrar NS must match the hosted zone's NS set |

Flush local caches when testing: Windows `Clear-DnsClientCache`, macOS `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`, systemd `resolvectl flush-caches`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Change records with a 24-hour TTL in place | Lower TTL a full period ahead | Rollback takes a day otherwise |
| Debug with one resolver only | Query authoritative servers and `+trace` | Caches hide the real state |
| Manual certificate renewal reminders | Managed certs, ACME or cert-manager | Expired certs are a classic outage |
| Test ACME against production endpoints | Staging issuer first | Rate limits lock you out for days |
| Add `preload` on day one | Staged `max-age` ramp | Preload is very hard to undo |
| Delete the old zone right after moving | Keep it until NS TTLs expire | Resolvers still query the old servers |

## Verification checklist

- [ ] Authoritative answers were verified before and after each change.
- [ ] TTLs were lowered ahead of migrations and restored afterwards.
- [ ] CAA lists every CA in use; certificates renew automatically.
- [ ] Served certificate covers all hostnames with a full chain.
- [ ] HSTS is staged; `preload` only with explicit approval.
- [ ] Record, delegation and zone changes were confirmed by the user.

## Related

- Knowledge: `cloud-networking`, `cdn-edge-cloudflare`, `nginx-proxy`, `transactional-email`, `cryptography`, `kubernetes-gke`, `cloud-run`.
- Agents: `cloud-devops-engineer`, `sre-engineer`.
