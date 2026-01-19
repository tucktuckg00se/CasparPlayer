// OSC Message Handler for CasparCG time updates
// Reference: https://github.com/CasparCG/help/wiki/OSC-Protocol

// Debug mode - set to false for production (reduces CPU usage from logging at 30fps)
const DEBUG_OSC_HANDLER = false;

export function processOscMessage(message, updateCallback) {
  const { address, args, parsed } = message;

  if (DEBUG_OSC_HANDLER) {
    console.log('[OSC Handler] Received message:', { address, args, parsed });
  }

  if (!parsed || !parsed.channel || !parsed.layer) {
    if (DEBUG_OSC_HANDLER) {
      console.log('[OSC Handler] Skipping - no channel/layer parsed');
    }
    return;
  }

  const { channel, layer, type } = parsed;

  if (DEBUG_OSC_HANDLER && type) {
    console.log(`[OSC Handler] Processing: channel=${channel}, layer=${layer}, type=${type}, args=`, args);
  }

  switch (type) {
    case 'time':
      // CasparCG OSC Protocol sends time as a single float: elapsed seconds
      // Some versions may send two values [current, total] - handle both
      if (args.length >= 1) {
        const currentTime = parseFloat(args[0]) || 0;
        // If second arg exists, use it as totalTime; otherwise null (use metadata)
        const totalTime = args.length >= 2 ? parseFloat(args[1]) || null : null;

        updateCallback({
          type: 'time',
          channel,
          layer,
          currentTime,
          totalTime  // May be null - AppContext will use playlist item duration
        });
      }
      break;

    case 'frame':
      // CasparCG OSC Protocol sends frame as a single int: frame count
      // Some versions may send two values [current, total] - handle both
      if (args.length >= 1) {
        const currentFrame = parseInt(args[0]) || 0;
        const totalFrames = args.length >= 2 ? parseInt(args[1]) || null : null;

        updateCallback({
          type: 'frame',
          channel,
          layer,
          currentFrame,
          totalFrames  // May be null
        });
      }
      break;

    case 'paused':
      // Boolean indicating paused state
      const isPaused = args[0] === true || args[0] === 1 || args[0] === 'true';
      updateCallback({
        type: 'paused',
        channel,
        layer,
        isPaused
      });
      break;

    case 'loop':
      // Boolean indicating loop state
      const isLooping = args[0] === true || args[0] === 1 || args[0] === 'true';
      updateCallback({
        type: 'loop',
        channel,
        layer,
        isLooping
      });
      break;

    case 'producer_type':
      // String indicating producer type (empty, ffmpeg, image, etc.)
      const producerType = String(args[0] || '');
      updateCallback({
        type: 'producer_type',
        channel,
        layer,
        producerType,
        isEmpty: producerType === '' || producerType === 'empty',
        isImage: producerType === 'image-producer' || producerType === 'image'
      });
      break;

    case 'path':
      // String with file path
      const path = String(args[0] || '');
      updateCallback({
        type: 'path',
        channel,
        layer,
        path
      });
      break;
  }
}

export function createOscUpdateHandler(setState) {
  // Note: This function is provided for backwards compatibility
  // The main OSC handling is done in AppContext.handleOscUpdate which has access to playlist data
  return (update) => {
    const { type, channel, layer } = update;

    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id !== channel) return ch;

        return {
          ...ch,
          layers: ch.layers.map(l => {
            if (l.id !== layer) return l;

            switch (type) {
              case 'time':
                // Get totalTime from OSC or keep existing (from playlist item metadata)
                const totalTime = update.totalTime ?? l.totalTime;
                return {
                  ...l,
                  currentTime: update.currentTime,
                  totalTime: totalTime
                };

              case 'frame':
                return {
                  ...l,
                  currentFrame: update.currentFrame,
                  totalFrames: update.totalFrames ?? l.totalFrames
                };

              case 'paused':
                return {
                  ...l,
                  isPlaying: !update.isPaused,
                  isPaused: update.isPaused  // FIX: Also update isPaused flag
                };

              case 'producer_type':
                // If producer becomes empty, might indicate end of playback
                if (update.isEmpty && l.isPlaying) {
                  return {
                    ...l,
                    isPlaying: false,
                    playlist: l.playlist.map(item => ({ ...item, playing: false }))
                  };
                }
                return l;

              default:
                return l;
            }
          })
        };
      })
    }));
  };
}

export default {
  processOscMessage,
  createOscUpdateHandler
};
