import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import Database from "@tauri-apps/plugin-sql";

import { settingsState } from "../util/settings";

class SearchDatabase {
  static async init() {
    while (true) {
      if (await exists("search.db", { baseDir: BaseDirectory.AppConfig })) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    while (true) {
      try {
        const db = await Database.load("sqlite:search.db");
        return new SearchDatabase(db);
      } catch (e) {
        console.error(e);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  private constructor(public db: Database) {}

  async search({
    term,
    limit,
    offset,
  }: {
    term: string;
    limit: number;
    offset: number;
  }) {
    const [lang] = settingsState.computed.lang.value.split("-");

    const items = await this.db.select<{}[]>(
      /* sql */ `
      SELECT * FROM term
      WHERE ${lang ? `term_${lang} IS NOT NULL` : "TRUE"}
        AND term LIKE $1||'%'
      LIMIT $2 OFFSET $3
    `,
      [term, limit + 1, offset],
    );

    let next: null | number = null;
    if (items.length > limit) {
      items.pop();
      next = offset + limit;
    }

    return { items, next };
  }
}

export const searchDB = await SearchDatabase.init();
