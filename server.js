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
const rooms = new Map(); // 修改为 Map 存储房间信息
const preCreatedRooms = ['room1', 'room2', 'room3', 'test'];
preCreatedRooms.forEach(room => {
  rooms.set(room, new Map());
});
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

  socket.on('join', ({ room, userName }) => {
    if (!rooms.has(room)) {
      rooms.set(room, new Map());
    }
    const roomUsers = rooms.get(room);

    // 将新用户添加到房间
    roomUsers.set(socket.id, { userName, color: getRandomColor() });
    socket.join(room);

    // 发送房间内现有用户列表给新用户
    const existingUsers = Array.from(roomUsers.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, user]) => ({
        id,
        userName: user.userName,
        color: user.color
      }));

    socket.emit('joined', {
      room,
      color: roomUsers.get(socket.id).color,
      users: existingUsers
    });

    // 通知其他用户有新用户加入
    socket.to(room).emit('userJoined', {
      id: socket.id,
      userName,
      color: roomUsers.get(socket.id).color
    });
  });

  socket.on('signal', ({ signal, targetUser }) => {
    io.to(targetUser).emit('signal', { signal, userId: socket.id });
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
    for (const [roomId, users] of rooms) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(roomId).emit('userLeft', { id: socket.id });
        if (users.size === 0) {
          rooms.delete(roomId);
        }
        break;
      }
    }
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
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`HTTPS server listening on port ${PORT}`);
  console.log('Pre-created rooms:', [...rooms]);
});
