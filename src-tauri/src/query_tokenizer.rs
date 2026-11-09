//! Query-side tokenizer for "~" dictionary search (lindera).
//!
//! Extracted from cjk-dict's yomitan-parser (`tokenize.rs`), which tokenizes terms at import.
//! The two must keep producing the same tokens, so keep them in sync.

use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{Arc, LazyLock},
};

use lindera::{dictionary::load_dictionary, mode::Mode, segmenter::Segmenter};
use lindera_analysis::{
    character_filter::CharacterFilterLoader, token_filter::TokenFilterLoader, tokenizer::Tokenizer,
};
use serde_json::json;
use tokio::{sync::OnceCell, task::spawn_blocking};

use crate::error::AppError;

#[derive(Debug, Eq, PartialEq, Hash, Clone, Copy)]
pub enum Lang {
    Ja,
    Ko,
    Zh,
}

impl std::fmt::Display for Lang {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Lang::Ja => "ja-JP",
            Lang::Ko => "ko-KR",
            Lang::Zh => "zh-CN",
        })
    }
}

impl Lang {
    pub const ALL: [Lang; 3] = [Lang::Ja, Lang::Ko, Lang::Zh];

    pub fn new_oncecell_map<T>() -> HashMap<Lang, OnceCell<T>> {
        Lang::ALL.iter().map(|&l| (l, OnceCell::new())).collect()
    }

    pub fn from(value: &str) -> Option<Self> {
        match value {
            "ja-JP" => Some(Lang::Ja),
            "ko-KR" => Some(Lang::Ko),
            "zh-CN" => Some(Lang::Zh),
            _ => None,
        }
    }
}

static KO_STOP_TAGS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    [
        "JKS", "JKC", "JKG", "JKO", "JKB", "JKV", "JKQ", "JX", "JC", "EP", "EF", "EC", "ETN",
        "ETM", "SF", "SE", "SSO", "SSC", "SC", "SY",
    ]
    .into_iter()
    .collect()
});

static KO_VERB_TAGS: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| ["VV", "VA", "VX", "VCN"].into_iter().collect());

// lindera `details` skip the first 4 dictionary columns (surface, left id, right id, cost),
// so a column number from the dictionary_format docs is `column - 4`.
const JA_LEXEME: usize = 11 - 4; // unidic: 11 - Lexeme
const JA_ORTH_BASE: usize = 14 - 4; // unidic: 14 - Orthographic base form
const KO_TYPE: usize = 8 - 4; // ko-dic: 8 - Type
const KO_EXPRESSION: usize = 11 - 4; // ko-dic: 11 - Expression

pub struct TokenizerMapper {
    root_dir: PathBuf,
    segmenter: HashMap<Lang, OnceCell<Arc<Segmenter>>>,
    tokenizer: HashMap<Lang, OnceCell<Arc<Tokenizer>>>,
}

impl TokenizerMapper {
    pub fn new(root_dir: PathBuf) -> Self {
        Self {
            root_dir,
            segmenter: Lang::new_oncecell_map(),
            tokenizer: Lang::new_oncecell_map(),
        }
    }

    pub async fn segment(
        &self,
        lang: Lang,
        text: &str,
    ) -> Result<Vec<(String, Vec<String>)>, AppError> {
        let segmenter = self.get_segmenter(lang).await?;

        let mut out = vec![];
        let mut tokens = segmenter.segment(std::borrow::Cow::Borrowed(text))?;
        for token in tokens.iter_mut() {
            out.push((
                token.surface.to_string(),
                token.details_iter().map(|s| s.to_string()).collect(),
            ));
        }

        Ok(out)
    }

    pub async fn tokenize(&self, lang: Lang, text: &str) -> Result<Vec<String>, AppError> {
        let tokenizer = self.tokenizer[&lang]
            .get_or_try_init(|| async move {
                let character_filters = vec![
                    json!({
                        "kind": "unicode_normalize",
                        "args": { "kind": "nfkc" }
                    }),
                    json!({
                        "kind": "japanese_iteration_mark",
                        "args": {
                            "normalize_kanji": true,
                            "normalize_kana": true
                        }
                    }),
                ];

                let token_filters = vec![
                    json!({
                        "kind": "remove_diacritical_mark",
                        "args": {
                            // do not remove dakuten, handakuten
                            "japanese": false
                        }
                    }),
                    json!({
                        "kind": "japanese_kana",
                        "args": {
                            "kind": "hiragana"
                        }
                    }),
                    json!({
                        "kind": "japanese_katakana_stem",
                        "args": {
                            "min": 3
                        }
                    }),
                    json!({
                        "kind": "remove_diacritical_mark",
                        "args": {
                            "japanese": false
                        }
                    }),
                    json!({
                        "kind": "uppercase"
                    }),
                ];

                let segmenter = self.get_segmenter(lang).await?;
                let mut tokenizer = Tokenizer::new((*segmenter).clone());

                for character_filter_setting in character_filters {
                    let character_filter_name = character_filter_setting["kind"].as_str();
                    if let Some(character_filter_name) = character_filter_name {
                        // Append a character filter to the tokenizer.
                        tokenizer.append_character_filter(CharacterFilterLoader::load_from_value(
                            character_filter_name,
                            &character_filter_setting["args"],
                        )?);
                    }
                }

                for token_filter_setting in token_filters {
                    let token_filter_name = token_filter_setting["kind"].as_str();
                    if let Some(token_filter_name) = token_filter_name {
                        // Append a token filter to the tokenizer.
                        tokenizer.append_token_filter(TokenFilterLoader::load_from_value(
                            token_filter_name,
                            &token_filter_setting["args"],
                        )?);
                    }
                }

                Ok::<_, AppError>(Arc::new(tokenizer))
            })
            .await?;

        let mut out: Vec<String> = vec![];
        let mut tokens = tokenizer.tokenize(text)?;
        let mut number_end = None;

        for token in tokens.iter_mut() {
            let surface = token.surface.to_string();
            if !surface.is_empty() && surface.chars().all(char::is_numeric) {
                if number_end == Some(token.byte_start) {
                    if let Some(number) = out.last_mut() {
                        number.push_str(&surface);
                    }
                } else {
                    out.push(surface);
                }
                number_end = Some(token.byte_end);
                continue;
            }

            number_end = None;
            let details = token.details();
            out.extend(terms_for_token(lang, &surface, &details));
        }

        Ok(out)
    }

    async fn get_segmenter(&self, lang: Lang) -> Result<Arc<Segmenter>, AppError> {
        let root_dir = self.root_dir.clone();

        self.segmenter[&lang]
            .get_or_try_init(|| async move {
                spawn_blocking(move || {
                    let model = match lang {
                        Lang::Ja => "unidic", // more consistent minimal units than ipadic(-neologd) and much smaller than sudachidict
                        Lang::Zh => "cc-cedict", // cc-cedict may have better support traditional form better than jieba
                        Lang::Ko => "ko-dic",
                    };

                    let dictionary = load_dictionary(
                        &root_dir
                            .join(format!("lindera-{}", model))
                            .display()
                            .to_string(),
                    )?;

                    Ok::<_, AppError>(Arc::new(Segmenter::new(Mode::Normal, dictionary, None)))
                })
                .await?
                .map_err(AppError::from)
            })
            .await
            .cloned()
    }
}

/// What one lindera token contributes to the search text: nothing (dropped), its dictionary
/// form, or several fragments (Korean compounds and inflections).
/// `details` are the dictionary fields after the surface; index 0 is the part of speech.
fn terms_for_token(lang: Lang, surface: &str, details: &[&str]) -> Vec<String> {
    // for some reasons, `[,-]` is considered by unidic to be 名詞, 普通名詞, サ変可能
    if !surface.chars().any(char::is_alphanumeric) {
        return vec![];
    }
    if surface.chars().all(char::is_numeric) {
        return vec![surface.to_string()];
    }

    let mut is_ko_verb = false;

    match lang {
        Lang::Ja => {
            if let Some(pos) = details.first()
                && (pos.starts_with("助") || pos.ends_with("記号"))
            {
                return vec![];
            }

            // @see https://lindera.github.io/lindera/lindera-unidic/dictionary_format.html
            for idx in [JA_LEXEME, JA_ORTH_BASE] {
                if let Some(d) = details.get(idx)
                    && *d != "*"
                {
                    return vec![d.to_string()];
                }
            }
        }
        Lang::Ko => {
            if let Some(pos) = details.first() {
                if KO_STOP_TAGS.contains(pos) {
                    return vec![];
                }
                if KO_VERB_TAGS.contains(pos) {
                    is_ko_verb = true;
                }
            }

            // @see https://lindera.github.io/lindera/lindera-ko-dic/dictionary_format.html
            if let Some(ty) = details.get(KO_TYPE)
                && let Some(expr) = details.get(KO_EXPRESSION)
                && matches!(*ty, "Compound" | "Inflect" | "Preanalysis")
                && *expr != "*"
            {
                let mut out = vec![];
                for sub_token in expr.split('+') {
                    let sub_tokens: Vec<&str> = sub_token.split('/').collect();
                    if let Some(pos) = sub_tokens.get(1) {
                        if KO_STOP_TAGS.contains(pos) {
                            continue;
                        }
                        if KO_VERB_TAGS.contains(pos) {
                            is_ko_verb = true;
                        }
                    }

                    if let Some(t) = sub_tokens.first() {
                        out.push(if is_ko_verb {
                            format!("{t}다")
                        } else {
                            t.to_string()
                        });
                    }
                }
                return out;
            }
        }
        Lang::Zh => {}
    }

    vec![if is_ko_verb {
        format!("{surface}다")
    } else {
        surface.to_string()
    }]
}
