# @lai/feishu-tools

Imported from [LJH-snow/dsh-tool-feishu](https://github.com/LJH-snow/dsh-tool-feishu), revision `511078c2e032a20c7ca6719995ea11dccd8c32e3` (upstream package 0.2.0). The original MIT license and copyright are retained in LICENSE; upstream documentation is in UPSTREAM.md.

Local changes are limited to the `@lai` package identity, pinned DSH 0.2.2-rc.1 peers, runtime settings schema and standard DSH tool registration. The Feishu client and individual tools remain the imported implementation.

The application Profile loads this Bundle. Open **Plugin → LAI Agents → specialist card → Tools**, find **Registered DSH tools**, and select the desired tools. Installation lists the capabilities but does not select them for any role. Choices apply to new specialist Runs and remain subject to the Superagent Ticket guard.

The plugin includes `feishu_send_message`, chat/message reads, users, departments, calendars and approval tools. Each operation requires the corresponding app permissions. No credentials are supplied by the repository; without credentials the tools report that Feishu is not configured, without making a network request.

Open **Plugin → Feishu tools** to configure App ID and App Secret (or tenant token). Blank secret inputs preserve existing credentials. Native DSH generic plugin settings remain available as well. Secret fields use DSH's secret role so ordinary settings reads redact them. Keep credentials out of committed Profile configuration. This is an outbound capability plugin and does not replace Superagent's Feishu input Source or start another message listener.

## UI and maintenance

The page is `/#/plugins/feishu-tools`, implemented in `app/lai-web/src/pages/FeishuToolsPage.tsx` under the shared route/menu and layout system. This plugin's own app/token configuration is distinct from `@lai/credentials` entries, and is not automatically populated from them.

Every component update, including documentation, bumps this package's version. New plugins start on a dedicated branch and reach main through PR merge; see [AGENTS.md](../../AGENTS.md).
