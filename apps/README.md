# apps

Application surfaces in `sdkwork-partner`.

- `sdkwork-partner-pc/` — PC React application root; hosts the partner admin domain packages (`packages/sdkwork-partner-pc-admin-*`) and a standalone demo shell.
- `sdkwork-partner-common/packages/` — shared TypeScript contracts (`sdkwork-partner-contracts`).

Consuming hosts (e.g. `sdkwork-cloudrouter`) import these packages through the consuming repository's `pnpm-workspace.yaml`; this workspace never ships them as `file:`/`link:` dependencies.
