# Deploying this app

`.github/workflows/deploy.yml` does two things on every push to `master`:

1. builds the image and pushes it to ECR as `apsomarketinghub:<sha>` **and** `:prod`;
2. runs `aws ecs update-service --force-new-deployment` so the running tasks pull
   the image it just pushed.

Step 1 has always worked. Step 2 fails with:

```
User: arn:aws:sts::905418292914:assumed-role/apso-github-actions-role/GitHubActions
is not authorized to perform: ecs:UpdateService on resource:
arn:aws:ecs:eu-central-1:905418292914:service/apso-dev/apso-dev-apsomarketinghub
because no identity-based policy allows the ecs:UpdateService action
```

So the image is in ECR and nothing is serving it. Every push since 15 September
built something nobody was looking at.

## The fix

Attach `github-actions-ecs-deploy-policy.json` (next to this file) to the role
**`apso-github-actions-role`** in account **905418292914**.

Console: IAM → Roles → `apso-github-actions-role` → Permissions → Add permissions
→ Create inline policy → JSON → paste the file → name it
`apsomarketinghub-ecs-deploy` → Create policy.

CLI:

```bash
aws iam put-role-policy \
  --role-name apso-github-actions-role \
  --policy-name apsomarketinghub-ecs-deploy \
  --policy-document file://docs/aws/github-actions-ecs-deploy-policy.json
```

`iam:PassRole` is **not** needed. It would be, if the workflow registered a new
task definition — it does not. The task definition is left alone and points at
`:prod`, so forcing a deployment is enough to pick up the new image.

## Getting a build live without the policy

The deployment can be forced by hand, and this needs no IAM change because a
human in the console already has the permission the role is missing:

ECS → Clusters → `apso-dev` → Services → `apso-dev-apsomarketinghub` → Update →
tick **Force new deployment** → Update.

The service pulls `:prod`, which is whatever the last successful build pushed.

## Checking which build is actually running

`GET /api/health` returns the commit the running container was built from:

```json
{ "commit": "...", "shortCommit": "97e4b3f", "builtAt": "2026-10-04T09:05:12Z" }
```

If `shortCommit` is not the head of `master`, the deployment did not happen.
That endpoint exists precisely because "it is pushed" and "it is deployed" were
indistinguishable from the outside for six weeks.
