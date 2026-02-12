import type { Lesson } from './types';

export const lessonRomeIaC: Lesson = {
  id: 36,
  title: 'Infrastructure as Code: From kubectl to Terraform',
  description:
    'Bridge the biggest gap between the simulator and production: why kubectl is for learning but Terraform is for real infrastructure — plus the 5-layer pipeline, observability, and a full tenant onboarding walkthrough.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand how Rome AI manages its entire infrastructure as code. Congratulations — you have completed the full curriculum!',
  lecture: {
    sections: [
      {
        title: 'Why Not kubectl? The Problem with Imperative Management',
        content:
          'Throughout the simulator, you ran `kubectl create`, `kubectl scale`, and `kubectl set image` to manage your cluster. ' +
          'This is imperative: you tell Kubernetes what to do step by step. It works for learning, but breaks down in production.\n\n' +
          'Three problems:\n\n' +
          '1. No record of intent. After running 50 kubectl commands across 3 months, no one knows the current desired state. ' +
          'Did someone scale to 5 replicas temporarily and forget to scale back?\n\n' +
          '2. No review process. A `kubectl delete deployment prod-api` has no approval step, no diff, no rollback.\n\n' +
          '3. Environment drift. The staging cluster was set up differently from production because different engineers ' +
          'ran different commands on different days.\n\n' +
          'Infrastructure as Code (IaC) solves all three: the desired state is defined in files, reviewed in pull requests, ' +
          'applied by automation, and the same files deploy identically to every environment.',
        keyTakeaway:
          'kubectl is for learning and debugging. Production infrastructure is defined as code — reviewed, versioned, and applied through automation. This is not optional; it is how every serious team operates.',
      },
      {
        title: 'The 5-Layer Terraform Pipeline',
        content:
          'Rome AI\'s infrastructure is managed through five Terraform layers, each building on the previous one.\n\n' +
          '1. org-bootstrap: sets up the AWS Organization, SCPs, the Terraform Cloud workspace, and IAM roles for automation. ' +
          'Run once, rarely changed.\n\n' +
          '2. account-factory: creates new AWS accounts for tenants. Each customer gets their own account with standardized networking ' +
          'and IAM baselines. This is a Terraform module triggered when a new customer is onboarded.\n\n' +
          '3. baselines: provisions VPC (the three subnet tiers you learned about), the EKS cluster (v1.34), installs Karpenter ' +
          'with NodePools (t3a/m6a/m7a, spot preferred), deploys NGINX DaemonSet, aws-load-balancer-controller, kyverno, and infisical-operator. ' +
          'This is the layer that creates the K8s cluster itself.\n\n' +
          '4. workloads: provisions data layer resources — RDS Aurora PostgreSQL, ElastiCache Redis, DynamoDB tables, S3 buckets, ' +
          'and ClickHouse setup. These are AWS-managed services that the K8s applications depend on.\n\n' +
          '5. services: deploys the actual K8s applications — Deployments, StatefulSets, Services, Ingresses, ConfigMaps. ' +
          'This is the layer closest to what you did in the simulator, but expressed as Terraform HCL instead of kubectl commands.',
        diagram:
          '  Layer 1: org-bootstrap\n' +
          '    └── AWS Org, SCPs, Terraform Cloud\n' +
          '  Layer 2: account-factory\n' +
          '    └── AWS Account per tenant\n' +
          '  Layer 3: baselines\n' +
          '    └── VPC, EKS, Karpenter, add-ons\n' +
          '  Layer 4: workloads\n' +
          '    └── RDS, ElastiCache, DynamoDB, S3\n' +
          '  Layer 5: services\n' +
          '    └── Deployments, StatefulSets, Ingress\n' +
          '         (what you did in the simulator)',
        keyTakeaway:
          'The 5 layers separate concerns: org structure, accounts, infrastructure, data, applications. Each layer can be changed independently and has its own review/apply cycle.',
      },
      {
        title: 'Terraform vs. kubectl: The Same Concepts, Different Interface',
        content:
          'Terraform and kubectl manage the same Kubernetes resources, just differently. When you ran ' +
          '`kubectl create deployment applayer --image=applayer:1.0 --replicas=1` in the simulator, ' +
          'Terraform expresses the same intent as:\n\n' +
          '  resource "kubernetes_deployment" "applayer" {\n' +
          '    metadata { name = "applayer" }\n' +
          '    spec {\n' +
          '      replicas = 1\n' +
          '      template {\n' +
          '        spec {\n' +
          '          container {\n' +
          '            image = "123456789.dkr.ecr.../applayer:1.0"\n' +
          '            resources {\n' +
          '              requests = { cpu = "512m", memory = "1Gi" }\n' +
          '              limits   = { memory = "2Gi" }\n' +
          '            }\n' +
          '          }\n' +
          '          service_account_name = "applayer-sa"\n' +
          '        }\n' +
          '      }\n' +
          '    }\n' +
          '  }\n\n' +
          'The key differences:\n\n' +
          '1. Terraform tracks state — it knows what it previously created and can compute a diff. ' +
          '`terraform plan` shows you exactly what will change before you apply it.\n\n' +
          '2. Terraform manages the entire stack — the EKS cluster, the VPC, the RDS database, AND the K8s Deployments. ' +
          'kubectl only manages K8s resources.\n\n' +
          '3. Terraform is declarative at the file level — you define the end state, and Terraform figures out the operations ' +
          '(create, update, delete) needed to reach it.',
        keyTakeaway:
          'Terraform manages K8s resources the same way kubectl does, but adds state tracking, diffs, and the ability to manage the entire infrastructure stack (not just K8s) from one tool.',
      },
      {
        title: 'Observability: Seeing Inside the Production Cluster',
        content:
          'In the simulator, you used `kubectl get pods` and `kubectl describe` to understand cluster state. ' +
          'In production, you need three pillars of observability: Metrics (numbers over time), Logs (event records), ' +
          'and Traces (request paths through services).\n\n' +
          'Rome AI collects all three via OpenTelemetry. An otel-collector Deployment runs in each tenant cluster. ' +
          'It collects metrics and traces from application Pods (which instrument with OpenTelemetry SDKs) and forwards them ' +
          'via VPC peering to SignOz in the engineering account. SignOz provides dashboards, alerting, and trace analysis.\n\n' +
          'For AWS-managed services (RDS, ElastiCache, DynamoDB), CloudWatch metrics provide CPU, memory, connections, and latency. ' +
          'VPC Flow Logs capture rejected network traffic, stored in S3 and queryable via Athena. ' +
          'GuardDuty monitors across 16 AWS regions for malicious activity, forwarding findings through EventBridge → SNS → PagerDuty. ' +
          'CloudTrail provides an organization-wide audit trail of every AWS API call.\n\n' +
          'When something breaks in production, the debugging path is: PagerDuty alert → SignOz dashboard (identify which service) → ' +
          'SignOz traces (find the failing request) → `kubectl logs` via break-glass (if traces are insufficient).',
        keyTakeaway:
          'Production debugging starts with dashboards and traces, not kubectl. kubectl is the last resort, accessed via break-glass. OpenTelemetry, CloudWatch, VPC Flow Logs, GuardDuty, and CloudTrail provide layered visibility.',
      },
      {
        title: 'Putting It All Together: A New Tenant Deployment',
        content:
          'Let\'s trace what happens when a new customer (tenant) is onboarded.\n\n' +
          '1. account-factory Terraform creates a new AWS account, sets up IAM roles, and applies SCPs.\n\n' +
          '2. baselines Terraform provisions the VPC (public/system/private subnets), creates the EKS cluster (v1.34), ' +
          'installs Karpenter with NodePools (t3a/m6a/m7a, spot preferred), deploys NGINX DaemonSet, ' +
          'aws-load-balancer-controller, kyverno, and infisical-operator.\n\n' +
          '3. workloads Terraform creates RDS Aurora PostgreSQL (multi-schema for temporal, applayer, keycloak), ' +
          'ElastiCache Redis (TLS + auth token), DynamoDB tables for Datomic, S3 buckets, and ClickHouse setup.\n\n' +
          '4. services Terraform deploys all K8s applications: applayer Deployment with IRSA for S3, ' +
          'datomic StatefulSet with IRSA for DynamoDB, temporal Deployment backed by RDS, ' +
          'keycloak in its own namespace, material-planners with HPA (2-5), litellm with HPA (2-5), ' +
          'centrifugo with websocket Ingress, clickhouse StatefulSet with 120Gi PVs, otel-collector pointing to the engineering SignOz.\n\n' +
          '5. Cloudflare DNS records are created for all subdomains, ACM wildcard cert is provisioned, ALB is configured.\n\n' +
          'The entire process is code-reviewed in a pull request, applied by Terraform Cloud, and takes about 30 minutes. ' +
          'Every concept from the simulator — Pods, Deployments, StatefulSets, DaemonSets, Services, Ingress, ConfigMaps, Secrets, ' +
          'HPA, RBAC, Karpenter, CRDs — appears in this flow.',
        keyTakeaway:
          'A full tenant deployment exercises every K8s concept from the simulator. The difference is that it is defined in Terraform, reviewed in a PR, and applied by automation — not typed into kubectl.',
      },
    ],
  },
  quiz: [
    {
      question:
        'In the simulator, you ran `kubectl scale deployment web --replicas=5` to scale up. In Rome AI, an engineer wants to permanently change the applayer from 1 to 2 replicas. What is the correct procedure?',
      choices: [
        'Run `kubectl scale deployment applayer --replicas=2` on the production cluster, then update the Terraform code to match',
        'Update the `replicas` field in the services Terraform module, open a pull request, get it reviewed, and let Terraform Cloud apply the change',
        'Update the HPA minimum replicas from 1 to 2, since all Deployments in production are managed by HPA',
        'Ask the Karpenter operator to provision a new node with enough capacity for the second replica',
      ],
      correctIndex: 1,
      explanation:
        'In an IaC workflow, the Terraform code is the source of truth. Changing replicas via kubectl would create drift — ' +
        'Terraform would overwrite it on the next apply. The correct approach is to modify the Terraform HCL, ' +
        'open a PR for review, and let Terraform Cloud apply the change. This ensures the change is documented, reviewed, and reproducible.',
    },
    {
      question:
        'A developer runs `kubectl apply -f hotfix.yaml` directly on the production cluster to deploy an urgent fix. Terraform was not updated. What happens on the next `terraform apply`?',
      choices: [
        'Terraform detects the manually-created resource as "drift" and reverts it to match the Terraform state, removing the hotfix',
        'Terraform ignores resources it did not create and the hotfix remains alongside Terraform-managed resources',
        'Terraform apply fails with a conflict error because it detects resources that exist but are not in its state file',
        'Terraform imports the hotfix automatically into its state and preserves it for future applies',
      ],
      correctIndex: 0,
      explanation:
        'Terraform compares its state file with the actual cluster state. If a resource managed by Terraform was modified externally ' +
        '(e.g., replicas changed by kubectl), Terraform detects this as drift and reverts it to match the HCL definition. ' +
        'If the hotfix modifies a Terraform-managed Deployment, the changes will be overwritten. This is why all changes must go through Terraform.',
    },
    {
      question:
        'Rome AI\'s 5-layer Terraform pipeline separates org-bootstrap, account-factory, baselines, workloads, and services. Why are RDS databases in the \'workloads\' layer rather than the \'baselines\' layer with EKS?',
      choices: [
        'RDS is not a Kubernetes resource so it cannot be in the same layer as EKS',
        'Data layer resources have different lifecycle and change frequency than infrastructure — you might resize RDS without touching the EKS cluster',
        'AWS does not allow RDS and EKS to be provisioned in the same Terraform workspace',
        'RDS must be created after EKS because it needs the Kubernetes VPC CNI to assign it an IP address',
      ],
      correctIndex: 1,
      explanation:
        'The layers separate concerns by lifecycle. The EKS cluster (baselines) is created once and rarely changes. ' +
        'RDS databases (workloads) might be resized, have backups configured, or have new schemas added more frequently. ' +
        'Separating them means an RDS change does not require re-evaluating the entire EKS cluster configuration. ' +
        'Each layer can be planned, reviewed, and applied independently.',
    },
    {
      question:
        'An alert fires in PagerDuty: \'applayer pod CrashLoopBackOff\'. Using Rome AI\'s observability stack, what is the recommended debugging sequence?',
      choices: [
        'SSH into the EKS node, find the container process, and read its stdout/stderr from the container runtime',
        'Check SignOz dashboard for error rate spikes, examine traces for failing requests, check CloudWatch for RDS connection limits, then use break-glass kubectl logs if needed',
        'Run `kubectl describe pod` to see the crash reason, then fix the code and redeploy via kubectl apply',
        'Check the Terraform Cloud run logs to see if a recent infrastructure change caused the crash',
      ],
      correctIndex: 1,
      explanation:
        'The debugging path follows the observability layers: SignOz (application metrics/traces) first to understand the scope and timing, ' +
        'CloudWatch (infrastructure metrics) to check if an underlying service (RDS, ElastiCache) is the cause, ' +
        'then break-glass kubectl access for direct Pod logs if needed. Direct SSH to nodes is not part of the workflow, ' +
        'and kubectl apply is not used for deployments.',
    },
    {
      question:
        'What does `terraform plan` show that `kubectl apply --dry-run=client` does not?',
      choices: [
        'Nothing — both commands show a preview of what will change in the cluster before applying',
        'Terraform plan shows changes across the entire infrastructure stack (VPC, RDS, EKS, K8s resources), while kubectl dry-run only validates the single resource being applied',
        'Terraform plan shows resource costs, while kubectl dry-run shows performance impact',
        'Terraform plan validates RBAC permissions, while kubectl dry-run skips authorization checks',
      ],
      correctIndex: 1,
      explanation:
        '`terraform plan` computes the diff for ALL resources managed by Terraform, across the entire infrastructure stack. ' +
        'It shows: "This will create 1 new S3 bucket, modify the RDS instance class, and update the applayer Deployment image." ' +
        '`kubectl apply --dry-run` only validates the single YAML file being applied and has no visibility into AWS resources or other K8s resources.',
    },
    {
      question:
        'A new engineer joins the Rome AI team. They have completed all 32 simulator lessons. What is the single most important conceptual shift they need to make?',
      choices: [
        'Learning HCL syntax instead of YAML, because Terraform uses a different configuration language',
        'Understanding that they should never run kubectl commands, even for debugging',
        'Recognizing that the entire cluster state is declared in code, reviewed in PRs, and applied by automation — kubectl is for observation and emergencies, not for making changes',
        'Learning AWS-specific concepts like VPCs and IAM, which are required before understanding any Kubernetes concepts',
      ],
      correctIndex: 2,
      explanation:
        'The conceptual shift is from "I run commands to change the cluster" to "I change code, and automation applies it to the cluster." ' +
        'Every concept from the simulator (Deployments, scaling, rolling updates, etc.) still applies, but the interface changes from kubectl to Terraform. ' +
        'kubectl remains valuable for debugging (kubectl get, kubectl describe, kubectl logs) but is not used for making changes in production.',
    },
  ],
};
