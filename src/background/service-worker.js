// AI Prompt Finder - Service Worker
// 包含存储管理和API调用

// ============ 存储管理 ============

// 默认设置
const DEFAULT_SETTINGS = {
  apiProvider: "openai", // "openai" | "anthropic"
  apiKey: "",
  customEndpoint: "", // 中转站地址，如 https://api.openai.com/v1
  language: "both" // "en" | "zh" | "both"
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
async function analyzeImage(imageUrl, provider) {
  const settings = await getSettings();
  const apiKey = settings.apiKey;
  const customEndpoint = settings.customEndpoint;
  const actualProvider = provider || settings.apiProvider;

  if (!apiKey) {
    throw new Error("请先在设置中配置API Key");
  }

  if (actualProvider === "anthropic") {
    return await analyzeWithClaude(imageUrl, apiKey, customEndpoint);
  } else {
    return await analyzeWithOpenAI(imageUrl, apiKey, customEndpoint);
  }
}

// OpenAI GPT-4V 调用
async function analyzeWithOpenAI(imageUrl, apiKey, customEndpoint) {
  const baseUrl = customEndpoint || "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
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
          ]
        }
      ],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Anthropic Claude Vision 调用
async function analyzeWithClaude(imageUrl, apiKey, customEndpoint) {
  // 将图片URL转换为base64
  let base64Data;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();
    base64Data = await blobToBase64(blob);
  } catch (error) {
    // 如果是 data URL（base64直接传入），直接提取
    if (imageUrl.startsWith('data:')) {
      base64Data = imageUrl.split(',')[1];
    } else {
      throw new Error(`无法获取图片: ${error.message}`);
    }
  }

  const baseUrl = customEndpoint || "https://api.anthropic.com/v1";
  const claudeResponse = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
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
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ]
    })
  });

  if (!claudeResponse.ok) {
    const errorData = await claudeResponse.json().catch(() => ({}));
    throw new Error(`Claude API error: ${claudeResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await claudeResponse.json();
  return data.content[0].text;
}

// ============ 消息监听器 ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeImage") {
    analyzeImage(message.imageUrl, message.provider)
      .then(async (prompt) => {
        // 保存到历史记录
        await addToHistory({
          imageUrl: message.imageUrl,
          prompt: prompt,
          provider: message.provider || 'openai'
        });
        sendResponse({ success: true, prompt });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
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
});

// ============ 启动日志 ============
console.log("AI Prompt Finder background service worker loaded");
