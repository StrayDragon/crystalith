# Crystalith v2 — Overmind process file
#
# Usage:
#   overmind start -N -c slidev   # or: just dev / bun run dev
#   overmind connect server       # attach to one process (tmux)
#   overmind quit
#
# Ports are owned by each app:
#   server  CL_SERVER_PORT (default 8032)
#   web     Rsbuild :3000
#   slidev  CL_SLIDEV_PORT (default 3030)
# Always start with -N (--no-port) so Overmind does not inject $PORT.
# `-c slidev` lets the optional preview die without killing server/web.
#
# Requires: overmind + tmux on PATH.

server: bun --watch apps/server/src/server.ts
web: cd apps/web && bun run dev
slidev: cd packages/crystalith-slidev && bun run dev
