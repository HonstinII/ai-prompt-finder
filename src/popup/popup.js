// AI Prompt Finder - Popup JavaScript

// Toast 显示函数
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2000);
}

document.addEventListener("DOMContentLoaded", async () => {
  // ============ 检查URL参数是否有待分析的图片（右键菜单触发） ============
  const urlParams = new URLSearchParams(window.location.search);
  const imageUrlParam = urlParams.get('imageUrl');

  if (imageUrlParam) {
    const imageUrl = decodeURIComponent(imageUrlParam);

    // 有待分析的图片，立即显示loading状态
    document.getElementById("upload-zone").classList.add("hidden");
    document.getElementById("preview-container").classList.remove("hidden");
    document.getElementById("preview-image").src = imageUrl;
    document.getElementById("loading-area").classList.remove("hidden");

    // 调用分析
    try {
      const response = await chrome.runtime.sendMessage({
        action: "analyzeImage",
        imageUrl: imageUrl
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

  // ============ 关闭按钮 ============
  document.getElementById("close-btn").addEventListener("click", () => {
    window.close();
  });

  // ============ 历史记录按钮 ============
  document.getElementById("history-btn").addEventListener("click", () => {
    showHistory();
  });

  // ============ 统一上传区域 ============
  const uploadZone = document.getElementById("upload-zone");
  const fileInput = document.getElementById("file-input");

  // 点击上传
  uploadZone.addEventListener("click", () => fileInput.click());

  // 拖拽上传
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageFile(file);
    }
  });

  // 文件选择
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });

  // ============ 全局粘贴监听 ============
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
        }
        break;
      }
    }
  });

  // ============ 复制按钮 ============
  document.addEventListener("click", (e) => {
    if (e.target.id === "copy-btn" || e.target.closest("#copy-btn")) {
      const btn = e.target.id === "copy-btn" ? e.target : e.target.closest("#copy-btn");
      const promptText = document.getElementById("prompt-output").textContent;
      const englishPrompt = extractEnglish(promptText);
      navigator.clipboard.writeText(englishPrompt);
      showToast("英文提示词已复制");
    }

    if (e.target.id === "copy-zh-btn" || e.target.closest("#copy-zh-btn")) {
      const btn = e.target.id === "copy-zh-btn" ? e.target : e.target.closest("#copy-zh-btn");
      const promptText = document.getElementById("prompt-output").textContent;
      const chinesePrompt = extractChinese(promptText);
      navigator.clipboard.writeText(chinesePrompt);
      showToast("中文描述已复制");
    }
  });
});

// ============ 处理图片文件 ============
function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    showPreview(e.target.result);
    analyzeImage(e.target.result);
  };
  reader.readAsDataURL(file);
}

// ============ 显示预览 ============
function showPreview(src) {
  const container = document.getElementById("preview-container");
  const img = document.getElementById("preview-image");
  img.src = src;
  container.classList.remove("hidden");
}

// ============ 显示结果 ============
function showResult(prompt) {
  document.getElementById("loading-area").classList.add("hidden");
  document.getElementById("upload-zone").classList.add("hidden");

  const resultArea = document.getElementById("result-area");
  resultArea.innerHTML = `
    <h3>识别结果</h3>
    <div id="prompt-output">${prompt}</div>
    <div class="actions">
      <button id="copy-btn" class="btn-primary">复制英文</button>
      <button id="copy-zh-btn" class="btn-secondary">复制中文</button>
    </div>
  `;
  resultArea.classList.remove("hidden");
  showToast("分析完成");
}

// ============ 显示加载状态 ============
function showLoading() {
  document.getElementById("upload-zone").classList.add("hidden");
  document.getElementById("preview-container").classList.remove("hidden");

  const loadingArea = document.getElementById("loading-area");
  if (!loadingArea) {
    const container = document.querySelector(".container");
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "loading-area";
    loadingDiv.className = "loading-area";
    loadingDiv.innerHTML = `
      <div class="spinner"></div>
      <p>正在分析图片...</p>
    `;
    container.appendChild(loadingDiv);
  } else {
    loadingArea.classList.remove("hidden");
  }
}

// ============ 显示错误 ============
function showError(message) {
  document.getElementById("loading-area").classList.add("hidden");
  document.getElementById("upload-zone").classList.add("hidden");

  const resultArea = document.getElementById("result-area");
  resultArea.innerHTML = `
    <div class="error-text">错误: ${message}</div>
    <div id="prompt-output" style="display:none;"></div>
  `;
  resultArea.classList.remove("hidden");
  showToast("分析失败");
}

// ============ 提取英文提示词 ============
function extractEnglish(text) {
  const match = text.match(/【英文】\s*([\s\S]*?)(?=【中文】|$)/);
  return match ? match[1].trim() : text;
}

// ============ 提取中文描述 ============
function extractChinese(text) {
  const match = text.match(/【中文】\s*([\s\S]*?)$/);
  return match ? match[1].trim() : text;
}

// ============ 分析图片 ============
async function analyzeImage(imageData) {
  showLoading();

  try {
    const response = await chrome.runtime.sendMessage({
      action: "analyzeImage",
      imageUrl: imageData
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

// ============ 显示历史记录 ============
async function showHistory() {
  try {
    const history = await chrome.runtime.sendMessage({ action: "getHistory" });
    if (history && history.length > 0) {
      const resultArea = document.getElementById("result-area");
      let historyHtml = `
        <button class="back-btn" onclick="location.reload()">← 返回</button>
        <h3>历史记录</h3>
        <div style="max-height: 350px; overflow-y: auto;">
      `;
      history.forEach(item => {
        historyHtml += `
          <div class="history-item" onclick="loadHistoryItem('${item.imageUrl.replace(/'/g, "\\'")}', \`${item.prompt.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`)">
            <img src="${item.imageUrl}" alt="历史图片">
            <span>${new Date(item.timestamp).toLocaleString()}</span>
          </div>
        `;
      });
      historyHtml += '</div>';
      resultArea.innerHTML = historyHtml + '<div id="prompt-output" style="display:none;"></div>';
      resultArea.classList.remove("hidden");
      document.getElementById("upload-zone").classList.add("hidden");
    } else {
      showError("暂无历史记录");
    }
  } catch (error) {
    showError("无法加载历史记录");
  }
}

// ============ 加载历史记录项 ============
window.loadHistoryItem = function(imageUrl, prompt) {
  document.getElementById("preview-container").classList.remove("hidden");
  document.getElementById("preview-image").src = imageUrl;
  showResult(prompt);
};