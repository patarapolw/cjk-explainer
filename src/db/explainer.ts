import Database from "@tauri-apps/plugin-sql";

import { supabase } from "../util/supabase";

import type { IDBSync } from "./sync";

interface IExplainer {
  text: string;
  explanation: string;
  lang: string;
}

const explainerCols = [
  "text",
  "explanation",
  "lang",
] as const satisfies readonly (keyof IExplainer)[];

const dbExplainer = await Database.load("sqlite:explainer.db");

export async function getExplanation({
  text,
  lang,
}: {
  text: string;
  lang: string;
}) {
  const [r] = await dbExplainer.select<IExplainer[]>(
    `SELECT "explanation" FROM explainer WHERE lang = $1 AND "text" = $2 LIMIT 1`,
    [lang, text],
  );

  return r?.explanation || null;
}

export async function saveExplanation({
  text,
  lang,
  explanation,
}: {
  text: string;
  lang: string;
  explanation: string;
}) {
  const id = crypto.randomUUID();
  const updated_at = Date.now();

  const cols = [...explainerCols, "id", "updated_at", "sync_status"];

  await dbExplainer.execute(
    `
    INSERT INTO explainer (${cols.map((c) => `"${c}"`)})
    VALUES (${cols.map((_, i) => `$${i + 1}`)})
    ON CONFLICT ("text", lang)
    DO UPDATE SET
      ${cols.filter((c) => !["id", "text", "lang"].includes(c)).map((c) => `"${c}" = excluded.${c}`)}
      -- do not update id UUID, so as not to break sync id
    `,
    [
      ...[text, explanation, lang], // cols
      ...[id, updated_at, "pending"], // syncCols
    ],
  );

  // rowid will correctly reference new or old id UUID for sync
  const rows = await dbExplainer.select<{ rowid: number }[]>(
    `SELECT rowid FROM explainer WHERE text = $1 AND lang = $2`,
    [text, lang],
  );

  // error will be thrown in console, but doesn't crash the function
  pushExplanation(rows).catch((e) => console.error(e));

  return id;
}

// *** SYNC logic per table

async function pushExplanation(rows: { rowid: number }[]) {
  if (!supabase) return;

  const fullRows = await dbExplainer.select<(IExplainer & IDBSync)[]>(
    `SELECT * FROM explainer WHERE rowid IN (${rows.map((r) => r.rowid)})`,
  );
  if (!fullRows.length) return;

  const user_id = await supabase.auth.getUser().then((u) => u.data.user?.id);

  const toBeUpserted = fullRows.map(({ sync_status, ...row }) => {
    return {
      ...row,
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
      user_id,
    };
  });

  const { error } = await supabase
    .from("explainer")
    .upsert(toBeUpserted as any, { onConflict: `user_id,text,lang` }); // TODO: proper typing from Supabase CLI

  if (error) throw error;

  await dbExplainer.execute(`
    WITH t (id, updated_at, deleted_at) AS (
      VALUES ${toBeUpserted.map((r) => `('${r.id}', ${+r.updated_at}, ${r.deleted_at ? +r.deleted_at : "NULL"})`)}
    )
    UPDATE explainer SET
      sync_status = 'synced',
      updated_at = t.updated_at,
      deleted_at = t.deleted_at
    FROM t
    WHERE explainer.id = t.id
  `);
}

export const syncExplainer = {
  async push() {
    if (!supabase) return;

    const noUUID = await dbExplainer.select<{ rowid: number }[]>(
      `SELECT rowid FROM explainer WHERE id IS NULL`,
    );
    if (noUUID.length) {
      await dbExplainer.execute(`
        WITH t (id, rowid) AS (
          VALUES ${noUUID.map((r) => `('${crypto.randomUUID()}', ${r.rowid})`)}
        )
        UPDATE explainer SET
          id = t.id
        FROM t
        WHERE explainer.rowid = t.rowid
      `);
    }

    const pending = await dbExplainer.select<{ rowid: number }[]>(
      `SELECT rowid FROM explainer WHERE sync_status = $1`,
      ["pending"],
    );
    await pushExplanation(pending);
  },
  async pull(lastSyncedAt: Date) {
    if (!supabase) return;

    const cols = [
      ...explainerCols,
      "id",
      "updated_at",
      "deleted_at",
      "sync_status",
    ];

    // Will throw error and stop pull sync if previous temp table isn't dropped yet.
    // TEMP TABLE isn't reliable for plugin's underlying sqlx connection pool
    // need testing
    await dbExplainer.execute(`
      CREATE TEMP TABLE sync_explainer (${cols.map((c) => `"${c}"`)});
      -- deleted_at index is probably not worth it
      -- full table scan for NULL once or twice is cheaper
    `);

    try {
      const { data, error } = await supabase
        .from("explainer")
        .select("*")
        .gt("updated_at", lastSyncedAt.toISOString());
      // supabase API doesn't compare TIMESTAMPTZ as Date object, only as ISO format string.
      if (error) throw error;

      // don't even try if supabase is empty
      if (!data?.length) return;

      const dataInArray = (data as (IExplainer & IDBSync)[]).map((r) => [
        ...[r.text, r.explanation, r.lang], // cols
        ...[
          r.id,
          +new Date(r.updated_at),
          r.deleted_at ? +new Date(r.deleted_at) : null,
          "synced",
        ], // syncCols
      ]);

      // SQLITE_MAX_VARIABLE_NUMBER 32766 in most recent SQLite builds
      const chunk_size = Math.floor(32_000 / cols.length);
      let chunk: typeof dataInArray;
      while ((chunk = dataInArray.splice(0, chunk_size)).length) {
        // `tauri-plugin-sql` doesn't have transactions, and writing SQL strings directly is not safe for user texts.
        await dbExplainer.execute(
          `
            INSERT INTO sync_explainer
            VALUES ${chunk.map((rows, i_row) => `(${rows.map((_, i) => `$${1 + i + i_row * cols.length}`)})`)}
          `,
          chunk.reduce((prev, current) => [...prev, ...current]),
        );
      }

      // temp table workaround for a transaction
      var { rowsAffected } = await dbExplainer.execute(`
        INSERT INTO explainer (${cols.map((c) => `"${c}"`)})
        SELECT ${cols.map((c) => `"${c}"`)} FROM sync_explainer
        WHERE deleted_at IS NULL
        -- WHERE clause is required to prevent ON be interpreted as JOIN part of SELECT statement
        ON CONFLICT (id)
        DO UPDATE SET
          ${cols.filter((c) => c !== "id").map((c) => `"${c}" = excluded.${c}`)}
        WHERE excluded.updated_at > explainer.updated_at
      `);
      console.log(`sync_explainer: pull inserted/updated ${rowsAffected} rows`);

      var { rowsAffected } = await dbExplainer.execute(`
        DELETE FROM explainer
        WHERE id IN (
          SELECT s.id FROM sync_explainer s
          WHERE s.deleted_at IS NOT NULL
            AND s.updated_at > COALESCE(
              (SELECT e.updated_at FROM explainer e WHERE e.id = s.id), -1
            )
        );
      `);
      console.log(`sync_explainer: pull deleted ${rowsAffected} rows`);
    } finally {
      // Guarantee running drop table, including premature return
      await dbExplainer
        .execute(`DROP TABLE sync_explainer`)
        .catch((e) => console.error(e));
    }
  },
};
