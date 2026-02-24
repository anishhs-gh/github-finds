import { Command } from "commander";
import ora from "ora";
import { getClient, requireAuth } from "../api/client.js";
import { printTitle, printKeyValue, printTable, printError, c, formatDate } from "../utils/display.js";

export function registerKeys(program: Command) {
  const keys = program.command("keys").description("SSH and GPG key commands (requires auth)");

  // ── keys ssh ───────────────────────────────────────────────────────────────
  keys
    .command("ssh")
    .description("List your SSH keys")
    .action(async () => {
      requireAuth();
      const spinner = ora("Fetching SSH keys…").start();
      try {
        const { data } = await getClient().rest.users.listPublicSshKeysForAuthenticated();
        spinner.stop();
        printTitle("Your SSH Keys");
        if (!data.length) { console.log(c.muted("  No SSH keys.")); return; }
        for (const key of data) {
          console.log(`\n  ${c.ok(key.title)}  ${c.muted(`ID: ${key.id}  Added: ${formatDate(key.created_at)}`)}`);
          console.log(`  ${c.muted(key.key.slice(0, 80) + "…")}`);
          if (key.verified !== undefined) {
            console.log(`  Verified: ${key.verified ? c.ok("yes") : c.err("no")}`);
          }
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch SSH keys. Ensure your token has admin:public_key scope.", err);
      }
    });

  // ── keys gpg ───────────────────────────────────────────────────────────────
  keys
    .command("gpg")
    .description("List your GPG keys")
    .action(async () => {
      requireAuth();
      const spinner = ora("Fetching GPG keys…").start();
      try {
        const { data } = await getClient().rest.users.listGpgKeysForAuthenticated();
        spinner.stop();
        printTitle("Your GPG Keys");
        if (!data.length) { console.log(c.muted("  No GPG keys.")); return; }
        printTable(
          ["ID", "Key ID", "Emails", "Created", "Expires"],
          data.map((k) => [
            k.id,
            k.key_id,
            k.emails.map((e) => e.email).join(", "),
            formatDate(k.created_at),
            k.expires_at ? formatDate(k.expires_at) : c.muted("never"),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch GPG keys. Ensure your token has admin:gpg_key scope.", err);
      }
    });

  // ── keys emails ────────────────────────────────────────────────────────────
  keys
    .command("emails")
    .description("List your verified email addresses")
    .action(async () => {
      requireAuth();
      const spinner = ora("Fetching emails…").start();
      try {
        const { data } = await getClient().rest.users.listEmailsForAuthenticated();
        spinner.stop();
        printTitle("Your Emails");
        printTable(
          ["Email", "Primary", "Verified", "Visibility"],
          data.map((e) => [
            e.email,
            e.primary ? c.ok("yes") : "no",
            e.verified ? c.ok("yes") : c.err("no"),
            e.visibility ?? "—",
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch emails. Ensure your token has user scope.", err);
      }
    });
}
