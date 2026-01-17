const osc = require('node-osc');

let oscServer = null;
let messageCallback = null;

// Debug mode - set to true for verbose logging
const DEBUG_OSC = true;

function start(port, onMessage) {
  return new Promise((resolve, reject) => {
    try {
      if (oscServer) {
        stop();
      }

      messageCallback = onMessage;

      // Bind to 0.0.0.0 to accept messages from any interface
      oscServer = new osc.Server(port, '0.0.0.0');

      console.log(`[OSC] Server binding to 0.0.0.0:${port}...`);

      oscServer.on('message', (msg, rinfo) => {
        const address = msg[0];
        const args = msg.slice(1);

        // Parse the OSC address to extract channel and layer info
        // CasparCG OSC format: /channel/[channel]/stage/layer/[layer]/...
        const parsed = parseOscAddress(address);

        // Debug logging
        if (DEBUG_OSC) {
          // Log all messages for debugging, not just time updates
          console.log(`[OSC] Message from ${rinfo.address}:${rinfo.port} - ${address}`, args);
          if (parsed.type) {
            console.log(`[OSC] Parsed: channel=${parsed.channel}, layer=${parsed.layer}, type=${parsed.type}`);
          }
        }

        if (messageCallback) {
          messageCallback({
            address,
            args,
            parsed,
            source: rinfo
          });
        }
      });

      oscServer.on('error', (err) => {
        console.error('[OSC] Server error:', err);
      });

      oscServer.on('listening', () => {
        console.log(`[OSC] Server successfully listening on port ${port}`);
      });

      console.log(`[OSC] Server started on port ${port}`);
      resolve(true);
    } catch (error) {
      console.error('[OSC] Failed to start OSC server:', error);
      reject(error);
    }
  });
}

function stop() {
  if (oscServer) {
    try {
      oscServer.close();
      oscServer = null;
      messageCallback = null;
      console.log('OSC Server stopped');
    } catch (error) {
      console.error('Error stopping OSC server:', error);
    }
  }
}

function isRunning() {
  return oscServer !== null;
}

function parseOscAddress(address) {
  const result = {
    channel: null,
    layer: null,
    type: null,
    property: null
  };

  const parts = address.split('/').filter(p => p);

  // Parse CasparCG OSC addresses
  // Examples:
  // /channel/1/stage/layer/10/file/time
  // /channel/1/stage/layer/10/file/frame
  // /channel/1/stage/layer/10/foreground/file/time
  // /channel/1/stage/layer/10/foreground/producer/type

  if (parts[0] === 'channel' && parts.length >= 2) {
    result.channel = parseInt(parts[1]);

    if (parts[2] === 'stage' && parts[3] === 'layer' && parts.length >= 5) {
      result.layer = parseInt(parts[4]);

      // Find the relevant property
      if (parts.includes('time')) {
        result.type = 'time';
      } else if (parts.includes('frame')) {
        result.type = 'frame';
      } else if (parts.includes('paused')) {
        result.type = 'paused';
      } else if (parts.includes('loop')) {
        result.type = 'loop';
      } else if (parts.includes('type')) {
        result.type = 'producer_type';
      } else if (parts.includes('path')) {
        result.type = 'path';
      }

      result.property = parts.slice(5).join('/');
    }
  }

  return result;
}

module.exports = {
  start,
  stop,
  isRunning,
  parseOscAddress
};
