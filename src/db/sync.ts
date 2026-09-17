import { supabase } from "../util/supabase";
import { syncExplainer } from "./explainer";

export interface IDBSync {
  id: ReturnType<typeof crypto.randomUUID>;
  updated_at: number;
  deleted_at: number | null; // TODO: soft delete logic
  // but delete might not be need for this table specifically
  sync_status: "pending" | "synced" | "error";
}

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

  const lastSyncedAt = new Date(
    Number(localStorage.getItem("last_synced_at") ?? 0),
  );

  await syncExplainer.pull(lastSyncedAt);

  localStorage.setItem("last_synced_at", String(Date.now()));
}

async function pushPending() {
  if (!supabase) return;

  await syncExplainer.push();
}

// TODO: periodic sync
