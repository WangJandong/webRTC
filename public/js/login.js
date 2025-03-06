const socket = io();

function joinRoom() {
  const userName = document.getElementById('userNameInput').value.trim();
  const room = document.getElementById('roomInput').value.trim();

  if (!userName) {
    document.getElementById('error').textContent = 'Please enter a user name';
    return;
  }

  if (!room) {
    document.getElementById('error').textContent = 'Please enter a room ID';
    return;
  }

  // 保存用户信息到sessionStorage
  sessionStorage.setItem('userName', userName);
  sessionStorage.setItem('roomId', room);

  // 加入房间
  socket.emit('join', { room, userName });

  socket.on('joined', (data) => {
    // 保存用户颜色
    sessionStorage.setItem('userColor', data.color);
    // 跳转到聊天页面
    window.location.href = '/chat';
  });

  socket.on('error', (message) => {
    document.getElementById('error').textContent = message;
  });
}