import Database from "@tauri-apps/plugin-sql";

export const dbExplainer = await Database.load("sqlite:explainer.db");

await dbExplainer.execute(/* sql */ `
  CREATE TABLE IF NOT EXISTS explainer (
    [text]          TEXT NOT NULL,
    [explanation]   TEXT NOT NULL,
    [lang]          TEXT NOT NULL,
    PRIMARY KEY (text)
  );

  CREATE INDEX IF NOT EXISTS idx_explainer_lang ON explainer ([lang]);
`);
