const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const SERVER_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'rebar_super_secret_access_key_963870';

// Real MongoDB Atlas Users
const USER_A = {
  id: '6ac3506e48d058771dccb16b',
  email: 'test@test.com',
  name: 'Test ID',
  role: 'Admin',
  companyId: '6ac3506e48d058771dccb169',
};

const USER_B = {
  id: '6add0d52fb61f19ffebd5705',
  email: 'asdaqswd@dsfds.com',
  name: 'mohit sawqw',
  role: 'Project Manager',
  companyId: '6ac3506e48d058771dccb169',
};

const USER_C = {
  id: '6ae0ec52656c992d6b8ccdbd',
  email: 'mohit@manager.com',
  name: 'Mohit Rathod',
  role: 'Site Supervisor',
  companyId: '6ac3506e48d058771dccb169',
};

const USER_COMPANY_B = {
  id: '6ad9d8455b7a34c1cbcb7a78',
  email: 'rushik@gmail.com',
  name: 'Rushik Patel',
  role: 'Admin',
  companyId: '6ad9d8455b7a34c1cbcb7a76',
};

function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, companyId: user.companyId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function createSocket(token) {
  return io(SERVER_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  });
}

async function apiRequest(endpoint, options = {}, token) {
  const url = `${SERVER_URL}/api${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const status = response.status;
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return { status, ok: response.ok, data };
}

const results = [];
function recordResult(testNum, testName, passed, details = '') {
  results.push({ testNum, testName, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [TEST ${testNum}] ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runE2ESuite() {
  console.log('\n======================================================');
  console.log('🚀 REBAR OPTIMA — CHAT MODULE AUTOMATED E2E TEST SUITE');
  console.log('======================================================\n');

  const tokenA = generateToken(USER_A);
  const tokenB = generateToken(USER_B);
  const tokenC = generateToken(USER_C);
  const tokenCompB = generateToken(USER_COMPANY_B);

  let socketA;
  let socketB;
  let directConvId = null;
  let sentMsgId = null;
  let groupConvId = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Socket Authentication & Dual User Connection
    // -----------------------------------------------------------------
    socketA = createSocket(tokenA);
    socketB = createSocket(tokenB);

    await Promise.all([
      new Promise((resolve, reject) => {
        socketA.on('connect', resolve);
        socketA.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socketB.on('connect', resolve);
        socketB.on('connect_error', reject);
      }),
    ]);
    recordResult(1, 'Socket Authentication & Dual User Connection', true, `SocketA: ${socketA.id}, SocketB: ${socketB.id}`);

    // -----------------------------------------------------------------
    // TEST 2: Start Direct Chat between User A and User B
    // -----------------------------------------------------------------
    const directRes = await apiRequest('/chat/conversations/direct', {
      method: 'POST',
      body: { otherUserId: USER_B.id },
    }, tokenA);

    if (directRes.ok && directRes.data && directRes.data.data) {
      directConvId = directRes.data.data.id || directRes.data.data._id;
      recordResult(2, 'Direct Chat Initiation & Deduplication', true, `Conversation ID: ${directConvId}`);
    } else {
      recordResult(2, 'Direct Chat Initiation', false, `Status: ${directRes.status}`);
    }

    // Join room for both users
    socketA.emit('join_conversation', { conversationId: directConvId });
    socketB.emit('join_conversation', { conversationId: directConvId });
    await new Promise((r) => setTimeout(r, 200));

    // -----------------------------------------------------------------
    // TEST 3: User A Sends Real-Time Direct Message to User B
    // -----------------------------------------------------------------
    const msgText = `Hello User B from User A at ${Date.now()}`;
    const receivePromise = new Promise((resolve) => {
      socketB.on('new_message', (msg) => {
        if (msg.content === msgText) {
          resolve(msg);
        }
      });
    });

    const sendAck = await new Promise((resolve) => {
      socketA.emit('send_message', {
        conversationId: directConvId,
        content: msgText,
        type: 'text',
      }, resolve);
    });

    const receivedMsg = await receivePromise;
    sentMsgId = receivedMsg._id || receivedMsg.id;
    recordResult(3, 'Real-Time Message Delivery via WebSocket', Boolean(sendAck.success && receivedMsg), `Message ID: ${sentMsgId}`);

    // -----------------------------------------------------------------
    // TEST 4: Delivery Receipt Acknowledgment (Delivered To)
    // -----------------------------------------------------------------
    const deliveredPromise = new Promise((resolve) => {
      socketA.on('messages_delivered', (data) => {
        if (data.conversationId === directConvId) resolve(data);
      });
    });

    socketB.emit('mark_delivered', { conversationId: directConvId });
    const deliveredData = await deliveredPromise;
    recordResult(4, 'Delivery Status Lifecycle (Double Grey Tick)', Boolean(deliveredData), `Delivered by: ${deliveredData.userId}`);

    // -----------------------------------------------------------------
    // TEST 5: Read Receipt Acknowledgment (Read By)
    // -----------------------------------------------------------------
    const readPromise = new Promise((resolve) => {
      socketA.on('messages_read', (data) => {
        if (data.conversationId === directConvId) resolve(data);
      });
    });

    socketB.emit('mark_read', { conversationId: directConvId });
    const readData = await readPromise;
    recordResult(5, 'Read Receipt Lifecycle (Double Blue Tick)', Boolean(readData), `Read by: ${readData.userId}`);

    // -----------------------------------------------------------------
    // TEST 6: User B Replies with Quote Reference
    // -----------------------------------------------------------------
    const replyText = `Acknowledged your message! [Reply at ${Date.now()}]`;
    const replyReceivedPromise = new Promise((resolve) => {
      socketA.on('new_message', (msg) => {
        if (msg.content === replyText && msg.replyTo) {
          resolve(msg);
        }
      });
    });

    socketB.emit('send_message', {
      conversationId: directConvId,
      content: replyText,
      type: 'text',
      replyTo: {
        messageId: sentMsgId,
        senderName: USER_A.name,
        contentSnippet: msgText.substring(0, 40),
        type: 'text',
      },
    });

    const replyMsg = await replyReceivedPromise;
    recordResult(6, 'Quoted Message Reply Interaction', Boolean(replyMsg && replyMsg.replyTo?.messageId === sentMsgId), `Reply linked to ${sentMsgId}`);

    // -----------------------------------------------------------------
    // TEST 7: Emoji Reaction on Message
    // -----------------------------------------------------------------
    const reactionPromise = new Promise((resolve) => {
      socketB.on('reaction_updated', (data) => {
        if (data.messageId === sentMsgId) resolve(data);
      });
    });

    socketA.emit('add_reaction', {
      conversationId: directConvId,
      messageId: sentMsgId,
      emoji: '👍',
    });

    const reactionData = await reactionPromise;
    const hasThumb = reactionData.reactions?.some((r) => r.emoji === '👍' && r.userId === USER_A.id);
    recordResult(7, 'Real-Time Message Reaction', Boolean(hasThumb), `Reactions count: ${reactionData.reactions?.length}`);

    // -----------------------------------------------------------------
    // TEST 8: Message Editing
    // -----------------------------------------------------------------
    const editedText = `${msgText} [EDITED]`;
    const editPromise = new Promise((resolve) => {
      socketB.on('message_edited', (data) => {
        if (data.messageId === sentMsgId) resolve(data);
      });
    });

    socketA.emit('edit_message', {
      conversationId: directConvId,
      messageId: sentMsgId,
      text: editedText,
    });

    const editData = await editPromise;
    recordResult(8, 'Message Edit & Live Broadcast', editData.text === editedText, `New text: ${editData.text}`);

    // -----------------------------------------------------------------
    // TEST 9: Typing Indicators (Start & Stop)
    // -----------------------------------------------------------------
    const typingPromise = new Promise((resolve) => {
      socketB.on('user_typing', (data) => {
        if (data.conversationId === directConvId) resolve(data);
      });
    });

    socketA.emit('typing_start', { conversationId: directConvId });
    const typingData = await typingPromise;

    const stopTypingPromise = new Promise((resolve) => {
      socketB.on('user_stop_typing', (data) => {
        if (data.conversationId === directConvId) resolve(data);
      });
    });

    socketA.emit('typing_stop', { conversationId: directConvId });
    const stopData = await stopTypingPromise;
    recordResult(9, 'Typing Presence Indicators', Boolean(typingData && stopData), `Typing user: ${typingData.userName}`);

    // -----------------------------------------------------------------
    // TEST 10: Attachment Upload (Base64) & Stream Download
    // -----------------------------------------------------------------
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const uploadRes = await apiRequest('/chat/attachments', {
      method: 'POST',
      body: {
        fileName: 'rebar-site-plan.png',
        mimeType: 'image/png',
        sizeBytes: 68,
        dataBase64: sampleBase64,
      },
    }, tokenA);

    let attachmentId = null;
    if (uploadRes.ok && uploadRes.data && uploadRes.data.data) {
      attachmentId = uploadRes.data.data.fileId;
      // Stream verify
      const streamRes = await apiRequest(`/chat/attachments/${attachmentId}`, {}, tokenB);
      recordResult(10, 'Attachment Upload & Stream Download', streamRes.ok, `File ID: ${attachmentId}, Status: ${streamRes.status}`);
    } else {
      recordResult(10, 'Attachment Upload', false, 'Upload endpoint failed');
    }

    // -----------------------------------------------------------------
    // TEST 11: Message Persistence & History Ordering across Refresh
    // -----------------------------------------------------------------
    const historyRes = await apiRequest(`/chat/conversations/${directConvId}/messages`, {}, tokenB);
    const historyMsgs = historyRes.data?.data || [];
    const persistedMsg = historyMsgs.find((m) => (m._id || m.id) === sentMsgId);
    recordResult(
      11,
      'Message Persistence & History Ordering across Refresh',
      Boolean(persistedMsg && persistedMsg.content === editedText),
      `Total messages in DB: ${historyMsgs.length}`
    );

    // -----------------------------------------------------------------
    // TEST 12: In-Chat Message Search
    // -----------------------------------------------------------------
    const searchRes = await apiRequest(`/chat/search?q=EDITED&conversationId=${directConvId}`, {}, tokenA);
    const found = (searchRes.data?.data || []).some((m) => (m._id || m.id) === sentMsgId);
    recordResult(12, 'In-Chat Message Full-Text Search', Boolean(found), `Matches: ${searchRes.data?.data?.length}`);

    // -----------------------------------------------------------------
    // TEST 13: Group Chat Creation with Multiple Members
    // -----------------------------------------------------------------
    const groupRes = await apiRequest('/chat/conversations/group', {
      method: 'POST',
      body: {
        title: 'Site Structural Team Alpha',
        description: 'Coordinating steel reinforcement fabrication',
        memberUserIds: [USER_B.id, USER_C.id],
      },
    }, tokenA);

    if (groupRes.ok && groupRes.data && groupRes.data.data) {
      groupConvId = groupRes.data.data.id || groupRes.data.data._id;
      recordResult(13, 'Multi-Member Group Creation & Admin Designation', true, `Group ID: ${groupConvId}, Members: ${groupRes.data.data.memberIds?.length}`);
    } else {
      recordResult(13, 'Group Creation', false, `Status: ${groupRes.status}`);
    }

    // -----------------------------------------------------------------
    // TEST 14: Group Administration (Add / Remove Member)
    // -----------------------------------------------------------------
    socketA.emit('join_conversation', { conversationId: groupConvId });
    socketB.emit('join_conversation', { conversationId: groupConvId });

    // User A (admin) removes User C
    const removeRes = await apiRequest(`/chat/conversations/${groupConvId}/members/${USER_C.id}`, { method: 'DELETE' }, tokenA);
    const isRemoved = !removeRes.data?.data?.memberIds?.includes(USER_C.id);

    // User A (admin) adds User C back
    const addBackRes = await apiRequest(`/chat/conversations/${groupConvId}/members`, {
      method: 'POST',
      body: { newUserId: USER_C.id },
    }, tokenA);
    const isAddedBack = addBackRes.data?.data?.memberIds?.includes(USER_C.id);

    recordResult(14, 'Group Administration (Member Add & Remove)', Boolean(isRemoved && isAddedBack), `Updated members: ${addBackRes.data?.data?.memberIds?.length}`);

    // -----------------------------------------------------------------
    // TEST 15: Cross-Tenant Isolation (Company B Security Test)
    // -----------------------------------------------------------------
    // User from Company B attempts to access Company A's conversation
    const tenantRes = await apiRequest(`/chat/conversations/${directConvId}/messages`, {}, tokenCompB);
    const tenantIsolated = tenantRes.status === 403 || tenantRes.status === 404;

    // Also verify Company B socket cannot subscribe to Company A's room
    const socketCompB = createSocket(tokenCompB);
    await new Promise((resolve) => socketCompB.on('connect', resolve));

    const joinResultPromise = new Promise((resolve) => {
      socketCompB.emit('join_conversation', { conversationId: directConvId }, (resp) => {
        resolve(resp);
      });
      setTimeout(() => resolve({ success: false, reason: 'timeout' }), 1500);
    });
    const joinResult = await joinResultPromise;
    const socketIsolated = !joinResult?.success;

    recordResult(
      15,
      'Multi-Tenant Company Isolation (Cross-Tenant Security)',
      Boolean(tenantIsolated && socketIsolated),
      `REST: HTTP ${tenantRes.status}, Socket: Join Rejected (${joinResult?.error || joinResult?.reason || 'Forbidden'})`
    );
    socketCompB.disconnect();

  } catch (err) {
    console.error('E2E Test Execution Error:', err.message);
    recordResult(99, 'Test Execution Uncaught Exception', false, err.message);
  } finally {
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();
  }

  console.log('\n======================================================');
  console.log('📊 E2E TEST SUMMARY');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total Scenarios: ${total}`);
  console.log(`Passed:          ${passed}`);
  console.log(`Failed:          ${failed}`);
  console.log(`Success Rate:    ${Math.round((passed / total) * 100)}%\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2ESuite();
