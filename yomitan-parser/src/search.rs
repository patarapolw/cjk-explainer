use std::path::PathBuf;

use sqlx::{Pool, Sqlite, SqlitePool, sqlite::SqliteConnectOptions};

use crate::error::YomitanError;

pub struct YomitanSearch {
    db: Pool<Sqlite>,
    dicts: Vec<(PathBuf, Pool<Sqlite>)>,
}

impl YomitanSearch {
    pub async fn new(db_path: PathBuf, dicts: Vec<PathBuf>) -> Result<Self, YomitanError> {
        let options = SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true)
            .foreign_keys(true);

        let db = SqlitePool::connect_with(options).await?;

        Ok(Self {
            db,
            dicts: dicts
                .iter()
                .map(|d| {
                    let options = SqliteConnectOptions::new()
                        .filename(d.join("content.db"))
                        .foreign_keys(true);
                    (d.clone(), SqlitePool::connect_lazy_with(options))
                })
                .collect(),
        })
    }

    pub async fn search(self, q: String) {}
}
