// Stream Relay Service for CasparCG MPEGTS preview
// Receives MPEGTS data from ffmpeg via HTTP POST and relays to browser clients

const http = require('http');
const { EventEmitter } = require('events');

// Active relay servers by channel ID
const relays = new Map();

class StreamRelay extends EventEmitter {
  constructor(channelId, port) {
    super();
    this.channelId = channelId;
    this.port = port;
    this.server = null;
    this.clients = new Set();
    this.isReceiving = false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Configure socket timeouts to handle stale connections
      this.server.timeout = 0;            // Disable general socket timeout
      this.server.requestTimeout = 0;     // Disable the 5-minute request limit (Node 14+)
      this.server.keepAliveTimeout = 0;    // Disable keep-alive timeout for streaming
      this.server.headersTimeout = 0;     // Disable header timeout

      this.server.on('error', (err) => {
        console.error(`[StreamRelay ${this.channelId}] Server error:`, err);
        reject(err);
      });

      // Handle connection-level errors
      this.server.on('connection', (socket) => {
        socket.on('error', (err) => {
          // Ignore ECONNRESET - this is normal when clients disconnect
          if (err.code !== 'ECONNRESET') {
            console.warn(`[StreamRelay ${this.channelId}] Socket error:`, err.message);
          }
        });
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`[StreamRelay ${this.channelId}] Listening on port ${this.port}`);
        resolve();
      });
    });
  }

  handleRequest(req, res) {
    const url = req.url || '/';
    console.log(`[StreamRelay ${this.channelId}] ${req.method} ${url}`);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Accept /stream, /stream/, /stream.ts for ffmpeg format detection
    if (url === '/stream' || url === '/stream/' || url === '/stream.ts') {
      if (req.method === 'POST') {
        this.handleIncomingStream(req, res);
      } else if (req.method === 'GET') {
        this.handleClientConnection(req, res);
      } else {
        res.writeHead(405);
        res.end('Method not allowed');
      }
    } else if (url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getStatus()));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  // Handle incoming MPEGTS stream from ffmpeg
  handleIncomingStream(req, res) {
    req.setTimeout(0); // Disable timeout for this specific incoming POST request
    console.log(`[StreamRelay ${this.channelId}] ffmpeg connected, starting relay`);
    this.isReceiving = true;
    this.emit('streamStarted', { channelId: this.channelId });

    req.on('data', (chunk) => {
      // Relay data to all connected clients
      // Use a copy of clients set to allow safe deletion during iteration
      const clientsToRemove = [];

      for (const client of this.clients) {
        try {
          if (!client.writableEnded && !client.destroyed) {
            // Write returns false if the buffer is full, but we don't need to wait
            client.write(chunk, (err) => {
              if (err) {
                // Async write error - remove client on next iteration
                if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
                  console.warn(`[StreamRelay ${this.channelId}] Async write error:`, err.message);
                }
                this.clients.delete(client);
              }
            });
          } else {
            clientsToRemove.push(client);
          }
        } catch (err) {
          // Synchronous write error
          if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
            console.warn(`[StreamRelay ${this.channelId}] Error writing to client:`, err.message);
          }
          clientsToRemove.push(client);
        }
      }

      // Remove dead clients
      for (const client of clientsToRemove) {
        this.clients.delete(client);
      }
    });

    req.on('end', () => {
      console.log(`[StreamRelay ${this.channelId}] ffmpeg disconnected`);
      this.isReceiving = false;
      this.emit('streamEnded', { channelId: this.channelId });
      res.writeHead(200);
      res.end();
    });

    req.on('error', (err) => {
      // Ignore ECONNRESET - this is normal when ffmpeg disconnects
      if (err.code !== 'ECONNRESET') {
        console.error(`[StreamRelay ${this.channelId}] Incoming stream error:`, err);
      }
      this.isReceiving = false;
      this.emit('streamError', { channelId: this.channelId, error: err.message });
    });
  }

  // Handle browser client connection
  handleClientConnection(req, res) {
    console.log(`[StreamRelay ${this.channelId}] Browser client connected`);

    // Set headers for MPEGTS streaming
    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    });

    // Add client to the set
    this.clients.add(res);
    this.emit('clientConnected', { channelId: this.channelId, clientCount: this.clients.size });

    // Handle response errors (ECONNRESET, EPIPE, etc.)
    res.on('error', (err) => {
      // Ignore ECONNRESET and EPIPE - these are normal when clients disconnect
      if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
        console.warn(`[StreamRelay ${this.channelId}] Response error:`, err.message);
      }
      this.clients.delete(res);
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[StreamRelay ${this.channelId}] Browser client disconnected`);
      this.clients.delete(res);
      this.emit('clientDisconnected', { channelId: this.channelId, clientCount: this.clients.size });
    });

    req.on('error', (err) => {
      // Ignore ECONNRESET - this is normal when clients disconnect
      if (err.code !== 'ECONNRESET') {
        console.warn(`[StreamRelay ${this.channelId}] Client request error:`, err.message);
      }
      this.clients.delete(res);
    });
  }

  async stop() {
    console.log(`[StreamRelay ${this.channelId}] Stopping server...`);

    // Close all client connections
    for (const client of this.clients) {
      try {
        client.end();
      } catch (err) {
        // Ignore
      }
    }
    this.clients.clear();

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log(`[StreamRelay ${this.channelId}] Server closed`);
          this.server = null;
          resolve();
        });
        // Force close after timeout
        setTimeout(() => {
          if (this.server) {
            this.server = null;
            resolve();
          }
        }, 1000);
      });
    }
  }

  getStatus() {
    return {
      channelId: this.channelId,
      port: this.port,
      isReceiving: this.isReceiving,
      clientCount: this.clients.size
    };
  }
}

/**
 * Start a stream relay for a channel
 * @param {number} channelId - Channel ID
 * @param {number} port - Port to listen on
 * @param {function} onStreamStarted - Callback when stream starts
 * @param {function} onStreamEnded - Callback when stream ends
 */
async function startRelay(channelId, port, onStreamStarted, onStreamEnded) {
  // Stop existing relay for this channel
  await stopRelay(channelId);

  const relay = new StreamRelay(channelId, port);

  if (onStreamStarted) {
    relay.on('streamStarted', onStreamStarted);
  }
  if (onStreamEnded) {
    relay.on('streamEnded', onStreamEnded);
  }

  await relay.start();
  relays.set(channelId, relay);

  return {
    success: true,
    port: relay.port,
    streamUrl: `http://127.0.0.1:${port}/stream`
  };
}

/**
 * Stop a stream relay
 */
async function stopRelay(channelId) {
  const relay = relays.get(channelId);
  if (relay) {
    await relay.stop();
    relays.delete(channelId);
  }
  return { success: true };
}

/**
 * Get relay status
 */
function getRelayStatus(channelId) {
  const relay = relays.get(channelId);
  if (relay) {
    return relay.getStatus();
  }
  return { running: false };
}

/**
 * Stop all relays
 */
async function stopAllRelays() {
  for (const [channelId, relay] of relays) {
    await relay.stop();
  }
  relays.clear();
}

module.exports = {
  startRelay,
  stopRelay,
  getRelayStatus,
  stopAllRelays
};
