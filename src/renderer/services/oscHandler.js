// OSC Message Handler for CasparCG time updates

export function processOscMessage(message, updateCallback) {
  const { address, args, parsed } = message;

  if (!parsed || !parsed.channel || !parsed.layer) {
    return;
  }

  const { channel, layer, type } = parsed;

  switch (type) {
    case 'time':
      // CasparCG sends time as two floats: [current, total]
      if (args.length >= 2) {
        const currentTime = parseFloat(args[0]) || 0;
        const totalTime = parseFloat(args[1]) || 0;

        updateCallback({
          type: 'time',
          channel,
          layer,
          currentTime,
          totalTime
        });
      }
      break;

    case 'frame':
      // CasparCG sends frame as two ints: [current, total]
      if (args.length >= 2) {
        const currentFrame = parseInt(args[0]) || 0;
        const totalFrames = parseInt(args[1]) || 0;

        updateCallback({
          type: 'frame',
          channel,
          layer,
          currentFrame,
          totalFrames
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
        isEmpty: producerType === '' || producerType === 'empty'
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
                return {
                  ...l,
                  currentTime: update.currentTime,
                  totalTime: update.totalTime
                };

              case 'frame':
                return {
                  ...l,
                  currentFrame: update.currentFrame,
                  totalFrames: update.totalFrames
                };

              case 'paused':
                return {
                  ...l,
                  isPlaying: !update.isPaused
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

    // Handle auto-advance when item finishes
    if (type === 'time' && update.totalTime > 0) {
      const timeRemaining = update.totalTime - update.currentTime;

      // Check if we're at the end (within 0.1 seconds)
      if (timeRemaining <= 0.1) {
        // This will be handled by the context's auto-advance logic
        // which monitors OSC updates
      }
    }
  };
}

export default {
  processOscMessage,
  createOscUpdateHandler
};
