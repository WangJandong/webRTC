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
    const mainVideo = document.getElementById('mainVideo');
    mainVideo.srcObject = stream;

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
  // 立即为新用户创建一个视频框，即使还没有视频流
  createOrUpdateRemoteVideo(user.id, null, user.userName);
  
  const pc = initializePeerConnection(user.id);
  
  // 创建并发送offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', {
    signal: pc.localDescription,
    targetUser: user.id
  });
});


function createOrUpdateRemoteVideo(userId, stream, userName) {
  let videoElement = document.getElementById(`video-${userId}`);
  if (!videoElement) {
    const sideVideoContainer = document.getElementById('sideVideoContainer');
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    
    videoElement = document.createElement('video');
    videoElement.id = `video-${userId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    
    // 存储流的映射关系
    if (stream) {
      streamMappings.set(userId, stream);
    }
    
    // 添加用户标识
    const userLabel = document.createElement('div');
    userLabel.className = 'video-user-label';
    userLabel.textContent = userName || `用户 ${userId}`;
    
    videoWrapper.appendChild(videoElement);
    videoWrapper.appendChild(userLabel);
    sideVideoContainer.appendChild(videoWrapper);
    
    videoElement.addEventListener('click', () => {
      if (stream) {
        setMainVideo(userId);
      }
    });
  }
  
  if (stream) {
    streamMappings.set(userId, stream);
    videoElement.srcObject = stream;
  } else {
    videoElement.srcObject = null;
    videoElement.style.backgroundColor = '#000';
    videoElement.poster = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}

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



// ... existing code ...

// 存储视频流的映射关系
const streamMappings = new Map();

function createOrUpdateRemoteVideo(userId, stream) {
  let videoElement = document.getElementById(`video-${userId}`);
  if (!videoElement) {
    const sideVideoContainer = document.getElementById('sideVideoContainer');
    videoElement = document.createElement('video');
    videoElement.id = `video-${userId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    
    // 存储流的映射关系
    if (stream) {
      streamMappings.set(userId, stream);
    }
    
    // 添加默认背景和用户标识
    videoElement.style.backgroundColor = '#000';
    const userLabel = document.createElement('div');
    userLabel.className = 'video-user-label';
    userLabel.textContent = `用户 ${userId}`;
    sideVideoContainer.appendChild(userLabel);
    
    videoElement.addEventListener('click', () => {
      if (stream) {
        setMainVideo(userId);
      }
    });
    
    sideVideoContainer.appendChild(videoElement);
  }
  
  if (stream) {
    streamMappings.set(userId, stream);
    videoElement.srcObject = stream;
  } else {
    videoElement.srcObject = null;
    videoElement.poster = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}

function setMainVideo(userId) {
  const mainVideo = document.getElementById('mainVideo');
  const clickedVideo = document.getElementById(`video-${userId}`);
  
  // 获取当前主视频的用户ID
  const currentMainUserId = [...streamMappings.entries()]
    .find(([id, stream]) => stream === mainVideo.srcObject)?.[0];
    
  if (currentMainUserId) {
    // 将主视频的流切换到侧边视频
    const mainStream = streamMappings.get(currentMainUserId);
    clickedVideo.srcObject = mainStream;
  }
  
  // 将点击的视频流设置为主视频
  const clickedStream = streamMappings.get(userId);
  mainVideo.srcObject = clickedStream;

  // 更新边框样式
  document.querySelectorAll('.side-videos video').forEach(video => {
    video.style.borderColor = video.id === `video-${userId}` ? '#007bff' : '#ccc';
  });
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
