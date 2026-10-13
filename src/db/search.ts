import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import Database from "@tauri-apps/plugin-sql";

import { settingsState } from "../util/settings";

interface SearchOpts {
  term: string;
  reading: string;
  limit: number;
  offset: number;
  type: string | null;
}

class SearchDatabase {
  static async init() {
    while (true) {
      if (await exists("search.db", { baseDir: BaseDirectory.AppConfig })) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let db: Database;
    while (true) {
      try {
        db = await Database.load("sqlite:search.db");
        break;
      } catch (e) {
        console.error(e);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return new SearchDatabase(db);
  }

  public dictMap = new Map<string, Database>();

  private constructor(public db: Database) {}

  async search(opts: SearchOpts): Promise<{ items: any[]; next: any }> {
    const start = new Date();
    try {
      if (opts.type === "fts") {
        return await this.search_fts(opts);
      } else {
        return await this.search_main(opts);
      }
    } finally {
      const timeTaken = (+new Date() - +start) / 1000;
      if (timeTaken > 0.1) {
        console.log(
          `Searching ${JSON.stringify(opts)} takes ${timeTaken.toPrecision(2)} seconds`,
        );
      }
    }
  }

  private async search_main({
    term,
    reading,
    limit,
    offset,
    type,
  }: SearchOpts) {
    const [lang] = settingsState.computed.lang.value.split("-");
    const isExact = type === "exact";

    let qTerm = term.toLocaleUpperCase();
    if (!isExact && !qTerm.endsWith(" ")) {
      if (qTerm) qTerm += "*";
    }

    const params: string[] = [];
    if (qTerm) params.push(qTerm);
    if (reading) {
      if (!lang || lang == "zh-CN") {
        reading = await invoke("normalize_reading", { reading });
      }
      params.push(`reading:(${reading.replace(/"/g, " ")})`);
    }
    console.log(params);

    const items = params.length
      ? await this.db.select<{ id: number }[]>(
          /* sql */ `
      SELECT * FROM term_search
      WHERE ${lang ? `term_${lang} IS NOT NULL` : "TRUE"}
        ${qTerm ? `AND term ${isExact ? "=" : "GLOB"} $1` : ""}
        ${reading ? `AND id IN (SELECT rowid FROM term_search_fts ($${params.length}))` : ""}
      ORDER BY score DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `,
          params,
        )
      : [];

    let next: null | number = null;
    if (items.length > limit) {
      items.pop();
      next = offset + limit;
    }

    return { items: await this.expandItems(items), next };
  }

  private async search_fts({ term, reading, limit, offset }: SearchOpts) {
    const lang = settingsState.computed.lang.value;

    const kvs = term.length
      ? (
          await Promise.all(
            (lang ? [lang] : ["ja-JP", "zh-CN", "ko-KR"]).map((subLang) =>
              invoke<string[]>("tokenize", {
                lang: subLang,
                text: term,
              }).then((ts) => [subLang.split("-")[0], ts.join(" ")]),
            ),
          )
        ).filter(([, v]) => v)
      : [];

    let qMatch = kvs
      .map(([k, v]) => `term_${k}:"${v.replace(/"/g, " ")}"`)
      .join(" OR ");

    if (reading) {
      if (!lang || lang == "zh-CN") {
        reading = await invoke("normalize_reading", { reading });
      }
      const qReading = `reading:(${reading})`;
      qMatch = qMatch ? `${qReading} (${qMatch})` : qReading;
    }

    const items = qMatch.length
      ? await this.db.select<{ id: number }[]>(
          /* sql */ `
        SELECT *, rowid id, rank FROM term_search_fts
        WHERE term_search_fts MATCH $1
        ORDER BY rank
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

    return { items: await this.expandItems(items), next };
  }

  private async expandItems(rawItems: { id: number }[]) {
    if (!rawItems.length) return [];

    const sidToRefs = new Map<number, { dict_id: number; term_id: number }[]>();

    const sids = rawItems.map((it) => it.id);
    for (const { dict_id, term_id, search_id } of await this.db.select<
      { dict_id: number; term_id: number; search_id: number }[]
    >(
      `SELECT dict_id, term_id, search_id
      FROM term_link WHERE search_id IN (${sids.map((_, i) => `$${i + 1}`)})`,
      sids,
    )) {
      const refs = sidToRefs.get(search_id) || [];
      refs.push({ dict_id, term_id });
      sidToRefs.set(search_id, refs);
    }

    const entMap = new Map<string, { dict_id: number; term_id: number }>();

    for (const ent of await this.refsToEntries(
      [...sidToRefs.values()].flat(),
    )) {
      entMap.set(
        JSON.stringify({ dict_id: ent.dict_id, term_id: ent.term_id }),
        ent,
      );
    }

    return rawItems.map((it) => {
      const entries = sidToRefs.get(it.id) || [];

      return {
        ...it,
        entries: entries.map(
          (ent) =>
            entMap.get(
              JSON.stringify({ dict_id: ent.dict_id, term_id: ent.term_id }),
            ) || ent,
        ),
      };
    });
  }

  private async refsToEntries(
    refs: { dict_id: number; term_id: number }[],
  ): Promise<{ dict_id: number; term_id: number }[]> {
    if (!refs.length) return [];

    const dictTermIdsMap = new Map<number, Set<number>>();

    for (const r of refs) {
      const termIds = dictTermIdsMap.get(r.dict_id) || new Set();
      termIds.add(r.term_id);
      dictTermIdsMap.set(r.dict_id, termIds);
    }

    const dictIds = [...dictTermIdsMap.keys()];
    const out: { dict_id: number; term_id: number; score: number | null }[] =
      [];

    for (const r of await this.db.select<{ id: number; path: string }[]>(
      `SELECT id, "path" FROM "index" WHERE id IN (${dictIds.map((_, i) => `$${i + 1}`)})`,
      dictIds,
    )) {
      const dictDB =
        this.dictMap.get(r.path) ||
        (await Database.load(`sqlite:${r.path}/content.db`));

      const termIds = Array.from(dictTermIdsMap.get(r.id) || []);
      const terms = await dictDB.select<
        { term_id: number; score: number | null }[]
      >(
        `SELECT rowid term_id, * FROM term WHERE rowid IN (${termIds.map((_, i) => `$${i + 1}`)})`,
        termIds,
      );
      out.push(...terms.map((t) => ({ dict_id: r.id, ...t })));
    }

    return out;
  }
}

export const searchDB = await SearchDatabase.init();
