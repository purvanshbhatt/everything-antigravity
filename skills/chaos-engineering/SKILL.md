---
name: chaos-engineering
description: >-
  Designs and runs controlled chaos experiments: steady-state hypotheses on
  SLIs, blast radius and abort conditions, fault injection with Chaos Mesh,
  LitmusChaos, Istio faults, Toxiproxy and tc netem, game days, and turning
  findings into fixes and automated resilience tests. Use when asked to test
  resilience, verify failover, timeouts or retries, prepare a game day, or
  prove a service survives losing a pod, zone or dependency.
---

# Chaos Engineering

Chaos engineering is an experiment, not an outage: a written hypothesis about
steady state, the smallest blast radius that can disprove it, abort conditions
watched in real time, and a rollback ready before the first fault. Every
experiment runs only after the user explicitly approves its written plan, and
production experiments only after the same experiment passed in staging.

## When to use

- Verifying that redundancy, failover, autoscaling, timeouts, retries or circuit breakers work.
- Preparing or facilitating a game day for a team or a new on-call rotation.
- After an incident, proving the fix holds by replaying the failure.
- Adding resilience tests (dependency latency, connection resets) to CI.

## When not to use

- The service has no SLOs, dashboards or alerts yet: fix that first with `observability-otel` and `runbooks-oncall`. Without them you cannot see the result or abort safely.
- Pure capacity questions: use `load-testing`.
- Testing backup restores: use `backup-dr` restore drills.
- An incident is in progress: use `incident-response`.

## Workflow

1. **Confirm prerequisites.** SLIs and dashboards exist, alerts work, a runbook exists for the target, and someone can stop the experiment instantly. Start in staging.

   **Check:** You can point to the dashboard and the exact command that ends the experiment.

2. **Define steady state.** Pick two or three SLIs with current values: for example success rate 99.9 percent, p95 latency 220 ms, queue lag under 30 seconds.

   **Check:** Steady state is numeric and measured over the last hour before the experiment.

3. **Write the hypothesis.** "When one of three `api` pods is killed, success rate stays above 99.5 percent and p95 below 400 ms, because the Service routes to healthy pods and clients retry idempotent calls."

   **Check:** The hypothesis can be disproved by the metrics you are watching.

4. **Design the experiment** in a plan artifact with this structure:

   ```text
   Target: api (staging), 1 of 3 pods          Fault: pod-kill
   Duration: 10 min                             Blast radius: staging only, one pod
   Abort if: success rate < 99% for 2 min, or any data error, or on-call asks
   Stop command: kubectl delete -f chaos/api-pod-kill.yaml
   Observers: <names>   Notified: on-call, owners of dependencies   Window: <time, not peak>
   ```

   **Check:** Every field is filled, and the abort condition is stricter than the SLO.

5. **Get explicit approval.** Show the plan to the user and wait for a clear yes. For production, also require stakeholder sign-off and on-call awareness.

   **Check:** Approval is recorded in the plan with a timestamp.

6. **Run and watch.** Apply the fault, watch the SLIs continuously, and abort immediately on any abort condition. Log the timeline in UTC.

   ```bash
   kubectl apply -f chaos/api-pod-kill.yaml
   kubectl get pods -n staging -l app=api -w
   kubectl delete -f chaos/api-pod-kill.yaml          # stop / clean up
   ```

   **Check:** The fault was removed at the end and SLIs returned to steady state.

7. **Analyse and fix.** Compare SLIs against the hypothesis. Each surprise becomes a ticket with an owner: missing timeout, retry storm, slow readiness, alert that did not fire, unclear runbook step.

   **Check:** A short report states held or disproved, with evidence and the follow-up tickets.

8. **Expand or automate.** After fixes, repeat with a slightly larger blast radius (one zone, a longer duration), or encode the experiment as a scheduled or CI test.

   **Check:** The experiment is repeatable from code, not from memory.

## Patterns

### Fault catalogue

| Fault | Tool | Tests |
| :--- | :--- | :--- |
| Pod or instance death | Chaos Mesh `PodChaos`, LitmusChaos, `kubectl delete pod` | Redundancy, readiness, graceful shutdown |
| Zone loss | `kubectl cordon` and `kubectl drain` one zone's nodes, or stop that zone's VMs | Spare capacity in remaining zones |
| Dependency latency | `NetworkChaos` delay, Istio fault `delay`, Toxiproxy `latency` | Timeouts, retry budgets, circuit breakers |
| Dependency errors | Istio fault `abort`, Toxiproxy `reset_peer` | Fallbacks, error handling, idempotent retries |
| CPU or memory pressure | Chaos Mesh `StressChaos`, `stress-ng` | Limits, autoscaling, OOM behaviour |
| Clock skew | Chaos Mesh `TimeChaos` | Token expiry and scheduling logic |
| Host network delay | `sudo tc qdisc add dev eth0 root netem delay 200ms 50ms` (remove: `sudo tc qdisc del dev eth0 root`) | VM-level resilience |

Cloud-specific services such as AWS Fault Injection Service and Azure Chaos Studio follow the same workflow.

### Chaos Mesh pod kill

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: api-pod-kill
  namespace: staging
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces: [staging]
    labelSelectors:
      app: api
```

### Istio or Cloud Service Mesh fault injection

```yaml
http:
  - fault:
      delay:
        percentage: { value: 10 }
        fixedDelay: 2s
    route:
      - destination: { host: ratings }
```

### Resilience tests in CI with Toxiproxy

Run Toxiproxy between the app and a test dependency, then add a toxic during a test: `toxiproxy-cli create -l localhost:26379 -u localhost:6379 redis` and `toxiproxy-cli toxic add -t latency -a latency=1000 redis` (verify flags against the current Toxiproxy README). Assert that the request fails fast with a clear error instead of hanging.

### Game day roles

Facilitator (runs the script and the clock), operator (injects faults), observers (watch dashboards), scribe (timeline). Timebox to two hours, inject one fault at a time, and debrief with "what surprised us".

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Break things to "see what happens" | Written hypothesis and abort conditions | Without a hypothesis there is no learning, only an outage |
| Start in production | Staging first, then production with sign-off | Unknown failure modes hurt real users |
| Run without an instant stop | Prepare and test the stop command first | A stuck fault becomes an incident |
| Inject many faults at once | One variable per experiment | You cannot attribute the result |
| Run at peak or during a release | Quiet, staffed window | Overlapping changes confuse cause and effect |
| Keep findings in a slide | Tickets with owners, then re-run | Untested fixes regress |

## Verification checklist

- [ ] Steady state is numeric and was measured before the run.
- [ ] Plan has target, fault, duration, blast radius, abort conditions and stop command.
- [ ] The user explicitly approved the plan; production runs had stakeholder sign-off.
- [ ] Faults were removed and SLIs returned to steady state.
- [ ] Report states held or disproved, with evidence and owned follow-ups.

## Related

- Agents: `sre-engineer`, `incident-commander`, `cloud-devops-engineer`.
- Workflows: `/postmortem`.
- Knowledge: `incident-response`, `runbooks-oncall`, `load-testing`, `backup-dr`, `kubernetes-gke`, `observability-otel`, `microservices`.
