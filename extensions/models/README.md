# @sntxrr/github-vikunja

Import GitHub issues as Vikunja kanban cards. One model instance bridges a GitHub repository and your Vikunja workspace, fetching issues and creating cards with customizable priority, placement, and timestamps.

| method | writes | what it does |
|--------|--------|------------|
| `import_issue` | one card | Fetch a GitHub issue, create a Vikunja card in the specified bucket with optional priority and timestamp. Links the card back to GitHub. Read-only on GitHub. |

## Why delegate to vikunja-kanban

This extension uses [@sntxrr/vikunja-kanban](https://github.com/sntxrr/swamp-vikunja-kanban) for all Vikunja API operations rather than reimplementing them. Benefits:

- **Case-insensitive bucket matching**: `bucketName: "backlog"` works even if Vikunja bucket is "Backlog"
- **Duplicate detection**: Skip creating duplicate cards (configured per model instance)
- **Label support**: Automatically attach labels from Vikunja configuration
- **Robust error messages**: Clear guidance on what went wrong and available options
- **Rate-limit handling**: Inherits proven retry logic
- **Verified creation**: Reads card back from Vikunja to confirm before returning
- **No secret leaks**: Plugin middleware configuration never read into a resource

This keeps the extension focused on GitHub-specific logic (fetching issues) while delegating proven Vikunja patterns.

## Model: import_issue

Fetch a GitHub issue and create a corresponding Vikunja card via `@sntxrr/vikunja-kanban.new_task()`.

### Parameters

**Global Arguments** (model-level configuration):

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| githubToken | string | yes | GitHub personal access token. Needs `public_repo` (public repositories) or `repo` (private repositories) scope. Never sent to Vikunja. |
| githubApiBaseUrl | string | no | GitHub API base URL. Defaults to `https://api.github.com`. |
| timeoutMs | number | no | HTTP timeout in milliseconds for GitHub API calls. Defaults to 30000. |

**Method Arguments** (per-invocation):

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| owner | string | yes | GitHub repository owner (username or organization). |
| repo | string | yes | GitHub repository name. |
| issueNumber | number | yes | GitHub issue number to fetch. |
| bucketName | string | yes | Vikunja bucket name where the card will be placed. Case-insensitive (matches via `@sntxrr/vikunja-kanban`). |
| priority | number | no | Card priority: 0 (none), 1 (low), 2 (medium), 3 (high), 4 (urgent). Defaults to 0. |
| includeCreatedAt | boolean | no | Prepend issue creation timestamp to card description. Defaults to false. |
| projectId | number | no | Override Vikunja project ID. If not set, uses the vikunja model's default project. |

### Output

Returns an ImportResult:

```
{
  success: boolean,           # true if card created successfully
  taskId: number,             # Vikunja task ID (present if success)
  bucketTitle: string,        # Vikunja bucket name card was placed in
  message: string             # Status or error message
}
```

### Behaviors

**What happens:**

1. Fetches the GitHub issue using the provided owner, repo, and issue number
2. Constructs a card title from the issue title
3. Constructs a card description from issue body, including a link back to GitHub (`[View on GitHub](https://github.com/{owner}/{repo}/issues/{issueNumber})`)
4. Calls `@sntxrr/vikunja-kanban.new_task()` to create the card in Vikunja with the specified bucket, priority, labels, and optional timestamp
5. Returns the created task ID and bucket title

**Read-only on GitHub:** The original GitHub issue is never modified. Only the GitHub API read operations occur.

**Bucket matching:** Bucket names are matched case-insensitively by `@sntxrr/vikunja-kanban`. `bucketName: "backlog"` will match a Vikunja bucket named "Backlog", "BACKLOG", or "backLog".

**Card deduplication:** Controlled by the vikunja model's `duplicateMode` setting:
- `skip` — If a card with the same title exists, skip creating a duplicate
- `refuse` — If a duplicate would be created, throw an error
- `allow` — Always create a new card (default)

**Timestamp preservation:** If `includeCreatedAt: true`, the card description will include the issue's creation timestamp in ISO 8601 format.

**Error handling:** Errors include the full context:
- GitHub errors: API status code, message, and the specific field that failed (owner, repo, issueNumber, etc.)
- Vikunja errors: Bucket not found (lists available buckets), project not found, authentication failed, etc.
- Rate limits: Inherited from vikunja-kanban; brief backoff and retry with clear messaging

## Unknown is never "current"

- If the GitHub issue cannot be fetched (404, 403, timeout), the operation fails with the full error from GitHub API.
- If the Vikunja bucket does not exist, an error lists available buckets in the project.
- If the vikunja-kanban model cannot be discovered, a clear error message is returned: "vikunja-kanban model not found — install @sntxrr/vikunja-kanban first".
- Timestamps are only included if the GitHub issue includes a creation timestamp and `includeCreatedAt: true`.

## Example

```yaml
type: "@sntxrr/github-vikunja/import_issue"
name: github-to-vikunja-bridge
globalArguments:
  githubToken: "${{ env.GH_TOKEN }}"
  githubApiBaseUrl: https://api.github.com
  timeoutMs: 30000
```

Running:

```bash
swamp model @github-to-vikunja-bridge method run import_issue \
  --input owner=sntxrr \
  --input repo=swamp-triage \
  --input issueNumber=10 \
  --input bucketName=Backlog \
  --input priority=2 \
  --input includeCreatedAt=true
```

Returns:

```json
{
  "success": true,
  "taskId": 603,
  "bucketTitle": "Backlog",
  "message": "Card created: swamp-triage#10 → Vikunja task 603"
}
```

## Using it from a workflow

```yaml
id: triage-github-issue
name: Triage GitHub Issue to Vikunja
jobs:
  - name: import
    steps:
      - task:
          type: model_method
          modelIdOrName: github-to-vikunja-bridge
          methodName: import_issue
          inputs:
            owner: sntxrr
            repo: swamp-triage
            issueNumber: "${{ env.ISSUE_NUMBER }}"
            bucketName: Backlog
            priority: 2
```

## Troubleshooting

### "vikunja-kanban model not found"

**Cause:** `@sntxrr/vikunja-kanban` is not installed, or no model instance of that type has been created.

**Fix:**
```bash
swamp extension pull @sntxrr/vikunja-kanban
swamp model create @sntxrr/vikunja-kanban vikunja-homelab
# Then ensure your github-vikunja model instance targets the correct vikunja model name
```

### "Bucket 'backlog' not found in project X. Available buckets: ..."

**Cause:** The specified bucket doesn't exist in the Vikunja project.

**Fix:**
- Use one of the listed available bucket names
- Note: bucket matching is case-insensitive, so "Backlog" matches "backlog", "BACKLOG", etc.
- Verify the project ID in your vikunja model configuration

### "GitHub API error 401: Unauthorized"

**Cause:** GitHub token is invalid, expired, or has insufficient permissions.

**Fix:**
- Verify the token has `public_repo` scope (for public repos) or `repo` scope (for private repos)
- Check the token hasn't expired
- Ensure you passed a token (not an empty string)

### "GitHub API error 404: Not Found"

**Cause:** Repository or issue doesn't exist, or the token can't access it.

**Fix:**
- Verify the repository is accessible with your token's permissions
- Verify the issue number is correct
- Check that owner and repo names are spelled correctly (GitHub is case-sensitive for URLs)

### "GitHub API error 403: Forbidden"

**Cause:** Token exists but doesn't have sufficient permissions for this repository.

**Fix:**
- Check that the token has the correct scope
- Verify the repository isn't archived
- If using a fine-grained token, ensure it has contents read access to the target repository

### Workflow never creates cards

**Cause:** Usually a missing or incorrectly named vikunja model instance.

**Fix:**
- Ensure @sntxrr/vikunja-kanban is installed: `swamp extension list | grep vikunja-kanban`
- Ensure a vikunja model instance exists: `swamp model list | grep vikunja`
- Check the extension code (or logs) to see which vikunja model name it's trying to discover
- If using a different vikunja model name, you may need to file an issue to allow customization

## Development

```bash
~/.swamp/deno/deno check extensions/models/github_vikunja.ts
~/.swamp/deno/deno lint extensions/models/
~/.swamp/deno/deno test extensions/models/
```

### Architecture

The extension:
1. Exports a TypeScript model with Zod-validated parameters and outputs
2. Implements `import_issue()` as the sole public method
3. Uses `fetchGitHubIssue()` to read GitHub issues with comprehensive error handling
4. Discovers the vikunja-kanban model via `swamp.model("vikunja-homelab")` at runtime
5. Delegates task creation to `vikunja-kanban.new_task()` to avoid duplication

See `github_vikunja.ts` for implementation details.

### Testing

Run smoke tests:
```bash
~/.swamp/deno/deno test extensions/models/github_vikunja_test.ts
```

Tests verify:
- Model exports correct spec (globalArgs, parameters, methods)
- Error handling for missing parameters
- Proper integration with vikunja-kanban delegation pattern

### Building

```bash
swamp extension fmt extensions/models/manifest.yaml
swamp extension quality extensions/models/manifest.yaml
```

## License

MIT. See LICENSE.md.
