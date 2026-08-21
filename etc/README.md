# etc

- **Purpose**: Deployable source configuration and environment profiles.
- **Owner**: sdkwork-partner
- **Related specs**: `../sdkwork-specs/SDKWORK_WORKSPACE_SPEC.md` and task-matrix rows from `../sdkwork-specs/README.md`
- **Verification**: `pnpm check` / `pnpm verify` (canonical scripts)

<!-- SDKWORK-DEPLOY-LAYOUT: v1 -->
## Installed Runtime Paths

Authority: `APPLICATION_DEPLOY_LAYOUT_SPEC.md` (`../sdkwork-specs/`).

| Item | Value |
| --- | --- |
| `appId` | `sdkwork-partner` |
| `runtimeCode` | `partner` |
| Config root | `/etc/sdkwork/partner/` |
| Runtime TOML | `/etc/sdkwork/partner/config.toml` |
| Secrets | `/etc/sdkwork/partner/secrets/` |
| Override | `SDKWORK_PARTNER_CONFIG_FILE` |

Source profiles live under `etc/` (`sdkwork.deployment.config.json` index). Deploy manifest: `deployments/deploy.yaml`. Web data-plane source: `deployments/webserver/` (`SDKWORK_WEBSERVER_SPEC.md` layout v2).

```bash
node ../sdkwork-specs/tools/check-source-config-standard.mjs --root .
node ../sdkwork-specs/tools/check-application-deploy-layout.mjs --root .
node ../sdkwork-specs/tools/check-webserver-toml-standard.mjs --root deployments/webserver
```
<!-- /SDKWORK-DEPLOY-LAYOUT -->


