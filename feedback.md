# K8s Learning Simulator — Audit & Iteration Tracker

## Overall: 8/10

Lectures are accurate, quizzes are excellent (test real misconceptions), 21/23 lessons have hands-on practice, and the visualization makes the control loop tangible. Main gaps are in simulation fidelity, a few broken hints/checks, and missing curriculum topics.

---

## CRITICAL — Broken / Teaches Wrong Things

### ~~[BUG] Lesson 8 & 23: Invalid kubectl patch hint syntax~~
~~Hint 6 uses `kubectl patch service backend-svc --selector=app=backend`.~~
Verified: The simulator's `handlePatch` actually supports `--selector=` syntax. Not a real bug.
- Status: **NOT A BUG** (simulator has custom simplified patch)

### ~~[BUG] Lesson 2: Goal 1 check has `|| s.tick > 0` false positive~~
- Status: **FIXED** — Now checks pod existence OR event history (for deleted standalone pods)

### ~~[BUG] Lesson 7: Goal 2 allows any image change, not specifically nginx:2.0~~
- Status: **FIXED** — Changed to `image === 'nginx:2.0'`

### ~~[BUG] Lesson 8: Goal 1 same issue — allows any image, not specifically nginx:2.0~~
- Status: **FIXED** — Changed to `image === 'nginx:2.0'`

### ~~[BUG] Lesson 23: Goal 1 same issue — allows any image, not specifically backend:1.0~~
- Status: **FIXED** — Changed to `image === 'backend:1.0'`

### ~~[BUG] Endpoints use pod names instead of IPs~~
- Status: **FIXED** — Now generates deterministic simulated IPs (10.244.x.x)

---

## HIGH — Simulation Fidelity Issues Affecting Learning

### ~~[SIM] CrashLoopBackOff has no exponential backoff~~
- Status: **FIXED** — Added exponential backoff (1-4 ticks between restarts based on restartCount)

### [SIM] Readiness probes only checked once, not continuously
Once `age > initialDelaySeconds`, pod becomes ready permanently. Real K8s: probes run repeatedly, pods can lose readiness.
- File: `src/simulation/store.ts`
- Status: **NOT FIXED** (acceptable simplification for now — no lesson depends on probe failure after ready)

### ~~[SIM] HPA scales every tick (no cooldown)~~
- Status: **FIXED** — Added 3-tick cooldown between scale actions

### ~~[SIM] StatefulSet doesn't enforce pod ordering~~
- Status: **FIXED** — Now waits for previous ordinal to be Running before creating next

### ~~[CMD] Unsupported commands give confusing errors~~
- Status: **FIXED** — exec, port-forward, edit, run, expose, etc. now show helpful messages with alternatives

---

## MEDIUM — Curriculum Gaps

### [CURRICULUM] No PersistentVolumes/PVCs lesson
Critical gap — can't understand StatefulSets without storage. Should add 1-2 lessons on PV/PVC/StorageClass.
- Status: **NOT STARTED**

### [CURRICULUM] Network Policies is lecture-only
Could benefit from simplified practice (write a deny-all policy, then allow specific traffic).
- Status: **NOT STARTED**

### [CURRICULUM] No init containers / sidecar pattern coverage
Common pod design patterns not covered at all.
- Status: **NOT STARTED**

### [CURRICULUM] No node affinity / tolerations lesson
Scheduling beyond basic round-robin not covered.
- Status: **NOT STARTED**

---

## CURRICULUM DEEP REVIEW (Feb 2026 — vs CKA/CKAD/industry)

### Strengths
- Mental-model-first approach (control loops before resources) is better than most tutorials
- Quiz questions target real misconceptions, not just recall
- Simulated control plane with actual reconciliation loops is a major differentiator
- 25 lessons covering all major resource types with two capstone troubleshooting scenarios

### Tier 1 Gaps — Real holes that limit the tutorial's value

**1. Multi-container Pod patterns (init containers, sidecars)**
20% of CKAD exam. Init containers (wait for dependency, run migrations) and sidecars (log shippers, envoy proxies) are daily production patterns. Zero coverage currently.
- Priority: **HIGH**
- Status: **NOT STARTED**

**2. Taints, tolerations, and affinity as a dedicated lesson**
CKA tests these as first-class concepts. "Schedule only on GPU nodes" or "never co-locate two replicas on the same node" are routine tasks. Current scheduling lesson mentions them but doesn't teach them hands-on.
- Priority: **HIGH**
- Status: **NOT STARTED**

**3. DNS and service discovery**
`<service>.<namespace>.svc.cluster.local` is the #1 networking debugging pain point. Every CKA study guide flags DNS as undertaught. A lesson debugging a cross-namespace service call that fails due to wrong DNS would be high value.
- Priority: **HIGH**
- Status: **NOT STARTED**

**4. Security contexts**
`runAsNonRoot`, `readOnlyRootFilesystem`, dropping capabilities — mandatory in production, tested on CKAD and CKS. Currently absent.
- Priority: **HIGH**
- Status: **NOT STARTED**

**5. Pod Disruption Budgets**
Without PDBs, `kubectl drain` can kill all pods at once. Bridge between "I know how to deploy" and "I can operate safely." Community consistently calls this a "wish I'd known sooner" topic.
- Priority: **HIGH**
- Status: **NOT STARTED**

**6. Kustomize**
Added to CKA exam in 2025 alongside Helm. Many teams use Kustomize as primary manifest management. Natural companion to existing Helm lesson.
- Priority: **HIGH**
- Status: **NOT STARTED**

**7. K8s architecture deep-dive**
No dedicated lesson on how API server, etcd, scheduler, and controller manager interact as a system. CKA gives 25% weight to "Cluster Architecture." The why-k8s lesson introduces the concept but doesn't go deep enough.
- Priority: **HIGH**
- Status: **NOT STARTED**

### Tier 2 Gaps — Would meaningfully round things out

**8. CRDs and Operators (conceptual)**
Added to CKA 2025. Every real cluster runs operators (cert-manager, prometheus-operator). Understanding K8s extensibility via CRDs explains why the ecosystem works.
- Priority: **MEDIUM**
- Status: **NOT STARTED**

**9. Gateway API**
Official successor to Ingress, added to CKA 2025. Current Ingress lesson is fine for now but Gateway API is where networking is heading.
- Priority: **MEDIUM**
- Status: **NOT STARTED**

**10. Resource Quotas and LimitRanges (dedicated)**
Namespaces lesson mentions quotas, but a hands-on exercise where pod creation fails because it exceeds a namespace quota would teach a common production gotcha.
- Priority: **MEDIUM**
- Status: **NOT STARTED**

**11. Node troubleshooting**
CKA troubleshooting domain is 30%. Capstone lessons cover app-level debugging, but diagnosing a NotReady node (kubelet down, disk pressure, certificate expired) is a different skill.
- Priority: **MEDIUM**
- Status: **NOT STARTED**

**12. Blue/green and canary deployments**
Deployments lesson covers rolling updates well, but blue/green and canary are common interview questions and production patterns. Even a conceptual comparison would help.
- Priority: **MEDIUM**
- Status: **NOT STARTED**

### Tier 3 Gaps — Nice-to-have / ecosystem awareness

- GitOps concepts (ArgoCD/Flux) — the standard production deployment model
- Monitoring concepts (Prometheus, metrics-server beyond HPA)
- etcd backup/restore — hard to simulate but CKA 25%
- Service mesh (Istio/Linkerd) — conceptual awareness
- Container image security — scanning, supply chain (CKS territory)
- Admission controllers — explains "magic" behind policy enforcement

### Structural Issues (not about missing topics)

1. **Two lessons are lecture-quiz only** (Network Policies, RBAC) with no hands-on. Both are high-weight CKA topics.
2. **No manifest-writing from scratch** — Most exercises use pre-built YAML or imperative commands. A lesson where users write a Deployment YAML from memory (with validation) would build CKA/CKAD muscle memory.
3. **Labels and selectors deserve a dedicated lesson** — They're the glue connecting everything (Services→Pods, Deployments→ReplicaSets, NetworkPolicies→targets). Currently taught incidentally.

### Coverage Estimates

| Criteria | Rating |
|---|---|
| Beginner fundamentals | Excellent |
| Intermediate workloads | Strong |
| Production readiness | Weak — missing security contexts, PDBs, multi-container patterns |
| CKA exam coverage | ~60% — missing architecture, taints/affinity, CRDs, etcd, maintenance |
| CKAD exam coverage | ~55% — missing init/sidecar containers, security contexts, Kustomize |
| Day-2 operations | Minimal — no monitoring, logging pipelines, GitOps, or upgrade paths |

---

## PRODUCTION CROSS-REFERENCE (Rome Terraform K8s setup)

Analyzed the real production EKS infrastructure in `romeai/dev/terraform/` to identify K8s concepts actively used in production that the simulator doesn't teach. This is the strongest signal for what's actually needed day-to-day.

### K8s features used in production that ARE covered by the simulator

- Deployments with rolling updates (maxSurge, maxUnavailable)
- StatefulSets with headless services and PVC templates
- Services (ClusterIP)
- Ingress (nginx ingress with host/path routing, CORS annotations, SSL redirect)
- HPA (CPU + memory metrics, scale-up/scale-down behavior policies)
- Liveness, readiness, AND startup probes (all three types)
- Resource requests and limits (CPU requests, memory requests+limits)
- ConfigMaps (for image version tracking, Infisical config)
- Secrets (Infisical-managed, mounted via envFrom)
- Namespaces
- Labels and selectors (app labels throughout)
- Helm charts (Karpenter, AWS LB Controller, Kyverno all deployed via Helm)
- Karpenter/cluster autoscaling (NodePool, EC2NodeClass, consolidation policies)
- StorageClasses (gp3 with EBS CSI driver, encrypted, WaitForFirstConsumer binding)

### K8s features used in production that are NOT covered — PRIORITY GAPS

**1. Init containers** — Used in production for DB migrations and dependency waits. The deployment module has full `init_containers` support with image resolution, env vars, volume mounts, and resource limits. Tutorial has zero init container coverage.

**2. Tolerations and taints** — Pervasive in production:
  - System nodes have `CriticalAddonsOnly` taint (only critical addons scheduled there)
  - Karpenter nodes have `karpenter.sh/capacity-type` taint (spot vs on-demand)
  - All workload pods include matching tolerations
  - All Helm-deployed controllers (Karpenter, Kyverno, ALB Controller) use tolerations to run on system nodes
  - Tutorial mentions these but never teaches hands-on use.

**3. Topology spread constraints** — Every Deployment and StatefulSet uses `topologySpreadConstraints` to distribute pods across nodes (`kubernetes.io/hostname`, maxSkew=1, ScheduleAnyway). Kyverno even auto-injects these via ClusterPolicy. Tutorial doesn't cover pod anti-affinity or topology spread at all.

**4. Pod Disruption Budgets** — Enabled by default for all services (`enable_pdb = true`). Sophisticated dual-PDB strategy: `maxUnavailable=1` for both single and multi-replica services, working in concert with Deployment's `max_unavailable=0` to allow Karpenter consolidation while protecting availability. Tutorial doesn't mention PDBs.

**5. Startup probes** — Used alongside liveness/readiness probes for containers with long initialization. Configured with `startup_probe_failure_threshold` to prevent liveness probe from killing slow-starting containers. Tutorial only covers liveness and readiness.

**6. CRDs (Custom Resource Definitions)** — Heavily used:
  - `InfisicalSecret` CRD for external secret management (syncs from Infisical to K8s Secrets)
  - `EC2NodeClass` and `NodePool` CRDs for Karpenter
  - `ClusterPolicy` CRD for Kyverno
  - Tutorial doesn't explain CRDs or operators.

**7. Policy engines (admission controllers)** — Kyverno deployed with two ClusterPolicies:
  - Auto-adds `unhealthyPodEvictionPolicy: AlwaysAllow` to all PDBs (prevents deadlocks during drain)
  - Auto-adds topology spread constraints to Deployments/StatefulSets that lack them
  - This is a real-world pattern for enforcing cluster-wide best practices.

**8. IRSA (IAM Roles for Service Accounts)** — Every controller (Karpenter, ALB Controller, EBS CSI) uses OIDC-federated IAM roles mapped to K8s ServiceAccounts. This is how pods get AWS permissions without static credentials. Tutorial covers ServiceAccounts but not cloud IAM integration.

**9. External secret management** — Infisical operator syncs secrets from external vault into K8s Secrets, with `auto-reload` annotations on pods. Tutorial teaches basic K8s Secrets but not the operator-based external secret pattern that's standard in production.

**10. Image version management via ConfigMap** — CI/CD writes image tags to a ConfigMap; Terraform reads from it. This decouples deployment config from image versions. Clever pattern not covered anywhere in the tutorial.

**11. Termination grace periods** — Explicitly configured (default 120s, some services up to 45min). Tutorial doesn't cover graceful shutdown or preStop hooks.

**12. Annotations for operational metadata** — Used extensively:
  - `resource.opentelemetry.io/service.name` for observability
  - `secrets.infisical.com/auto-reload` for secret rotation
  - `nginx.ingress.kubernetes.io/*` for ingress CORS/SSL config
  - Tutorial doesn't teach annotations as a concept.

**13. EKS add-ons / managed cluster components** — Production uses:
  - VPC CNI with prefix delegation (for IP address management)
  - CoreDNS with custom Corefile (forwarding private domain to VPC resolver)
  - kube-proxy
  - EBS CSI driver with IRSA
  - Snapshot controller (for volume snapshots)
  - Node monitoring agent
  - Pod Identity agent

**14. KMS encryption** — Secrets encrypted at rest with AWS KMS. Node storage encrypted with separate KMS key. Tutorial mentions encryption at rest for Secrets but doesn't show how it actually works.

**15. Node groups with capacity planning** — Two-tier node architecture:
  - System nodes: ON_DEMAND, t3a.large/xlarge, 2-6 nodes, with `CriticalAddonsOnly` taint
  - App nodes: Managed by Karpenter, spot/on-demand, flexible instance families, consolidation policies
  - Tutorial's scheduling lesson doesn't cover this real-world multi-pool pattern.

### Critique of the K8s usage in the Terraform setup

The production setup is well-architected overall, but a few observations:

1. **Ingress CORS `cors-allow-origin: *`** — Wildcard CORS origin is overly permissive. Should restrict to known domains.
2. **`image_pull_policy: Always`** — Forces a registry check on every pod start, adding latency. Fine for dev/staging but consider `IfNotPresent` for production with immutable tags.
3. **`ignore_changes = [spec.0.replicas]` everywhere** — Necessary for HPA, but means Terraform can never intentionally reset replica count. Could be conditional on `enable_autoscaling`.
4. **PDB `maxUnavailable=1` for single-replica services** — With 1 replica and `maxUnavailable=1`, the PDB allows disrupting the only pod. The comment explains the deployment strategy compensates, but this is subtle and could surprise during manual drains.
5. **No NetworkPolicies** — No pod-to-pod traffic restrictions. All pods can communicate freely within the cluster. Should consider at least default-deny with explicit allow rules for production.
6. **No security contexts** — No `runAsNonRoot`, `readOnlyRootFilesystem`, or capability dropping. Containers run with default privileges.

### Priority order for new lessons (based on production reality)

Given what the production setup actually uses, the highest-impact additions would be:

1. **Init containers** — Used in production, zero coverage, CKAD exam topic
2. **Tolerations + taints (dedicated)** — Pervasive in production (every single pod), CKA exam
3. **Pod Disruption Budgets** — Default-on in production, critical for safe operations
4. **Topology spread / pod anti-affinity** — Every deployment uses it, not taught at all
5. **Startup probes** — Used alongside liveness/readiness, easy addition to existing probes lesson
6. **CRDs and operators (conceptual)** — 3+ CRDs in active use, explains how ecosystem tools work
7. **Annotations (dedicated)** — Used everywhere for operational metadata, never explicitly taught
8. **Termination grace periods + graceful shutdown** — Explicitly configured in production
9. **External secret management** — Real-world secret pattern vs raw K8s Secrets
10. **DNS / CoreDNS** — Custom Corefile in production, cross-namespace FQDN patterns

---

## LOW — Minor Issues

### [LESSON] Lesson 6: Goal description says "observe pod eviction" but only teaches cordon/uncordon
Cordon doesn't evict — needs drain or description fix.
- File: `src/lessons/lesson6.ts`

### [LESSON] Lesson 3 Q2: Explanation for pod termination order is slightly misleading
Says oldest pods are "proven stable" — real reason is just implementation default (newest first).
- File: `src/lessons/lesson3.ts`

### [SIM] CronJob missing concurrencyPolicy support
- File: `src/simulation/controllers/cronjob.ts`

### [SIM] Deployment maxSurge/maxUnavailable not fully enforced
Simplified but works for teaching purposes.
- File: `src/simulation/controllers/deployment.ts`

---

## COMPLETED (from previous audits)

- [x] Added YAML apply support (`kubectl apply -f -` with inline YAML)
- [x] Added `kubectl logs` command
- [x] Fixed lesson 12 (was broken — missing "web" deployment)
- [x] Fixed CronJob to use real cron syntax (was `every-N-ticks`)
- [x] Added goals checklist panel with per-goal progress tracking
- [x] Added progressive hint system (click to reveal)
- [x] Made lesson list scrollable so goals stay visible
- [x] Rewrote all hints to be actionable (not restating goals)
- [x] Added `kubectl patch`, `kubectl label`, `kubectl taint`, `kubectl drain` commands
- [x] Added `kubectl describe` with detailed output including Reason/Message
- [x] Quiz questions rewritten to test misconceptions
- [x] Added `hint` command to terminal
- [x] Fixed goal check false positives in lessons 2, 7, 8, 23 (now check exact target image)
- [x] Endpoints now use simulated pod IPs (10.244.x.x) instead of pod names
- [x] CrashLoopBackOff now has exponential backoff (1-4 ticks between restarts)
- [x] HPA has 3-tick cooldown between scale actions (simulates stabilization window)
- [x] StatefulSet enforces ordering (waits for previous pod Running before creating next)
- [x] Unsupported commands (exec, port-forward, edit, run, expose) show helpful messages
