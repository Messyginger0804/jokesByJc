import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createChrome } from "./chrome-mock.js";

let chrome;

async function load(options) {
  vi.resetModules();
  chrome = createChrome(options);
  vi.stubGlobal("chrome", chrome);
  return import("../../background.js");
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listener registration", () => {
  it("registers install, startup and alarm listeners synchronously at load", async () => {
    await load();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1);
  });
});

describe("ensureDailyAlarm", () => {
  it("creates the hourly alarm when it is missing", async () => {
    const bg = await load();
    await bg.ensureDailyAlarm();
    expect(chrome.alarms.create).toHaveBeenCalledWith(bg.ALARM_NAME, {
      delayInMinutes: bg.CHECK_PERIOD_MINUTES,
      periodInMinutes: bg.CHECK_PERIOD_MINUTES
    });
  });

  it("does not reset an existing alarm with the current schedule", async () => {
    const bg = await load({ alarms: { dailyPopup: { periodInMinutes: 60, scheduledTime: 123 } } });
    await bg.ensureDailyAlarm();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it("replaces a legacy alarm left with the old daily period", async () => {
    const bg = await load({ alarms: { dailyPopup: { periodInMinutes: 1440 } } });
    await bg.ensureDailyAlarm();
    expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
    expect(chrome.alarms.map.get("dailyPopup").periodInMinutes).toBe(60);
  });
});

describe("onInstalled", () => {
  it("ensures the alarm on install or update", async () => {
    await load();
    await chrome.runtime.onInstalled.dispatch({ reason: "install" });
    expect(chrome.alarms.map.get("dailyPopup")).toEqual({ delayInMinutes: 60, periodInMinutes: 60 });
  });

  it("logs instead of leaving an unhandled rejection when the alarms API fails", async () => {
    await load();
    chrome.alarms.get.mockRejectedValueOnce(new Error("alarms down"));
    await chrome.runtime.onInstalled.dispatch({ reason: "update" });
    await flush();
    expect(console.error).toHaveBeenCalledWith("Could not schedule the daily popup:", expect.any(Error));
  });
});

describe("onStartup", () => {
  it("keeps the existing alarm and schedules a one-shot startup check", async () => {
    await load({ alarms: { dailyPopup: { periodInMinutes: 60 } } });
    await chrome.runtime.onStartup.dispatch();
    expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
    expect(chrome.alarms.create).toHaveBeenCalledWith("dailyPopupStartup", { delayInMinutes: 1 });
  });

  it("logs instead of leaving an unhandled rejection when scheduling fails", async () => {
    await load();
    chrome.alarms.create.mockRejectedValue(new Error("quota"));
    await chrome.runtime.onStartup.dispatch();
    await flush();
    expect(console.error).toHaveBeenCalledWith("Could not schedule the daily popup:", expect.any(Error));
  });
});

describe("onAlarm", () => {
  it.each(["dailyPopup", "dailyPopupStartup"])("opens the popup window when %s fires", async (name) => {
    await load();
    await chrome.alarms.onAlarm.dispatch({ name });
    await flush();
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: "popup.html",
      type: "popup",
      width: 500,
      height: 600,
      focused: true
    });
  });

  it("ignores unrelated alarms", async () => {
    await load();
    await chrome.alarms.onAlarm.dispatch({ name: "somethingElse" });
    await flush();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });
});

describe("showPopupIfOwed", () => {
  it("records today's date and opens one window", async () => {
    const bg = await load();
    await bg.showPopupIfOwed();
    expect(chrome.storage.local.data.lastPopupDate).toBe(new Date().toDateString());
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
  });

  it("does nothing when today's popup was already shown", async () => {
    const bg = await load({ store: { lastPopupDate: new Date().toDateString() } });
    await bg.showPopupIfOwed();
    expect(chrome.windows.create).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("shows the popup again on a new day", async () => {
    const bg = await load({ store: { lastPopupDate: "Mon Jan 01 2001" } });
    await bg.showPopupIfOwed();
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
  });

  it("restores the previous date when the window cannot be opened", async () => {
    const bg = await load({ store: { lastPopupDate: "Mon Jan 01 2001" } });
    chrome.windows.create.mockRejectedValueOnce(new Error("no browser window"));
    await expect(bg.showPopupIfOwed()).rejects.toThrow("no browser window");
    expect(chrome.storage.local.data.lastPopupDate).toBe("Mon Jan 01 2001");
  });

  it("removes the date instead of storing null when there was no previous popup", async () => {
    const bg = await load();
    chrome.windows.create.mockRejectedValueOnce(new Error("no browser window"));
    await expect(bg.showPopupIfOwed()).rejects.toThrow();
    expect("lastPopupDate" in chrome.storage.local.data).toBe(false);
    expect(chrome.storage.local.remove).toHaveBeenCalledWith("lastPopupDate");
  });
});

describe("checkAndShowPopup", () => {
  it("serializes overlapping checks so only one window opens", async () => {
    const bg = await load();
    await Promise.all([bg.checkAndShowPopup(), bg.checkAndShowPopup(), bg.checkAndShowPopup()]);
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
  });

  it("logs a failed check and lets the next check retry", async () => {
    const bg = await load();
    chrome.windows.create.mockRejectedValueOnce(new Error("no browser window"));
    await bg.checkAndShowPopup();
    expect(console.error).toHaveBeenCalledWith("Daily popup check failed:", expect.any(Error));
    await bg.checkAndShowPopup();
    expect(chrome.windows.create).toHaveBeenCalledTimes(2);
  });
});
