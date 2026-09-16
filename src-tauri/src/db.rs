use tauri_plugin_sql::{Migration, MigrationKind};

pub fn explainer_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
                CREATE TABLE IF NOT EXISTS explainer (
                    [text]          TEXT NOT NULL,
                    [explanation]   TEXT NOT NULL,
                    [lang]          TEXT NOT NULL,
                    PRIMARY KEY (text)
                );

                CREATE INDEX IF NOT EXISTS idx_explainer_lang ON explainer ([lang]);
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_sync_columns_and_id_primary_key",
            sql: "
                -- rebuild table: SQLite ALTER TABLE can't add/drop PRIMARY KEY or CHECK constraints
                CREATE TABLE explainer_new (
                    text            TEXT NOT NULL,
                    explanation     TEXT NOT NULL,
                    lang            TEXT NOT NULL,
                    updated_at      INTEGER NOT NULL DEFAULT 0, -- epoch millisec, i.e. CAST(round(unixepoch('subsec') * 1000) AS INTEGER)
                    deleted_at      INTEGER,                    -- epoch millisec at soft delete
                    sync_status     TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
                    id              TEXT PRIMARY KEY            -- matches Supabase UUID PK; nullable until synced (multiple NULLs allowed)
                );

                -- omitted columns take their own DEFAULT/NULL automatically -- no need to repeat literals here
                INSERT INTO explainer_new (text, explanation, lang)
                SELECT text, explanation, lang FROM explainer;

                DROP TABLE explainer;

                ALTER TABLE explainer_new RENAME TO explainer;

                CREATE INDEX idx_explainer_lang ON explainer (lang);
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "restore_unique_index",
            sql: "
                -- I forgot to put back PRIMARY TEXT (text), i.e. text is unique
                -- but I want to change definition now
                CREATE UNIQUE INDEX idx_explainer_u ON explainer (`text`, lang);
            ",
            kind: MigrationKind::Up
        }
    ]
}
