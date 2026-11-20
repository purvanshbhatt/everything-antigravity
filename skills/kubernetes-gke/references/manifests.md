# Reference Manifests

Production-shaped starting points for the `kubernetes-gke` skill. Replace every
`PROJECT`, `REPO`, `NAMESPACE` and `<digest>`. Validate with
`kubectl apply --dry-run=server -f <file>` before applying anything.

## Namespace with Pod Security Admission

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: web
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
```

## ServiceAccount and Deployment

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: web
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels: { app.kubernetes.io/name: web }
spec:
  # Omit `replicas` when an HPA owns scaling, or every apply resets the count.
  revisionHistoryLimit: 10
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 25%, maxUnavailable: 0 }
  selector:
    matchLabels: { app.kubernetes.io/name: web }
  template:
    metadata:
      labels: { app.kubernetes.io/name: web }
    spec:
      serviceAccountName: web
      terminationGracePeriodSeconds: 45     # > preStop delay + app drain time
      securityContext:
        runAsNonRoot: true
        seccompProfile: { type: RuntimeDefault }
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels: { app.kubernetes.io/name: web }
      containers:
        - name: app
          image: us-docker.pkg.dev/PROJECT/REPO/web@sha256:<digest>
          ports: [{ name: http, containerPort: 8080 }]
          env:
            - { name: OTEL_SERVICE_NAME, value: web }
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits: { memory: 512Mi }
          startupProbe:
            httpGet: { path: /healthz, port: http }
            periodSeconds: 5
            failureThreshold: 30        # up to 150 s to boot
          readinessProbe:
            httpGet: { path: /readyz, port: http }
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet: { path: /healthz, port: http }
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop:
              sleep: { seconds: 10 }    # native sleep action needs Kubernetes 1.30+
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
          volumeMounts:
            - { name: tmp, mountPath: /tmp }
      volumes:
        - name: tmp
          emptyDir: {}
```

The `preStop` delay gives load balancers time to stop sending traffic before the
app receives `SIGTERM`. The app must still drain in-flight requests on `SIGTERM`.
On clusters older than 1.30, use an `exec` sleep only if the image has a shell.

## Service, Gateway and HTTPRoute

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector: { app.kubernetes.io/name: web }
  ports: [{ name: http, port: 80, targetPort: http }]
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: external
spec:
  gatewayClassName: gke-l7-global-external-managed
  listeners:
    - name: http
      protocol: HTTP
      port: 80
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web
spec:
  parentRefs: [{ name: external }]
  hostnames: ["app.example.com"]
  rules:
    - matches: [{ path: { type: PathPrefix, value: / } }]
      backendRefs: [{ name: web, port: 80 }]
---
apiVersion: networking.gke.io/v1
kind: HealthCheckPolicy
metadata:
  name: web
spec:
  default:
    config:
      type: HTTP
      httpHealthCheck:
        requestPath: /readyz
        port: 8080
  targetRef:
    group: ""
    kind: Service
    name: web
```

- List available classes with `kubectl get gatewayclass`. Other GKE classes
  include `gke-l7-regional-external-managed` and `gke-l7-rilb` (internal).
- For HTTPS listeners, certificates (Certificate Manager maps or Kubernetes TLS
  Secrets) and Cloud Armor policies, follow the current GKE Gateway docs; the
  attachment mechanism differs by gateway class.
- Prefer Gateway API over Ingress for new work: it separates infrastructure
  owners (Gateway) from application owners (HTTPRoute).

## HorizontalPodAutoscaler and PodDisruptionBudget

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 65 }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web
spec:
  maxUnavailable: 1
  selector:
    matchLabels: { app.kubernetes.io/name: web }
```

## NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-allow
spec:
  podSelector:
    matchLabels: { app.kubernetes.io/name: web }
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: frontend }
      ports: [{ protocol: TCP, port: 8080 }]
    - from:   # Google Cloud health checks and front ends; verify ranges for your LB type
        - ipBlock: { cidr: 35.191.0.0/16 }
        - ipBlock: { cidr: 130.211.0.0/22 }
      ports: [{ protocol: TCP, port: 8080 }]
```

- Regional and internal load balancers send traffic from the VPC's proxy-only
  subnet; add that CIDR too, or the load balancer reports backends unhealthy.
- If you default-deny egress, allow DNS. With kube-dns:

  ```yaml
  egress:
    - to:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: kube-system }
          podSelector:
            matchLabels: { k8s-app: kube-dns }
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
  ```

  Clusters using Cloud DNS for GKE resolve through the metadata server instead;
  check the cluster's DNS provider before writing egress rules.

## Secret Manager add-on (CSI)

Enable once per cluster (confirm first: it updates the cluster):
`gcloud container clusters update CLUSTER --location LOCATION --enable-secret-manager`.

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: web-secrets
spec:
  provider: gke
  parameters:
    secrets: |
      - resourceName: "projects/PROJECT_ID/secrets/db-password/versions/3"
        path: "db-password"
```

Pod spec additions:

```yaml
      volumes:
        - name: secrets
          csi:
            driver: secrets-store-gke.csi.k8s.io
            readOnly: true
            volumeAttributes:
              secretProviderClass: web-secrets
      # container:
      #   volumeMounts:
      #     - { name: secrets, mountPath: /var/secrets, readOnly: true }
```

Field names for the managed add-on differ from the open-source
`secrets-store.csi.k8s.io` driver with the `gcp` provider; verify against the
current GKE docs for whichever you install. Pin numbered secret versions for
reproducible rollouts; use `latest` only with a rotation process that restarts pods.

## Workload Identity: legacy Google service account pattern

Use when a Google API does not accept the direct `principal://` member:

```bash
gcloud iam service-accounts add-iam-policy-binding web@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="serviceAccount:PROJECT_ID.svc.id.goog[NAMESPACE/web]"
kubectl annotate serviceaccount web -n NAMESPACE \
  iam.gke.io/gcp-service-account=web@PROJECT_ID.iam.gserviceaccount.com
```

## Kustomize layout

```text
k8s/
├── base/
│   ├── kustomization.yaml      # resources: deployment, service, hpa, pdb, networkpolicy
│   └── *.yaml
└── overlays/
    ├── dev/kustomization.yaml
    └── prod/kustomization.yaml
```

```yaml
# k8s/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: web
resources: [../../base]
images:
  - name: us-docker.pkg.dev/PROJECT/REPO/web
    digest: sha256:<digest>
patches:
  - path: hpa-prod.yaml
```

Render and review before applying: `kubectl kustomize k8s/overlays/prod`.
