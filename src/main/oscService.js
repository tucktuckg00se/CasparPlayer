const dgram = require('dgram');

let udpServer = null;
let messageCallback = null;

// Debug mode - set to false for production (reduces CPU usage from logging at 30fps)
const DEBUG_OSC = false;

/**
 * Parse OSC data - handles both single messages and bundles
 */
function parseOscData(buffer) {
  const messages = [];

  // Check if it's a bundle
  const firstString = readOscString(buffer, 0);
  if (firstString === '#bundle') {
    // Parse bundle
    let offset = 8; // Skip '#bundle\0'
    offset += 8; // Skip timetag (8 bytes)

    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) break;

      // Read message size
      const size = buffer.readInt32BE(offset);
      offset += 4;

      if (size <= 0 || offset + size > buffer.length) break;

      // Extract message data
      const messageBuffer = buffer.slice(offset, offset + size);
      offset += size;

      // Recursively parse (could be nested bundle or message)
      const nestedMessages = parseOscData(messageBuffer);
      messages.push(...nestedMessages);
    }
  } else {
    // Single message
    const message = parseOscMessage(buffer);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

/**
 * Parse a single OSC message from a buffer
 * OSC format: address string, type tag string, arguments
 */
function parseOscMessage(buffer) {
  try {
    let offset = 0;

    // Read address string (null-terminated, padded to 4 bytes)
    const address = readOscString(buffer, offset);
    if (!address || address.length === 0) return null;

    offset += align4(address.length + 1);

    // Read type tag string (starts with ',')
    const typeTag = readOscString(buffer, offset);
    offset += align4(typeTag.length + 1);

    // Parse arguments based on type tags
    const args = [];
    if (typeTag.startsWith(',')) {
      for (let i = 1; i < typeTag.length; i++) {
        const type = typeTag[i];
        switch (type) {
          case 'i': // int32
            if (offset + 4 > buffer.length) break;
            args.push(buffer.readInt32BE(offset));
            offset += 4;
            break;
          case 'f': // float32
            if (offset + 4 > buffer.length) break;
            args.push(buffer.readFloatBE(offset));
            offset += 4;
            break;
          case 's': // string
            const str = readOscString(buffer, offset);
            args.push(str);
            offset += align4(str.length + 1);
            break;
          case 'T': // True
            args.push(true);
            break;
          case 'F': // False
            args.push(false);
            break;
          case 'h': // int64
            if (offset + 8 > buffer.length) break;
            const high = buffer.readInt32BE(offset);
            const low = buffer.readUInt32BE(offset + 4);
            args.push(high * 0x100000000 + low);
            offset += 8;
            break;
          case 'd': // float64/double
            if (offset + 8 > buffer.length) break;
            args.push(buffer.readDoubleBE(offset));
            offset += 8;
            break;
          default:
            // Unknown type, skip
            break;
        }
      }
    }

    return { address, args };
  } catch (e) {
    return null;
  }
}

/**
 * Read a null-terminated string from buffer
 */
function readOscString(buffer, offset) {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) {
    end++;
  }
  return buffer.toString('utf8', offset, end);
}

/**
 * Align to 4-byte boundary
 */
function align4(n) {
  return (n + 3) & ~3;
}

/**
 * Parse CasparCG OSC address to extract channel, layer, and type
 * Examples:
 * /channel/1/stage/layer/10/file/time
 * /channel/1/stage/layer/10/foreground/file/time
 * /channel/1/stage/layer/10/foreground/paused
 */
function parseOscAddress(address) {
  const result = {
    channel: null,
    layer: null,
    type: null,
    property: null
  };

  const parts = address.split('/').filter(p => p);

  if (parts[0] === 'channel' && parts.length >= 2) {
    result.channel = parseInt(parts[1]);

    if (parts[2] === 'stage' && parts[3] === 'layer' && parts.length >= 5) {
      result.layer = parseInt(parts[4]);

      // Get the property path after the layer number
      const propertyPath = parts.slice(5).join('/');
      result.property = propertyPath;

      // Determine the type based on the last part of the address
      const lastPart = parts[parts.length - 1];
      if (lastPart === 'time') {
        result.type = 'time';
      } else if (lastPart === 'frame') {
        result.type = 'frame';
      } else if (lastPart === 'paused') {
        result.type = 'paused';
      } else if (lastPart === 'loop') {
        result.type = 'loop';
      } else if (lastPart === 'type' && propertyPath.includes('producer')) {
        result.type = 'producer_type';
      } else if (lastPart === 'path') {
        result.type = 'path';
      }
    }
  }

  return result;
}

function start(port, onMessage) {
  return new Promise((resolve, reject) => {
    try {
      if (udpServer) {
        stop();
      }

      messageCallback = onMessage;

      // Create UDP4 socket
      udpServer = dgram.createSocket('udp4');

      udpServer.on('error', (err) => {
        console.error('[OSC] Server error:', err);
        udpServer.close();
        udpServer = null;
      });

      udpServer.on('message', (msg, rinfo) => {
        try {
          // Parse OSC data (handles bundles and single messages)
          const messages = parseOscData(msg);

          // Process each message
          for (const { address, args } of messages) {
            // Parse the address to extract channel/layer info
            const parsed = parseOscAddress(address);

            // Debug logging - only log messages with recognized types
            if (DEBUG_OSC && parsed.type) {
              console.log(`[OSC] ${address} [${args.join(', ')}] -> ch=${parsed.channel}, layer=${parsed.layer}, type=${parsed.type}`);
            }

            if (messageCallback) {
              messageCallback({
                address,
                args,
                parsed,
                source: rinfo
              });
            }
          }
        } catch (parseErr) {
          if (DEBUG_OSC) {
            console.error('[OSC] Parse error:', parseErr);
          }
        }
      });

      udpServer.on('listening', () => {
        const addr = udpServer.address();
        console.log(`[OSC] UDP Server listening on ${addr.address}:${addr.port}`);
        resolve(true);
      });

      // Bind to all interfaces on the specified port
      udpServer.bind(port, '0.0.0.0');

    } catch (error) {
      console.error('[OSC] Failed to start OSC server:', error);
      reject(error);
    }
  });
}

function stop() {
  if (udpServer) {
    try {
      udpServer.close();
      udpServer = null;
      messageCallback = null;
      console.log('[OSC] Server stopped');
    } catch (error) {
      console.error('[OSC] Error stopping server:', error);
    }
  }
}

function isRunning() {
  return udpServer !== null;
}

module.exports = {
  start,
  stop,
  isRunning,
  parseOscAddress
};
