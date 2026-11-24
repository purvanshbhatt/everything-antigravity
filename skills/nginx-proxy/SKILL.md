---
name: nginx-proxy
disable-model-invocation: true
description: >-
  Configures and debugs Nginx and Caddy as reverse proxies: upstreams and
  forwarded headers, TLS with ACME certificates and HSTS, HTTP/2, WebSocket and
  SSE proxying, response caching, rate limiting, security headers, real client
  IPs behind load balancers and safe reloads. Use when writing or reviewing
  nginx.conf or a Caddyfile, when a proxy returns 502 or 504, or when adding
  TLS, caching or rate limits in front of an app.
---

# Nginx and Caddy Reverse Proxies

Put a small, boring, tested proxy in front of the app. Validate every change
with the server's own config test before reloading, reload instead of
restarting, and get the user's yes before touching a production proxy.

## When to use

- Writing or reviewing `nginx.conf`, `sites-available/*`, `conf.d/*.conf` or a `Caddyfile`.
- 502, 504, 413 or redirect-loop errors from a proxy.
- Adding TLS, HTTP/2, WebSockets, caching, rate limits or security headers.
- Running on VMs or bare metal, or as an ingress or sidecar you control.

## When not to use

- Cloud Run or a Google Cloud load balancer already terminates TLS and routes: configure those instead (`cloud-run`, `cloud-networking`).
- CDN rules, WAF and edge functions: use `cdn-edge-cloudflare`.
- Certificates and DNS records themselves: use `dns-tls`.
- Kubernetes ingress objects: use `kubernetes-gke` or `helm-charts`.

## Workflow

1. **Read the effective config.** `nginx -T` prints the merged configuration; `caddy adapt --config Caddyfile` shows the JSON Caddy will run. Note which `server` or site block matches the failing host.

   **Check:** You can name the block, the `location` and the upstream that serve the failing request.

2. **Reproduce with curl against the proxy.**

   ```bash
   curl -sv --resolve app.example.com:443:127.0.0.1 https://app.example.com/healthz -o /dev/null
   curl -sI http://127.0.0.1:8080/healthz          # the upstream directly, from the proxy host
   ```

   On Windows PowerShell call `curl.exe`, not the `curl` alias.

   **Check:** You know whether the upstream itself works and what the proxy returns.

3. **Map the error to its cause** with the error log (`/var/log/nginx/error.log` or `journalctl -u caddy`) and the table below. Fix the cause, not the timeout.

   **Check:** The error log line that explains the failure is quoted in your notes.

4. **Edit, test, reload.**

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   caddy fmt --overwrite Caddyfile && caddy validate --config Caddyfile && caddy reload --config Caddyfile
   ```

   **Check:** The config test passes and the curl from step 2 now returns the expected status and headers.

5. **Verify TLS and headers from outside.**

   ```bash
   curl -sI https://app.example.com | grep -iE 'strict-transport|content-security|x-content-type'
   openssl s_client -connect app.example.com:443 -servername app.example.com </dev/null | openssl x509 -noout -dates -subject
   sudo certbot renew --dry-run       # if certbot manages the certificates
   ```

   **Check:** The certificate is valid with more than 20 days left, renewal dry-run passes, and the headers are present.

## Patterns

### Nginx reverse proxy with TLS, WebSockets and rate limits

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

upstream app { server 127.0.0.1:8080; keepalive 32; }

server {
  listen 443 ssl;
  http2 on;                                  # nginx 1.25.1+; older: listen 443 ssl http2;
  server_name app.example.com;
  ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  client_max_body_size 10m;

  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;

  location / {
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Connection "";          # enables upstream keepalive
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    limit_req zone=api burst=20 nodelay;
    limit_req_status 429;
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /ws/ {
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_read_timeout 1h;                   # idle WebSockets close after 60s by default
  }
}
server { listen 80; server_name app.example.com; return 301 https://$host$request_uri; }
```

For SSE add `proxy_buffering off;` to that location. For caching, define `proxy_cache_path ... keys_zone=app_cache:10m` and set `proxy_cache`, `proxy_cache_valid 200 10m`, `proxy_cache_use_stale error timeout updating` and `add_header X-Cache-Status $upstream_cache_status always;` on static or public routes only.

### Caddy equivalent

```caddyfile
app.example.com {
	encode zstd gzip
	header Strict-Transport-Security "max-age=63072000; includeSubDomains"
	handle /api/* {
		reverse_proxy localhost:8080
	}
	handle {
		reverse_proxy localhost:3000
	}
}
```

Caddy obtains and renews certificates automatically, proxies WebSockets without extra config and sets `X-Forwarded-*` headers. Rate limiting needs a third-party module; check the Caddy module registry.

### Error map

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| 502 `connect() failed (111: Connection refused)` | Upstream down or wrong port | Fix the upstream; check `ss -tlnp` on its host |
| 502 `upstream prematurely closed` | App crashed or keepalive mismatch | Check app logs; make upstream idle timeout longer than nginx's |
| 504 `upstream timed out` | Slow handler | Fix the handler or move work to a job; raise `proxy_read_timeout` only for known long routes |
| 413 Request Entity Too Large | `client_max_body_size` (default 1m) | Raise it on the upload route only |
| Redirect loop behind a load balancer | App sees `http` because TLS ended upstream | Forward `X-Forwarded-Proto` and make the app trust it |
| Every client has the LB's IP | Real IP not restored | `set_real_ip_from <LB ranges>; real_ip_header X-Forwarded-For; real_ip_recursive on;` (take ranges from your provider's current docs) |
| Headers vanish in one location | `add_header` in a block discards inherited `add_header` lines | Repeat the headers there or use an `include` snippet |

`proxy_pass http://app;` forwards the original URI. `proxy_pass http://app/;` (with a path) replaces the matched location prefix. Most broken routes are this trailing slash.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `systemctl restart nginx` after edits | `nginx -t` then `reload` | Restart drops connections; a bad config takes the site down |
| Cache authenticated responses | Cache only public routes; respect `Cache-Control: private` | One user's page is served to another |
| Raise every timeout to 300s | Fix the slow upstream or split long work out | Long timeouts tie up workers and hide failures |
| `ssl_protocols TLSv1 TLSv1.1` for old clients | TLS 1.2 and 1.3 only | Old protocols are broken and fail compliance |
| Trust `X-Forwarded-For` from anyone | `set_real_ip_from` only your load balancer ranges | Clients can spoof their IP and dodge rate limits |
| HSTS `preload` on the first deploy | Start with a short `max-age`, then lengthen | A preload mistake breaks HTTP for months |

## Verification checklist

- [ ] `nginx -t` or `caddy validate` passes; changes were reloaded, not restarted.
- [ ] Production proxy changes had explicit user consent.
- [ ] TLS 1.2+ only, valid certificate, renewal dry-run passes, HSTS present.
- [ ] Forwarded headers set; the app sees the real scheme and client IP.
- [ ] WebSocket and SSE routes tested end to end if present.
- [ ] Rate-limited routes return 429 under a burst; cached routes show `X-Cache-Status`.

## Related

- Agents: `cloud-devops-engineer`, `security-guard`, `sre-engineer`.
- Knowledge: `dns-tls`, `cdn-edge-cloudflare`, `cloud-networking`, `linux-admin`, `realtime-websockets`, `web-performance`, `load-testing`.
