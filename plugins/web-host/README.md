# @lai/dsh-web-host

Serve the built LAI frontend and DSH APIs on one authenticated origin. The Profile disables the official `web-runtime` row and inserts `lai-web-runtime`; the official Web server, authentication and API services remain mounted. DSH's public `@deepseek-ai/dsh-host-frontend-static` plugin owns static files and browser admission.

`distIndex` identifies the built frontend. `openBrowser` and `publicUrl` come from the ordinary DSH startup options. The plugin advertises its URL through the public `webApp` service and opens the authenticated browser URL after startup settlement. `--no-open` suppresses browser opening; SSH launches print the URL only. Disposal cancels pending readiness announcements.

From the repository root, `pnpm start` builds the application and launches the DSH `lai` Profile. The development-only `pnpm dev:web` server remains optional for frontend editing.

The official installed DSH frontend is also available at `/dsh/`, linked from LAI's header. Both frontends share the same API, browser cookie and Profile. Official assets are served by `sirv` from the pinned frontend distribution; index requests pass DSH's existing browser authentication and receive the same boot injections. The debug entry does not launch another DSH process.
