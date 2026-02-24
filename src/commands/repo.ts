import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getClient, requireAuth, isAuthenticated, friendlyError } from "../api/client.js";
import {
  printTitle, printKeyValue, printTable, printError, printSuccess, printSection,
  printWarn, c, formatDate, truncate, stateBadge,
} from "../utils/display.js";
import { askLoadMore, printPageInfo, DEFAULT_PER_PAGE } from "../utils/paginate.js";
import { cacheGet, cacheSet, cacheKey } from "../utils/cache.js";

function splitRepo(ownerRepo: string): { owner: string; repo: string } {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) {
    printError(`Invalid format. Use owner/repo (e.g. "torvalds/linux")`);
    process.exit(1);
  }
  return { owner, repo };
}

export function registerRepo(program: Command) {
  const repoCmd = program.command("repo").description("Repository commands");

  // ── repo list ──────────────────────────────────────────────────────────────
  repoCmd
    .command("list [username]")
    .description("List repos for a user. Omit username to list your own (incl. private).")
    .option("-t, --type <type>", "all|public|private|forks|sources|member", "all")
    .option("-s, --sort <sort>", "created|updated|pushed|full_name", "updated")
    .option("-p, --page <n>", "Page number", "1")
    .option("-l, --limit <n>", "Results per page", String(DEFAULT_PER_PAGE))
    .option("--all-pages", "Automatically page through all results interactively", false)
    .action(async (username: string | undefined, opts) => {
      const perPage = Math.min(parseInt(opts.limit, 10), 100);
      if (!username) requireAuth();

      type Repo = { full_name: string; description: string | null; stargazers_count: number; language: string | null; private: boolean; updated_at: string | null; fork: boolean };

      let page = parseInt(opts.page, 10);
      let continueLoop = true;
      const title = username ? `Repos — ${username}` : "Your Repositories";
      printTitle(title);

      while (continueLoop) {
        const key = cacheKey("repo.list", username ?? "__me__", opts.type, opts.sort, page, perPage);
        let repos = cacheGet<Repo[]>(key);

        if (!repos) {
          const spinner = ora(`Fetching page ${page}…`).start();
          try {
            if (username) {
              const { data } = await getClient().rest.repos.listForUser({
                username, type: opts.type, sort: opts.sort, per_page: perPage, page,
              });
              repos = data as Repo[];
            } else {
              const { data } = await getClient().rest.repos.listForAuthenticatedUser({
                type: opts.type, sort: opts.sort, per_page: perPage, page,
              });
              repos = data as Repo[];
            }
            cacheSet(key, repos);
            spinner.stop();
          } catch (err) {
            spinner.fail("Failed");
            printError(friendlyError(err));
            return;
          }
        }

        if (!repos.length) { console.log(c.muted("  No repos found.")); break; }
        printTable(
          ["Repo", "Stars", "Lang", "Private", "Fork", "Updated"],
          repos.map((r) => [
            r.full_name, r.stargazers_count, r.language ?? "—",
            r.private ? c.warn("yes") : "no", r.fork ? "yes" : "no", formatDate(r.updated_at),
          ])
        );
        printPageInfo(page, repos.length, perPage);

        const hasMore = repos.length === perPage;
        if (!hasMore || !opts.allPages) break;
        continueLoop = await askLoadMore();
        page++;
      }
    });

  // ── repo view ──────────────────────────────────────────────────────────────
  repoCmd
    .command("view <owner/repo>")
    .description("View detailed info about a repository")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora(`Fetching ${ownerRepo}…`).start();
      try {
        const { data: r } = await getClient().rest.repos.get({ owner, repo });
        spinner.stop();
        printTitle(r.full_name);
        console.log(`\n  ${c.val(r.description ?? "(no description)")}\n`);
        printKeyValue([
          ["URL", r.html_url],
          ["Stars", r.stargazers_count],
          ["Forks", r.forks_count],
          ["Watchers", r.watchers_count],
          ["Open issues", r.open_issues_count],
          ["Language", r.language ?? "—"],
          ["Default branch", r.default_branch],
          ["Private", r.private],
          ["Fork", r.fork],
          ["Archived", r.archived],
          ["Template", r.is_template ?? false],
          ["License", r.license?.name ?? "—"],
          ["Topics", r.topics?.join(", ") ?? "—"],
          ["Created", formatDate(r.created_at)],
          ["Last push", formatDate(r.pushed_at)],
          ["Clone (HTTPS)", r.clone_url],
          ["Clone (SSH)", r.ssh_url],
          ["Size", `${r.size} KB`],
        ]);
        if (r.parent) {
          printSection("Forked from");
          printKeyValue([["Parent", r.parent.full_name]]);
        }
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not fetch repo "${ownerRepo}".`, err);
      }
    });

  // ── repo create ────────────────────────────────────────────────────────────
  repoCmd
    .command("create")
    .description("Create a new repository (requires auth)")
    .option("-n, --name <name>", "Repository name")
    .option("-d, --description <desc>", "Description")
    .option("--private", "Make the repo private", false)
    .option("--auto-init", "Initialize with README", false)
    .action(async (opts) => {
      requireAuth();
      let { name, description } = opts;

      if (!name || !description) {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Repository name:",
            when: !name,
            validate: (v: string) => v.trim().length > 0 ? true : "Name is required",
          },
          {
            type: "input",
            name: "description",
            message: "Description (optional):",
            when: !description,
          },
          {
            type: "confirm",
            name: "private",
            message: "Private repository?",
            default: false,
            when: !opts.private,
          },
          {
            type: "confirm",
            name: "autoInit",
            message: "Initialize with README?",
            default: true,
            when: !opts.autoInit,
          },
        ]);
        name = name ?? answers.name;
        description = description ?? answers.description;
        opts.private = opts.private || answers.private;
        opts.autoInit = opts.autoInit || answers.autoInit;
      }

      const spinner = ora("Creating repository…").start();
      try {
        const { data: r } = await getClient().rest.repos.createForAuthenticatedUser({
          name: name.trim(),
          description: description?.trim(),
          private: opts.private,
          auto_init: opts.autoInit,
        });
        spinner.succeed(`Repository created: ${c.ok(r.full_name)}`);
        printKeyValue([
          ["URL", r.html_url],
          ["Clone (HTTPS)", r.clone_url],
          ["Clone (SSH)", r.ssh_url],
        ]);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not create repository.", err);
      }
    });

  // ── repo delete ────────────────────────────────────────────────────────────
  repoCmd
    .command("delete <owner/repo>")
    .description("Delete a repository (requires auth + delete_repo scope)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const { confirm } = await inquirer.prompt([{
        type: "confirm",
        name: "confirm",
        message: `${c.err("DANGER:")} Delete ${c.warn(ownerRepo)}? This cannot be undone.`,
        default: false,
      }]);
      if (!confirm) { console.log(c.muted("Aborted.")); return; }
      const spinner = ora("Deleting repository…").start();
      try {
        await getClient().rest.repos.delete({ owner, repo });
        spinner.succeed(`Deleted ${c.ok(ownerRepo)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not delete repository. Ensure your token has the delete_repo scope.", err);
      }
    });

  // ── repo fork ──────────────────────────────────────────────────────────────
  repoCmd
    .command("fork <owner/repo>")
    .description("Fork a repository (requires auth)")
    .option("--org <org>", "Fork into an organization instead of your account")
    .action(async (ownerRepo: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora(`Forking ${ownerRepo}…`).start();
      try {
        const { data: f } = await getClient().rest.repos.createFork({
          owner,
          repo,
          organization: opts.org,
        });
        spinner.succeed(`Forked to ${c.ok(f.full_name)}`);
        printKeyValue([
          ["URL", f.html_url],
          ["Clone (HTTPS)", f.clone_url],
          ["Clone (SSH)", f.ssh_url],
        ]);
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not fork "${ownerRepo}".`, err);
      }
    });

  // ── repo star ──────────────────────────────────────────────────────────────
  repoCmd
    .command("star <owner/repo>")
    .description("Star a repository (requires auth)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora(`Starring ${ownerRepo}…`).start();
      try {
        await getClient().rest.activity.starRepoForAuthenticatedUser({ owner, repo });
        spinner.succeed(`Starred ${c.ok(ownerRepo)} ⭐`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not star repo.", err);
      }
    });

  // ── repo unstar ────────────────────────────────────────────────────────────
  repoCmd
    .command("unstar <owner/repo>")
    .description("Unstar a repository (requires auth)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora(`Unstarring ${ownerRepo}…`).start();
      try {
        await getClient().rest.activity.unstarRepoForAuthenticatedUser({ owner, repo });
        spinner.succeed(`Unstarred ${c.ok(ownerRepo)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not unstar repo.", err);
      }
    });

  // ── repo watch ─────────────────────────────────────────────────────────────
  repoCmd
    .command("watch <owner/repo>")
    .description("Watch (subscribe to) a repository (requires auth)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora(`Watching ${ownerRepo}…`).start();
      try {
        await getClient().rest.activity.setRepoSubscription({ owner, repo, subscribed: true, ignored: false });
        spinner.succeed(`Now watching ${c.ok(ownerRepo)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not watch repo.", err);
      }
    });

  // ── repo unwatch ───────────────────────────────────────────────────────────
  repoCmd
    .command("unwatch <owner/repo>")
    .description("Unwatch a repository (requires auth)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora(`Unwatching ${ownerRepo}…`).start();
      try {
        await getClient().rest.activity.deleteRepoSubscription({ owner, repo });
        spinner.succeed(`Stopped watching ${c.ok(ownerRepo)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not unwatch repo.", err);
      }
    });

  // ── repo branches ──────────────────────────────────────────────────────────
  repoCmd
    .command("branches <owner/repo>")
    .description("List branches of a repository")
    .option("-l, --limit <n>", "Max results", "30")
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching branches…").start();
      try {
        const { data } = await getClient().rest.repos.listBranches({ owner, repo, per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle(`Branches — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No branches.")); return; }
        printTable(
          ["Branch", "SHA", "Protected"],
          data.map((b) => [b.name, b.commit.sha.slice(0, 10), b.protected ? c.ok("yes") : "no"])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch branches.", err);
      }
    });

  // ── repo contributors ──────────────────────────────────────────────────────
  repoCmd
    .command("contributors <owner/repo>")
    .description("List top contributors")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching contributors…").start();
      try {
        const { data } = await getClient().rest.repos.listContributors({ owner, repo, per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle(`Contributors — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No contributors.")); return; }
        printTable(
          ["#", "Login", "Type", "Contributions"],
          data.slice(0, limit).map((u, i) => [i + 1, u.login, u.type, u.contributions])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch contributors.", err);
      }
    });

  // ── repo languages ─────────────────────────────────────────────────────────
  repoCmd
    .command("languages <owner/repo>")
    .description("Show language breakdown of a repo")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching language stats…").start();
      try {
        const { data } = await getClient().rest.repos.listLanguages({ owner, repo });
        spinner.stop();
        printTitle(`Languages — ${ownerRepo}`);
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        if (!total) { console.log(c.muted("  No language data.")); return; }
        printTable(
          ["Language", "Bytes", "Percentage"],
          Object.entries(data)
            .sort(([, a], [, b]) => b - a)
            .map(([lang, bytes]) => [lang, bytes.toLocaleString(), `${((bytes / total) * 100).toFixed(1)}%`])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch languages.", err);
      }
    });

  // ── repo releases ──────────────────────────────────────────────────────────
  repoCmd
    .command("releases <owner/repo>")
    .description("List releases of a repository")
    .option("-l, --limit <n>", "Max results", "10")
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching releases…").start();
      try {
        const { data } = await getClient().rest.repos.listReleases({ owner, repo, per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle(`Releases — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No releases.")); return; }
        printTable(
          ["Tag", "Name", "Prerelease", "Assets", "Published"],
          data.slice(0, limit).map((r) => [
            r.tag_name,
            truncate(r.name ?? "", 30),
            r.prerelease ? c.warn("pre") : "stable",
            r.assets.length,
            formatDate(r.published_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch releases.", err);
      }
    });

  // ── repo tags ──────────────────────────────────────────────────────────────
  repoCmd
    .command("tags <owner/repo>")
    .description("List tags of a repository")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching tags…").start();
      try {
        const { data } = await getClient().rest.repos.listTags({ owner, repo, per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle(`Tags — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No tags.")); return; }
        printTable(
          ["Tag", "SHA"],
          data.slice(0, limit).map((t) => [t.name, t.commit.sha.slice(0, 10)])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch tags.", err);
      }
    });

  // ── repo topics ────────────────────────────────────────────────────────────
  repoCmd
    .command("topics <owner/repo>")
    .description("List topics of a repository")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching topics…").start();
      try {
        const { data } = await getClient().rest.repos.getAllTopics({ owner, repo });
        spinner.stop();
        printTitle(`Topics — ${ownerRepo}`);
        if (!data.names?.length) { console.log(c.muted("  No topics.")); return; }
        console.log("\n  " + data.names.map((t) => c.badge(t, "cyan")).join("  ") + "\n");
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch topics.", err);
      }
    });

  // ── repo readme ────────────────────────────────────────────────────────────
  repoCmd
    .command("readme <owner/repo>")
    .description("View the README of a repository")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching README…").start();
      try {
        const { data } = await getClient().rest.repos.getReadme({ owner, repo });
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        spinner.stop();
        printTitle(`README — ${ownerRepo}`);
        console.log("\n" + content);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch README.", err);
      }
    });

  // ── repo commits ───────────────────────────────────────────────────────────
  repoCmd
    .command("commits <owner/repo>")
    .description("List commits on a repository")
    .option("-b, --branch <branch>", "Branch or SHA to list commits for")
    .option("-a, --author <author>", "Filter by author login or email")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching commits…").start();
      try {
        const { data } = await getClient().rest.repos.listCommits({
          owner,
          repo,
          sha: opts.branch,
          author: opts.author,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Commits — ${ownerRepo}${opts.branch ? ` (${opts.branch})` : ""}`);
        if (!data.length) { console.log(c.muted("  No commits.")); return; }
        printTable(
          ["SHA", "Author", "Date", "Message"],
          data.slice(0, limit).map((c2) => [
            c2.sha.slice(0, 10),
            c2.commit.author?.name ?? c2.author?.login ?? "unknown",
            formatDate(c2.commit.author?.date),
            truncate(c2.commit.message.split("\n")[0], 60),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch commits.", err);
      }
    });

  // ── repo commit ────────────────────────────────────────────────────────────
  repoCmd
    .command("commit <owner/repo> <sha>")
    .description("View a single commit")
    .action(async (ownerRepo: string, sha: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora(`Fetching commit ${sha.slice(0, 10)}…`).start();
      try {
        const { data: cm } = await getClient().rest.repos.getCommit({ owner, repo, ref: sha });
        spinner.stop();
        printTitle(`Commit ${cm.sha.slice(0, 10)} — ${ownerRepo}`);
        printKeyValue([
          ["Author", `${cm.commit.author?.name} <${cm.commit.author?.email}>`],
          ["Date", formatDate(cm.commit.author?.date)],
          ["Committer", `${cm.commit.committer?.name}`],
          ["Message", cm.commit.message.split("\n")[0]],
          ["Additions", cm.stats?.additions ?? 0],
          ["Deletions", cm.stats?.deletions ?? 0],
          ["Total changes", cm.stats?.total ?? 0],
          ["Files changed", cm.files?.length ?? 0],
        ]);
        if (cm.files?.length) {
          printSection("Files Changed");
          printTable(
            ["Filename", "+", "-", "Status"],
            cm.files.map((f) => [truncate(f.filename, 60), f.additions, f.deletions, f.status])
          );
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch commit.", err);
      }
    });

  // ── repo forks ─────────────────────────────────────────────────────────────
  repoCmd
    .command("forks <owner/repo>")
    .description("List forks of a repository")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching forks…").start();
      try {
        const { data } = await getClient().rest.repos.listForks({ owner, repo, per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle(`Forks — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No forks.")); return; }
        printTable(
          ["Fork", "Owner", "Stars", "Updated"],
          data.slice(0, limit).map((f) => [f.full_name, f.owner.login, f.stargazers_count, formatDate(f.updated_at)])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch forks.", err);
      }
    });

  // ── repo clone-url ─────────────────────────────────────────────────────────
  repoCmd
    .command("clone-url <owner/repo>")
    .description("Show clone URLs for a repository")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching repo…").start();
      try {
        const { data: r } = await getClient().rest.repos.get({ owner, repo });
        spinner.stop();
        printTitle(`Clone URLs — ${ownerRepo}`);
        printKeyValue([
          ["HTTPS", r.clone_url],
          ["SSH", r.ssh_url],
          ["Git", r.git_url],
        ]);
        console.log(`\n${c.muted("  git clone")} ${r.clone_url}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch repo.", err);
      }
    });

  // ── repo collaborators ─────────────────────────────────────────────────────
  repoCmd
    .command("collaborators <owner/repo>")
    .description("List collaborators (requires push access)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching collaborators…").start();
      try {
        const { data } = await getClient().rest.repos.listCollaborators({ owner, repo, per_page: 100 });
        spinner.stop();
        printTitle(`Collaborators — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No collaborators.")); return; }
        printTable(
          ["Login", "Role", "URL"],
          data.map((u) => [u.login, u.role_name ?? u.permissions ? "collaborator" : "—", u.html_url])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch collaborators.", err);
      }
    });

  // ── repo webhooks ──────────────────────────────────────────────────────────
  repoCmd
    .command("webhooks <owner/repo>")
    .description("List webhooks (requires admin access)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching webhooks…").start();
      try {
        const { data } = await getClient().rest.repos.listWebhooks({ owner, repo });
        spinner.stop();
        printTitle(`Webhooks — ${ownerRepo}`);
        if (!data.length) { console.log(c.muted("  No webhooks.")); return; }
        printTable(
          ["ID", "URL", "Events", "Active", "Created"],
          data.map((w) => [
            w.id,
            truncate(w.config.url ?? "", 50),
            w.events.join(", "),
            w.active ? c.ok("yes") : c.err("no"),
            formatDate(w.created_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch webhooks.", err);
      }
    });
}
