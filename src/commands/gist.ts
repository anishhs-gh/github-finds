import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getClient, requireAuth } from "../api/client.js";
import {
  printTitle, printKeyValue, printTable, printError, printSuccess,
  printSection, c, formatDate, truncate,
} from "../utils/display.js";

export function registerGist(program: Command) {
  const gist = program.command("gist").description("Gist commands");

  // ── gist list ──────────────────────────────────────────────────────────────
  gist
    .command("list")
    .description("List your gists (requires auth)")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (opts) => {
      requireAuth();
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching your gists…").start();
      try {
        const { data } = await getClient().rest.gists.list({ per_page: Math.min(limit, 100) });
        spinner.stop();
        printTitle("Your Gists");
        if (!data.length) { console.log(c.muted("  No gists.")); return; }
        printTable(
          ["ID", "Description", "Files", "Public", "Updated"],
          data.slice(0, limit).map((g) => [
            g.id.slice(0, 12),
            truncate(g.description ?? "(no description)", 45),
            Object.keys(g.files ?? {}).length,
            g.public ? c.ok("yes") : c.warn("secret"),
            formatDate(g.updated_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch gists.", err);
      }
    });

  // ── gist view ──────────────────────────────────────────────────────────────
  gist
    .command("view <id>")
    .description("View the contents of a gist")
    .action(async (id: string) => {
      const spinner = ora(`Fetching gist ${id}…`).start();
      try {
        const { data: g } = await getClient().rest.gists.get({ gist_id: id });
        spinner.stop();
        printTitle(`Gist — ${g.description ?? id}`);
        printKeyValue([
          ["ID", g.id],
          ["Owner", g.owner?.login ?? "—"],
          ["Public", g.public],
          ["Forks", g.forks_url],
          ["Created", formatDate(g.created_at)],
          ["Updated", formatDate(g.updated_at)],
          ["URL", g.html_url],
        ]);
        if (g.files) {
          for (const [filename, file] of Object.entries(g.files)) {
            if (!file) continue;
            printSection(filename);
            console.log(c.muted(`  Language: ${file.language ?? "unknown"}  |  Size: ${file.size} bytes`));
            console.log("\n" + (file.content ?? "(content unavailable)") + "\n");
          }
        }
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not fetch gist "${id}".`, err);
      }
    });

  // ── gist create ────────────────────────────────────────────────────────────
  gist
    .command("create")
    .description("Create a new gist (requires auth)")
    .option("-f, --file <filename>", "Filename")
    .option("-d, --description <desc>", "Gist description")
    .option("--public", "Make the gist public", false)
    .action(async (opts) => {
      requireAuth();
      let { file: filename, description } = opts;

      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "filename",
          message: "Filename (e.g. snippet.py):",
          when: !filename,
          validate: (v: string) => v.trim() ? true : "Required",
        },
        {
          type: "input",
          name: "description",
          message: "Description (optional):",
          when: !description,
        },
        {
          type: "editor",
          name: "content",
          message: "Gist content (opens editor):",
          validate: (v: string) => v.trim() ? true : "Content cannot be empty",
        },
        {
          type: "confirm",
          name: "isPublic",
          message: "Make this gist public?",
          default: false,
          when: !opts.public,
        },
      ]);

      filename = filename ?? answers.filename;
      description = description ?? answers.description ?? "";
      const content = answers.content;
      const isPublic = opts.public || answers.isPublic;

      const spinner = ora("Creating gist…").start();
      try {
        const { data: g } = await getClient().rest.gists.create({
          description,
          public: isPublic,
          files: {
            [filename]: { content },
          },
        });
        spinner.succeed(`Gist created: ${c.link(g.html_url ?? "")}`);
        printKeyValue([
          ["ID", g.id],
          ["Public", g.public],
        ]);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not create gist.", err);
      }
    });

  // ── gist star ──────────────────────────────────────────────────────────────
  gist
    .command("star <id>")
    .description("Star a gist (requires auth)")
    .action(async (id: string) => {
      requireAuth();
      const spinner = ora(`Starring gist ${id}…`).start();
      try {
        await getClient().rest.gists.star({ gist_id: id });
        spinner.succeed(`Gist ${c.ok(id)} starred`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not star gist.", err);
      }
    });

  // ── gist unstar ────────────────────────────────────────────────────────────
  gist
    .command("unstar <id>")
    .description("Unstar a gist (requires auth)")
    .action(async (id: string) => {
      requireAuth();
      const spinner = ora(`Unstarring gist ${id}…`).start();
      try {
        await getClient().rest.gists.unstar({ gist_id: id });
        spinner.succeed(`Gist ${c.ok(id)} unstarred`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not unstar gist.", err);
      }
    });

  // ── gist delete ────────────────────────────────────────────────────────────
  gist
    .command("delete <id>")
    .description("Delete a gist (requires auth)")
    .action(async (id: string) => {
      requireAuth();
      const { confirm } = await inquirer.prompt([{
        type: "confirm",
        name: "confirm",
        message: `Delete gist ${c.warn(id)}? This cannot be undone.`,
        default: false,
      }]);
      if (!confirm) { console.log(c.muted("Aborted.")); return; }
      const spinner = ora("Deleting gist…").start();
      try {
        await getClient().rest.gists.delete({ gist_id: id });
        spinner.succeed(`Gist ${c.ok(id)} deleted`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not delete gist.", err);
      }
    });

  // ── gist forks ─────────────────────────────────────────────────────────────
  gist
    .command("forks <id>")
    .description("List forks of a gist")
    .action(async (id: string) => {
      const spinner = ora(`Fetching forks of gist ${id}…`).start();
      try {
        const { data } = await getClient().rest.gists.listForks({ gist_id: id });
        spinner.stop();
        printTitle(`Forks — Gist ${id}`);
        if (!data.length) { console.log(c.muted("  No forks.")); return; }
        printTable(
          ["ID", "Owner", "Created"],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((f) => [f.id?.slice(0, 12) ?? "—", (f.user as any)?.login ?? "—", formatDate(f.created_at)])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch gist forks.", err);
      }
    });

  // ── gist fork ──────────────────────────────────────────────────────────────
  gist
    .command("fork <id>")
    .description("Fork a gist (requires auth)")
    .action(async (id: string) => {
      requireAuth();
      const spinner = ora(`Forking gist ${id}…`).start();
      try {
        const { data: g } = await getClient().rest.gists.fork({ gist_id: id });
        spinner.succeed(`Forked gist: ${c.link(g.html_url ?? "")}`);
        printKeyValue([["New ID", g.id]]);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fork gist.", err);
      }
    });
}
