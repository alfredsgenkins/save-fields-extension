var not_loaded = true;

chrome.browserAction.onClicked.addListener(function(tab) {
    if (tab) {
        chrome.tabs.sendMessage(tab.id, true);
    }
});