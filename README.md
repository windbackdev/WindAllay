# WindAllay CLI Assistant

---

## 📖 概述

WindAllay 是一个 **AI 驱动的命令行助手**，帮助你通过自然语言与开发环境交互、运行脚本、管理文件等。它的灵感来源于 *Claude Code*，提供能够理解并执行复杂任务的对话式界面。

---

## ✨ 功能

- **自然语言指令执行** – 输入你的需求，WindAllay 会将其转换为相应的 Shell 命令。
- **上下文感知** – 记住当前工作目录、最近的命令和项目文件。
- **多模态支持** – 能处理文本、代码片段以及 JSON/YAML 等结构化数据。
- **可扩展插件** – 可以添加自定义命令或与其他工具集成。
- **跨平台** – 在 Windows、macOS、Linux 上均可使用。

---

## 🛠️ 安装

```bash
# 使用 npm 安装
npm i -g windallay

# 或者使用 pnpm
pnpm add -g windallay
```

确保已安装 **Node.js >= 18**。

---

## 🚀 使用方法

```bash
# 启动交互式助手
windallay
```

在 REPL 中，你可以输入类似以下指令：

- `列出 src 目录下的所有 JavaScript 文件`
- `运行测试套件`
- `显示最近两次提交的差异`
- `创建一个名为 Header 的 React 组件`

使用 `Ctrl-C` 或输入 `exit` 退出。

---

## 🤝 贡献

我们欢迎任何贡献！欢迎提交 issue 或 pull request。

1. Fork 项目。
2. 创建功能分支 (`git checkout -b feat/your-feature`)。
3. 运行测试 (`npm test`)。
4. 提交 PR。

---

## 📄 许可证

本项目遵循 **MIT 许可证**。

---

> **以下为英文版本 / English version below**

---

# WindAllay CLI Assistant

---

## 📖 Overview

WindAllay is an **AI‑powered command‑line assistant** that helps you interact with your development environment, run scripts, manage files, and more — all through natural language. It is inspired by the *Claude Code* experience, offering a conversational interface that can understand and execute complex tasks.

---

## ✨ Features

- **Natural‑language command execution** – type what you want to do, and WindAllay translates it into shell commands.
- **Context‑aware suggestions** – remembers the current working directory, recent commands, and project files.
- **Multi‑modal support** – can handle text, code snippets, and even JSON/YAML schemas.
- **Extensible plugins** – add custom commands or integrate with other tools.
- **Cross‑platform** – works on Windows, macOS, and Linux.

---

## 🛠️ Installation

```bash
# Using npm
npm i -g windallay

# Or using pnpm
pnpm add -g windallay
```

Make sure you have **Node.js >= 18** installed.

---

## 🚀 Usage

```bash
# Start the interactive assistant
windallay
```

Inside the REPL you can type commands like:

- `list all JavaScript files in src`
- `run the test suite`
- `show me the diff between the last two commits`
- `create a new React component named Header`

Use `Ctrl-C` or type `exit` to quit.

---

## 🤝 Contributing

We welcome contributions! Feel free to open issues or submit pull requests.

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/your-feature`).
3. Run tests (`npm test`).
4. Submit a PR.

---

## 📄 License

This project is licensed under the **MIT License**.
