use std::path::{Path, PathBuf};

use tokio::fs::read_dir;
use yomitan_parser::{error::YomitanError, yomitan::YomitanParser};

#[tokio::main]
async fn main() -> Result<(), YomitanError> {
    let mut zip_paths: Vec<PathBuf> = vec![];

    let root = Path::new("D:\\Projects\\cjdic2\\tmp");

    {
        let mut entries = read_dir(root).await?;
        while let Some(en) = entries.next_entry().await? {
            if !en.file_type().await?.is_file() {
                continue;
            }
            let path = en.path();
            if path
                .extension()
                .is_some_and(|x| x.eq_ignore_ascii_case("zip"))
            {
                zip_paths.push(en.path());
            }
        }
    }

    {
        let mut entries = read_dir(root.join("yomitan")).await?;
        while let Some(en) = entries.next_entry().await? {
            if !en.file_type().await?.is_file() {
                continue;
            }
            let path = en.path();
            if path
                .extension()
                .is_some_and(|x| x.eq_ignore_ascii_case("zip"))
            {
                zip_paths.push(en.path());
            }
        }
    }

    for en in zip_paths.iter() {
        let stem = en.as_path().file_stem().unwrap();
        println!("{:?}", stem);

        let yomi = YomitanParser::from_zip(en.clone(), Path::new("tmp").join(stem)).await?;
        yomi.create_db(|p| {
            if p.current % 50 == 0 {
                println!("{} ({}/{})", p.bank, p.current, p.total);
            }
        })
        .await?;
    }

    Ok(())
}
