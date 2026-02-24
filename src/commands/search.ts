import { Command } from "commander";
import ora from "ora";
import { getClient, friendlyError } from "../api/client.js";
import {
  printTitle, printTable, printError, c, truncate, formatDate,
} from "../utils/display.js";
import { askLoadMore, printPageInfo, DEFAULT_PER_PAGE } from "../utils/paginate.js";
import { cacheGet, cacheSet, cacheKey } from "../utils/cache.js";

export function registerSearch(program: Command) {
  const search = program.command("search").description("Search GitHub");

  // ── search users ───────────────────────────────────────────────────────────
  search
    .command("users <query>")
    .description("Search GitHub users")
    .option("-l, --limit <n>", "Max results", "15")
    .action(async (query: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Searching users: "${query}"…`).start();
      try {
        const { data } = await getClient().rest.search.users({
          q: query,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`User Search — "${query}" (${data.total_count.toLocaleString()} results)`);
        if (!data.items.length) { console.log(c.muted("  No results.")); return; }
        printTable(
          ["Login", "Type", "Score", "Profile URL"],
          data.items.slice(0, limit).map((u) => [u.login, u.type, u.score.toFixed(1), u.html_url])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Search failed.", err);
      }
    });

  // ── search repos ───────────────────────────────────────────────────────────
  search
    .command("repos <query>")
    .description("Search GitHub repositories")
    .option("--language <lang>", "Filter by language")
    .option("--stars <n>", "Minimum stars (e.g. '>100')")
    .option("-s, --sort <sort>", "stars|forks|updated", "stars")
    .option("-p, --page <n>", "Page number", "1")
    .option("-l, --limit <n>", "Results per page", String(DEFAULT_PER_PAGE))
    .option("--all-pages", "Page through results interactively", false)
    .action(async (query: string, opts) => {
      const perPage = Math.min(parseInt(opts.limit, 10), 100);
      let q = query;
      if (opts.language) q += ` language:${opts.language}`;
      if (opts.stars) q += ` stars:${opts.stars}`;

      let page = parseInt(opts.page, 10);
      let totalCount = 0;
      let continueLoop = true;

      type RepoSearchResult = { total_count: number; items: Array<{ full_name: string; stargazers_count: number; forks_count: number; language: string | null; updated_at: string | null }> };

      while (continueLoop) {
        const key = cacheKey("search.repos", q, opts.sort, page, perPage);
        let result = cacheGet<RepoSearchResult>(key);

        if (!result) {
          const spinner = ora(`Searching repos: "${q}" (page ${page})…`).start();
          try {
            const { data } = await getClient().rest.search.repos({ q, sort: opts.sort, per_page: perPage, page });
            result = data as unknown as RepoSearchResult;
            cacheSet(key, result);
            spinner.stop();
          } catch (err) {
            spinner.fail("Failed");
            printError(friendlyError(err));
            return;
          }
        }

        totalCount = result!.total_count;
        if (page === parseInt(opts.page, 10)) {
          printTitle(`Repo Search — "${query}" (${totalCount.toLocaleString()} results)`);
        }
        if (!result!.items.length) { console.log(c.muted("  No results.")); break; }
        printTable(
          ["Repo", "Stars", "Forks", "Language", "Updated"],
          result!.items.map((r) => [r.full_name, r.stargazers_count, r.forks_count, r.language ?? "—", formatDate(r.updated_at)])
        );
        printPageInfo(page, result!.items.length, perPage);

        const hasMore = result!.items.length === perPage && page * perPage < totalCount;
        if (!hasMore || !opts.allPages) break;
        continueLoop = await askLoadMore();
        page++;
      }
    });

  // ── search code ────────────────────────────────────────────────────────────
  search
    .command("code <query>")
    .description("Search code on GitHub")
    .option("--repo <owner/repo>", "Limit search to a specific repo")
    .option("--language <lang>", "Filter by language")
    .option("-l, --limit <n>", "Max results", "15")
    .action(async (query: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      let q = query;
      if (opts.repo) q += ` repo:${opts.repo}`;
      if (opts.language) q += ` language:${opts.language}`;

      const spinner = ora(`Searching code: "${q}"…`).start();
      try {
        const { data } = await getClient().rest.search.code({
          q,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Code Search — "${query}" (${data.total_count.toLocaleString()} results)`);
        if (!data.items.length) { console.log(c.muted("  No results.")); return; }
        printTable(
          ["File", "Repo", "Path", "URL"],
          data.items.slice(0, limit).map((item) => [
            item.name,
            item.repository.full_name,
            truncate(item.path, 50),
            item.html_url,
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Code search failed. Note: code search requires authentication.", err);
      }
    });

  // ── search issues ──────────────────────────────────────────────────────────
  search
    .command("issues <query>")
    .description("Search issues and pull requests on GitHub")
    .option("-t, --type <type>", "issue|pr (default: issue)", "issue")
    .option("-s, --state <state>", "open|closed", "open")
    .option("--repo <owner/repo>", "Limit to a specific repo")
    .option("-l, --limit <n>", "Max results", "15")
    .action(async (query: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      let q = query;
      if (opts.type === "pr") q += " type:pr";
      else q += " type:issue";
      if (opts.state) q += ` state:${opts.state}`;
      if (opts.repo) q += ` repo:${opts.repo}`;

      const spinner = ora(`Searching issues: "${q}"…`).start();
      try {
        const { data } = await getClient().rest.search.issuesAndPullRequests({
          q,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Issue Search — "${query}" (${data.total_count.toLocaleString()} results)`);
        if (!data.items.length) { console.log(c.muted("  No results.")); return; }
        printTable(
          ["#", "Title", "Repo", "State", "Author", "Updated"],
          data.items.slice(0, limit).map((i) => [
            i.number,
            truncate(i.title, 40),
            i.repository_url.replace("https://api.github.com/repos/", ""),
            i.state,
            i.user?.login ?? "—",
            formatDate(i.updated_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Search failed.", err);
      }
    });

  // ── search commits ─────────────────────────────────────────────────────────
  search
    .command("commits <query>")
    .description("Search commits on GitHub")
    .option("--repo <owner/repo>", "Limit to a specific repo")
    .option("--author <login>", "Filter by committer login")
    .option("-l, --limit <n>", "Max results", "15")
    .action(async (query: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      let q = query;
      if (opts.repo) q += ` repo:${opts.repo}`;
      if (opts.author) q += ` author:${opts.author}`;

      const spinner = ora(`Searching commits: "${q}"…`).start();
      try {
        const { data } = await getClient().rest.search.commits({
          q,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Commit Search — "${query}" (${data.total_count.toLocaleString()} results)`);
        if (!data.items.length) { console.log(c.muted("  No results.")); return; }
        printTable(
          ["SHA", "Author", "Repo", "Message", "Date"],
          data.items.slice(0, limit).map((item) => [
            item.sha.slice(0, 10),
            item.commit.author?.name ?? "—",
            item.repository.full_name,
            truncate(item.commit.message.split("\n")[0], 45),
            formatDate(item.commit.author?.date),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Commit search failed.", err);
      }
    });

  // ── search topics ──────────────────────────────────────────────────────────
  search
    .command("topics <query>")
    .description("Search GitHub repository topics")
    .option("-l, --limit <n>", "Max results", "15")
    .action(async (query: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Searching topics: "${query}"…`).start();
      try {
        const { data } = await getClient().rest.search.topics({ q: query, per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle(`Topic Search — "${query}" (${data.total_count.toLocaleString()} results)`);
        if (!data.items.length) { console.log(c.muted("  No results.")); return; }
        printTable(
          ["Name", "Display Name", "Featured", "Curated"],
          data.items.slice(0, limit).map((t) => [
            t.name,
            t.display_name ?? "—",
            t.featured ? c.ok("yes") : "no",
            t.curated ? c.ok("yes") : "no",
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Topic search failed.", err);
      }
    });
}
