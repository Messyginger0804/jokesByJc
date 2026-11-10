import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createChrome } from "./chrome-mock.js";

// background.js is a classic service-worker script with no exports, so it is driven
// through the chrome.* events it registers.
async function load(options) {
  const chrome = createChrome(options);
  vi.stubGlobal("chrome", chrome);
  vi.resetModules();
  await import("../../background.js");
  return chrome;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("background.js", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers install, startup and alarm listeners", async () => {
    const chrome = await load();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
  });

  it("schedules the daily alarm on install: first check in an hour, then every 24 h", async () => {
    const chrome = await load();
    await chrome.runtime.onInstalled.dispatch({ reason: "install" });
    await flush();
    expect(chrome.alarms.create).toHaveBeenCalledWith("dailyPopup", { delayInMinutes: 60, periodInMinutes: 1440 });
    expect(chrome.alarms.map.get("dailyPopup")).toEqual({ delayInMinutes: 60, periodInMinutes: 1440 });
  });

  it("schedules the daily alarm on browser startup when none exists", async () => {
    const chrome = await load();
    await chrome.runtime.onStartup.dispatch();
    await flush();
    expect(chrome.alarms.map.get("dailyPopup")).toEqual({ delayInMinutes: 60, periodInMinutes: 1440 });
  });

  // Known bug: startup clears every alarm and restarts the 60 min delay, so a browser
  // session shorter than an hour never reaches the check. Fixed in PR #4 (create only if missing).
  it.fails("keeps an existing alarm on browser startup instead of resetting it", async () => {
    const existing = { scheduledTime: Date.now() + 5 * 60_000, periodInMinutes: 1440 };
    const chrome = await load({ alarms: { dailyPopup: existing } });
    await chrome.runtime.onStartup.dispatch();
    await flush();
    expect(chrome.alarms.map.get("dailyPopup")).toEqual(existing);
  });

  it("opens the popup window and records today's date when the alarm fires", async () => {
    const chrome = await load();
    await chrome.alarms.onAlarm.dispatch({ name: "dailyPopup" });
    await flush();
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chrome.windows.create).toHaveBeenCalledWith({ url: "popup.html", type: "popup", width: 500, height: 600 });
    expect(chrome.storage.local.data.lastPopupDate).toBe(new Date().toDateString());
  });

  it("opens the popup when it was last shown on an earlier day", async () => {
    const chrome = await load({ store: { lastPopupDate: new Date(2026, 10, 9).toDateString() } });
    await chrome.alarms.onAlarm.dispatch({ name: "dailyPopup" });
    await flush();
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.data.lastPopupDate).toBe(new Date().toDateString());
  });

  it("does nothing when the popup was already shown today", async () => {
    const chrome = await load({ store: { lastPopupDate: new Date().toDateString() } });
    await chrome.alarms.onAlarm.dispatch({ name: "dailyPopup" });
    await flush();
    expect(chrome.windows.create).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("ignores alarms with other names", async () => {
    const chrome = await load();
    await chrome.alarms.onAlarm.dispatch({ name: "somethingElse" });
    await flush();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  // Known gaps, fixed in PR #4 and not asserted here:
  it.todo("does not open two windows when two checks overlap (PR #4 serializes checks)");
  it.todo("rolls back lastPopupDate when windows.create fails (PR #4)");
});
