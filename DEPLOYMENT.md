# Deployment

`2.25.167.101` is a **shared** box hosting several other sites
(`aibrigade.ai`, `ivyleaguesolutions.com`, `pilotcourier.com`), each running
as a Docker container fronted by the **system nginx** (+ certbot for TLS).
This site follows the exact same pattern: a Docker container listening on
an internal port only, reverse-proxied by the existing system nginx.

**Do not** run anything that binds host ports 80/443 for this project
(no `nginx-proxy`, no `traefik`, etc.) — the system nginx already owns
those ports for every site on the box, and taking them over breaks
everyone else.

GitHub Actions (`.github/workflows/deploy.yml`) rsyncs the repo to the
server and runs `docker compose up -d --build` on every push to `main`.
That only touches the `barakah-site` container — it never touches nginx.

## 1. One-time server setup (run once, manually, on 2.25.167.101)

```bash
mkdir -p /opt/barakah-ventures
```

Add a dedicated deploy keypair if you haven't already (see §2 below for
where the private half goes):

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/deploy_key -C "github-actions-deploy"
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key   # copy this whole output into the SSH_PRIVATE_KEY secret
```

Then, after the first `docker compose up -d --build` has run at least once
(so something is actually listening on `127.0.0.1:3003`), add the nginx
vhost — same shape as the other sites on this box:

```bash
cat > /etc/nginx/sites-available/barakahventures.us <<'EOF'
server {
    listen 80;
    server_name barakahventures.us;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
ln -s /etc/nginx/sites-available/barakahventures.us /etc/nginx/sites-enabled/barakahventures.us
nginx -t && systemctl reload nginx
```

Then let certbot obtain the cert and rewrite this vhost with the HTTPS
block + redirect, exactly like it already did for the other domains:

```bash
certbot --nginx -d barakahventures.us
```

(`www.barakahventures.us` has no DNS record yet — add `-d www.barakahventures.us`
to the command above once one exists, or re-run
`certbot --nginx -d barakahventures.us -d www.barakahventures.us --expand` later.)

## 2. GitHub repository secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `SSH_PRIVATE_KEY` | Output of `cat ~/.ssh/deploy_key` above |
| `SSH_HOST` | `2.25.167.101` |
| `SSH_USER` | `root` (or your deploy user) |
| `SSH_PORT` | `22` (omit to use the default) |
| `DEPLOY_PATH` | `/opt/barakah-ventures` (omit to use the default) |

## 3. Deploying

Push to `main`, or run the workflow manually from the Actions tab
(`Deploy` → `Run workflow`). This only rebuilds/restarts the `barakah-site`
container on port `3003` — nginx and every other site on the box are
untouched.

## 4. Verifying

```bash
ssh root@2.25.167.101
cd /opt/barakah-ventures
docker compose ps
curl -I http://127.0.0.1:3003        # container itself
curl -I https://barakahventures.us   # through nginx + TLS
```

## Notes

- Never run `systemctl stop nginx` on this box for this project — it's
  the shared front door for every site, not just this one. If it's ever
  down, every site on the server is down.
- Every deploy runs `docker image prune -f` on the server to avoid
  unbounded disk growth from old image layers.
- Certbot auto-renewal (`certbot renew`, typically a systemd timer/cron
  already running on this box for the other domains) will pick up
  `barakahventures.us` automatically once it's added — no extra setup
  needed.
