// 右键菜单创建 - 在 Service Worker 中实现
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ai-prompt-finder",
    title: "识别AI提示词",
    contexts: ["image"]
  });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ai-prompt-finder" && info.srcUrl) {
    // 发送图片URL到background处理
    chrome.runtime.sendMessage({
      action: "analyzeImage",
      imageUrl: info.srcUrl,
      source: "contextMenu"
    });
  }
});

// Content Script - 图片点击处理（如果需要从页面内触发）
// 当用户点击页面图片时的处理逻辑可以在这里扩展
