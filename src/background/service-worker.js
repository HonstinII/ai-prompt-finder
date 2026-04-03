// AI Prompt Finder - Service Worker
// 包含存储管理和API调用

// ============ 硬编码API配置 ============
const API_CONFIG = {
  endpoint: "https://api.alltoken.co/v1",
  apiKey: "sk-hzeBKuTfDfzpnT2329CS4Bo9WLBzl2Nx83rMQ3jANRGs5Gng",
  model: "kimi-k2.5"
};

// ============ 存储管理 ============

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
  const { endpoint, apiKey, model } = API_CONFIG;

  if (!endpoint || endpoint === "https://your-api-endpoint.com/v1") {
    throw new Error("请先配置API地址");
  }
  if (!apiKey || apiKey === "your-api-key-here") {
    throw new Error("请先配置API Key");
  }
  if (!model) {
    throw new Error("请先配置模型名称");
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

  const baseUrl = endpoint.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
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

// ============ 右键菜单 ============

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ai-prompt-finder",
    title: "识别AI提示词",
    contexts: ["image"]
  });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ai-prompt-finder" && info.srcUrl) {
    console.log("Context menu clicked, image URL:", info.srcUrl);

    // 保存待分析的图片URL，popup打开后会立即读取并显示loading
    await chrome.storage.local.set({
      pendingAnalysis: {
        imageUrl: info.srcUrl,
        timestamp: Date.now()
      }
    });

    // 保存右键点击位置，用于定位popup
    if (info.pageUrl) {
      await chrome.storage.local.set({ clickPageUrl: info.pageUrl });
    }

    // 打开popup窗口
    chrome.action.openPopup().catch(() => {
      // 如果openPopup失败，创建新窗口
      chrome.windows.create({
        url: "src/popup/popup.html",
        type: "popup",
        width: 380,
        height: 480,
        left: Math.min(info.mouseX, screen.availWidth - 400),
        top: Math.min(info.mouseY, screen.availHeight - 500)
      });
    });
  }
});

// ============ 消息监听器 ============

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

  if (message.action === "getHistory") {
    getHistory().then(history => sendResponse(history));
    return true;
  }

  if (message.action === "getPendingAnalysis") {
    chrome.storage.local.get(["pendingAnalysis"]).then(result => {
      sendResponse(result.pendingAnalysis || null);
    });
    return true;
  }

  if (message.action === "clearPendingAnalysis") {
    chrome.storage.local.remove(["pendingAnalysis"]).then(() => sendResponse(true));
    return true;
  }
});

// ============ 启动日志 ============
console.log("AI Prompt Finder background service worker loaded");