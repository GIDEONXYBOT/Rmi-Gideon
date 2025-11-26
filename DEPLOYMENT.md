# Deployment Guide — Make this app online

This repository contains a fullstack app (frontend + backend + MongoDB). Below are recommended ways to make the project available on the public internet and a quick start for Docker deployments.

## Recommended approaches

1) Quick: Deploy both services with Docker on a public VM (DigitalOcean, AWS EC2, Hetzner)
   - Pros: simple, full control
   - Cons: responsibility for security, TLS, scaling

2) Managed services:
   - Frontend static on Vercel / Netlify (fast, automatic TLS), backend on Render / Railway / Fly.io
   - Use MongoDB Atlas for managed DB service
   - Pros: Reduced ops, auto TLS, easy scaling
   - Cons: May cost money after free tiers

3) PaaS (Render / Railway / Fly.io) — deploy backend and static frontend in one place, use managed MongoDB or add the DB as a service.

---

## Quick local -> public test using Docker Compose + optional tunnel

This is a good path to make your app reachable immediately for QA/demo.

1) Build and start locally

```powershell
# from repo root
docker compose up --build -d
```

- Frontend will be served on port 80 of the host.
- Backend will be available on port 5000.
- Mongo runs locally on port 27017.

2) Expose to the internet securely for a demo

- Option A: Use ngrok for a quick (temporary) public URL:
  - Install and run `ngrok http 80` to expose the frontend
  - You can also expose backend: `ngrok http 5000`

- Option B: Configure domains and a reverse proxy (Nginx) + TLS via Certbot (Let's Encrypt)
  - Create DNS records pointing your domain to the VM IP
  - Use Nginx as a reverse proxy: proxy / (frontend) and /api (backend) to the container ports
  - Use Certbot to get and install TLS certs

## Persistent production setup (recommended)

1) Create a VM or use a managed hosting provider
2) Use Docker + docker-compose or Kubernetes
3) Use MongoDB Atlas for highly available production DB
4) Configure environment variables (MONGO_URI, JWT secret, email settings)
5) Create systemd units or use a process manager for docker-compose
6) Configure reverse proxy (nginx/caddy) and TLS

---

## Option A — Cloudflare Pages (frontend) + Cloudflare Tunnel (backend)

This setup is a great combination for fast/static frontend hosting and a secure backend without exposing your VM's public IP. Cloudflare provides automatic TLS for Pages and an encrypted tunnel (cloudflared) to your local backend.

High-level flow
- Cloudflare Pages -> hosts your frontend (fast static hosting + CDN)
- Cloudflare Tunnel (cloudflared) -> runs on your server and creates a secure, outbound-only connection from your backend to Cloudflare; Cloudflare will route api.gideonbot.xyz to your local app running on port 5000.

Detailed steps
1) Cloudflare Pages (frontend)
  - In Cloudflare Pages, create a new site and connect your GitHub repo.
  - Build command: cd frontend && npm ci && npm run build
  - Build output directory: frontend/dist
  - Add an Environment Variable (Pages env): VITE_API_URL=https://api.gideonbot.xyz

2) Cloudflare Tunnel (backend)
  - On the machine where your backend runs (VM/Dev PC), install cloudflared:
    - https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation
  - Login once: `cloudflared tunnel login` (opens browser to authorise your account)
  - Create a tunnel name: `cloudflared tunnel create rmi-backend` (this returns a TUNNEL_ID and saves credentials JSON)
  - Route DNS record for your tunnel (example):
    `cloudflared tunnel route dns rmi-backend api.gideonbot.xyz`
  - Place cloudflared config into `/etc/cloudflared/config.yml` (an example is provided at `infra/cloudflared/config.example.yml`). It should map hostname `api.gideonbot.xyz` to `http://localhost:5000`.
  - Create a systemd service (example at `infra/cloudflared/cloudflared.service.example`) or run `cloudflared tunnel run rmi-backend` for temporary runs.

3) Configure frontend environment
  - In Cloudflare Pages, ensure `VITE_API_URL` points to https://api.gideonbot.xyz
  - If you use GitHub Actions to build and deploy, use the provided `.github/workflows/deploy-pages.yml` sample above and add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to repository secrets.

4) Backend
  - Ensure the backend is running locally on port 5000 (or change config.yml to target the correct port). The tunnel will forward Cloudflare traffic to your app.
  - Set production environment variables (MONGO_URI -> Atlas or local Mongo) and any JWT secrets.

Notes & tips
- Cloudflare Tunnel keeps an outbound connection; your machine doesn't need a public IP.
- For production-grade reliability, run the tunnel in systemd with a restart policy and monitor it.
- If you also have static assets or uploads, consider using a separate bucket or CDN and route them through Cloudflare as needed.

## Important note about large static assets (GLB/3D models, large media)

Cloudflare Pages has a 25 MiB limit for files in the final build directory. If you have large assets (GLB models, large images), they must NOT be included in the Pages build output. You have two safe options:

1) Host large files in Cloudflare R2 (recommended) or other CDN/S3:
   - Upload the file to R2 and make it publicly readable or behind signed URLs.
   - Set an environment variable in Cloudflare Pages: VITE_DEFAULT_GLB_URL=https://your-r2-bucket.workers.dev/path/default-model.glb
   - In the frontend we added support to prefer VITE_DEFAULT_GLB_URL (Admin Map Editor will load a remote file when provided).
   - Remove the large file from the repo (e.g. `frontend/public/default-model.glb`) and commit the change so Pages build succeeds.

2) Reduce file size / host elsewhere:
   - Replace with an optimized smaller GLB file (<25MB), or host the large model on a storage CDN and reference it via a URL as above.

Example (upload to Cloudflare R2 using Wrangler):
  - Create bucket and configure access following Cloudflare R2 docs.
  - Upload:
    ```bash
    # using wrangler CLI
    wrangler r2 bucket put --binding=MY_BUCKET default-model.glb default-model.glb
    ```
  - Make the file available at a stable URL (via Pages, Worker, or public settings) and set `VITE_DEFAULT_GLB_URL` in Pages.

Removing the file from the repo
  - After uploading to R2, remove the local copy to avoid Pages build errors:
    ```bash
    git rm frontend/public/default-model.glb
    git commit -m "Move default GLB to R2; remove heavy asset from repo"
    git push origin main
    ```

If you want, I can:
- Upload the GLB to Cloudflare R2 for you (you will need to provide R2 credentials / the R2 bucket name or allow me to provide a script to run locally).
- Remove the file from the repo and set `VITE_DEFAULT_GLB_URL` in Cloudflare Pages settings.

If you'd like I can prepare: the cloudflared config file populated with the actual TUNNEL_ID, a systemd unit for the tunnel, and a small GitHub Actions setup to deploy the frontend automatically to Pages.

---

## Environment variables you should provide

- BACKEND (server):
  - PORT (default 5000)
  - MONGO_URI (point to Atlas or local mongo)
  - JWT secrets / other secrets used by the app

- FRONTEND:
  - VITE_API_URL (e.g. https://api.yourdomain.com) — ensures the frontend talks to the public backend URL

---

If you want, I can:
- Add an Nginx reverse-proxy example with TLS using Certbot
- Deploy this project to a test server (I can add Docker Compose config and sample env files for you to run)
- Prepare Render/Vercel configuration files / CI to auto-deploy from this repo

Tell me which platform you prefer (DigitalOcean / Render / Vercel / Railway / Fly/Other) and I’ll scaffold the required deploy files and step-by-step commands.