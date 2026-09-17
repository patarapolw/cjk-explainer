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
      ${cols.map((c) => `"${c}" = excluded.${c}`)}
    `,
    [
      ...[text, explanation, lang], // cols
      ...[id, updated_at, "pending"], // syncCols
    ],
  );

  const rows = await dbExplainer.select<{ rowid: number }[]>(
    `SELECT rowid FROM explainer WHERE text = $1 AND lang = $2`,
    [text, lang],
  );

  // error will be thrown in console, but doesn't crash the function
  pushExplanation(rows).catch((e) => console.error(e));

  return id;
}

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

  await dbExplainer.execute(
    toBeUpserted
      .map(
        (r, i) => `
          UPDATE explainer SET
            sync_status = 'synced',
            id = '${r.id}',
            updated_at = ${+r.updated_at},
            deleted_at = ${r.deleted_at ? +r.deleted_at : null}
          WHERE rowid = ${rows[i].rowid}
        `,
      )
      .join(";\n"),
  );
}

export const syncExplainer = {
  async push() {
    if (!supabase) return;

    const noUUID = await dbExplainer.select<{ rowid: number }[]>(
      `SELECT rowid FROM explainer WHERE id IS NULL`,
    );
    if (noUUID.length) {
      await dbExplainer.execute(
        noUUID
          .map(
            (r) => `
              UPDATE explainer SET
                id = '${crypto.randomUUID()}'
              WHERE rowid = ${r.rowid}
            `,
          )
          .join(";\n"),
      );
    }

    const pending = await dbExplainer.select<{ rowid: number }[]>(
      `SELECT rowid FROM explainer WHERE sync_status = $1`,
      ["pending"],
    );
    await pushExplanation(pending);
  },
  async pull(lastSyncedAt: Date) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("explainer")
      .select("*")
      .gt("updated_at", lastSyncedAt.toISOString());
    // supabase API doesn't compare TIMESTAMPTZ as Date object, only as ISO format string.
    if (error) throw error;

    const cols = [
      ...explainerCols,
      "id",
      "updated_at",
      "deleted_at",
      "sync_status",
    ];

    for (const r of data as (IExplainer & IDBSync)[]) {
      await dbExplainer.execute(
        `
        INSERT INTO explainer (${cols.map((c) => `"${c}"`)})
        VALUES (${cols.map((_, i) => `$${i + 1}`)})
        ON CONFLICT (id)
        DO UPDATE SET
          ${cols.map((c) => `"${c}" = excluded.${c}`)}
        WHERE excluded.updated_at > explainer.updated_at
        `,
        [
          ...[r.text, r.explanation, r.lang], // cols
          ...[
            r.id,
            +new Date(r.updated_at),
            r.deleted_at ? +new Date(r.deleted_at) : null,
            "synced",
          ], // syncCols
        ],
      );
    }
  },
};
