import Database from "@tauri-apps/plugin-sql";

import { supabase } from "../util/supabase";

interface IExplainer {
  text: string;
  explanation: string;
  lang: string;
}

interface IDBSync {
  id: ReturnType<typeof crypto.randomUUID>;
  updated_at: number;
  deleted_at: number | null; // TODO: soft delete logic
  // but delete might not be need for this table specifically
  sync_status: "pending" | "synced" | "error";
}

const localCols = [
  "text",
  "explanation",
  "lang",
] as const satisfies readonly (keyof IExplainer)[];

const db = await Database.load("sqlite:explainer.db");

export async function getExplanation({
  text,
  lang,
}: {
  text: string;
  lang: string;
}) {
  const [r] = await db.select<IExplainer[]>(
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

  const cols = [...localCols, "id", "updated_at", "sync_status"];

  await db.execute(
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

  const rows = await db.select<{ rowid: number }[]>(
    `SELECT rowid FROM explainer WHERE text = $1 AND lang = $2`,
    [text, lang],
  );

  // error will be thrown in console, but doesn't crash the function
  pushExplanation(rows).catch((e) => console.error(e));

  return id;
}

async function pushExplanation(rows: { rowid: number }[]) {
  if (!supabase) return;

  const fullRows = await db.select<(IExplainer & IDBSync)[]>(
    `SELECT * FROM explainer WHERE rowid IN (${rows.map((r) => r.rowid)})`,
  );
  if (!fullRows.length) return;

  const user_id = await supabase.auth.getUser().then((u) => u.data.user?.id);

  const toBeUpserted = fullRows.map(({ sync_status, ...row }) => {
    return {
      ...row,
      id: row.id || crypto.randomUUID(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
      user_id,
    };
  });

  const { error } = await supabase
    .from("explainer")
    .upsert(toBeUpserted as any, { onConflict: `user_id,text,lang` }); // TODO: proper typing from Supabase CLI

  if (error) throw error;

  await db.execute(
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

// --- startup / periodic sync ---

let syncing = false;

export async function runSync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    await pullChanges();
    await pushPending();
  } catch (err) {
    console.error("sync failed", err);
  } finally {
    syncing = false;
  }
}

async function pullChanges() {
  if (!supabase) return;

  const lastSyncedAt = Number(localStorage.getItem("last_synced_at") ?? 0);

  const { data, error } = await supabase
    .from("explainer")
    .select("*")
    .gt("updated_at", new Date(lastSyncedAt).toISOString());
  // supabase API doesn't compare TIMESTAMPTZ as Date object, only as ISO format string.
  if (error) throw error;

  const cols = [...localCols, "id", "updated_at", "deleted_at", "sync_status"];

  for (const r of data as (IExplainer & IDBSync)[]) {
    await db.execute(
      `
      INSERT INTO explainer (${cols.map((c) => `"${c}"`)})
      VALUES (${cols.map((_, i) => `$${i + 1}`)})
      ON CONFLICT ("text", lang)
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

  localStorage.setItem("last_synced_at", String(Date.now()));
}

async function pushPending() {
  if (!supabase) return;

  const pending = await db.select<{ rowid: number }[]>(
    `SELECT rowid FROM explainer WHERE sync_status = $1`,
    ["pending"],
  );
  await pushExplanation(pending);
}
