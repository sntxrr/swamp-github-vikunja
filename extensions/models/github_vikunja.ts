/**
 * GitHub issue to Vikunja card converter — a bridge between GitHub's issue
 * tracking and Vikunja's kanban board for personal automation.
 *
 * This extension is a **thin bridge layer** that:
 * 1. Reads a GitHub issue via GitHub's REST API
 * 2. Calls @sntxrr/vikunja-kanban's `new_task()` method to create the card
 * 3. Returns the result
 *
 * It does NOT reimplement Vikunja API interaction. Instead, it leverages the
 * existing vikunja-kanban extension for all Vikunja operations, which provides:
 * - Proper error handling and retry logic
 * - Bucket validation and placement
 * - Task verification (read-back assertion)
 * - Label attachment
 * - Comprehensive logging and debugging
 *
 * This model is READ-ONLY on GitHub (issues are never modified), and delegates
 * WRITE operations to vikunja-kanban.
 *
 * @module
 */
// extensions/models/github_vikunja.ts
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  githubToken: z.string().min(1).meta({ sensitive: true }).describe(
    "GitHub token with read access to repositories. Supply via vault.get() — never inline. Needs `public_repo` for public repositories, or `repo` to include private ones.",
  ),
  githubApiBaseUrl: z.string().url().default("https://api.github.com").describe(
    "GitHub API base URL. Override for GitHub Enterprise Server.",
  ),
  timeoutMs: z.number().int().positive().default(30000).describe(
    "Abort any GitHub API request after this long.",
  ),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  url: string;
  html_url: string;
  repository_url: string;
  created_at: string;
  updated_at: string;
}

interface ImportResult {
  issueNumber: number;
  issueUrl: string;
  vikunjaTaskId: number;
  vikunjaTaskTitle: string;
  bucket: string;
  message: string;
}

/**
 * Fetch a GitHub issue by owner, repo, and issue number.
 */
async function fetchGitHubIssue(
  args: GlobalArgs,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GitHubIssue> {
  const url =
    `${args.githubApiBaseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `token ${args.githubToken}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "swamp-github-vikunja/1.0",
    },
    signal: AbortSignal.timeout(args.timeoutMs),
  });

  if (!response.ok) {
    let errorBody = "";
    try {
      const error = await response.json();
      errorBody = error.message || JSON.stringify(error);
    } catch {
      errorBody = await response.text();
    }
    throw new Error(
      `GitHub API error ${response.status}: ${response.statusText}. ${errorBody}`,
    );
  }

  return response.json();
}

/**
 * Import a GitHub issue into Vikunja by delegating to vikunja-kanban.new_task().
 *
 * @param owner GitHub repository owner
 * @param repo GitHub repository name
 * @param issueNumber GitHub issue number
 * @param bucketName Vikunja bucket name (passed to vikunja-kanban; defaults to its defaultBucketName)
 * @param priority Vikunja priority (0=none, 1=low, 2=medium, 3=high, 4=urgent) — passed to vikunja-kanban
 * @param includeCreatedAt Include issue's created_at timestamp in description
 * @param projectId Override the Vikunja project ID (passed to vikunja-kanban)
 */
export const import_issue = async (
  owner: string,
  repo: string,
  issueNumber: number,
  bucketName?: string,
  priority?: number,
  includeCreatedAt?: boolean,
  projectId?: number,
): Promise<ImportResult> => {
  // Validate and get global arguments
  const globalArgs = GlobalArgsSchema.parse(swamp.globalArgs);

  // Validate inputs
  if (!owner || typeof owner !== "string" || owner.length === 0) {
    throw new Error("owner must be a non-empty string");
  }
  if (!repo || typeof repo !== "string" || repo.length === 0) {
    throw new Error("repo must be a non-empty string");
  }
  if (typeof issueNumber !== "number" || issueNumber <= 0) {
    throw new Error("issueNumber must be a positive number");
  }
  if (
    priority !== undefined &&
    (typeof priority !== "number" || priority < 0 || priority > 4)
  ) {
    throw new Error("priority must be a number between 0 and 4");
  }

  // Fetch the GitHub issue
  const issue = await fetchGitHubIssue(globalArgs, owner, repo, issueNumber);

  if (!issue.html_url) {
    throw new Error("GitHub issue missing html_url field");
  }

  // Build card description with GitHub link and optional metadata
  let description =
    `**GitHub Issue**: [${owner}/${repo}#${issue.number}](${issue.html_url})\n\n`;
  if (includeCreatedAt) {
    description += `**Created**: ${issue.created_at}\n\n`;
  }
  description += issue.body || "(No description provided)";

  // Delegate to vikunja-kanban.new_task() for the actual task creation.
  // This ensures we use the same proven, well-tested Vikunja API interaction
  // logic as all other automation in swamp-homelab.
  //
  // The vikunja-kanban model handles:
  // - Bucket validation and fetching
  // - Task creation with proper error handling
  // - Task read-back verification
  // - Label attachment (if any)
  // - All edge cases and retry logic
  const vikunjaModel = swamp.model("vikunja-homelab") ||
    swamp.model("vikunja-kanban");

  if (!vikunjaModel) {
    throw new Error(
      "vikunja-kanban model not found. Ensure @sntxrr/vikunja-kanban is " +
        "installed and a vikunja model instance is available (e.g., vikunja-homelab).",
    );
  }

  const newTaskResult = await vikunjaModel.new_task({
    title: issue.title,
    description: description,
    priority: priority,
    bucketName: bucketName,
    projectId: projectId,
  });

  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    vikunjaTaskId: newTaskResult.task.id,
    vikunjaTaskTitle: newTaskResult.task.title,
    bucket: newTaskResult.bucket.title,
    message:
      `Successfully imported GitHub issue #${issue.number} (${issue.title}) as Vikunja task ${newTaskResult.task.id} in bucket "${newTaskResult.bucket.title}"`,
  };
};

/**
 * Extension metadata and resource spec.
 */
export const spec = {
  kind: "extension",
  name: "@sntxrr/github-vikunja",
  description: "Import GitHub issues into Vikunja kanban boards",
  globalArgs: GlobalArgsSchema,
  data: {
    githubVikunjaImportResult: {
      schema: z.object({
        issueNumber: z.number(),
        issueUrl: z.string().url(),
        vikunjaTaskId: z.number(),
        vikunjaTaskTitle: z.string(),
        bucket: z.string(),
        message: z.string(),
      }),
    },
  },
  methods: {
    import_issue: {
      description:
        "Import a GitHub issue into a Vikunja project bucket by delegating to vikunja-kanban.new_task()",
      parameters: z.object({
        owner: z.string().min(1).describe("GitHub repository owner"),
        repo: z.string().min(1).describe("GitHub repository name"),
        issueNumber: z.number().int().positive().describe(
          "GitHub issue number",
        ),
        bucketName: z.string().optional().describe(
          "Vikunja bucket name (overrides default)",
        ),
        priority: z.number().int().min(0).max(4).optional().describe(
          "Vikunja priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent",
        ),
        includeCreatedAt: z.boolean().optional().describe(
          "Include issue created_at timestamp in description",
        ),
        projectId: z.number().int().positive().optional().describe(
          "Override Vikunja project ID (defaults to vikunja-kanban's default)",
        ),
      }),
      output: z.object({
        issueNumber: z.number(),
        issueUrl: z.string().url(),
        vikunjaTaskId: z.number(),
        vikunjaTaskTitle: z.string(),
        bucket: z.string(),
        message: z.string(),
      }),
      fn: import_issue,
    },
  },
};
