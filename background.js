// Optionally opens the joke popup in its own window once per calendar day.
//
// This is opt-in: nothing opens on its own unless the user turns on "daily joke"
// in the popup (storage key DAILY_POPUP_KEY). Opening the extension from the
// toolbar always works, whatever the setting.
//
// While enabled, a periodic alarm checks every hour whether today's popup has been shown yet.
// The alarm is only created when missing (never reset on startup), and an extra
// check runs shortly after the browser starts, so short browsing sessions still
// get their daily joke.

export const ALARM_NAME = "dailyPopup";
export const STARTUP_ALARM_NAME = "dailyPopupStartup";
export const DAILY_POPUP_KEY = "dailyPopupEnabled";
export const CHECK_PERIOD_MINUTES = 60;
const STARTUP_DELAY_MINUTES = 1;

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;

// Also runs on update, which clears the alarm an older version left behind.
chrome.runtime.onInstalled.addListener(() => {
  syncDailyAlarm().catch(logScheduleError);
});

chrome.runtime.onStartup.addListener(() =>
  isDailyPopupEnabled()
    .then(async (enabled) => {
      if (!enabled) return;
      await ensureDailyAlarm();
      // Give the browser a moment to restore its session before opening a window.
      await chrome.alarms.create(STARTUP_ALARM_NAME, { delayInMinutes: STARTUP_DELAY_MINUTES });
    })
    .catch(logScheduleError)
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && DAILY_POPUP_KEY in changes) {
    syncDailyAlarm().catch(logScheduleError);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME || alarm.name === STARTUP_ALARM_NAME) {
    checkAndShowPopup();
  }
});

function logScheduleError(error) {
  console.error("Could not schedule the daily popup:", error);
}

// A missing or non-true value counts as off.
export async function isDailyPopupEnabled() {
  const stored = await chrome.storage.local.get(DAILY_POPUP_KEY);
  return stored[DAILY_POPUP_KEY] === true;
}

// Makes the alarms match the setting: scheduled when on, cleared when off.
export async function syncDailyAlarm() {
  if (await isDailyPopupEnabled()) {
    await ensureDailyAlarm();
  } else {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(STARTUP_ALARM_NAME);
  }
}

export async function ensureDailyAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (existing && existing.periodInMinutes === CHECK_PERIOD_MINUTES) return;
  // Missing, or left over from an older version with a different schedule.
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: CHECK_PERIOD_MINUTES,
    periodInMinutes: CHECK_PERIOD_MINUTES
  });
}

// Serializes checks so two alarms firing together can't open two windows.
let pendingCheck = Promise.resolve();

export function checkAndShowPopup() {
  pendingCheck = pendingCheck.then(showPopupIfOwed).catch((error) => {
    console.error("Daily popup check failed:", error);
  });
  return pendingCheck;
}

export async function showPopupIfOwed() {
  if (!(await isDailyPopupEnabled())) return;
  const today = new Date().toDateString();
  const { lastPopupDate } = await chrome.storage.local.get("lastPopupDate");
  if (lastPopupDate === today) return;

  // Record first so an overlapping check skips it.
  await chrome.storage.local.set({ lastPopupDate: today });
  try {
    await chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      focused: true
    });
  } catch (error) {
    // Couldn't open a window; let the next check retry today.
    if (lastPopupDate === undefined) {
      await chrome.storage.local.remove("lastPopupDate");
    } else {
      await chrome.storage.local.set({ lastPopupDate });
    }
    throw error;
  }
}
