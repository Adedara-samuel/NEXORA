# Sapok OneGrid — Nginx / Reverse Proxy Configuration

`onegrid.conf` is a real, syntax-validated (via `docker run nginx:alpine nginx -t`)
reverse-proxy config — but it's for an **alternative deployment path**, not
the one this project actually uses.

This project's real deployment is Control Center on Vercel and Core API on
Render (see the root `README.md`'s "Deployment" section) — both terminate
TLS and route traffic themselves, so nginx has nothing to do there.

`onegrid.conf` is for someone choosing to self-host everything on a single
VPS instead: it terminates TLS (via certbot-issued Let's Encrypt
certificates), routes `/api/*` to Core API and everything else to Control
Center, adds the security headers `helmet()` can't add to Control Center's
own responses, and rate-limits at the edge as a network-level backstop in
front of the API's own per-route throttling.

See the comments at the top of `onegrid.conf` for the install steps.
