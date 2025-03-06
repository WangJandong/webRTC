// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { Server } = require('socket.io');

const app = express();

// HTTPS 配置
const pfxPath = path.join(__dirname, 'certificate.pfx'); // 确保证书文件位置正确
const pfxPassword = 'password'; // 替换为您的证书密码

const httpsOptions = {
    pfx: fs.readFileSync(path.join(__dirname, 'cert', 'certificate.pfx')),
  passphrase: pfxPassword
};

// 创建 HTTPS 服务器
const server = https.createServer(httpsOptions, app);
const io = new Server(server);

// 预创建的房间列表
const rooms = new Set(['room1', 'room2', 'room3', 'test']);
// 用户颜色映射
const userColors = {};

app.use(express.static('public'));

// 路由设置
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join', ({room, userName}) => {
    if (rooms.has(room)) {
      socket.join(room);
      
      // 为用户分配随机颜色
      if (!userColors[userName]) {
        userColors[userName] = getRandomColor();
      }
      
      socket.emit('joined', {room, color: userColors[userName]});
      
      // 通知房间内其他用户有新用户加入
      socket.to(room).emit('message', {
        text: `${userName} has joined the room`,
        user: 'System',
        color: '#888888',
        isSystem: true
      });
    } else {
      socket.emit('error', 'Room does not exist');
    }
  });

  socket.on('signal', ({ signal, room }) => {
    socket.to(room).emit('signal', signal);
  });

  socket.on('message', ({ message, room, userName, color }) => {
    io.to(room).emit('message', {
      text: message, 
      user: userName, 
      color: color,
      isSystem: false
    });
  });
  
  socket.on('image', ({ imageData, room, userName, color }) => {
    io.to(room).emit('image', {
      imageData: imageData,
      user: userName,
      color: color
    });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

function getRandomColor() {
  const colors = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab',
    '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047',
    '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// 设置端口（HTTPS 通常使用 443）
const PORT = process.env.PORT || 443;

server.listen(PORT, () => {
  console.log(`HTTPS server listening on port ${PORT}`);
  console.log('Pre-created rooms:', [...rooms]);
});
