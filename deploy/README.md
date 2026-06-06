# VM deployment (Caddy + docker-compose)

Hosts Spellnook on `https://spellnook.ankur.theworkpc.com` (default port 443) with
automatic Let's Encrypt TLS via Caddy. Self-contained — does not use k3s/Cilium.

## Prereqs on the VM
- Docker + docker compose (present).
- Ports 80 + 443 free and reachable (we stop k3s to free them; OCI already allows them).
- DNS `spellnook.ankur.theworkpc.com` → VM IP (already wildcarded).

## First-time setup
```bash
# 1) Free 80/443 from k3s (reversible — see "k3s" below)
sudo systemctl disable --now k3s
sudo /usr/local/bin/k3s-killall.sh    # clears k3s eBPF/iptables/netns
sudo systemctl restart docker          # reassert docker's iptables

# 2) Configure + launch (from the deploy/ dir)
cp .env.vm.example .env && $EDITOR .env   # set POSTGRES_PASSWORD, SPELLNOOK_JWT_SECRET, (optional) GOOGLE_CLIENT_ID
docker compose -f docker-compose.vm.yml --env-file .env up -d --build

# 3) Full guess dictionary (optional; otherwise only the 5-letter curated list)
docker compose -f docker-compose.vm.yml exec backend python scripts/fetch_words.py
docker compose -f docker-compose.vm.yml restart backend
```
Caddy fetches the TLS cert automatically on first request (needs 80/443 public).

## Updating (promotion)
```bash
git pull           # or re-sync the code
docker compose -f docker-compose.vm.yml --env-file .env up -d --build
```

## k3s (reversible)
We only **stop+disable** k3s; its data remains. To bring it back:
`sudo systemctl enable --now k3s`. To remove it permanently later:
`sudo /usr/local/bin/k3s-uninstall.sh`.

> Stopping k3s takes its workloads offline too (argocd./kargo./devops. subdomains).

## VM-specific notes (Oracle Cloud + this host)
- **Compose CLI:** this host has the standalone **`docker-compose` (v2)** at
  `/usr/local/bin`, but no `docker compose` plugin — use `docker-compose`.
  Docker needs root here (the `ubuntu` user was added to the `docker` group; takes
  effect next login, until then use `sudo`).
- **Cilium leftovers required a reboot.** k3s used Cilium; `k3s-killall.sh` does NOT
  remove Cilium's eBPF programs / virtual interfaces / runtime iptables, which then
  **blackholed ports 80/443** (LE ACME timed out). Fix: after disabling k3s, **reboot**
  — Cilium's datapath isn't persisted, so it comes back clean (verified: `ip link` shows
  no `cilium_*`, `iptables-save | grep -c cilium` = 0). Our containers are
  `restart: unless-stopped`, so the stack auto-starts on boot.
- **Firewall:** OCI security list already allows 80/443; host iptables default-rejects
  new inbound except 22, but published container ports go via DNAT→FORWARD (ACCEPT), so
  no host iptables change was needed once Cilium was gone.
- **TLS:** Caddy obtained a real production Let's Encrypt cert automatically once 80/443
  were reachable. No cert-manager involved.
