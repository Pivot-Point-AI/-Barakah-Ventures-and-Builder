# Deployment

The site ships as a static build served by Docker Compose:
`nginx-proxy` + `acme-companion` (automatic Let's Encrypt) in front of a
`web` container built from the `Dockerfile` in this repo. GitHub Actions
(`.github/workflows/deploy.yml`) rsyncs the repo to the server and runs
`docker compose up -d --build` on every push to `main`.

## 1. One-time server setup (run once, manually, on 2.25.167.101)

DNS for `barakahventures.us` and `www.barakahventures.us` must already
point at `2.25.167.101` before requesting certificates, or `acme-companion`
will fail to issue them.

```bash
# Install Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
apt-get update && apt-get install -y rsync

# The box already has a system nginx bound to :80/:443 (serving the
# default Debian page) — it must be stopped and disabled, otherwise
# nginx-proxy can't bind those ports.
systemctl stop nginx
systemctl disable nginx

# Deploy directory (must match the DEPLOY_PATH secret below)
mkdir -p /opt/barakah-ventures
```

Generate a dedicated deploy keypair (don't reuse your personal one — this
one lives in a GitHub secret, so it should be revocable on its own):

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/deploy_key -C "github-actions-deploy"
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key
```

Copy the full output of that last `cat` — including the
`-----BEGIN OPENSSH PRIVATE KEY-----` / `-----END...-----` lines — that's
the value for the `SSH_PRIVATE_KEY` secret below. Once it's saved in
GitHub, you can `rm ~/.ssh/deploy_key` from the server (keep a backup copy
somewhere safe first if you might need to rotate/re-add it later — GitHub
won't show a saved secret's value again).

## 2. GitHub repository secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `SSH_PRIVATE_KEY` | Output of `cat ~/.ssh/deploy_key` above |
| `SSH_HOST` | `2.25.167.101` |
| `SSH_USER` | `root` (or your deploy user) |
| `SSH_PORT` | `22` (omit to use the default) |
| `DEPLOY_PATH` | `/opt/barakah-ventures` (omit to use the default) |

If your GitHub Actions environment protection rules require an
`environment` named `production` to exist (referenced in the workflow),
create it under Settings → Environments and attach the secrets there
instead of at the repo level if you want an approval gate on deploys.

## 3. First deploy

Push to `main`, or run the workflow manually from the Actions tab
(`Deploy` → `Run workflow`). Watch the run — the first deploy will take a
minute longer while `acme-companion` requests the Let's Encrypt
certificate.

## 4. Verifying

```bash
ssh root@2.25.167.101
cd /opt/barakah-ventures
docker compose ps
docker compose logs -f acme-companion   # confirm cert issuance succeeded
curl -I https://barakahventures.us
```

## Notes

- `docker-compose.yml` issues certs for `barakahventures.us` and
  `www.barakahventures.us`. Remove the `www` host from `VIRTUAL_HOST` /
  `LETSENCRYPT_HOST` in `docker-compose.yml` if that subdomain isn't
  pointed at this server.
- The Let's Encrypt notification email defaults to
  `contact@barakahventures.us`; override by setting a `LETSENCRYPT_EMAIL`
  environment variable in the compose file's `web`/`acme-companion`
  services if you'd rather use a different address.
- Every deploy runs `docker image prune -f` on the server to avoid
  unbounded disk growth from old image layers.
