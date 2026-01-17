const osc = require('node-osc');

let oscServer = null;
let messageCallback = null;

function start(port, onMessage) {
  return new Promise((resolve, reject) => {
    try {
      if (oscServer) {
        stop();
      }

      messageCallback = onMessage;

      oscServer = new osc.Server(port, '0.0.0.0');

      oscServer.on('message', (msg, rinfo) => {
        const address = msg[0];
        const args = msg.slice(1);

        // Parse the OSC address to extract channel and layer info
        // CasparCG OSC format: /channel/[channel]/stage/layer/[layer]/...
        const parsed = parseOscAddress(address);

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
        console.error('OSC Server error:', err);
      });

      console.log(`OSC Server started on port ${port}`);
      resolve(true);
    } catch (error) {
      console.error('Failed to start OSC server:', error);
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
