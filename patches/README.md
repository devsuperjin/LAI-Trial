# Core patches

No DSH core patches are required. Account configuration is controlled by `config/cordis.patch.yml`; subagent API differences are handled by `packages/dsh-adapter`.

If a future feature needs a core patch, record the exact upstream commit, one patch per independent change, a regression test, and the condition for removing it. Validate it on an integration branch before release.
