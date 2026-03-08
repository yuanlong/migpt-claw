# migpt-claw

小米小爱音箱 OpenClaw Channel 插件，让小爱音箱成为你的 🦞龙虾 语音助手。

## 功能特性

- 🎤 **语音对话** - 对小爱音箱说话，🦞 语音回复
- 📦 **流式输出** - 长文本分块播放，降低延迟
- 🎯 **智能分流** - 长内容/代码/多媒体自动引导至其他渠道
- 🔔 **状态提示** - 支持启动播报和收到消息提示音

## 快速开始

### 1. 安装插件

```bash
# 本地安装
openclaw plugins install ./migpt-claw-1.0.0.tgz
```

### 2. 配置账号

编辑 `~/.openclaw/openclaw.json` 配置文件：

**推荐配置（密码 + passToken）**：

```json
{
  "channels": {
    "migpt": {
      "enabled": true,
      "userId": "123456789",
      "password": "your_password",
      "passToken": "your_pass_token",
      "devices": ["客厅音箱"],
      "announceOnStart": true,
      "startupMessage": "您的小龙虾已上线，随时为您服务",
      "acknowledgeOnReceive": true,
      "receiveMessage": "收到，处理中"
    }
  }
}
```

**配置说明**：
- `userId`：小米 ID（数字，在小米账号「个人信息」-「小米 ID」查看）
- `password`：小米账号密码
- `passToken`：登录辅助凭证，避免验证码（推荐配置）
- `devices`：小爱音箱设备名称列表
- `announceOnStart`：启动时是否播报上线文案
- `startupMessage`：上线播报文案
- `acknowledgeOnReceive`：收到消息时是否回复提示
- `receiveMessage`：收到消息回复文案
- `speakerControl`：音箱控制方式（`mina` 或 `miot`，默认 `mina`）

### 音箱控制方式说明

**`speakerControl`**：指定与小爱音箱通信的控制方式

- **`mina`**（默认）：使用 MiNA API，适用于大多数小爱音箱型号
- **`miot`**：使用 MIoT API，适用于部分需要特殊控制的型号

**已知需要 `miot` 的型号**：
- LX04（小爱音箱 Pro）
- X10A（小爱音箱 X10）
- L05B / L05C（小爱音箱 Play 增强版）

**注意**：
- 不同型号的小爱音箱对 `mina` 和 `miot` 的支持情况可能不同
- 如果默认 `mina` 方式无法正常工作，请尝试切换为 `miot`
- 完整兼容性列表参考：[MiGPT 兼容性文档](https://github.com/idootop/mi-gpt/blob/main/docs/compatibility.md)
- 建议自行编译测试以确定您的设备最佳配置

**特别说明**：当前项目未对所有小爱音箱型号进行全面测试，以上型号支持情况仅供参考。由于小爱音箱型号众多，不同型号可能存在差异，建议用户根据自身设备型号自行编译测试。

**配置示例**：

```json
{
  "channels": {
    "migpt": {
      "userId": "123456789",
      "password": "your_password",
      "passToken": "your_pass_token",
      "devices": ["客厅音箱"],
      "speakerControl": "miot"
    }
  }
}
```

### 3. 启动服务

```bash
openclaw gateway restart
```


## 设备名称

设备名称必须与米家 App 中设置的名称**完全一致**（包括大小写和空格）。

如果不确定设备名称，可以：
1. 开启 `debug: true` 配置
2. 启动服务查看设备列表
3. 日志中会打印所有可用设备

## 使用技能

### 播报规范

插件内置智能播报规范，AI 会自动判断内容是否适合语音播报：

- ✅ **适合播报**：简短回复、确认信息、简单问答
- ❌ **不适合播报**：代码、长文、数据、多媒体内容

对于不适合播报的内容，AI 会告知用户已通过其他渠道（如微信、邮件等）发送。

## 故障排查

### 登录失败

**错误**: `❌ 本次登录需要验证码，请使用 passToken 重新登录`

**解决**: 使用 passToken 替代密码登录，或尝试多次登录直到不需要验证码

### 设备未找到

**错误**: `❌ 找不到设备：客厅音箱`

**解决**:
1. 检查设备名称是否与米家 App 中完全一致
2. 开启 `debug: true` 查看可用设备列表
3. 注意错别字，如「音响」vs「音箱」

### 消息轮询失败

**错误**: `❌ getConversations failed`

**解决**:
1. 检查网络连接
2. 检查 serviceToken 是否过期
3. 删除 `.mi.json` 缓存文件重新登录

## 项目结构

```
migpt-claw/
├── index.ts                 # 插件入口
├── src/
│   ├── channel.ts          # Channel 核心
│   ├── service.ts          # 认证服务
│   ├── message.ts          # 消息轮询
│   ├── speaker.ts          # TTS 播放
│   ├── config.ts           # 配置解析
│   ├── types.ts            # 类型定义
│   ├── outbound.ts         # 消息发送
│   ├── onboarding.ts       # 安装向导
│   ├── runtime.ts          # 运行时管理
│   ├── mi/                 # 小米服务
│   │   ├── mina.ts        # MiNA API
│   │   ├── miot.ts        # MIoT API
│   │   ├── account.ts     # 账号认证
│   │   ├── common.ts      # 通用工具
│   │   └── typing.ts      # 类型定义
│   └── utils/              # 工具函数
│       ├── http.ts        # HTTP 请求
│       ├── codec.ts       # 编解码
│       ├── hash.ts        # 哈希工具
│       ├── io.ts          # 文件 IO
│       └── parse.ts       # 解析工具
└── skills/
    └── migpt-volume/       # 音量控制技能
        ├── index.ts
        └── SKILL.md
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

```

## AI 辅助开发

本项目由 **Qwen Code** + **Qwen3.5-Plus** 大模型开发实现。

- **[Qwen Code](https://qwenlm.github.io/qwen-code-docs/zh/users/overview/)** - 阿里巴巴通义实验室推出的终端 AI 编程助手（CLI 工具）
- **[Qwen3.5-Plus](https://github.com/QwenLM/Qwen)** - 通义千问 3.5 增强版大模型，提供强大的代码理解和生成能力

感谢 AI 助手在代码编写、问题排查和文档撰写过程中提供的智能辅助！🤖

## 相关项目

本项目受到以下优秀项目的启发和帮助：

- **[MiGPT Next](https://github.com/idootop/migpt-next)** - 让小爱音箱接入 AI 大模型，实现智能对话
- **[MiService](https://github.com/yihong0618/MiService)** - 小米账号认证和米家设备控制基础库

向以上项目的作者致敬！🙏

## 开源协议

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 免责声明

本项目仅供学习和研究使用，不得用于任何商业用途或非法目的。

- 使用本项目时，请遵守当地法律法规和小米公司的相关服务条款
- 本项目与小米公司无任何关联，不构成任何官方支持或背书
- 使用本项目可能导致小米账号异常，请谨慎使用并自行承担风险
- 建议仅使用测试账号或非主要账号进行体验
- 如因使用本项目造成的任何损失（包括但不限于账号封禁、数据丢失等），本项目作者不承担任何责任
- 本项目按「原样」提供，不提供任何明示或暗示的保证

如将本项目用于生产环境或其他重要场景，请务必：
1. 仔细阅读并遵守小米开放平台的相关规范
2. 通过官方渠道获取合法的 API 调用权限
3. 评估潜在的法律和技术风险
