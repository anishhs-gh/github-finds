import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getToken, setToken, clearToken, getConfigPath } from "../utils/config.js";
import { resetClient, getClient } from "../api/client.js";
import { printSuccess, printError, printKeyValue, printTitle, c, formatDate } from "../utils/display.js";

export function registerAuth(program: Command) {
  const auth = program.command("auth").description("Manage GitHub authentication");

  // ── auth login ─────────────────────────────────────────────────────────────
  auth
    .command("login")
    .description("Authenticate with a GitHub Personal Access Token (PAT)")
    .option("--token <token>", "Pass token directly (non-interactive)")
    .action(async (opts) => {
      let token: string = opts.token ?? "";

      if (!token) {
        console.log(c.muted(`\nCreate a token at: ${c.link("https://github.com/settings/tokens")}`));
        console.log(
          c.muted("Recommended scopes: repo, read:user, user:follow, gist, read:org, workflow, admin:public_key, admin:gpg_key\n")
        );
        const answers = await inquirer.prompt([
          {
            type: "password",
            name: "token",
            message: "Paste your GitHub Personal Access Token:",
            mask: "*",
            validate: (v: string) => (v.trim().length > 0 ? true : "Token cannot be empty"),
          },
        ]);
        token = answers.token.trim();
      }

      const spinner = ora("Verifying token…").start();
      try {
        resetClient();
        // Temporarily store so getClient can use it
        setToken(token);
        resetClient();
        const { data } = await getClient().rest.users.getAuthenticated();
        spinner.succeed(`Logged in as ${c.ok(data.login)}`);
        printKeyValue([
          ["Name", data.name ?? ""],
          ["Email", data.email ?? "(private)"],
          ["Account type", data.type],
          ["Config file", getConfigPath()],
        ]);
      } catch (err) {
        clearToken();
        resetClient();
        spinner.fail("Authentication failed");
        printError("Invalid token or insufficient scopes.", err);
        process.exit(1);
      }
    });

  // ── auth logout ────────────────────────────────────────────────────────────
  auth
    .command("logout")
    .description("Remove stored authentication token")
    .action(() => {
      if (!getToken()) {
        console.log(c.muted("Not logged in."));
        return;
      }
      clearToken();
      resetClient();
      printSuccess("Logged out — token removed from local storage.");
    });

  // ── auth status ────────────────────────────────────────────────────────────
  auth
    .command("status")
    .description("Show current authentication status and token scopes")
    .action(async () => {
      const token = getToken();
      if (!token) {
        console.log(c.err("✖  Not authenticated.") + c.muted("  Run `ghf auth login` first."));
        return;
      }

      const spinner = ora("Fetching auth status…").start();
      try {
        const response = await getClient().rest.users.getAuthenticated();
        const { data } = response;
        const scopes = (response.headers as Record<string, string | undefined>)["x-oauth-scopes"] ?? "(none listed)";
        spinner.stop();
        printTitle("Authentication Status");
        printKeyValue([
          ["Status", "✔ Authenticated"],
          ["Login", data.login],
          ["Name", data.name ?? ""],
          ["Email", data.email ?? "(private)"],
          ["Account type", data.type],
          ["Public repos", data.public_repos],
          ["Private repos", data.total_private_repos ?? 0],
          ["Member since", formatDate(data.created_at)],
          ["Token scopes", scopes],
          ["Config file", getConfigPath()],
        ]);
      } catch (err) {
        spinner.fail("Failed to fetch auth status");
        printError("Token may be expired or invalid.", err);
      }
    });
}
