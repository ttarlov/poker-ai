/**
 * In-memory mock Supabase client for local development without a Supabase project.
 * Implements the subset of the Supabase JS client API used by this app.
 */
import { v4 as uuidv4 } from "uuid";

// ── In-memory tables ──────────────────────────────────────────────────
const tables: Record<string, any[]> = {
  sessions: [],
  session_participants: [],
  tickets: [],
  votes: [],
};

// ── Realtime subscriptions ────────────────────────────────────────────
type ChangeListener = { table: string; callback: () => void };
const activeChannels = new Map<string, ChangeListener[]>();

function notifyListeners(table: string) {
  activeChannels.forEach((listeners) => {
    listeners.forEach((listener) => {
      if (listener.table === table) {
        listener.callback();
      }
    });
  });
}

// ── Room code generator ───────────────────────────────────────────────
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Query builder (thenable chain) ────────────────────────────────────
class MockQueryBuilder {
  private _table: string;
  private _op: "select" | "insert" | "update" | "upsert" | "delete" | null = null;
  private _payload: any = null;
  private _filters: { col: string; val: any }[] = [];
  private _orderCol: string | null = null;
  private _isSingle = false;
  private _hasSelect = false;
  private _upsertOpts: any = null;

  constructor(table: string) {
    this._table = table;
  }

  select(_cols?: string) {
    if (!this._op) this._op = "select";
    this._hasSelect = true;
    return this;
  }

  insert(data: any) {
    this._op = "insert";
    this._payload = data;
    return this;
  }

  update(data: any) {
    this._op = "update";
    this._payload = data;
    return this;
  }

  upsert(data: any, opts?: any) {
    this._op = "upsert";
    this._payload = data;
    this._upsertOpts = opts;
    return this;
  }

  delete() {
    this._op = "delete";
    return this;
  }

  eq(col: string, val: any) {
    this._filters.push({ col, val });
    return this;
  }

  order(col: string) {
    this._orderCol = col;
    return this;
  }

  single() {
    this._isSingle = true;
    return this;
  }

  // Makes the builder await-able / thenable — resolves synchronously for speed
  then(resolve: any, reject?: any) {
    try {
      const result = this._execute();
      return Promise.resolve(result).then(resolve, reject);
    } catch (err) {
      return Promise.reject(err).then(resolve, reject);
    }
  }

  private _execute(): { data: any; error: any } {
    const rows = tables[this._table];
    if (!rows) return { data: null, error: { message: `Unknown table: ${this._table}` } };

    switch (this._op) {
      case "select": {
        let result = [...rows];
        for (const f of this._filters) {
          result = result.filter((r) => r[f.col] === f.val);
        }
        if (this._orderCol) {
          const col = this._orderCol;
          result.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0));
        }
        return { data: this._isSingle ? result[0] || null : result, error: null };
      }

      case "insert": {
        const row = { id: uuidv4(), created_at: new Date().toISOString(), ...this._payload };
        rows.push(row);
        notifyListeners(this._table);
        if (this._hasSelect && this._isSingle) return { data: row, error: null };
        return { data: [row], error: null };
      }

      case "upsert": {
        const conflictCols =
          this._upsertOpts?.onConflict?.split(",").map((s: string) => s.trim()) || [];
        const existing = rows.find((r: any) =>
          conflictCols.every((c: string) => r[c] === this._payload[c])
        );
        if (existing) {
          Object.assign(existing, this._payload);
        } else {
          rows.push({ id: uuidv4(), ...this._payload });
        }
        notifyListeners(this._table);
        return { data: null, error: null };
      }

      case "update": {
        for (const row of rows) {
          if (this._filters.every((f) => row[f.col] === f.val)) {
            Object.assign(row, this._payload);
          }
        }
        notifyListeners(this._table);
        return { data: null, error: null };
      }

      case "delete": {
        const toRemove: number[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (this._filters.every((f) => rows[i][f.col] === f.val)) toRemove.push(i);
        }
        for (let i = toRemove.length - 1; i >= 0; i--) rows.splice(toRemove[i], 1);
        notifyListeners(this._table);
        return { data: null, error: null };
      }

      default:
        return { data: null, error: null };
    }
  }
}

// ── Channel mock (realtime subscriptions) ─────────────────────────────
class MockChannel {
  channelName: string;
  private _listeners: ChangeListener[] = [];

  constructor(name: string) {
    this.channelName = name;
  }

  on(_event: string, config: { table: string; [key: string]: any }, callback: () => void) {
    this._listeners.push({ table: config.table, callback });
    return this;
  }

  subscribe() {
    activeChannels.set(this.channelName, this._listeners);
    return this;
  }
}

// ── Exported factory ──────────────────────────────────────────────────
export function createMockClient() {
  return {
    from(table: string) {
      return new MockQueryBuilder(table);
    },

    rpc(fnName: string) {
      if (fnName === "generate_room_code") {
        return Promise.resolve({ data: generateRoomCode(), error: null });
      }
      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fnName}` } });
    },

    channel(name: string) {
      return new MockChannel(name);
    },

    removeChannel(channel: any) {
      if (channel?.channelName) {
        activeChannels.delete(channel.channelName);
      }
    },
  };
}
