import { invoke } from "@tauri-apps/api/core";
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

  async search(opts: {
    term: string;
    limit: number;
    offset: number;
  }): Promise<{ items: any[]; next: any }> {
    const isFTS = /^[~～]/.test(opts.term);

    if (isFTS) {
      opts.term = opts.term.slice(1);
    }

    if (!opts.term.length) return { items: [], next: null };

    if (isFTS) {
      return this.search_fts(opts);
    } else {
      return this.search_like(opts);
    }
  }

  private async search_like({
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
      ORDER BY score DESC
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

  private async search_fts({
    term,
    limit,
    offset,
  }: {
    term: string;
    limit: number;
    offset: number;
  }) {
    const vLang = settingsState.computed.lang.value;
    const langs = vLang ? [vLang] : ["ja-JP", "zh-CN", "ko-KR"];
    term = term.replace(/['"]/g, " ");

    const term_langs = await Promise.all(
      langs.map((ln) =>
        invoke<string[]>("tokenize", {
          lang: ln,
          text: term,
        }).then((s) => s.join(" ")),
      ),
    );

    const items = await this.db.select<{}[]>(
      /* sql */ `SELECT * FROM term
      WHERE ${langs.map((ln, i) => `term_${ln} LIKE '% '||$${i + 1}||' %'`).join(" OR ")}
      ORDER BY score DESC
      LIMIT $${langs.length + 1} OFFSET ${langs.length + 2}
    `,
      [...term_langs, limit + 1, offset],
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
