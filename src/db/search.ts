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
    const originalTerm = opts.term;
    const isFTS = /^[~～]/.test(opts.term);

    if (isFTS) {
      opts.term = opts.term.slice(1);
    }

    if (!opts.term.length) return { items: [], next: null };

    const start = new Date();
    try {
      if (isFTS) {
        return await this.search_fts(opts);
      } else {
        return await this.search_like(opts);
      }
    } finally {
      const timeTaken = (+new Date() - +start) / 1000;
      if (timeTaken > 0.1) {
        console.log(
          `Searching [${originalTerm}] takes ${timeTaken.toPrecision(2)} seconds`,
        );
      }
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

    const qTerm = term.toLocaleUpperCase() + "*";

    const items = await this.db.select<{}[]>(
      /* sql */ `
      SELECT * FROM term
      WHERE ${lang ? `term_${lang} IS NOT NULL` : "TRUE"}
        AND term GLOB $1
      ORDER BY score DESC
      LIMIT $2 OFFSET $3
    `,
      [qTerm, limit + 1, offset],
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

    const kvs = (
      await Promise.all(
        (vLang ? [vLang] : ["ja-JP", "zh-CN", "ko-KR"]).map((lang) =>
          invoke<string[]>("tokenize", {
            lang,
            text: term,
          }).then((ts) => [lang.split("-")[0], ts.join(" ")]),
        ),
      )
    ).filter(([, v]) => v);

    const qMatch = kvs
      .map(([k, v]) => `term_${k}:"${v.replace(/"/g, " ")}"`)
      .join(" OR ");

    const items = kvs.length
      ? await this.db.select<{}[]>(
          /* sql */ `SELECT * FROM term_fts
      WHERE term_fts MATCH $1
      LIMIT $2 OFFSET $3
    `,
          [qMatch, limit + 1, offset],
        )
      : [];

    let next: null | number = null;
    if (items.length > limit) {
      items.pop();
      next = offset + limit;
    }

    return { items, next };
  }
}

export const searchDB = await SearchDatabase.init();
