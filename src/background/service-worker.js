// AI Prompt Finder - Service Worker
// 包含存储管理和API调用

// ============ 存储管理 ============

// 默认设置
const DEFAULT_SETTINGS = {
  apiEndpoint: "", // 中转站地址，如 https://xxx.com/v1
  apiKey: "",
  apiModel: "" // 模型名称，如 gpt-4o
};

// 获取设置
async function getSettings() {
  const result = await chrome.storage.sync.get(["settings"]);
  return result.settings || DEFAULT_SETTINGS;
}

// 保存设置
async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
}

// 获取历史记录
async function getHistory() {
  const result = await chrome.storage.local.get(["history"]);
  return result.history || [];
}

// 添加到历史记录
async function addToHistory(entry) {
  const history = await getHistory();
  history.unshift({
    id: Date.now(),
    ...entry,
    timestamp: new Date().toISOString()
  });
  // 限制最多100条
  if (history.length > 100) history.pop();
  await chrome.storage.local.set({ history });
}

// ============ API 调用 ============

// 将 blob 转换为 base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 分析图片主函数
async function analyzeImage(imageUrl) {
  const settings = await getSettings();
  const { apiEndpoint, apiKey, apiModel } = settings;

  if (!apiEndpoint) {
    throw new Error("请先在设置中配置API地址");
  }
  if (!apiKey) {
    throw new Error("请先在设置中配置API Key");
  }
  if (!apiModel) {
    throw new Error("请先在设置中配置模型名称");
  }

  // 构建消息内容
  let content;
  if (imageUrl.startsWith('data:')) {
    // data URL (base64) - 直接使用
    content = [
      {
        type: "text",
        text: `分析这张图片，生成详细的AI绘画提示词。请分别用英文和中文输出：
1. 主体描述（Subject）
2. 艺术风格（Style）
3. 构图细节（Composition）
4. 色彩光线（Color & Lighting）
5. 质量修饰词（Quality modifiers）

格式：
【英文】
[英文提示词]

【中文】
[中文描述]`
      },
      {
        type: "image_url",
        image_url: { url: imageUrl }
      }
    ];
  } else {
    // 远程URL - 需要先下载转为base64
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      const mimeType = blob.type || 'image/jpeg';
      content = [
        {
          type: "text",
          text: `分析这张图片，生成详细的AI绘画提示词。请分别用英文和中文输出：
1. 主体描述（Subject）
2. 艺术风格（Style）
3. 构图细节（Composition）
4. 色彩光线（Color & Lighting）
5. 质量修饰词（Quality modifiers）

格式：
【英文】
[英文提示词]

【中文】
[中文描述]`
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` }
        }
      ];
    } catch (error) {
      throw new Error(`无法获取图片: ${error.message}`);
    }
  }

  const baseUrl = apiEndpoint.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: apiModel,
      messages: [
        {
          role: "user",
          content: content
        }
      ],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0]) {
    throw new Error(`API返回格式错误: ${JSON.stringify(data)}`);
  }
  return data.choices[0].message.content;
}

// ============ 消息监听器 ============

// 右键菜单创建
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
    console.log("Context menu clicked, image URL:", info.srcUrl);
    analyzeImage(info.srcUrl)
      .then(prompt => {
        console.log("Analysis successful, prompt:", prompt);
        chrome.notifications.create({
          type: "basic",
          title: "AI Prompt Finder",
          message: "分析完成！请查看插件弹窗。"
        });
        chrome.runtime.sendMessage({
          action: "displayResult",
          prompt: prompt
        }).catch(e => console.log("Could not send to popup:", e));
      })
      .catch(error => {
        console.error("Analysis failed:", error);
        chrome.notifications.create({
          type: "basic",
          title: "AI Prompt Finder",
          message: `错误: ${error.message}`
        });
      });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeImage") {
    analyzeImage(message.imageUrl)
      .then(async (prompt) => {
        await addToHistory({
          imageUrl: message.imageUrl,
          prompt: prompt
        });
        sendResponse({ success: true, prompt });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === "getSettings") {
    getSettings().then(settings => sendResponse(settings));
    return true;
  }

  if (message.action === "saveSettings") {
    saveSettings(message.settings).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "getHistory") {
    getHistory().then(history => sendResponse(history));
    return true;
  }

  if (message.action === "displayResult") {
    chrome.runtime.sendMessage({
      action: "displayResult",
      prompt: message.prompt
    }).catch(e => console.log("Could not send to popup:", e));
    return true;
  }
});

// ============ 启动日志 ============
console.log("AI Prompt Finder background service worker loaded");
