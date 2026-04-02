// AI Prompt Finder - Popup JavaScript

document.addEventListener("DOMContentLoaded", () => {
  // ============ Tab切换 ============
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${tabId}`).classList.add("active");
    });
  });

  // ============ 设置面板切换 ============
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");

  settingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  // ============ 文件上传 ============
  const uploadArea = document.getElementById("upload-area");
  const fileInput = document.getElementById("file-input");

  uploadArea.addEventListener("click", () => fileInput.click());

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "#333";
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.style.borderColor = "#ccc";
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "#ccc";
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageFile(file);
    }
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });

  // ============ 粘贴功能 ============
  const pasteArea = document.getElementById("paste-area");

  pasteArea.addEventListener("paste", (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          showPreview(event.target.result, "paste-preview");
          analyzeImage(event.target.result);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  });

  // ============ 历史记录按钮 ============
  document.getElementById("history-btn").addEventListener("click", () => {
    showHistory();
  });

  // ============ 加载设置 ============
  loadSettings();

  // ============ 保存设置 ============
  document.getElementById("save-settings").addEventListener("click", async () => {
    const settings = {
      apiProvider: document.getElementById("api-provider").value,
      apiKey: document.getElementById("api-key").value
    };
    await chrome.runtime.sendMessage({ action: "saveSettings", settings });
    alert("设置已保存");
  });

  // ============ 复制按钮 ============
  document.getElementById("copy-btn").addEventListener("click", () => {
    const promptText = document.getElementById("prompt-output").textContent;
    const englishPrompt = extractEnglish(promptText);
    navigator.clipboard.writeText(englishPrompt);
    alert("英文提示词已复制");
  });

  document.getElementById("copy-zh-btn").addEventListener("click", () => {
    const promptText = document.getElementById("prompt-output").textContent;
    const chinesePrompt = extractChinese(promptText);
    navigator.clipboard.writeText(chinesePrompt);
    alert("中文描述已复制");
  });
});

// ============ 辅助函数 ============

function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    showPreview(e.target.result, "preview-container");
    analyzeImage(e.target.result);
  };
  reader.readAsDataURL(file);
}

function showPreview(src, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<img src="${src}" alt="Preview">`;
  container.classList.remove("hidden");
}

function showResult(prompt) {
  const resultArea = document.getElementById("result-area");
  const promptOutput = document.getElementById("prompt-output");
  promptOutput.textContent = prompt;
  resultArea.classList.remove("hidden");
}

function showLoading() {
  const resultArea = document.getElementById("result-area");
  resultArea.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>正在分析图片...</p>
    </div>
  `;
  resultArea.classList.remove("hidden");
}

function showError(message) {
  const resultArea = document.getElementById("result-area");
  resultArea.innerHTML = `<p style="color: red;">错误: ${message}</p>`;
  resultArea.classList.remove("hidden");
}

function extractEnglish(text) {
  const match = text.match(/【英文】\s*([\s\S]*?)(?=【中文】|$)/);
  return match ? match[1].trim() : text;
}

function extractChinese(text) {
  const match = text.match(/【中文】\s*([\s\S]*?)$/);
  return match ? match[1].trim() : text;
}

async function analyzeImage(imageData) {
  showLoading();

  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      showError("请先在设置中配置API Key");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: "analyzeImage",
      imageUrl: imageData,
      provider: settings.apiProvider
    });

    if (response.success) {
      showResult(response.prompt);
    } else {
      showError(response.error);
    }
  } catch (error) {
    showError(error.message);
  }
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getSettings" }, resolve);
  });
}

async function loadSettings() {
  try {
    const settings = await getSettings();
    document.getElementById("api-provider").value = settings.apiProvider || "openai";
    document.getElementById("api-key").value = settings.apiKey || "";
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

async function showHistory() {
  try {
    const history = await chrome.runtime.sendMessage({ action: "getHistory" });
    if (history && history.length > 0) {
      const resultArea = document.getElementById("result-area");
      let historyHtml = '<h3>历史记录</h3><div style="max-height: 300px; overflow-y: auto;">';
      history.forEach(item => {
        historyHtml += `
          <div style="padding: 8px; border-bottom: 1px solid #eee;">
            <img src="${item.imageUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 8px;">
            <span style="font-size: 12px; color: #666;">${new Date(item.timestamp).toLocaleString()}</span>
          </div>
        `;
      });
      historyHtml += '</div>';
      resultArea.innerHTML = historyHtml;
      resultArea.classList.remove("hidden");
    } else {
      showError("暂无历史记录");
    }
  } catch (error) {
    showError("无法加载历史记录");
  }
}
