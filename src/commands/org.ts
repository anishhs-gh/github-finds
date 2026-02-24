import { Command } from "commander";
import ora from "ora";
import { getClient, requireAuth } from "../api/client.js";
import {
  printTitle, printKeyValue, printTable, printError,
  c, formatDate, truncate,
} from "../utils/display.js";

export function registerOrg(program: Command) {
  const org = program.command("org").description("Organization commands");

  // ── org view ───────────────────────────────────────────────────────────────
  org
    .command("view <org>")
    .description("View organization details")
    .action(async (orgName: string) => {
      const spinner = ora(`Fetching org ${orgName}…`).start();
      try {
        const { data: o } = await getClient().rest.orgs.get({ org: orgName });
        spinner.stop();
        printTitle(`Organization — ${o.login}`);
        console.log(`\n  ${c.val(o.description ?? "(no description)")}\n`);
        printKeyValue([
          ["Name", o.name ?? ""],
          ["Type", o.type],
          ["Email", o.email ?? ""],
          ["Location", o.location ?? ""],
          ["Blog", o.blog ?? ""],
          ["Twitter", o.twitter_username ? `@${o.twitter_username}` : ""],
          ["Public repos", o.public_repos],
          ["Public gists", o.public_gists],
          ["Followers", o.followers],
          ["Following", o.following],
          ["Members (public)", o.public_members_url ? "see members command" : "—"],
          ["Created", formatDate(o.created_at)],
          ["URL", o.html_url],
        ]);
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not fetch organization "${orgName}".`, err);
      }
    });

  // ── org repos ──────────────────────────────────────────────────────────────
  org
    .command("repos <org>")
    .description("List public repositories of an organization")
    .option("-t, --type <type>", "all|public|private|forks|sources|member", "public")
    .option("-s, --sort <sort>", "created|updated|pushed|full_name", "updated")
    .option("-l, --limit <n>", "Max results", "30")
    .action(async (orgName: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Fetching repos for ${orgName}…`).start();
      try {
        const { data } = await getClient().rest.repos.listForOrg({
          org: orgName,
          type: opts.type,
          sort: opts.sort,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Repos — ${orgName}`);
        if (!data.length) { console.log(c.muted("  No repos.")); return; }
        printTable(
          ["Repo", "Stars", "Lang", "Fork", "Updated"],
          data.slice(0, limit).map((r) => [
            r.name,
            r.stargazers_count ?? 0,
            r.language ?? "—",
            r.fork ? "yes" : "no",
            formatDate(r.updated_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch org repos.", err);
      }
    });

  // ── org members ────────────────────────────────────────────────────────────
  org
    .command("members <org>")
    .description("List public members of an organization")
    .option("-l, --limit <n>", "Max results", "30")
    .action(async (orgName: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Fetching members of ${orgName}…`).start();
      try {
        const { data } = await getClient().rest.orgs.listPublicMembers({
          org: orgName,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Public Members — ${orgName}`);
        if (!data.length) { console.log(c.muted("  No public members.")); return; }
        printTable(
          ["Login", "Type", "Profile URL"],
          data.slice(0, limit).map((u) => [u.login, u.type, u.html_url])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch org members.", err);
      }
    });

  // ── org list ───────────────────────────────────────────────────────────────
  org
    .command("list")
    .description("List organizations you belong to (requires auth)")
    .action(async () => {
      requireAuth();
      const spinner = ora("Fetching your organizations…").start();
      try {
        const { data } = await getClient().rest.orgs.listForAuthenticatedUser({ per_page: 100 });
        spinner.stop();
        printTitle("Your Organizations");
        if (!data.length) { console.log(c.muted("  No organizations.")); return; }
        printTable(
          ["Login", "URL"],
          data.map((o) => [o.login, o.url])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch your organizations.", err);
      }
    });

  // ── org teams ──────────────────────────────────────────────────────────────
  org
    .command("teams <org>")
    .description("List teams in an organization (requires org membership + auth)")
    .action(async (orgName: string) => {
      requireAuth();
      const spinner = ora(`Fetching teams for ${orgName}…`).start();
      try {
        const { data } = await getClient().rest.teams.list({ org: orgName, per_page: 100 });
        spinner.stop();
        printTitle(`Teams — ${orgName}`);
        if (!data.length) { console.log(c.muted("  No teams.")); return; }
        printTable(
          ["Slug", "Name", "Privacy"],
          data.map((t) => [t.slug, t.name, t.privacy ?? "—"])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch teams. Ensure you are a member of this org.", err);
      }
    });

  // ── org events ─────────────────────────────────────────────────────────────
  org
    .command("events <org>")
    .description("List recent public events for an organization")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (orgName: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Fetching events for ${orgName}…`).start();
      try {
        const { data } = await getClient().rest.activity.listPublicOrgEvents({
          org: orgName,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Events — ${orgName}`);
        if (!data.length) { console.log(c.muted("  No events.")); return; }
        printTable(
          ["Type", "Actor", "Repo", "Date"],
          data.slice(0, limit).map((e) => [
            e.type ?? "—",
            e.actor.login,
            e.repo.name,
            formatDate(e.created_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch org events.", err);
      }
    });
}
