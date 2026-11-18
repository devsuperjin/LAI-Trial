# @lai/lai-web

Independent React frontend for MQ run lists, dashboards, delegation graphs and model settings. Start from the repository root with `pnpm dev:web` after building workspace packages. `LAI_WEB_TARGET` selects the authenticated DSH development proxy target (default `http://127.0.0.1:3080`). The frontend listens on port 5174.

The public DSH wire protocol lives in `@lai/dsh-adapter/gateway`; components do not import framework internals. The four model modules under `src/model` reconstruct modules absent from the old source branch. Production hosting must provide the same authenticated same-origin proxy; Vite development hosting is not a production deployment.
