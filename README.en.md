# dsh-project-map-governance

`@dsh-external/project-map-governance` — a **project-map + changelog governance** toolkit for the DeepSeek Harness.

It installs a sustainable, scalable governance layer onto vibe / AI-coding projects and exposes the governance commands to agents as **native Harness tools**:

- **Structural anchor**: `AGENTS.md`(`CLAUDE.md`) + `docs/map/{index,root,tree,decisions}` — information-class separation + progressive disclosure
- **Semantic loops**: cross-module relatedness (outgoing + reverse), CHANGELOG, ADRs, semantic fields — all gateable by `off|warn|error` rules
- **Anti-drift**: pre-commit auto-check; size review + documentation-hygiene reconcile
- **Zero dependency**: engine is Node standard library only; tool registry via Cordis / schemastery

## Tools (registered natively)

| Tool | Purpose |
|---|---|
| `project_map_governance_init` | init governance: AGENTS/CLAUDE + docs/map + CHANGELOG + pre-commit |
| `project_map_governance_sync` | refresh map after changes: granular tree + derived root.md + index reconcile |
| `project_map_governance_check` | rule review (structured): dead-links / relatedness / changelog / semantics / … |
| `project_map_governance_adr` | create an ADR-NNNN.md record |
| `project_map_governance_status` | governance status snapshot |
| `project_map_governance_reconcile` | document-hygiene reconcile list |

## Engine & shape

Engine = Node stdlib scripts (zero third-party deps, Node 22+).

```
scripts/
├── lib-parse.mjs   unified parsing layer (single source for formats / config schema)
├── lib-links.mjs   cross-module reference scanner (relative & absolute imports)
├── init / sync / check / adr / status / reconcile / devref
└── mcp-server.mjs  MCP stdio wrapper (for other agents, e.g. Claude Code)
```

The plugin is a thin contract over the engine (tools wrap the scripts; `check` uses `--json` structured output), so the **pre-commit hook, CLI, DSH plugin and MCP all share the same engine**.

## Install & inject

```powershell
git clone https://github.com/Fishsb/dsh-project-map-governance
cd dsh-project-map-governance
$env:DSH_CHECKOUT = "C:\path\to\dsh\source"
bash scripts/build.sh
# within a Harness session: dev_inject_plugin <dir>
# or: dsh plugin --profile web add <dir>
```

> Without a DSH source checkout, you can bundle a prebuilt `lib/` (ignored by `.gitignore` by default); `lib/index.js` mirrors `src/index.ts`.

## Config (project `docs/map/governance.json`)

```jsonc
{
  "configVersion": 3,
  "level": "files",
  "roots": ["src"],
  "links": true,
  "rules": { "dead-links": "error", "relatedness": "warn", "changelog": "off", "semantics": "warn", "doc-hygiene": "warn" }
}
```

Legacy fields (`strict`/`strictLinks`/`changelog`/`strictSemantics`) are auto-migrated to `rules` on first run (`configVersion: 3`).

## MCP (for other agents)

```bash
claude mcp add project-map-governance -- node <repo>/scripts/mcp-server.mjs
```

## Compatibility

- Targets the DeepSeek Harness with dsh-super-injector
- Plugin peer deps: `@deepseek-ai/dsh-tools` / `cordis` / `schemastery` (junction-linked to host)
- Engine: Node stdlib, no install

## Design references

[AGENTS.md guide](https://www.aihero.dev/a-complete-guide-to-agents-md) · [llms.txt](https://llmstxt.org/) · [ADRs](https://adr.github.io/) · [Changelog Enforcer](https://dangoslen.me/blog/enforcing-a-changelog-with-github-actions/) · [document-hygiene](https://github.com/muellah24/document-hygiene)

## License

[BSD-3-Clause](LICENSE)

中文: [README.md](README.md)
