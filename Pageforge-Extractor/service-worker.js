// service-worker.js
// PageForge background script to configure side panel behavior.

// Configure the side panel to open when the action button (toolbar icon) is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting side panel behavior:", error));

// Optional: Log when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("PageForge extension installed and ready.");
});
