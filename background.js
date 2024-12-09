// Schedule an alarm when Chrome starts
chrome.runtime.onStartup.addListener(() => {
    scheduleDailyPopup();
});

// Schedule an alarm when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    scheduleDailyPopup();
});

// Function to schedule the daily popup
function scheduleDailyPopup() {
    // Clear any existing alarms
    chrome.alarms.clearAll(() => {
        // Create a new alarm to fire in 1 hour
        chrome.alarms.create("dailyPopup", { delayInMinutes: 60, periodInMinutes: 1440 });
    });
}

// Handle the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "dailyPopup") {
        checkAndShowPopup();
    }
});

// Check the last shown date and show the popup if applicable
function checkAndShowPopup() {
    const today = new Date().toDateString();

    // Get the last shown date from storage
    chrome.storage.local.get("lastPopupDate", (data) => {
        if (data.lastPopupDate !== today) {
            // Show the popup (trigger the popup.html)
            chrome.windows.create({
                url: "popup.html",
                type: "popup",
                width: 500,
                height: 600,
            });

            chrome.storage.local.set({ lastPopupDate: today });
        }
    });
}
