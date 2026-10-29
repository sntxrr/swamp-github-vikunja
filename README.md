# swamp-github-vikunja

A swamp extension to convert GitHub issues into Vikunja kanban cards. Bridge your issue tracking between GitHub and personal Vikunja boards.

**GitHub**: https://github.com/sntxrr/swamp-github-vikunja  
**Registry**: https://swamp-club.com/extensions?name=github-vikunja

## Requirements

**`@sntxrr/vikunja-kanban`** (required)  
This extension delegates Vikunja task creation to the proven `@sntxrr/vikunja-kanban` extension, ensuring consistent error handling, validation, and advanced features (case-insensitive buckets, duplicate detection, label support, etc.).

```bash
swamp extension pull @sntxrr/vikunja-kanban
```

## Quick Start

### Install

```bash
cd ~/git/swamp-homelab  # or your swamp repo
swamp extension pull @sntxrr/vikunja-kanban  # Required dependency
swamp extension pull @sntxrr/github-vikunja
```

### Create a Model

```bash
# First, ensure you have a vikunja model instance configured
# (e.g., vikunja-homelab), created from @sntxrr/vikunja-kanban
swamp model list | grep vikunja  # Should show at least one vikunja model

# Create the GitHub-Vikunja bridge model
swamp model create @sntxrr/github-vikunja my-github-vikunja
```

### Configure Secrets

Store your GitHub token in a vault (Vikunja token goes into the vikunja model):

```bash
swamp vault create @sntxrr/1password-connect my-vault --config '...'
# Then create/update vault item with your GitHub token
```

### Use in a Workflow

```yaml
id: my-workflow
name: github-to-vikunja
jobs:
  - name: import
    steps:
      - name: fetch-and-create
        task:
          type: model_method
          modelIdOrName: my-github-vikunja
          methodName: import_issue
          inputs:
            owner: sntxrr
            repo: swamp-triage
            issueNumber: 10
            bucketName: Backlog  # Optional: defaults to vikunja model's defaultBucketName
```

## Model: @sntxrr/github-vikunja

Provides one method:

### `import_issue`

Fetch a GitHub issue and create a Vikunja card via the `@sntxrr/vikunja-kanban` extension.

**Parameters:**
- `owner`: GitHub repository owner
- `repo`: GitHub repository name
- `issueNumber`: GitHub issue number
- `bucketName`: Vikunja bucket name (optional; case-insensitive, defaults to vikunja model's `defaultBucketName`)
- `priority`: Card priority 0–4 (optional; 0=none, 1=low, 2=medium, 3=high, 4=urgent)
- `includeCreatedAt`: Include issue timestamp in description (default: false)
- `projectId`: Override Vikunja project ID (optional; defaults to vikunja model's configuration)

**Output:** `githubVikunjaImportResult` with issue/card metadata and success message

**Error Handling:** Errors from GitHub or Vikunja APIs include the full error message for debugging. Example: `"Bucket 'backlog' not found in project 1. Available buckets: Backlog, Ready, Doing, Done"`

## Features

- ✅ **Bidirectional link**: Card description includes link back to GitHub issue
- ✅ **Read-only on GitHub**: Never modifies the original issue
- ✅ **Verified creation**: Reads card back from Vikunja to confirm
- ✅ **Flexible targeting**: Supports any GitHub repo and Vikunja project/bucket
- ✅ **Timestamp preservation**: Can include original issue creation time
- ✅ **Case-insensitive buckets**: Works with any case variation (bucket "Backlog" matches "backlog", "BACKLOG", etc.)
- ✅ **Duplicate detection**: Via vikunja-kanban; can skip existing cards with same title
- ✅ **Advanced error messages**: Clear guidance on what went wrong and how to fix it
- ✅ **Rate-limit safe**: Inherits vikunja-kanban's retry logic

## Troubleshooting

### "vikunja-kanban model not found"
**Cause**: @sntxrr/vikunja-kanban is not installed or no vikunja model instance is configured  
**Fix**:
```bash
swamp extension pull @sntxrr/vikunja-kanban
swamp model list | grep vikunja  # Verify at least one vikunja model exists
```

### "Bucket not found in project"
**Cause**: Bucket name doesn't exist in the target Vikunja project  
**Fix**: Check available buckets with:
```bash
swamp model get <your-vikunja-model-name> --json | jq '.buckets'
```

### "GitHub API error 401: Unauthorized"
**Cause**: GitHub token is invalid or has insufficient permissions  
**Fix**: Ensure your GitHub token has `public_repo` (public repos) or `repo` (private repos) scope

### "GitHub API error 404: Not Found"
**Cause**: Repository or issue doesn't exist, or token can't access it  
**Fix**: Verify repo is public/accessible with your token scope, and issue number is correct

## Development

This extension is authored in TypeScript and uses Deno/swamp's bundler.

### Structure

```
extensions/models/
  ├── github_vikunja.ts        # Main model implementation
  ├── github_vikunja_test.ts    # Smoke tests
  └── manifest.yaml             # Extension metadata
README.md                         # This file
LICENSE.md                        # MIT license
```

### Testing

```bash
deno test extensions/models/github_vikunja_test.ts
```

### Building

```bash
swamp extension build
```

## License

MIT. See LICENSE.md.
