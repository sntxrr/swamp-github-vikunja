# @sntxrr/github-vikunja

Convert GitHub issues to Vikunja kanban cards. Bridge your issue tracking between GitHub and personal Vikunja boards.

**Requires**: `@sntxrr/vikunja-kanban` (installed as dependency; provides task creation with advanced features)

## Overview

This swamp extension provides a single method: `import_issue` that:
1. Fetches a GitHub issue via GitHub's REST API
2. Delegates Vikunja task creation to the `@sntxrr/vikunja-kanban` extension's `new_task()` method
3. Returns the result with issue/card metadata

The original GitHub issue is never modified — this is purely a one-way import into Vikunja's kanban board. All Vikunja operations (task creation, validation, error handling) are delegated to the proven vikunja-kanban extension for consistency and reliability.

### Design

- **Read-only on GitHub**: Never modifies issues; only fetches issue metadata
- **Delegated Vikunja interaction**: Uses @sntxrr/vikunja-kanban's `new_task()` for all Vikunja operations
- **Verification**: vikunja-kanban reads the created card back to confirm
- **Advanced features**: Inherits case-insensitive buckets, duplicate detection, labels, readiness validation from vikunja-kanban
- **Flexible targeting**: Specify any GitHub repository and any Vikunja project/bucket

## Model: @sntxrr/github-vikunja

### Global Arguments

- `githubToken` (required, sensitive): GitHub API token with `public_repo` (public) or `repo` (public+private) scope
- `githubApiBaseUrl`: GitHub API URL (default: `https://api.github.com`). Override for GitHub Enterprise
- `timeoutMs`: GitHub API request timeout in milliseconds (default: `30000`)

**Note:** Vikunja credentials are NOT configured here. Instead, they're configured in your `@sntxrr/vikunja-kanban` model instance(s). This extension discovers and delegates to that model.

### Methods

#### import_issue

Fetch a GitHub issue and create a Vikunja card via `@sntxrr/vikunja-kanban.new_task()`.

**Parameters:**
- `owner` (required): GitHub repository owner (user or org)
- `repo` (required): GitHub repository name
- `issueNumber` (required): GitHub issue number (positive integer)
- `bucketName`: Vikunja bucket name (optional; case-insensitive; uses vikunja-kanban's default if omitted)
- `priority`: Vikunja priority 0–4 (optional; 0=none, 1=low, 2=medium, 3=high, 4=urgent)
- `includeCreatedAt`: Include issue creation timestamp in description (default: false)
- `projectId`: Override Vikunja project ID (optional; uses vikunja model's default if omitted)

**Output:** `githubVikunjaImportResult` resource with:
- `issueNumber`: The GitHub issue number
- `issueUrl`: Full GitHub issue URL (with link to web interface)
- `vikunjaTaskId`: ID of the created Vikunja task
- `vikunjaTaskTitle`: Title of the created card
- `bucket`: Bucket name where card was placed
- `message`: Human-readable success message

**Card Details:**
- Title: Issue title (e.g., `Fix login bug`)
- Description: `**GitHub Issue**: [owner/repo#number](url)\n\n<issue-body>` with optional created timestamp
- Priority: Optional, passed through to vikunja-kanban
- Bucket: Placed in specified bucket or vikunja-kanban's default (usually "Backlog")
- Original GitHub issue: Never modified

## Features

✅ **Bidirectional links**: Card description includes clickable link back to GitHub issue  
✅ **Case-insensitive buckets**: Works with any case variation thanks to vikunja-kanban  
✅ **Duplicate detection**: Via vikunja-kanban's skip/refuse/allow modes  
✅ **Label support**: Can attach labels (via vikunja-kanban)  
✅ **Advanced error messages**: Clear guidance on failures  
✅ **Rate-limit safe**: Inherits vikunja-kanban's retry logic  
✅ **Proven path**: Uses vikunja-kanban's battle-tested code  

## Example

In a swamp workflow:

```yaml
steps:
  - name: import-issue
    task:
      type: model_method
      modelIdOrName: github-vikunja-bridge
      methodName: import_issue
      inputs:
        owner: sntxrr
        repo: swamp-triage
        issueNumber: 42
        bucketName: Backlog  # Case-insensitive
        priority: 2          # Medium priority
```

In a swamp model config:

```yaml
models:
  - name: github-vikunja-bridge
    type: @sntxrr/github-vikunja
    spec:
      githubToken: ${{ vault.get('github', 'pat') }}
```

That's it! The extension discovers the vikunja-kanban model and uses it for task creation.

## Troubleshooting

### "vikunja-kanban model not found"
**Cause**: @sntxrr/vikunja-kanban is not installed, or no vikunja model instance is configured  
**Fix**:
```bash
swamp extension pull @sntxrr/vikunja-kanban
swamp model list | grep vikunja  # Should show at least one
```

### "Bucket '<name>' not found"
**Cause**: Bucket doesn't exist in the target Vikunja project  
**Fix**: Check available buckets via vikunja-kanban model; error message lists them

### "GitHub API error 401: Unauthorized"  
**Cause**: Invalid or insufficient GitHub token  
**Fix**: Ensure token has `public_repo` (public) or `repo` (public+private) scope

### "GitHub API error 404: Not Found"
**Cause**: Repo or issue doesn't exist, or token can't access it  
**Fix**: Verify repository is accessible with your token's scope

## License

MIT. See LICENSE.md.

