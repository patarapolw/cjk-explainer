import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";

import { settingsState } from "../util/settings";

/**
 * Dictionary search is served by the cjk-dict worker (Cloudflare D1 + R2).
 * The client still tokenizes the query and expands pinyin locally (lindera + yomitan-parser),
 * then sends the result to the worker.
 *
 * @see https://github.com/patarapolw/cjk-dict
 */

interface SearchOpts {
  term: string;
  reading: string;
  limit: number;
  offset: number;
  type: string | null;
}

export interface ISearchTerm {
  id: number;
  term: string;
}

export interface ITerm {
  dict_id: number;
  /** dictionary name on the server */
  dict_path: string;
  term_id: number;

  term: string;
  reading: string;
  def_tags: string;
  rules: string;
  score: number | null;
  glossary: string;
  sequence: number | null;
  tags: string;
}

export interface IDict {
  id: number;
  name: string;
  title: string;
  revision: string | null;
  L1: string | null;
  L2: string | null;
  term_count: number;
}

type SearchResult = {
  items: (ISearchTerm & { entries: ITerm[] })[];
  next: number | null;
};

const ALL_LANGS = ["ja-JP", "zh-CN", "ko-KR"];

class SearchDatabase {
  private assetCache = new Map<string, Promise<string>>();

  get baseURL() {
    const url = settingsState.computed.dictApiURL.value;
    if (!url) {
      throw new Error("Dictionary server URL is not set (Settings → Dictionary)");
    }
    return url.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(this.baseURL + path, init);
    if (!r.ok) {
      throw new Error(`${init?.method || "GET"} ${path}: ${r.status} ${await r.text()}`);
    }
    return r.json();
  }

  async dicts() {
    return this.request<IDict[]>("/dicts");
  }

  async search(opts: SearchOpts): Promise<SearchResult> {
    const start = new Date();
    try {
      const lang = settingsState.computed.lang.value;
      const body = {
        type: opts.type,
        lang,
        term: opts.term,
        readings: await this.readings(opts.reading, lang),
        tokens: opts.type === "fts" ? await this.tokens(opts.term, lang) : undefined,
        limit: opts.limit,
        offset: opts.offset,
      };

      return await this.request<SearchResult>("/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      const timeTaken = (+new Date() - +start) / 1000;
      if (timeTaken > 0.5) {
        console.log(
          `Searching ${JSON.stringify(opts)} takes ${timeTaken.toPrecision(2)} seconds`,
        );
      }
    }
  }

  /** Object URL for a file inside a dictionary zip (images in structured content). */
  assetSrc(dict: string, path: string): Promise<string> {
    const key = `${dict}\n${path}`;
    let p = this.assetCache.get(key);
    if (!p) {
      const url = `${this.baseURL}/dicts/${encodeURIComponent(dict)}/assets/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`GET ${url}: ${r.status}`);
          return r.blob();
        })
        .then((b) => URL.createObjectURL(b));
      p.catch(() => this.assetCache.delete(key));
      this.assetCache.set(key, p);
    }
    return p;
  }

  private async readings(reading: string, lang: string) {
    if (!reading) return [];
    if (!lang || lang === "zh-CN") {
      const segments = await invoke<string[]>("normalize_reading", { reading });
      if (segments.length) return segments;
    }
    return [reading];
  }

  private async tokens(term: string, lang: string) {
    if (!term) return {};
    const kvs = await Promise.all(
      (lang ? [lang] : ALL_LANGS).map((subLang) =>
        invoke<string[]>("tokenize", { lang: subLang, text: term }).then(
          (ts) => [subLang.split("-")[0], ts.join(" ")] as const,
        ),
      ),
    );
    return Object.fromEntries(kvs.filter(([, v]) => v));
  }
}

export const searchDB = new SearchDatabase();
