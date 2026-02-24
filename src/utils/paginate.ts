import inquirer from "inquirer";
import { c } from "./display.js";

export const DEFAULT_PER_PAGE = 30;

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
  nextPage: number;
}

/**
 * Interactive "load more" loop.
 *
 * Usage:
 *   let page = 1;
 *   do {
 *     const { items, hasMore } = await fetchPage(page, perPage);
 *     renderItems(items);
 *     if (!hasMore) break;
 *     page++;
 *   } while (await askLoadMore());
 */
export async function askLoadMore(): Promise<boolean> {
  const { more } = await inquirer.prompt<{ more: boolean }>([
    {
      type: "confirm",
      name: "more",
      message: "Load next page?",
      default: false,
    },
  ]);
  return more;
}

/** Print a small pager status line */
export function printPageInfo(page: number, count: number, perPage: number) {
  const showing = (page - 1) * perPage + count;
  console.log(c.muted(`\n  Page ${page} · showing ${showing} total · ${count} on this page`));
}
