chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "RESUME_TAILOR_TOGGLE_WIDGET",
    });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["assets/floatingWidget.js"],
    });
  }
});
