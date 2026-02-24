import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getClient, requireAuth, friendlyError } from "../api/client.js";
import {
  printTitle, printKeyValue, printTable, printError, printSuccess,
  printSection, c, formatDate, truncate, stateBadge,
} from "../utils/display.js";
import { askLoadMore, printPageInfo, DEFAULT_PER_PAGE } from "../utils/paginate.js";
import { cacheGet, cacheSet, cacheKey } from "../utils/cache.js";

function splitRepo(ownerRepo: string): { owner: string; repo: string } {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) { printError(`Invalid format. Use owner/repo`); process.exit(1); }
  return { owner, repo };
}

export function registerIssue(program: Command) {
  const issue = program.command("issue").description("Issue commands");

  // ── issue list ─────────────────────────────────────────────────────────────
  issue
    .command("list <owner/repo>")
    .description("List issues in a repository")
    .option("-s, --state <state>", "open|closed|all", "open")
    .option("--label <label>", "Filter by label")
    .option("--assignee <assignee>", "Filter by assignee login")
    .option("-p, --page <n>", "Page number", "1")
    .option("-l, --limit <n>", "Results per page", String(DEFAULT_PER_PAGE))
    .option("--all-pages", "Page through results interactively", false)
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const perPage = Math.min(parseInt(opts.limit, 10), 100);

      let page = parseInt(opts.page, 10);
      let continueLoop = true;
      printTitle(`Issues — ${ownerRepo} [${opts.state}]`);

      type Issue = { number: number; state: string; title: string; user?: { login?: string } | null; labels: Array<string | { name?: string | null }>; comments: number; updated_at: string };

      while (continueLoop) {
        const key = cacheKey("issue.list", owner, repo, opts.state, opts.label, opts.assignee, page, perPage);
        let issues = cacheGet<Issue[]>(key);

        if (!issues) {
          const spinner = ora(`Fetching page ${page}…`).start();
          try {
            const { data } = await getClient().rest.issues.listForRepo({
              owner, repo, state: opts.state, labels: opts.label,
              assignee: opts.assignee, per_page: perPage, page,
            });
            // Filter out PRs (GitHub API returns PRs as issues)
            issues = data.filter((i) => !("pull_request" in i && i.pull_request)) as unknown as Issue[];
            cacheSet(key, issues);
            spinner.stop();
          } catch (err) {
            spinner.fail("Failed");
            printError(friendlyError(err));
            return;
          }
        }

        if (!issues.length) { console.log(c.muted("  No issues.")); break; }
        printTable(
          ["#", "State", "Title", "Author", "Labels", "Comments", "Updated"],
          issues.map((i) => [
            i.number, stateBadge(i.state), truncate(i.title, 40),
            i.user?.login ?? "—",
            i.labels.map((l) => typeof l === "string" ? l : l.name ?? "").join(", ") || "—",
            i.comments, formatDate(i.updated_at),
          ])
        );
        printPageInfo(page, issues.length, perPage);

        const hasMore = issues.length === perPage;
        if (!hasMore || !opts.allPages) break;
        continueLoop = await askLoadMore();
        page++;
      }
    });

  // ── issue view ─────────────────────────────────────────────────────────────
  issue
    .command("view <owner/repo> <number>")
    .description("View issue details")
    .action(async (ownerRepo: string, number: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const issue_number = parseInt(number, 10);
      const spinner = ora(`Fetching issue #${issue_number}…`).start();
      try {
        const [{ data: i }, { data: comments }] = await Promise.all([
          getClient().rest.issues.get({ owner, repo, issue_number }),
          getClient().rest.issues.listComments({ owner, repo, issue_number, per_page: 20 }),
        ]);
        spinner.stop();
        printTitle(`Issue #${i.number} — ${truncate(i.title, 60)}`);
        console.log(`\n  ${stateBadge(i.state)}\n`);
        console.log(`  ${c.val(i.body ?? "(no description)")}\n`);
        printKeyValue([
          ["Author", i.user?.login ?? "—"],
          ["Assignees", i.assignees?.map((a) => a.login).join(", ") || "—"],
          ["Labels", i.labels.map((l) => (typeof l === "string" ? l : l.name)).join(", ") || "—"],
          ["Milestone", i.milestone?.title ?? "—"],
          ["Comments", i.comments],
          ["Locked", i.locked],
          ["Created", formatDate(i.created_at)],
          ["Updated", formatDate(i.updated_at)],
          ["Closed", formatDate(i.closed_at)],
          ["URL", i.html_url],
        ]);
        if (comments.length) {
          printSection(`Comments (${comments.length})`);
          for (const cm of comments) {
            console.log(`\n  ${c.ok(cm.user?.login ?? "—")}  ${c.muted(formatDate(cm.created_at))}`);
            console.log(`  ${c.val(truncate(cm.body ?? "", 300))}`);
          }
        }
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not fetch issue #${issue_number}.`, err);
      }
    });

  // ── issue create ───────────────────────────────────────────────────────────
  issue
    .command("create <owner/repo>")
    .description("Create an issue (requires auth)")
    .option("--title <title>", "Issue title")
    .option("--body <body>", "Issue body")
    .option("--label <labels>", "Comma-separated labels")
    .option("--assignee <assignees>", "Comma-separated assignee logins")
    .action(async (ownerRepo: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      let { title, body } = opts;

      if (!title) {
        const answers = await inquirer.prompt([
          { type: "input", name: "title", message: "Issue title:", validate: (v: string) => v.trim() ? true : "Required" },
          { type: "editor", name: "body", message: "Issue body (opens editor):" },
          { type: "input", name: "labels", message: "Labels (comma-separated, optional):" },
          { type: "input", name: "assignees", message: "Assignees (comma-separated logins, optional):" },
        ]);
        title = answers.title;
        body = answers.body ?? "";
        opts.label = opts.label ?? answers.labels;
        opts.assignee = opts.assignee ?? answers.assignees;
      }

      const labels = opts.label ? opts.label.split(",").map((l: string) => l.trim()).filter(Boolean) : undefined;
      const assignees = opts.assignee ? opts.assignee.split(",").map((a: string) => a.trim()).filter(Boolean) : undefined;

      const spinner = ora("Creating issue…").start();
      try {
        const { data: i } = await getClient().rest.issues.create({
          owner,
          repo,
          title: title.trim(),
          body: body?.trim() ?? "",
          labels,
          assignees,
        });
        spinner.succeed(`Issue #${i.number} created: ${c.ok(i.title)}`);
        printKeyValue([["URL", i.html_url]]);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not create issue.", err);
      }
    });

  // ── issue close ────────────────────────────────────────────────────────────
  issue
    .command("close <owner/repo> <number>")
    .description("Close an issue (requires auth + write access)")
    .action(async (ownerRepo: string, number: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const issue_number = parseInt(number, 10);
      const spinner = ora(`Closing issue #${issue_number}…`).start();
      try {
        await getClient().rest.issues.update({ owner, repo, issue_number, state: "closed" });
        spinner.succeed(`Issue #${issue_number} closed`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not close issue.", err);
      }
    });

  // ── issue reopen ───────────────────────────────────────────────────────────
  issue
    .command("reopen <owner/repo> <number>")
    .description("Reopen a closed issue (requires auth + write access)")
    .action(async (ownerRepo: string, number: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const issue_number = parseInt(number, 10);
      const spinner = ora(`Reopening issue #${issue_number}…`).start();
      try {
        await getClient().rest.issues.update({ owner, repo, issue_number, state: "open" });
        spinner.succeed(`Issue #${issue_number} reopened`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not reopen issue.", err);
      }
    });

  // ── issue comment ──────────────────────────────────────────────────────────
  issue
    .command("comment <owner/repo> <number>")
    .description("Add a comment to an issue (requires auth)")
    .option("-b, --body <body>", "Comment text")
    .action(async (ownerRepo: string, number: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const issue_number = parseInt(number, 10);

      let body = opts.body;
      if (!body) {
        const answers = await inquirer.prompt([
          { type: "editor", name: "body", message: "Comment (opens editor):", validate: (v: string) => v.trim() ? true : "Required" },
        ]);
        body = answers.body;
      }

      const spinner = ora("Adding comment…").start();
      try {
        const { data: cm } = await getClient().rest.issues.createComment({
          owner,
          repo,
          issue_number,
          body: body.trim(),
        });
        spinner.succeed(`Comment added: ${c.link(cm.html_url)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not add comment.", err);
      }
    });

  // ── issue comments ─────────────────────────────────────────────────────────
  issue
    .command("comments <owner/repo> <number>")
    .description("List all comments on an issue")
    .action(async (ownerRepo: string, number: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const issue_number = parseInt(number, 10);
      const spinner = ora("Fetching comments…").start();
      try {
        const { data } = await getClient().rest.issues.listComments({ owner, repo, issue_number, per_page: 100 });
        spinner.stop();
        printTitle(`Comments — Issue #${issue_number} in ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No comments.")); return; }
        for (const cm of data) {
          console.log(`\n  ${c.ok(cm.user?.login ?? "—")}  ${c.muted(formatDate(cm.created_at))}`);
          console.log(`  ${c.val(truncate(cm.body ?? "", 400))}`);
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch comments.", err);
      }
    });

  // ── issue labels ───────────────────────────────────────────────────────────
  issue
    .command("labels <owner/repo>")
    .description("List available labels in a repository")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching labels…").start();
      try {
        const { data } = await getClient().rest.issues.listLabelsForRepo({ owner, repo, per_page: 100 });
        spinner.stop();
        printTitle(`Labels — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No labels.")); return; }
        for (const l of data) {
          console.log(`  ${"#" + l.color}  ${c.ok(l.name)}  ${c.muted(l.description ?? "")}`);
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch labels.", err);
      }
    });

  // ── issue milestones ───────────────────────────────────────────────────────
  issue
    .command("milestones <owner/repo>")
    .description("List milestones in a repository")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching milestones…").start();
      try {
        const { data } = await getClient().rest.issues.listMilestones({ owner, repo, per_page: 100 });
        spinner.stop();
        printTitle(`Milestones — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No milestones.")); return; }
        printTable(
          ["#", "Title", "State", "Open Issues", "Due"],
          data.map((m) => [m.number, truncate(m.title, 40), stateBadge(m.state), m.open_issues, formatDate(m.due_on)])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch milestones.", err);
      }
    });
}
