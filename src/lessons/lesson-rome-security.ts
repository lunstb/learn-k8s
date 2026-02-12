import type { Lesson } from './types';

export const lessonRomeSecurity: Lesson = {
  id: 35,
  title: 'Security and Access Control',
  description:
    'Map RBAC and Secrets from the simulator to production security: IRSA for AWS access, 7 layers of defense in depth, Infisical for secrets lifecycle, and break-glass emergency access.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand how Rome AI secures its production Kubernetes infrastructure.',
  lecture: {
    sections: [
      {
        title: 'From ServiceAccounts to IRSA: How Pods Access AWS',
        content:
          'In the simulator, you learned that ServiceAccounts give Pods an identity for RBAC within the cluster. ' +
          'In Rome AI, Pods also need to access AWS services — S3 buckets, DynamoDB tables, SQS queues.\n\n' +
          'The naive approach: create an IAM user, put the access key in a Kubernetes Secret, and mount it in the Pod. ' +
          'This is insecure (long-lived credentials, shared secrets, no rotation).\n\n' +
          'IRSA (IAM Roles for Service Accounts) solves this. It works by connecting the Kubernetes ServiceAccount to an ' +
          'AWS IAM role via an OIDC (OpenID Connect) federation trust. When a Pod with an annotated ServiceAccount starts, ' +
          'the kubelet injects a short-lived token. AWS APIs accept this token because the IAM role trusts the EKS cluster\'s OIDC provider.\n\n' +
          'The applayer Pod uses IRSA to access S3 for file storage. The ingest-server uses IRSA for S3 and DynamoDB. ' +
          'Each service gets its own IAM role with minimum permissions — the applayer can read/write its S3 bucket but cannot touch DynamoDB.',
        diagram:
          '  Pod (ServiceAccount: applayer-sa)\n' +
          '       │\n' +
          '  Kubelet injects OIDC token\n' +
          '       │\n' +
          '  AWS SDK reads token → calls STS AssumeRoleWithWebIdentity\n' +
          '       │\n' +
          '  IAM Role (applayer-role): s3:GetObject, s3:PutObject\n' +
          '       │\n' +
          '  S3 Bucket (applayer-storage)',
        keyTakeaway:
          'IRSA eliminates long-lived AWS credentials. Each Pod gets a short-lived, automatically-rotated token. Each service\'s IAM role follows least privilege — only the specific AWS actions it needs.',
      },
      {
        title: 'Defense in Depth: Layers of Security',
        content:
          'In the simulator, security was a single concept (RBAC). In production, security is layered. ' +
          'Rome AI has seven layers:\n\n' +
          '1. SCPs (Service Control Policies) at the AWS Organization level — they restrict what any account can do regardless of IAM permissions. ' +
          'For example, an SCP prevents deleting CloudTrail logs.\n\n' +
          '2. IAM roles and policies per service (IRSA).\n\n' +
          '3. Kubernetes RBAC — who can kubectl into the cluster and what they can do.\n\n' +
          '4. Pod Security Standards per namespace — prevent privileged containers, host networking, etc.\n\n' +
          '5. Kyverno policies — enforce resource limits, image sources (only ECR), label requirements.\n\n' +
          '6. Network ACLs and Security Groups — control which ports and protocols are allowed at the VPC level ' +
          '(HTTP/HTTPS/QUIC only).\n\n' +
          '7. KMS encryption at rest for etcd, EBS volumes, S3 buckets, and RDS. TLS in transit for all service-to-service communication.\n\n' +
          'Each layer catches threats the others miss. An attacker who bypasses RBAC still cannot exfiltrate data because IRSA limits their AWS access. ' +
          'An attacker who compromises an IAM role cannot disable security logging because SCPs prevent it.',
        keyTakeaway:
          'Production security is not one mechanism but seven overlapping layers. Each layer assumes the others might fail. This is defense in depth.',
      },
      {
        title: 'Secrets Management: Infisical Operator in Practice',
        content:
          'In the simulator, you created Secrets with `kubectl create secret` and learned that base64 is not encryption. ' +
          'Rome AI takes this further.\n\n' +
          'Secrets are stored in Infisical (a centralized secrets manager). The infisical-operator watches for InfisicalSecret ' +
          'custom resources in the cluster. When it finds one, it fetches the secrets from Infisical\'s API, creates a Kubernetes ' +
          'Secret with the values, and keeps it synchronized. If a secret changes in Infisical (e.g., database password rotation), ' +
          'the operator updates the K8s Secret within minutes.\n\n' +
          'This approach has three advantages over manual secret creation:\n\n' +
          '1. Secrets never appear in CI/CD logs or Terraform state.\n' +
          '2. Rotation is automatic.\n' +
          '3. There is an audit trail of who accessed which secret.\n\n' +
          'The K8s Secrets themselves are still base64 in etcd, but EKS encrypts etcd with KMS, so they are encrypted at rest. ' +
          'Combined with RBAC that restricts Secret access per namespace, this provides a robust secrets pipeline.',
        keyTakeaway:
          'The infisical-operator automates the Secret lifecycle: create, sync, rotate, audit. Combined with KMS encryption at rest and namespace-scoped RBAC, this is production-grade secrets management.',
      },
      {
        title: 'Break-Glass Access: Emergency Procedures',
        content:
          'In normal operations, engineers interact with Rome AI\'s infrastructure through Terraform and CI/CD pipelines. ' +
          'Direct `kubectl` access is limited by RBAC. But emergencies happen — a production incident requires immediate debugging.\n\n' +
          'Rome AI implements a break-glass role: an IAM role that grants temporary elevated access with a 1-hour session duration. ' +
          'When an engineer assumes this role, an SNS alert is immediately sent to the team (so everyone knows someone is using elevated access). ' +
          'The 1-hour session means the elevated access automatically expires.\n\n' +
          'CloudTrail records every API call made during the session, creating a full audit trail. After the incident, ' +
          'the team reviews the CloudTrail logs to understand what actions were taken and whether any changes need to be reverted.\n\n' +
          'This pattern balances two competing needs: security (restrict access) and operability (engineers must be able to fix things fast). ' +
          'The break-glass role is never used for routine work — only for incidents that cannot be resolved through the normal pipeline.',
        keyTakeaway:
          'Break-glass access provides emergency elevated permissions with automatic expiration, immediate team notification, and full audit logging. It balances security with the need for rapid incident response.',
      },
    ],
  },
  quiz: [
    {
      question:
        'In the simulator, you learned that ServiceAccounts give Pods identity for RBAC. In Rome AI, the applayer Pod needs to read from an S3 bucket. Using IRSA, which component actually verifies that the Pod is authorized to access S3?',
      choices: [
        'The Kubernetes API Server checks the Pod\'s ServiceAccount against an S3-specific RBAC Role before allowing the call',
        'The NGINX Ingress Controller validates the S3 request token before forwarding it to the AWS API',
        'AWS STS verifies the Pod\'s OIDC token against the EKS cluster\'s identity provider and returns temporary IAM credentials',
        'The infisical-operator generates S3-specific access tokens and injects them into the Pod as environment variables',
      ],
      correctIndex: 2,
      explanation:
        'IRSA works through OIDC federation. The Pod\'s ServiceAccount token is a JWT signed by the EKS OIDC provider. ' +
        'The AWS SDK in the Pod calls STS AssumeRoleWithWebIdentity with this token. STS verifies the token against the ' +
        'registered OIDC provider, confirms the ServiceAccount matches the IAM role trust policy, and returns temporary credentials. ' +
        'Kubernetes RBAC is not involved in AWS authorization.',
    },
    {
      question:
        'An engineer wants to add a new S3 bucket that the ingest-server can access. They update the IAM policy for the ingest-server\'s IRSA role. Do the running ingest-server Pods need to be restarted?',
      choices: [
        'Yes — IRSA tokens are cached at Pod startup and will not reflect IAM policy changes until the Pod restarts',
        'No — IRSA tokens are short-lived and automatically refreshed, and IAM policy changes take effect immediately on the next AWS API call',
        'Yes — the Kubernetes ServiceAccount annotation must be updated and the Pod recreated to pick up the new role',
        'No — but only if the infisical-operator is configured to refresh IAM policies in addition to secrets',
      ],
      correctIndex: 1,
      explanation:
        'IRSA credentials are automatically refreshed by the AWS SDK. IAM policy changes are evaluated on every API call. ' +
        'Since the IAM role itself has not changed (only its attached policy), the existing Pods will automatically ' +
        'gain access to the new S3 bucket on their next API call without any restart or redeployment.',
    },
    {
      question:
        'Rome AI uses KMS encryption for etcd (Kubernetes secrets), EBS volumes, S3 buckets, and RDS. If an attacker gains direct access to the underlying EBS volume of an EKS node, what can they read?',
      choices: [
        'Everything — KMS encryption only protects data during network transit, not at rest on disk',
        'Nothing useful — the EBS volume is encrypted with a KMS key, so raw disk reads return ciphertext without the key',
        'Only non-secret data — Kubernetes Secrets are double-encrypted but other Pod data is readable',
        'Container images only — application data is stored in memory (tmpfs) and not written to the EBS volume',
      ],
      correctIndex: 1,
      explanation:
        'EBS encryption with KMS is transparent to the operating system but protects against physical disk access. ' +
        'If someone copies the raw EBS volume (e.g., via a snapshot API call they should not have), they get encrypted blocks. ' +
        'Without access to the KMS key (which requires IAM permissions), the data is unreadable. ' +
        'This is one layer in Rome AI\'s defense-in-depth strategy.',
    },
    {
      question:
        'A production incident occurs at 2 AM. An on-call engineer needs to run `kubectl exec` into a Pod to check application logs. In Rome AI\'s security model, what is the correct procedure?',
      choices: [
        'The engineer uses their regular IAM credentials, which always have kubectl exec permissions for on-call personnel',
        'The engineer assumes the break-glass IAM role (1-hour session), which triggers an SNS alert, then accesses the cluster with elevated permissions',
        'The engineer contacts the security team to request temporary credentials, which are manually provisioned and revoked after the incident',
        'The engineer accesses the Pod logs through the SignOz observability dashboard, because direct kubectl access is never permitted',
      ],
      correctIndex: 1,
      explanation:
        'The break-glass role is designed for exactly this scenario. The engineer assumes the role (which auto-expires in 1 hour), ' +
        'the SNS alert notifies the team, and CloudTrail logs every action. This provides fast access without compromising ' +
        'the principle that routine operations should not have elevated cluster access.',
    },
    {
      question:
        'Rome AI\'s Kyverno policy requires all container images to come from the company\'s ECR registry. A developer deploys a Deployment with image `docker.io/library/nginx:latest`. What happens?',
      choices: [
        'The Deployment is created but Kyverno automatically rewrites the image reference to the ECR equivalent',
        'The Deployment is created and Pods start, but Kyverno generates a PolicyViolation report for the security team',
        'The API Server rejects the Deployment because Kyverno\'s validating webhook detects the non-ECR image source',
        'The kubelet pulls the image from Docker Hub but Kyverno quarantines the Pod by adding a network policy that blocks all egress',
      ],
      correctIndex: 2,
      explanation:
        'Kyverno in enforce mode uses validating admission webhooks. When the API Server processes the Deployment creation, ' +
        'the webhook checks the image field against the policy\'s allowed registries. Since `docker.io` is not an approved source, ' +
        'the webhook denies the request. The developer receives an error message explaining the policy violation and must push the image to ECR first.',
    },
  ],
};
