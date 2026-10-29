# swamp-github-vikunja

A [swamp](https://github.com/systeminit/swamp) extension that imports GitHub issues as Vikunja kanban cards, bridging your personal issue tracking across GitHub and Vikunja.

Delegates all Vikunja operations to [@sntxrr/vikunja-kanban](https://github.com/sntxrr/swamp-vikunja-kanban), ensuring case-insensitive buckets, duplicate detection, label support, and robust error handling — eliminating code duplication and inheriting proven reliability.

**The full documentation is [`extensions/models/README.md`](extensions/models/README.md)**, which is also what ships with the extension.

## Install

```bash
swamp extension pull @sntxrr/github-vikunja
```

## Development

```bash
~/.swamp/deno/deno check extensions/models/github_vikunja.ts
~/.swamp/deno/deno lint extensions/models/
~/.swamp/deno/deno test extensions/models/
```
