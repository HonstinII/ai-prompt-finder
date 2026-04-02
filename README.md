# AI Prompt Finder

从图片反推AI绘画提示词的Chrome扩展插件。

## 功能

- 右键网页图片快速识别
- 上传本地图片分析
- 粘贴/拖拽图片分析
- 支持 OpenAI GPT-4V 和 Claude Vision
- 双语提示词输出
- 历史记录保存

## 安装

1. 克隆项目
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

## 配置

1. 点击扩展图标打开Popover
2. 点击设置按钮
3. 选择API Provider并填入API Key
4. 保存设置

## 使用方法

### 右键菜单
在网页图片上右键，选择"识别AI提示词"

### 上传图片
1. 打开插件Popover
2. 切换到"上传"Tab
3. 选择或拖拽图片

### 粘贴图片
1. 打开插件Popover
2. 切换到"粘贴"Tab
3. Ctrl+V 粘贴图片

## 项目结构

```
ai-prompt-finder/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.js   # API调用、存储管理
│   ├── content/
│   │   └── content-script.js    # 右键菜单
│   └── popup/
│       ├── popup.html
│       ├── popup.css
│       └── popup.js
└── icons/
```
