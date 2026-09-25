use std::path::PathBuf;

use yomitan_parser::{error::YomitanError, yomitan::YomitanParser};

#[tokio::main]
async fn main() -> Result<(), YomitanError> {
    let yomi = YomitanParser::from_zip(
        PathBuf::from("D:\\Projects\\cjdic2\\tmp\\yomitan\\smk8.zip"),
        PathBuf::from("tmp"),
    )
    .await?;
    yomi.create_db().await?;

    Ok(())
}
