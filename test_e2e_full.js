const axios = require('axios');
const io = require('socket.io-client');

const API_BASE = 'https://tales-vpn-stronger-pst.trycloudflare.com/api';
const SOCKET_BASE = 'https://tales-vpn-stronger-pst.trycloudflare.com';

async function runTest() {
  console.log('=== 1. Testing Login via Cloudflare Tunnel ===');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'john@gmail.com',
    password: '12345678',
  });
  console.log('Login success:', loginRes.data.success, 'User:', loginRes.data.data.user.username);
  const token = loginRes.data.data.token;

  console.log('\n=== 2. Creating / Joining Room ===');
  const roomRes = await axios.post(
    `${API_BASE}/rooms`,
    { name: 'John’s YouTube Music Room' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const room = roomRes.data.data.room || roomRes.data.data;
  console.log('Room created:', room.name, 'Code:', room.room_code || room.roomCode, 'ID:', room.id);

  console.log('\n=== 3. Searching YouTube Music for "Rathinamo Female Version" ===');
  const searchRes = await axios.get(`${API_BASE}/search`, {
    params: { q: 'Rathinamo Female Version' },
    headers: { Authorization: `Bearer ${token}` },
  });
  const results = searchRes.data.data.results || searchRes.data.data;
  console.log(`Found ${results.length} results.`);
  const targetSong = results[0];
  console.log('Target song:', {
    title: targetSong.title,
    artist: targetSong.artist,
    videoId: targetSong.videoId,
    musicVideoId: targetSong.musicVideoId,
    hasVideo: targetSong.hasVideo,
  });

  if (!targetSong.hasVideo) {
    throw new Error('Expected target song to have video counterpart!');
  }

  console.log('\n=== 4. Connecting via WebSocket with Token ===');
  const socket = io(SOCKET_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('error', (err) => {
    console.error('>>> RECEIVED SOCKET ERROR:', err);
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('Socket connected! ID:', socket.id);
      resolve();
    });
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Socket connection timeout')), 7000);
  });

  console.log('\n=== 5. Joining Room via Socket ===');
  socket.emit('rejoin_room', { roomId: room.id });

  let trackChangedPromise = new Promise((resolve) => {
    socket.once('track_changed', (data) => {
      console.log('EVENT: track_changed received! Track:', data.track?.title);
      resolve(data.track);
    });
  });

  console.log('\n=== 6. Adding Song to Queue ===');
  socket.emit('add_song', {
    roomId: room.id,
    videoId: targetSong.videoId,
    title: targetSong.title,
    artist: targetSong.artist,
    duration: targetSong.duration,
    thumbnail: targetSong.thumbnails?.high || targetSong.thumbnails?.default,
    musicVideoId: targetSong.musicVideoId,
    hasVideo: targetSong.hasVideo,
  });

  const changedTrack = await trackChangedPromise;
  console.log('Confirmed now playing track:', changedTrack.title, 'hasVideo:', changedTrack.has_video || changedTrack.hasVideo);

  console.log('\n=== 7. Toggling Video Mode ===');
  const videoModePromise = new Promise((resolve) => {
    socket.once('video_mode_changed', (data) => {
      console.log('EVENT: video_mode_changed received! isVideoMode:', data.isVideoMode);
      resolve(data);
    });
  });

  socket.emit('toggle_video_mode', {
    roomId: room.id,
    isVideoMode: true,
    position: 15,
  });

  const videoModeData = await videoModePromise;
  console.log('Video mode verified:', videoModeData);

  console.log('\n=== 8. Testing Play & Pause Sync ===');
  const playPromise = new Promise((resolve) => {
    socket.once('playback_state', (data) => {
      console.log('EVENT: playback_state received! State:', data.state, 'Position:', data.position);
      resolve(data);
    });
  });

  socket.emit('play', { roomId: room.id, position: 20 });
  await playPromise;

  console.log('\n=== 9. Adding Second Track for Next/Skip Test ===');
  const queueUpdatedPromise = new Promise((resolve) => {
    socket.once('queue_updated', (data) => {
      console.log('EVENT: queue_updated received! Count:', data.queue.length);
      resolve(data.queue);
    });
  });

  socket.emit('add_song', {
    roomId: room.id,
    videoId: 'second_track_test_id',
    title: 'Second Test Track',
    artist: 'Second Artist',
    duration: 180,
    thumbnail: null,
    musicVideoId: null,
    hasVideo: false,
  });

  const updatedQueue = await queueUpdatedPromise;
  console.log('Queue has items:', updatedQueue.length);

  console.log('\n=== 10. Testing Next Track Skip ===');
  const nextTrackPromise = new Promise((resolve) => {
    socket.once('track_changed', (data) => {
      console.log('EVENT: Next track played! Title:', data.track?.title);
      resolve(data.track);
    });
  });

  socket.emit('next_track', { roomId: room.id });
  const nextTrack = await nextTrackPromise;
  console.log('Next track confirmed:', nextTrack?.title);

  console.log('\n=== 11. Testing Previous Track ===');
  const prevTrackPromise = new Promise((resolve) => {
    socket.once('track_changed', (data) => {
      console.log('EVENT: Previous track restored! Title:', data.track?.title);
      resolve(data.track);
    });
  });

  socket.emit('previous_track', { roomId: room.id });
  const prevTrack = await prevTrackPromise;
  console.log('Previous track confirmed:', prevTrack?.title);

  socket.disconnect();
  console.log('\n ALL 11 TEST SCENARIOS PASSED WITH FLYING COLORS! ');
}

runTest().catch((err) => {
  console.error('Test failed:', err.response?.data || err.message);
  process.exit(1);
});
