// Minimal in-memory chrome.* mock covering the APIs this extension uses.
// storage.local supports both the promise form (background.js) and the callback form (popup.js).
import { vi } from "vitest";

function event() {
  const listeners = [];
  return {
    listeners,
    addListener: vi.fn((fn) => listeners.push(fn)),
    // Calls every listener and resolves once any async ones settle.
    dispatch: (...args) => Promise.all(listeners.map((fn) => fn(...args)))
  };
}

export function createChrome({ store = {}, alarms = {} } = {}) {
  const data = structuredClone(store);
  const alarmMap = new Map(Object.entries(alarms));

  const pick = (keys) => {
    if (keys == null) return structuredClone(data);
    const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const out = {};
    for (const key of list) if (key in data) out[key] = structuredClone(data[key]);
    return out;
  };

  const chrome = {
    runtime: {
      lastError: undefined,
      onInstalled: event(),
      onStartup: event()
    },
    storage: {
      local: {
        data,
        get: vi.fn((keys, callback) => {
          const result = pick(keys);
          if (callback) {
            queueMicrotask(() => callback(result));
            return undefined;
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((items, callback) => {
          Object.assign(data, structuredClone(items));
          if (callback) {
            queueMicrotask(() => callback());
            return undefined;
          }
          return Promise.resolve();
        }),
        remove: vi.fn((keys) => {
          for (const key of [].concat(keys)) delete data[key];
          return Promise.resolve();
        })
      }
    },
    alarms: {
      map: alarmMap,
      onAlarm: event(),
      get: vi.fn(async (name) => {
        const alarm = alarmMap.get(name);
        return alarm ? { name, ...alarm } : undefined;
      }),
      create: vi.fn(async (name, info) => {
        alarmMap.set(name, { ...info });
      })
    },
    windows: {
      create: vi.fn(async (options) => ({ id: 1, ...options }))
    }
  };
  return chrome;
}
