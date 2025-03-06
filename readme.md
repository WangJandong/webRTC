# WebRTC 实时通信项目

这是一个基于WebRTC的实时音视频通信项目，包含文本聊天、音视频通话等功能。

## 功能特性
- 用户登录/注册
- 实时文本聊天
- 音视频通话
- 在线用户列表

## 技术栈
- 前端：HTML5, CSS3, JavaScript
- 后端：Node.js, Express
- 通信协议：WebRTC, WebSocket
- 安全：HTTPS, TLS/SSL

## 安装与运行
1. 克隆项目
   ```bash
   git clone https://github.com/yourusername/webrtc-project.git
   cd webrtc-project
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 配置证书
   - 将SSL证书放入`cert/`目录
   - 确保证书文件名为`cert.pem`和`key.pem`

4. 启动服务器
   ```bash
   node server.js
   ```

5. 访问应用
   - 打开浏览器访问 `https://localhost:3000`

## 项目结构
```
.
├── cert/                # SSL证书目录
├── public/              # 前端资源
│   ├── css/             # 样式文件
│   ├── js/              # JavaScript文件
│   ├── chat.html        # 聊天页面
│   └── login.html       # 登录页面
├── .gitignore           # Git忽略文件
├── package.json         # 项目配置
├── package-lock.json    # 依赖锁定文件
├── readme.md            # 项目说明
└── server.js            # 服务器入口文件
```

## 注意事项
- 请使用支持WebRTC的现代浏览器访问
- 首次访问需要允许使用摄像头和麦克风
- 本地开发时浏览器可能会提示不安全连接，请选择继续访问
