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

  async migrate() {
    await this.db.execute(/* sql */ `
      CREATE TABLE IF NOT EXISTS term_search (
        term        TEXT NOT NULL,
        term_ja     TEXT CHECK (term_ja   LIKE ' %_ '),
        term_zh     TEXT CHECK (term_zh   LIKE ' %_ '),
        term_ko     TEXT CHECK (term_ko   LIKE ' %_ '),

        reading     TEXT CHECK (reading   LIKE ' %_ '), -- could be helpful for ' Pin[1-5] Yin[1-5] '

        def_tags    TEXT CHECK (def_tags  LIKE ' %_ '), -- space-separated, accept NULL
        rules       TEXT CHECK (rules     LIKE ' %_ '),
        score       INTEGER,

        tags        TEXT CHECK (tags      LIKE ' %_ '),

        ref         TEXT_JSON NOT NULL                  -- { dict_id: u64, term_id: u64, score: int | null }[]
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_u_term_search ON term_search (
        term, reading,
        (term_ja IS NULL), (term_zh IS NULL), (term_ko IS NULL)
      );
    `);

    const searchCols = [
      "term",
      "term_ja",
      "term_zh",
      "term_ko",
      "reading",
      "def_tags",
      "rules",
      "score",
      "tags",
      "ref",
    ];

    const virtualTableSQL = createVirtualTableSQL(
      "term_search",
      searchCols,
      ["term", "score", "ref"],
      "IF NOT EXISTS",
    );

    console.log(virtualTableSQL);
    await this.db.execute(virtualTableSQL);

    // const label = "load into term_search_fts";
    // console.time(label);

    // const doUpdateSpaceSep = (c: string) => /* sql */ `
    //   "${c}" = IIF("${c}" = excluded.${c}, "${c}",
    //     NULLIF(TRIM(FORMAT(' %s %s ', TRIM("${c}"), TRIM(excluded.${c}))), ''))`;

    // try {
    //   const cols = searchCols.filter((c) => c !== "ref");
    //   await this.db.execute(/* sql */ `
    //   INSERT INTO term_search (${cols.map((c) => `"${c}"`)}, ref)
    //   SELECT ${cols.map((c) => `"${c}"`)},
    //     json_array(json_object('dict_id', index_rowid, 'term_id', term_rowid, 'score', score))
    //   FROM term
    //   WHERE TRUE
    //   ON CONFLICT DO UPDATE SET
    //     ${["def_tags", "rules", "tags"].map((c) => doUpdateSpaceSep(c))},
    //     score = IIF(IFNULL(excluded.score, 0) > IFNULL("score", 0), excluded.score, "score"),
    //     ref = json_insert(ref, '$[#]', json_extract(excluded.ref, '$[0]'))
    //   ;
    // `);
    // } finally {
    //   console.timeEnd(label);
    // }
  }

  async search(opts: {
    term: string;
    limit: number;
    offset: number;
    type: string | null;
  }): Promise<{ items: any[]; next: any }> {
    if (!opts.term.length) return { items: [], next: null };

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
          `Searching [${opts.term}] takes ${timeTaken.toPrecision(2)} seconds`,
        );
      }
    }
  }

  private async search_main({
    term,
    limit,
    offset,
    type,
  }: {
    term: string;
    limit: number;
    offset: number;
    type: string | null;
  }) {
    const [lang] = settingsState.computed.lang.value.split("-");

    let qTerm = term.toLocaleUpperCase();
    if (!type && !qTerm.endsWith(" ")) {
      qTerm += "*";
    }

    const items = await this.db.select<{ ref: string }[]>(
      /* sql */ `
      SELECT * FROM term_search
      WHERE ${lang ? `term_${lang} IS NOT NULL` : "TRUE"}
        AND term ${type ? "=" : "GLOB"} $1
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

    return { items: await this.expandItems(items), next };
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
      ? await this.db.select<{ ref: string }[]>(
          /* sql */ `
        SELECT *, rank FROM term_search_fts
        WHERE term_search_fts MATCH $1
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

  private async expandItems(rawItems: { ref: string }[]) {
    const refs: { dict_id: number; term_id: number }[] = [];
    const entMap = new Map<string, { dict_id: number; term_id: number }>();

    const items = rawItems.map(({ ref, ...it }) => {
      const entries: { dict_id: number; term_id: number }[] = JSON.parse(ref);
      refs.push(
        ...entries.map(({ dict_id, term_id }) => ({ dict_id, term_id })),
      );
      return { ...it, entries };
    });

    for (const ent of await this.refsToEntries(refs)) {
      entMap.set(
        JSON.stringify({ dict_id: ent.dict_id, term_id: ent.term_id }),
        ent,
      );
    }

    return items.map(({ entries, ...it }) => ({
      ...it,
      entries: entries.map(
        (ent) =>
          entMap.get(
            JSON.stringify({ dict_id: ent.dict_id, term_id: ent.term_id }),
          ) || ent,
      ),
    }));
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

    for (const r of await this.db.select<{ rowid: number; path: string }[]>(
      `SELECT rowid, "path" FROM "index" WHERE rowid IN (${dictIds.map((_, i) => `$${i + 1}`)})`,
      dictIds,
    )) {
      const dictDB =
        this.dictMap.get(r.path) ||
        (await Database.load(`sqlite:${r.path}/content.db`));

      const termIds = Array.from(dictTermIdsMap.get(r.rowid)!);
      const terms = await dictDB.select<
        { term_id: number; score: number | null }[]
      >(
        `SELECT rowid term_id, * FROM term WHERE rowid IN (${termIds.map((_, i) => `$${i + 1}`)})`,
        termIds,
      );
      out.push(...terms.map((t) => ({ dict_id: r.rowid, ...t })));
    }

    return out;
  }
}

export const searchDB = await SearchDatabase.init();

function createVirtualTableSQL(
  tableName: string,
  cols: string[],
  unindexed: string[],
  ifNotExists = "",
) {
  const sql = [
    `
CREATE VIRTUAL TABLE ${ifNotExists} ${tableName}_fts USING fts5 (
  ${cols.map((c) => `\n  "${c}"${unindexed.includes(c) ? "  UNINDEXED" : ""}`)},
  content='${tableName}',
  tokenize="unicode61 tokenchars '-'"
);
`,
  ];

  const insertSQL = `
  INSERT INTO ${tableName}_fts (
    ${cols.filter((c) => !unindexed.includes(c)).map((c) => `"${c}"`)},
    rowid
  ) VALUES (
    ${cols.filter((c) => !unindexed.includes(c)).map((c) => `new.${c}`)},
    new.rowid
  );
`;

  const deleteSQL = `
  INSERT INTO ${tableName}_fts (
    ${cols.filter((c) => !unindexed.includes(c)).map((c) => `"${c}"`)},
    rowid, ${tableName}_fts
  ) VALUES (
    ${cols.filter((c) => !unindexed.includes(c)).map((c) => `old.${c}`)},
    old.rowid, 'delete'
  );
`;

  sql.push(`
CREATE TRIGGER ${ifNotExists} t_${tableName}_after_insert
AFTER INSERT ON "${tableName}"
BEGIN
${insertSQL}
END;
`);

  sql.push(`
CREATE TRIGGER ${ifNotExists} t_${tableName}_after_delete
AFTER DELETE ON "${tableName}"
BEGIN
${deleteSQL}
END;
`);

  sql.push(`
CREATE TRIGGER ${ifNotExists} t_${tableName}_after_update
AFTER UPDATE ON "${tableName}"
BEGIN
${deleteSQL}
${insertSQL}
END;
`);

  return sql.join("\n");
}
