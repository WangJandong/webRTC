// 检查用户是否已经登录
const userName = sessionStorage.getItem('userName');
const roomId = sessionStorage.getItem('roomId');
const userColor = sessionStorage.getItem('userColor');
const peerConnections = new Map(); // 存储所有对等连接


if (!userName || !roomId) {
  window.location.href = '/';
}

// 显示用户和房间信息
document.getElementById('currentUser').textContent = userName;
document.getElementById('currentRoom').textContent = roomId;

const socket = io();
let peerConnection;
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// 初始化本地视频
let localStream;

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    document.getElementById('localVideo').srcObject = stream;

    // 初始化媒体控制按钮
    initMediaControls();

    // 自动加入房间
    socket.emit('join', { room: roomId, userName: userName });
  })
  .catch(error => {
    console.error('Error accessing media devices:', error);
    alert('Could not access camera or microphone. Please check permissions.');

    // 即使没有媒体设备，仍然加入房间进行文字聊天
    socket.emit('join', { room: roomId, userName: userName });
  });

socket.on('joined', (data) => {
  initializePeerConnection();
});

socket.on('signal', async ({ signal, userId }) => {
  let pc = peerConnections.get(userId);
  if (!pc) {
    pc = initializePeerConnection(userId);
  }

  if (signal.type === 'offer') {
    await pc.setRemoteDescription(new RTCSessionDescription(signal));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('signal', {
      signal: pc.localDescription,
      targetUser: userId
    });
  } else if (signal.type === 'answer') {
    await pc.setRemoteDescription(new RTCSessionDescription(signal));
  } else if (signal.candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(signal));
  }
});

socket.on('message', message => {
  addMessageToChat(message);
});

socket.on('image', imageInfo => {
  addImageToChat(imageInfo);
});

socket.on('userJoined', async (user) => {
  const pc = initializePeerConnection(user.id);
  
  // 创建并发送offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', {
    signal: pc.localDescription,
    targetUser: user.id
  });
});

socket.on('userLeft', ({ id }) => {
  const videoElement = document.getElementById(`video-${id}`);
  if (videoElement) {
    videoElement.remove();
  }
  if (peerConnections.has(id)) {
    peerConnections.get(id).close();
    peerConnections.delete(id);
  }
});

function createOrUpdateRemoteVideo(userId, stream) {
  let videoElement = document.getElementById(`video-${userId}`);
  if (!videoElement) {
    const videoContainer = document.querySelector('.video-container');
    videoElement = document.createElement('video');
    videoElement.id = `video-${userId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoContainer.appendChild(videoElement);
  }
  videoElement.srcObject = stream;
}

function initializePeerConnection(userId) {
  const peerConnection = new RTCPeerConnection(configuration);
  peerConnections.set(userId, peerConnection);

  // 添加本地流
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // 监听远程流
  peerConnection.ontrack = event => {
    createOrUpdateRemoteVideo(userId, event.streams[0]);
  };

  // ICE Candidate处理
  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('signal', { 
        signal: candidate, 
        targetUser: userId 
      });
    }
  };

  return peerConnection;
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();

  if (message) {
    socket.emit('message', { 
      message, 
      room: roomId, 
      userName: userName,
      color: userColor
    });
    input.value = '';
  }
}

function addMessageToChat(message) {
  const chat = document.getElementById('chat');
  const messageDiv = document.createElement('div');
  messageDiv.className = message.isSystem ? 'chat-message system-message' : 'chat-message';

  if (message.isSystem) {
    messageDiv.textContent = message.text;
  } else {
    const userSpan = document.createElement('span');
    userSpan.className = 'username';
    userSpan.style.color = message.color;
    userSpan.textContent = message.user + ': ';

    const messageContent = document.createElement('span');
    messageContent.textContent = message.text;

    messageDiv.appendChild(userSpan);
    messageDiv.appendChild(messageContent);
  }

  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight;
}

function addImageToChat(imageInfo) {
  const chat = document.getElementById('chat');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';

  const userSpan = document.createElement('span');
  userSpan.className = 'username';
  userSpan.style.color = imageInfo.color;
  userSpan.textContent = imageInfo.user + ': ';

  const image = document.createElement('img');
  image.src = imageInfo.imageData;
  image.className = 'chat-image';

  messageDiv.appendChild(userSpan);
  messageDiv.appendChild(document.createElement('br'));
  messageDiv.appendChild(image);

  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight;
}

function triggerImageUpload() {
  document.getElementById('imageInput').click();
}

// 处理图片上传
document.getElementById('imageInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file && file.type.match('image.*')) {
    const reader = new FileReader();

    reader.onload = function(event) {
      socket.emit('image', {
        imageData: event.target.result,
        room: roomId,
        userName: userName,
        color: userColor
      });
    };

    reader.readAsDataURL(file);
    this.value = ''; // 重置文件输入，允许上传相同的文件
  }
});

// 支持Enter键发送消息
document.getElementById('messageInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault(); // 防止默认的换行行为
    sendMessage();
  }
});

// 初始化媒体控制
function initMediaControls() {
  const videoBtn = document.getElementById('videoControl');
  const audioBtn = document.getElementById('audioControl');

  // 视频控制
  videoBtn.addEventListener('click', () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      videoBtn.classList.toggle('video-on', videoTrack.enabled);
      videoBtn.classList.toggle('video-off', !videoTrack.enabled);
    }
  });

  // 音频控制
  audioBtn.addEventListener('click', () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      audioBtn.classList.toggle('audio-on', audioTrack.enabled);
      audioBtn.classList.toggle('audio-off', !audioTrack.enabled);
    }
  });

  // 初始化按钮状态
  videoBtn.classList.add('video-on');
  audioBtn.classList.add('audio-on');
}
