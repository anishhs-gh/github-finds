import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getClient, requireAuth, friendlyError } from "../api/client.js";
import {
  printTitle, printKeyValue, printTable, printError, printSuccess,
  printSection, printWarn, c, formatDate, truncate, stateBadge,
} from "../utils/display.js";
import { askLoadMore, printPageInfo, DEFAULT_PER_PAGE } from "../utils/paginate.js";
import { cacheGet, cacheSet, cacheKey } from "../utils/cache.js";
import type { MergeMethod, ReviewEvent } from "../types/index.js";

function splitRepo(ownerRepo: string): { owner: string; repo: string } {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) {
    printError(`Invalid format. Use owner/repo (e.g. "torvalds/linux")`);
    process.exit(1);
  }
  return { owner, repo };
}

export function registerPR(program: Command) {
  const pr = program.command("pr").description("Pull request commands");

  // ── pr list ────────────────────────────────────────────────────────────────
  pr
    .command("list <owner/repo>")
    .description("List pull requests")
    .option("-s, --state <state>", "open|closed|all", "open")
    .option("-b, --base <branch>", "Filter by base branch")
    .option("-p, --page <n>", "Page number", "1")
    .option("-l, --limit <n>", "Results per page", String(DEFAULT_PER_PAGE))
    .option("--all-pages", "Page through results interactively", false)
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const perPage = Math.min(parseInt(opts.limit, 10), 100);
      const state: "open" | "closed" | "all" = opts.state === "all" ? "all" : opts.state === "closed" ? "closed" : "open";

      type PR = { number: number; state: string; title: string; user?: { login?: string } | null; base: { label: string }; head: { label: string }; updated_at: string };

      let page = parseInt(opts.page, 10);
      let continueLoop = true;
      printTitle(`Pull Requests — ${ownerRepo} [${state}]`);

      while (continueLoop) {
        const key = cacheKey("pr.list", owner, repo, state, opts.base, page, perPage);
        let prs = cacheGet<PR[]>(key);

        if (!prs) {
          const spinner = ora(`Fetching page ${page}…`).start();
          try {
            const { data } = await getClient().rest.pulls.list({
              owner, repo, state, base: opts.base, per_page: perPage, page,
            });
            prs = data as PR[];
            cacheSet(key, prs);
            spinner.stop();
          } catch (err) {
            spinner.fail("Failed");
            printError(friendlyError(err));
            return;
          }
        }

        if (!prs.length) { console.log(c.muted("  No pull requests.")); break; }
        printTable(
          ["#", "State", "Title", "Author", "Base←Head", "Updated"],
          prs.map((p) => [
            p.number, stateBadge(p.state), truncate(p.title, 40),
            p.user?.login ?? "—", `${p.base.label} ← ${p.head.label}`, formatDate(p.updated_at),
          ])
        );
        printPageInfo(page, prs.length, perPage);

        const hasMore = prs.length === perPage;
        if (!hasMore || !opts.allPages) break;
        continueLoop = await askLoadMore();
        page++;
      }
    });

  // ── pr view ────────────────────────────────────────────────────────────────
  pr
    .command("view <owner/repo> <number>")
    .description("View pull request details")
    .action(async (ownerRepo: string, number: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);
      const spinner = ora(`Fetching PR #${pull_number}…`).start();
      try {
        const [{ data: p }, { data: files }, { data: reviews }] = await Promise.all([
          getClient().rest.pulls.get({ owner, repo, pull_number }),
          getClient().rest.pulls.listFiles({ owner, repo, pull_number, per_page: 100 }),
          getClient().rest.pulls.listReviews({ owner, repo, pull_number }),
        ]);
        spinner.stop();
        printTitle(`PR #${p.number} — ${truncate(p.title, 60)}`);
        console.log(`\n  ${stateBadge(p.merged ? "merged" : p.state)}  ${p.merged ? c.badge("MERGED", "magenta") : ""}\n`);
        console.log(`  ${c.val(p.body ?? "(no description)")}\n`);
        printKeyValue([
          ["Repo", ownerRepo],
          ["Author", p.user?.login ?? "—"],
          ["Base ← Head", `${p.base.label} ← ${p.head.label}`],
          ["Mergeable", p.mergeable === null ? "checking…" : String(p.mergeable)],
          ["Merge state", p.mergeable_state ?? "—"],
          ["Draft", p.draft ?? false],
          ["Labels", p.labels.map((l) => l.name).join(", ") || "—"],
          ["Assignees", p.assignees?.map((a) => a.login).join(", ") || "—"],
          ["Reviewers", p.requested_reviewers?.map((r) => r.login).join(", ") || "—"],
          ["Comments", p.comments],
          ["Review comments", p.review_comments],
          ["Commits", p.commits],
          ["Additions", `+${p.additions}`],
          ["Deletions", `-${p.deletions}`],
          ["Changed files", p.changed_files],
          ["Created", formatDate(p.created_at)],
          ["Updated", formatDate(p.updated_at)],
          ["Closed", formatDate(p.closed_at)],
          ["Merged at", formatDate(p.merged_at)],
          ["Merged by", p.merged_by?.login ?? "—"],
          ["URL", p.html_url],
        ]);

        if (files.length) {
          printSection("Files Changed");
          printTable(
            ["File", "+", "-", "Status"],
            files.map((f) => [truncate(f.filename, 60), f.additions, f.deletions, f.status])
          );
        }
        if (reviews.length) {
          printSection("Reviews");
          printTable(
            ["Author", "State", "Submitted"],
            reviews.map((r) => [r.user?.login ?? "—", stateBadge(r.state), formatDate(r.submitted_at)])
          );
        }
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not fetch PR #${pull_number}.`, err);
      }
    });

  // ── pr create ──────────────────────────────────────────────────────────────
  pr
    .command("create <owner/repo>")
    .description("Create a pull request (requires auth)")
    .option("--title <title>", "PR title")
    .option("--body <body>", "PR body/description")
    .option("--base <branch>", "Base branch (where you want to merge into)")
    .option("--head <branch>", "Head branch (your changes)")
    .option("--draft", "Create as draft PR", false)
    .action(async (ownerRepo: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);

      // Fetch default branch for base default
      let defaultBranch = "main";
      try {
        const { data: r } = await getClient().rest.repos.get({ owner, repo });
        defaultBranch = r.default_branch;
      } catch { /* use 'main' */ }

      let { title, body, base, head } = opts;

      if (!title || !head) {
        const answers = await inquirer.prompt([
          { type: "input", name: "title", message: "PR title:", when: !title, validate: (v: string) => v.trim() ? true : "Required" },
          { type: "input", name: "base", message: `Base branch [${defaultBranch}]:`, when: !base, default: defaultBranch },
          { type: "input", name: "head", message: "Head branch (owner:branch or branch):", when: !head, validate: (v: string) => v.trim() ? true : "Required" },
          { type: "editor", name: "body", message: "PR description (opens editor):", when: !body },
          { type: "confirm", name: "draft", message: "Create as draft?", default: false, when: !opts.draft },
        ]);
        title = title ?? answers.title;
        base = base ?? answers.base ?? defaultBranch;
        head = head ?? answers.head;
        body = body ?? answers.body ?? "";
        opts.draft = opts.draft || answers.draft;
      }

      const spinner = ora("Creating pull request…").start();
      try {
        const { data: p } = await getClient().rest.pulls.create({
          owner,
          repo,
          title: title.trim(),
          body: body?.trim() ?? "",
          base: base ?? defaultBranch,
          head: head.trim(),
          draft: opts.draft,
        });
        spinner.succeed(`PR #${p.number} created: ${c.ok(p.title)}`);
        printKeyValue([["URL", p.html_url]]);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not create pull request.", err);
      }
    });

  // ── pr merge ───────────────────────────────────────────────────────────────
  pr
    .command("merge <owner/repo> <number>")
    .description("Merge a pull request (requires auth + write access)")
    .option("-m, --method <method>", "merge|squash|rebase", "merge")
    .option("--title <title>", "Commit title for merge/squash")
    .option("--message <msg>", "Commit message body")
    .action(async (ownerRepo: string, number: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);

      const { confirm } = await inquirer.prompt([{
        type: "confirm",
        name: "confirm",
        message: `Merge PR #${pull_number} in ${ownerRepo} using ${c.warn(opts.method)} strategy?`,
        default: false,
      }]);
      if (!confirm) { console.log(c.muted("Aborted.")); return; }

      const spinner = ora(`Merging PR #${pull_number}…`).start();
      try {
        const { data } = await getClient().rest.pulls.merge({
          owner,
          repo,
          pull_number,
          merge_method: opts.method as MergeMethod,
          commit_title: opts.title,
          commit_message: opts.message,
        });
        spinner.succeed(`PR #${pull_number} merged: ${c.ok(data.sha?.slice(0, 10) ?? "")}`);
        console.log(c.muted(`  ${data.message}`));
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not merge PR #${pull_number}.`, err);
      }
    });

  // ── pr close ───────────────────────────────────────────────────────────────
  pr
    .command("close <owner/repo> <number>")
    .description("Close a pull request without merging (requires auth + write access)")
    .action(async (ownerRepo: string, number: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);
      const spinner = ora(`Closing PR #${pull_number}…`).start();
      try {
        await getClient().rest.pulls.update({ owner, repo, pull_number, state: "closed" });
        spinner.succeed(`PR #${pull_number} closed`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not close PR.", err);
      }
    });

  // ── pr review ──────────────────────────────────────────────────────────────
  pr
    .command("review <owner/repo> <number>")
    .description("Submit a review on a pull request (requires auth)")
    .option("-e, --event <event>", "APPROVE|REQUEST_CHANGES|COMMENT", "COMMENT")
    .option("-b, --body <body>", "Review body text")
    .action(async (ownerRepo: string, number: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);

      let { event, body } = opts;
      if (!body) {
        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "event",
            message: "Review type:",
            choices: ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
            when: !["APPROVE", "REQUEST_CHANGES", "COMMENT"].includes(event?.toUpperCase()),
          },
          {
            type: "editor",
            name: "body",
            message: "Review body (optional, opens editor):",
          },
        ]);
        event = event ?? answers.event ?? "COMMENT";
        body = answers.body ?? "";
      }

      const spinner = ora(`Submitting ${event} review on PR #${pull_number}…`).start();
      try {
        const { data: review } = await getClient().rest.pulls.createReview({
          owner,
          repo,
          pull_number,
          event: event.toUpperCase() as ReviewEvent,
          body: body?.trim() ?? "",
        });
        spinner.succeed(`Review submitted (${stateBadge(review.state)})`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not submit review.", err);
      }
    });

  // ── pr reviews ─────────────────────────────────────────────────────────────
  pr
    .command("reviews <owner/repo> <number>")
    .description("List reviews on a pull request")
    .action(async (ownerRepo: string, number: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);
      const spinner = ora("Fetching reviews…").start();
      try {
        const { data } = await getClient().rest.pulls.listReviews({ owner, repo, pull_number });
        spinner.stop();
        printTitle(`Reviews — PR #${pull_number} in ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No reviews.")); return; }
        for (const r of data) {
          console.log(`\n  ${stateBadge(r.state)}  ${c.ok(r.user?.login ?? "—")}  ${c.muted(formatDate(r.submitted_at))}`);
          if (r.body) console.log(`  ${c.val(truncate(r.body, 200))}`);
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch reviews.", err);
      }
    });

  // ── pr comment ─────────────────────────────────────────────────────────────
  pr
    .command("comment <owner/repo> <number>")
    .description("Add a comment to a pull request (requires auth)")
    .option("-b, --body <body>", "Comment text")
    .action(async (ownerRepo: string, number: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const issue_number = parseInt(number, 10); // PRs share issue comment API

      let body = opts.body;
      if (!body) {
        const answers = await inquirer.prompt([
          { type: "editor", name: "body", message: "Comment (opens editor):", validate: (v: string) => v.trim() ? true : "Required" },
        ]);
        body = answers.body;
      }

      const spinner = ora("Adding comment…").start();
      try {
        const { data: comment } = await getClient().rest.issues.createComment({
          owner,
          repo,
          issue_number,
          body: body.trim(),
        });
        spinner.succeed(`Comment added: ${c.link(comment.html_url)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not add comment.", err);
      }
    });

  // ── pr files ───────────────────────────────────────────────────────────────
  pr
    .command("files <owner/repo> <number>")
    .description("List files changed in a pull request")
    .action(async (ownerRepo: string, number: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);
      const spinner = ora("Fetching changed files…").start();
      try {
        const { data } = await getClient().rest.pulls.listFiles({ owner, repo, pull_number, per_page: 100 });
        spinner.stop();
        printTitle(`Files Changed — PR #${pull_number} in ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No files.")); return; }
        printTable(
          ["File", "+", "-", "Status"],
          data.map((f) => [truncate(f.filename, 70), f.additions, f.deletions, f.status])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch files.", err);
      }
    });

  // ── pr comments ────────────────────────────────────────────────────────────
  pr
    .command("comments <owner/repo> <number>")
    .description("List all comments on a pull request")
    .action(async (ownerRepo: string, number: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const issue_number = parseInt(number, 10);
      const spinner = ora("Fetching comments…").start();
      try {
        const { data } = await getClient().rest.issues.listComments({ owner, repo, issue_number, per_page: 100 });
        spinner.stop();
        printTitle(`Comments — PR #${issue_number} in ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No comments.")); return; }
        for (const cm of data) {
          console.log(`\n  ${c.ok(cm.user?.login ?? "—")}  ${c.muted(formatDate(cm.created_at))}`);
          console.log(`  ${c.val(truncate(cm.body ?? "", 300))}`);
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch comments.", err);
      }
    });

  // ── pr commits ─────────────────────────────────────────────────────────────
  pr
    .command("commits <owner/repo> <number>")
    .description("List commits in a pull request")
    .action(async (ownerRepo: string, number: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);
      const spinner = ora("Fetching PR commits…").start();
      try {
        const { data } = await getClient().rest.pulls.listCommits({ owner, repo, pull_number, per_page: 100 });
        spinner.stop();
        printTitle(`Commits — PR #${pull_number} in ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No commits.")); return; }
        printTable(
          ["SHA", "Author", "Date", "Message"],
          data.map((cm) => [
            cm.sha.slice(0, 10),
            cm.commit.author?.name ?? cm.author?.login ?? "—",
            formatDate(cm.commit.author?.date),
            truncate(cm.commit.message.split("\n")[0], 60),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch PR commits.", err);
      }
    });

  // ── pr reopen ──────────────────────────────────────────────────────────────
  pr
    .command("reopen <owner/repo> <number>")
    .description("Reopen a closed pull request (requires auth + write access)")
    .action(async (ownerRepo: string, number: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const pull_number = parseInt(number, 10);
      const spinner = ora(`Reopening PR #${pull_number}…`).start();
      try {
        await getClient().rest.pulls.update({ owner, repo, pull_number, state: "open" });
        spinner.succeed(`PR #${pull_number} reopened`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not reopen PR.", err);
      }
    });
}
