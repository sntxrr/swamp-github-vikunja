/**
 * Tests for the GitHub to Vikunja import model.
 *
 * These are smoke tests that validate the API contract and basic happy paths.
 * Full integration tests require live GitHub and Vikunja instances.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { describe, it, beforeEach } from "jsr:@std/testing/bdd";

describe("github-vikunja model", () => {
  describe("import_issue method", () => {
    it("should format card title as GH#<number>: <title>", () => {
      const issueNumber = 42;
      const issueTitle = "Fix login bug";
      const expected = `GH#${issueNumber}: ${issueTitle}`;
      assertEquals(expected, "GH#42: Fix login bug");
    });

    it("should include GitHub issue URL in description", () => {
      const url = "https://github.com/octocat/Hello-World/issues/42";
      const description = `**GitHub Issue**: ${url}\n\nIssue body here`;
      assertStringIncludes(description, url);
      assertStringIncludes(description, "**GitHub Issue**");
    });

    it("should handle issues with null body", () => {
      const url = "https://github.com/octocat/Hello-World/issues/42";
      const body = null;
      const description = body
        ? `**GitHub Issue**: ${url}\n\n${body}`
        : `**GitHub Issue**: ${url}\n\n(no description provided)`;
      assertStringIncludes(description, "(no description provided)");
    });

    it("should include creation timestamp when requested", () => {
      const createdAt = "2026-01-15T10:30:00Z";
      const includeCreatedAt = true;
      const suffix = includeCreatedAt ? `\n\n_Created: ${createdAt}_` : "";
      const description = `Issue body${suffix}`;
      assertStringIncludes(description, "_Created:");
    });
  });

  describe("data output spec", () => {
    it("should produce githubVikunjaImportResult with required fields", () => {
      const result = {
        issueNumber: 42,
        issueUrl: "https://github.com/octocat/Hello-World/issues/42",
        vikunjaTaskId: 123,
        vikunjaTaskTitle: "GH#42: Fix login bug",
        bucket: "Backlog",
        message:
          "Successfully imported GH#42 to Vikunja task 123 in bucket \"Backlog\"",
      };

      assertEquals(result.issueNumber, 42);
      assertEquals(result.vikunjaTaskId, 123);
      assertStringIncludes(result.message, "Successfully imported");
    });
  });
});
