import { Command } from "commander";
import ora from "ora";
import { getClient, requireAuth } from "../api/client.js";
import {
  printTitle, printKeyValue, printTable, printError, printSection,
  c, formatDate, truncate, pluralize, stateBadge,
} from "../utils/display.js";

export function registerUser(program: Command) {
  const user = program.command("user").description("User profile commands");

  // ── user view <username> ───────────────────────────────────────────────────
  user
    .command("view <username>")
    .description("View a user's public profile")
    .action(async (username: string) => {
      const spinner = ora(`Fetching profile for ${username}…`).start();
      try {
        const { data: u } = await getClient().rest.users.getByUsername({ username });
        spinner.stop();
        printTitle(`${u.login}${u.name ? `  (${u.name})` : ""}`);
        printKeyValue([
          ["Type", u.type],
          ["Bio", u.bio ?? ""],
          ["Company", u.company ?? ""],
          ["Location", u.location ?? ""],
          ["Email", u.email ?? "(private)"],
          ["Blog", u.blog ?? ""],
          ["Twitter", u.twitter_username ? `@${u.twitter_username}` : ""],
          ["Public repos", u.public_repos],
          ["Public gists", u.public_gists],
          ["Followers", u.followers],
          ["Following", u.following],
          ["Member since", formatDate(u.created_at)],
          ["Profile URL", u.html_url],
        ]);
      } catch (err) {
        spinner.fail("Failed to fetch user");
        printError(`User "${username}" not found.`, err);
      }
    });

  // ── user me ────────────────────────────────────────────────────────────────
  user
    .command("me")
    .description("View your own profile (requires auth)")
    .action(async () => {
      requireAuth();
      const spinner = ora("Fetching your profile…").start();
      try {
        const { data: u } = await getClient().rest.users.getAuthenticated();
        spinner.stop();
        printTitle(`${u.login}${u.name ? `  (${u.name})` : ""}`);
        printKeyValue([
          ["Type", u.type],
          ["Bio", u.bio ?? ""],
          ["Company", u.company ?? ""],
          ["Location", u.location ?? ""],
          ["Email", u.email ?? "(private)"],
          ["Blog", u.blog ?? ""],
          ["Twitter", u.twitter_username ? `@${u.twitter_username}` : ""],
          ["Plan", u.plan?.name ?? ""],
          ["Public repos", u.public_repos],
          ["Private repos", u.total_private_repos ?? 0],
          ["Owned private repos", u.owned_private_repos ?? 0],
          ["Public gists", u.public_gists],
          ["Private gists", u.private_gists ?? 0],
          ["Followers", u.followers],
          ["Following", u.following],
          ["2FA enabled", ("two_factor_authentication" in u ? u.two_factor_authentication : false) as boolean],
          ["Member since", formatDate(u.created_at)],
          ["Profile URL", u.html_url],
        ]);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch your profile.", err);
      }
    });

  // ── user followers <username> ──────────────────────────────────────────────
  user
    .command("followers <username>")
    .description("List followers of a user")
    .option("-l, --limit <n>", "Max results", "30")
    .action(async (username: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Fetching followers of ${username}…`).start();
      try {
        const { data } = await getClient().rest.users.listFollowersForUser({
          username,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Followers of ${username}`);
        if (!data.length) { console.log(c.muted("  No followers.")); return; }
        printTable(
          ["Login", "Type", "Profile URL"],
          data.slice(0, limit).map((u) => [u.login, u.type, u.html_url])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch followers.", err);
      }
    });

  // ── user following <username> ──────────────────────────────────────────────
  user
    .command("following <username>")
    .description("List users that a user follows")
    .option("-l, --limit <n>", "Max results", "30")
    .action(async (username: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Fetching following list for ${username}…`).start();
      try {
        const { data } = await getClient().rest.users.listFollowingForUser({
          username,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`${username} is following`);
        if (!data.length) { console.log(c.muted("  Not following anyone.")); return; }
        printTable(
          ["Login", "Type", "Profile URL"],
          data.slice(0, limit).map((u) => [u.login, u.type, u.html_url])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch following list.", err);
      }
    });

  // ── user orgs <username> ───────────────────────────────────────────────────
  user
    .command("orgs <username>")
    .description("List public organizations of a user")
    .action(async (username: string) => {
      const spinner = ora(`Fetching orgs for ${username}…`).start();
      try {
        const { data } = await getClient().rest.orgs.listForUser({ username, per_page: 100 });
        spinner.stop();
        printTitle(`Organizations — ${username}`);
        if (!data.length) { console.log(c.muted("  No public organizations.")); return; }
        printTable(
          ["Login", "URL"],
          data.map((o) => [o.login, o.url])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch organizations.", err);
      }
    });

  // ── user gists <username> ──────────────────────────────────────────────────
  user
    .command("gists <username>")
    .description("List public gists of a user")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (username: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Fetching gists for ${username}…`).start();
      try {
        const { data } = await getClient().rest.gists.listForUser({ username, per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle(`Gists — ${username}`);
        if (!data.length) { console.log(c.muted("  No public gists.")); return; }
        printTable(
          ["ID", "Description", "Files", "Updated"],
          data.slice(0, limit).map((g) => [
            g.id.slice(0, 12),
            truncate(g.description ?? "(no description)", 50),
            Object.keys(g.files ?? {}).length,
            formatDate(g.updated_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch gists.", err);
      }
    });

  // ── user stars <username> ──────────────────────────────────────────────────
  user
    .command("stars <username>")
    .description("List repos starred by a user")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (username: string, opts) => {
      const limit = parseInt(opts.limit, 10);
      const spinner = ora(`Fetching starred repos for ${username}…`).start();
      try {
        const { data } = await getClient().rest.activity.listReposStarredByUser({
          username,
          per_page: Math.min(limit, 100),
        });
        spinner.stop();
        printTitle(`Starred Repos — ${username}`);
        if (!data.length) { console.log(c.muted("  No starred repos.")); return; }
        const repos = data as Array<{ full_name: string; description: string | null; stargazers_count?: number; language: string | null }>;
        printTable(
          ["Repo", "Description", "Stars", "Language"],
          repos.slice(0, limit).map((r) => [
            r.full_name,
            truncate(r.description ?? "", 45),
            r.stargazers_count ?? 0,
            r.language ?? "—",
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch starred repos.", err);
      }
    });

  // ── user follow <username> ─────────────────────────────────────────────────
  user
    .command("follow <username>")
    .description("Follow a user (requires auth)")
    .action(async (username: string) => {
      requireAuth();
      const spinner = ora(`Following ${username}…`).start();
      try {
        await getClient().rest.users.follow({ username });
        spinner.succeed(`Now following ${c.ok(username)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not follow ${username}.`, err);
      }
    });

  // ── user unfollow <username> ───────────────────────────────────────────────
  user
    .command("unfollow <username>")
    .description("Unfollow a user (requires auth)")
    .action(async (username: string) => {
      requireAuth();
      const spinner = ora(`Unfollowing ${username}…`).start();
      try {
        await getClient().rest.users.unfollow({ username });
        spinner.succeed(`Unfollowed ${c.ok(username)}`);
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not unfollow ${username}.`, err);
      }
    });

  // ── user keys <username> ────────────────────────────────────────────────────
  user
    .command("keys <username>")
    .description("List public SSH keys of a user")
    .action(async (username: string) => {
      const spinner = ora(`Fetching SSH keys for ${username}…`).start();
      try {
        const { data } = await getClient().rest.users.listPublicKeysForUser({ username });
        spinner.stop();
        printTitle(`Public SSH Keys — ${username}`);
        if (!data.length) { console.log(c.muted("  No public keys.")); return; }
        for (const key of data) {
          console.log(`\n${c.key(`ID:`)} ${key.id}`);
          console.log(c.muted(key.key.slice(0, 80) + "…"));
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch SSH keys.", err);
      }
    });

  // ── user notifications ──────────────────────────────────────────────────────
  user
    .command("notifications")
    .description("List your unread notifications (requires auth)")
    .option("-a, --all", "Include read notifications", false)
    .action(async (opts) => {
      requireAuth();
      const spinner = ora("Fetching notifications…").start();
      try {
        const { data } = await getClient().rest.activity.listNotificationsForAuthenticatedUser({
          all: opts.all,
          per_page: 50,
        });
        spinner.stop();
        printTitle("Notifications");
        if (!data.length) { console.log(c.muted("  No notifications.")); return; }
        printTable(
          ["Type", "Repo", "Subject", "Updated"],
          data.map((n) => [
            n.subject.type,
            n.repository.full_name,
            truncate(n.subject.title, 50),
            formatDate(n.updated_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch notifications.", err);
      }
    });
}
