// HTTP/WebSocket API Server for external control
// Allows external applications (Bitfocus Companion, vMix, Stream Deck) to control the client

const http = require('http');
const { EventEmitter } = require('events');

// Store for single server instance
let serverInstance = null;

class ApiServer extends EventEmitter {
  constructor(port, callbacks = {}) {
    super();
    this.port = port;
    this.server = null;
    this.wsClients = new Set();
    this.callbacks = callbacks;
    this.isRunning = false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Handle WebSocket upgrade
      this.server.on('upgrade', (req, socket, head) => {
        this.handleWebSocketUpgrade(req, socket, head);
      });

      this.server.on('error', (err) => {
        console.error('[ApiServer] Server error:', err);
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(err);
        }
      });

      this.server.on('connection', (socket) => {
        socket.on('error', (err) => {
          if (err.code !== 'ECONNRESET') {
            console.warn('[ApiServer] Socket error:', err.message);
          }
        });
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`[ApiServer] HTTP/WebSocket server listening on port ${this.port}`);
        this.isRunning = true;
        resolve();
      });
    });
  }

  handleRequest(req, res) {
    const url = req.url || '/';
    const method = req.method;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Route requests
    if (url === '/api/command' && method === 'POST') {
      this.handleCommandRequest(req, res);
    } else if (url === '/api/state' && method === 'GET') {
      this.handleStateRequest(req, res);
    } else if (url === '/api/status' && method === 'GET') {
      this.handleStatusRequest(req, res);
    } else if (url === '/api/commands' && method === 'GET') {
      this.handleCommandListRequest(req, res);
    } else if (url === '/' || url === '/api') {
      this.handleRootRequest(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', endpoints: ['/api/command', '/api/state', '/api/status', '/api/commands'] }));
    }
  }

  // Parse JSON body from request
  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
        // Limit body size to 1MB
        if (body.length > 1048576) {
          reject(new Error('Request body too large'));
        }
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  // POST /api/command - Execute a command
  async handleCommandRequest(req, res) {
    try {
      const body = await this.parseBody(req);
      const { command, params = {} } = body;

      if (!command) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing command field' }));
        return;
      }

      console.log('[ApiServer] Command received:', command, params);

      // Forward command to renderer via callback
      if (this.callbacks.onCommand) {
        try {
          const result = await this.callbacks.onCommand(command, params);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Command handler not available' }));
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // GET /api/state - Get current app state
  async handleStateRequest(req, res) {
    try {
      if (this.callbacks.onStateRequest) {
        const state = await this.callbacks.onStateRequest();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, state }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'State handler not available' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // GET /api/status - Get server status
  handleStatusRequest(req, res) {
    const status = {
      success: true,
      server: {
        port: this.port,
        isRunning: this.isRunning,
        wsClients: this.wsClients.size
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  }

  // GET /api/commands - List available commands
  handleCommandListRequest(req, res) {
    // Import command list from commandHandler (sent from renderer)
    const commands = {
      transport: [
        { command: 'play', params: ['channel', 'layer', 'itemIndex?'], description: 'Play playlist item' },
        { command: 'pause', params: ['channel', 'layer'], description: 'Pause playback' },
        { command: 'resume', params: ['channel', 'layer'], description: 'Resume playback' },
        { command: 'playPauseResume', params: ['channel', 'layer', 'itemIndex?'], description: 'Toggle play/pause/resume' },
        { command: 'stop', params: ['channel', 'layer'], description: 'Stop playback' },
        { command: 'next', params: ['channel', 'layer'], description: 'Next playlist item' },
        { command: 'prev', params: ['channel', 'layer'], description: 'Previous playlist item' }
      ],
      client: [
        { command: 'togglePlaylistMode', params: ['channel', 'layer'], description: 'Toggle auto-advance' },
        { command: 'toggleLoopMode', params: ['channel', 'layer'], description: 'Toggle playlist loop' },
        { command: 'toggleLoopItem', params: ['channel', 'layer'], description: 'Toggle item loop' },
        { command: 'loadRundown', params: ['name'], description: 'Load rundown' },
        { command: 'saveRundown', params: ['name'], description: 'Save rundown' },
        { command: 'clearAll', params: [], description: 'Clear all channels' },
        { command: 'addChannel', params: [], description: 'Add channel' },
        { command: 'addLayer', params: ['channel'], description: 'Add layer' },
        { command: 'deleteChannel', params: ['channel'], description: 'Delete channel' },
        { command: 'deleteLayer', params: ['channel', 'layer'], description: 'Delete layer' }
      ],
      caspar: [
        { command: 'casparPlay', params: ['channel', 'layer', 'clip', 'options?'], description: 'Direct PLAY' },
        { command: 'casparStop', params: ['channel', 'layer'], description: 'Direct STOP' },
        { command: 'casparPause', params: ['channel', 'layer'], description: 'Direct PAUSE' },
        { command: 'casparResume', params: ['channel', 'layer'], description: 'Direct RESUME' },
        { command: 'casparClear', params: ['channel', 'layer?'], description: 'Clear layer/channel' },
        { command: 'casparLoadBg', params: ['channel', 'layer', 'clip', 'options?'], description: 'Load in background' },
        { command: 'cgAdd', params: ['channel', 'layer', 'template', 'playOnLoad?', 'data?'], description: 'Add template' },
        { command: 'cgPlay', params: ['channel', 'layer'], description: 'Play template' },
        { command: 'cgStop', params: ['channel', 'layer'], description: 'Stop template' },
        { command: 'cgUpdate', params: ['channel', 'layer', 'data'], description: 'Update template data' },
        { command: 'custom', params: ['amcp'], description: 'Raw AMCP command' }
      ],
      macro: [
        { command: 'executeMacro', params: ['macroId'], description: 'Execute saved macro' }
      ]
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, commands }));
  }

  // GET / - API info
  handleRootRequest(req, res) {
    const info = {
      name: 'CasparCG Client API',
      version: '1.0.0',
      endpoints: {
        'POST /api/command': 'Execute command { command, params }',
        'GET /api/state': 'Get current app state',
        'GET /api/status': 'Get server status',
        'GET /api/commands': 'List available commands'
      },
      websocket: `ws://localhost:${this.port}/ws`
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info));
  }

  // Handle WebSocket upgrade (simple implementation without external library)
  handleWebSocketUpgrade(req, socket, head) {
    const url = req.url || '/';

    // Only accept /ws path
    if (url !== '/ws' && url !== '/ws/') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // Get WebSocket key from headers
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Create WebSocket accept key
    const crypto = require('crypto');
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    // Send upgrade response
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n'
    );

    // Create a simple WebSocket wrapper
    const wsClient = {
      socket,
      send: (data) => this.sendWebSocketFrame(socket, data),
      close: () => {
        this.wsClients.delete(wsClient);
        socket.end();
      }
    };

    this.wsClients.add(wsClient);
    console.log('[ApiServer] WebSocket client connected, total:', this.wsClients.size);

    // Handle incoming WebSocket frames
    socket.on('data', (buffer) => {
      this.handleWebSocketData(buffer, wsClient);
    });

    socket.on('close', () => {
      this.wsClients.delete(wsClient);
      console.log('[ApiServer] WebSocket client disconnected, total:', this.wsClients.size);
    });

    socket.on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        console.warn('[ApiServer] WebSocket error:', err.message);
      }
      this.wsClients.delete(wsClient);
    });

    // Send welcome message
    wsClient.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  }

  // Parse WebSocket frame and handle data
  handleWebSocketData(buffer, wsClient) {
    try {
      // Simple WebSocket frame parsing
      const firstByte = buffer[0];
      const opcode = firstByte & 0x0F;

      // Handle close frame
      if (opcode === 0x08) {
        wsClient.close();
        return;
      }

      // Handle ping frame
      if (opcode === 0x09) {
        // Send pong
        const pongFrame = Buffer.alloc(2);
        pongFrame[0] = 0x8A; // Pong frame
        pongFrame[1] = 0x00;
        wsClient.socket.write(pongFrame);
        return;
      }

      // Only handle text frames
      if (opcode !== 0x01) return;

      const secondByte = buffer[1];
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7F;
      let offset = 2;

      if (payloadLength === 126) {
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        // Skip 64-bit length for simplicity
        return;
      }

      let maskingKey = null;
      if (isMasked) {
        maskingKey = buffer.slice(offset, offset + 4);
        offset += 4;
      }

      let payload = buffer.slice(offset, offset + payloadLength);

      // Unmask if needed
      if (isMasked && maskingKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskingKey[i % 4];
        }
      }

      const message = payload.toString('utf8');
      this.handleWebSocketMessage(message, wsClient);
    } catch (err) {
      console.error('[ApiServer] Error parsing WebSocket frame:', err);
    }
  }

  // Handle WebSocket message
  async handleWebSocketMessage(message, wsClient) {
    try {
      const data = JSON.parse(message);
      console.log('[ApiServer] WebSocket message:', data);

      if (data.type === 'command' && data.command) {
        // Execute command
        if (this.callbacks.onCommand) {
          try {
            const result = await this.callbacks.onCommand(data.command, data.params || {});
            wsClient.send(JSON.stringify({
              type: 'command_result',
              id: data.id,
              success: true,
              result
            }));
          } catch (err) {
            wsClient.send(JSON.stringify({
              type: 'command_result',
              id: data.id,
              success: false,
              error: err.message
            }));
          }
        }
      } else if (data.type === 'get_state') {
        // Get current state
        if (this.callbacks.onStateRequest) {
          const state = await this.callbacks.onStateRequest();
          wsClient.send(JSON.stringify({
            type: 'state',
            id: data.id,
            state
          }));
        }
      } else if (data.type === 'ping') {
        wsClient.send(JSON.stringify({ type: 'pong', id: data.id }));
      }
    } catch (err) {
      console.error('[ApiServer] Error handling WebSocket message:', err);
      wsClient.send(JSON.stringify({ type: 'error', error: err.message }));
    }
  }

  // Send WebSocket frame
  sendWebSocketFrame(socket, data) {
    if (socket.destroyed || socket.writableEnded) return;

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const payloadLength = payloadBuffer.length;

    let frame;
    if (payloadLength < 126) {
      frame = Buffer.alloc(2 + payloadLength);
      frame[0] = 0x81; // FIN + text frame
      frame[1] = payloadLength;
      payloadBuffer.copy(frame, 2);
    } else if (payloadLength < 65536) {
      frame = Buffer.alloc(4 + payloadLength);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(payloadLength, 2);
      payloadBuffer.copy(frame, 4);
    } else {
      // For very large payloads (unlikely for our use case)
      frame = Buffer.alloc(10 + payloadLength);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(payloadLength), 2);
      payloadBuffer.copy(frame, 10);
    }

    try {
      socket.write(frame);
    } catch (err) {
      console.warn('[ApiServer] Error sending WebSocket frame:', err.message);
    }
  }

  // Broadcast state to all WebSocket clients
  broadcastState(state) {
    const message = JSON.stringify({ type: 'state', data: state });
    for (const client of this.wsClients) {
      try {
        client.send(message);
      } catch (err) {
        // Remove dead clients
        this.wsClients.delete(client);
      }
    }
  }

  // Broadcast event to all WebSocket clients
  broadcastEvent(event, data) {
    const message = JSON.stringify({ type: 'event', event, data });
    for (const client of this.wsClients) {
      try {
        client.send(message);
      } catch (err) {
        this.wsClients.delete(client);
      }
    }
  }

  async stop() {
    console.log('[ApiServer] Stopping server...');

    // Close all WebSocket clients
    for (const client of this.wsClients) {
      try {
        client.close();
      } catch (err) {
        // Ignore
      }
    }
    this.wsClients.clear();

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('[ApiServer] Server closed');
          this.server = null;
          this.isRunning = false;
          resolve();
        });
        // Force close after timeout
        setTimeout(() => {
          if (this.server) {
            this.server = null;
            this.isRunning = false;
            resolve();
          }
        }, 1000);
      });
    }

    this.isRunning = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      wsClients: this.wsClients.size
    };
  }
}

// Module exports - singleton pattern
async function start(port, callbacks) {
  // Stop existing server if running
  await stop();

  serverInstance = new ApiServer(port, callbacks);
  await serverInstance.start();
  return serverInstance.getStatus();
}

async function stop() {
  if (serverInstance) {
    await serverInstance.stop();
    serverInstance = null;
  }
}

function getStatus() {
  if (serverInstance) {
    return serverInstance.getStatus();
  }
  return { isRunning: false, port: null, wsClients: 0 };
}

function broadcastState(state) {
  if (serverInstance) {
    serverInstance.broadcastState(state);
  }
}

function broadcastEvent(event, data) {
  if (serverInstance) {
    serverInstance.broadcastEvent(event, data);
  }
}

module.exports = {
  start,
  stop,
  getStatus,
  broadcastState,
  broadcastEvent
};
