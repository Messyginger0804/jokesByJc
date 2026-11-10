// Opens the joke popup in its own window once per calendar day.
//
// A periodic alarm checks every hour whether today's popup has been shown yet.
// The alarm is only created when missing (never reset on startup), and an extra
// check runs shortly after the browser starts, so short browsing sessions still
// get their daily joke.

const ALARM_NAME = "dailyPopup";
const STARTUP_ALARM_NAME = "dailyPopupStartup";
const CHECK_PERIOD_MINUTES = 60;
const STARTUP_DELAY_MINUTES = 1;

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;

chrome.runtime.onInstalled.addListener(() => {
  ensureDailyAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDailyAlarm();
  // Give the browser a moment to restore its session before opening a window.
  await chrome.alarms.create(STARTUP_ALARM_NAME, { delayInMinutes: STARTUP_DELAY_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME || alarm.name === STARTUP_ALARM_NAME) {
    checkAndShowPopup();
  }
});

async function ensureDailyAlarm() {
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

function checkAndShowPopup() {
  pendingCheck = pendingCheck.then(showPopupIfOwed).catch((error) => {
    console.error("Daily popup check failed:", error);
  });
  return pendingCheck;
}

async function showPopupIfOwed() {
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
    await chrome.storage.local.set({ lastPopupDate: lastPopupDate ?? null });
    throw error;
  }
}
