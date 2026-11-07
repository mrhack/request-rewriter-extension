# Request Rewriter Chrome Extension

## 安装
1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录

## 使用
1. 点击扩展图标打开 popup
2. 点击 ＋ 新建配置，填写 URL 正则、勾选需要的修改项
3. 点击 ✓ 保存（存入 chrome.storage.local）
4. 点击「启用当前页」开始拦截（使用 Chrome Debugger API）
5. 再次点击停止

## 功能
- **修改请求**：Header（key-value 行）、Body（JSONPath 或 JS 函数）
- **修改响应**：Header、Body（同上）
- **URL 匹配**：正则表达式，空=全部请求
- **配置管理**：新建/删除/保存/取消修改，导入/导出 JSON 文件
- **持久化**：保存到 chrome.storage.local，popup 关闭后不丢失
- **未保存标记**：有未保存修改时标题旁显示小黄点
- **单配置展开**：同时只展开一个配置

## 测试
```bash
node --test
```
