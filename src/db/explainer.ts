import Database from "@tauri-apps/plugin-sql";

export const dbExplainer = await Database.load("sqlite:explainer.db");
