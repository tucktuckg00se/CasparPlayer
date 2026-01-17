// CasparCG AMCP Commands Service

export async function play(casparCG, channel, layer, clip = null, options = {}) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    if (clip) {
      // PLAY with clip
      const params = {
        channel,
        layer,
        clip: formatClipPath(clip)
      };

      if (options.loop) {
        params.loop = true;
      }

      // Use frame-based values if available (more precise), otherwise convert from seconds
      const frameRate = clip.frameRate ?? options.frameRate ?? 25;

      if (clip.inPointFrames !== undefined && clip.inPointFrames !== null) {
        // Use frame-based value directly
        params.seek = clip.inPointFrames;
      } else if (options.inPoint !== undefined && options.inPoint !== null) {
        // Fallback: convert from seconds
        params.seek = Math.floor(options.inPoint * frameRate);
      }

      if (clip.outPointFrames !== undefined && clip.outPointFrames !== null) {
        // Calculate length from frame-based values
        const inFrames = clip.inPointFrames || 0;
        params.length = clip.outPointFrames - inFrames;
      } else if (options.outPoint !== undefined && options.outPoint !== null) {
        // Fallback: convert from seconds
        params.length = Math.floor((options.outPoint - (options.inPoint || 0)) * frameRate);
      }

      return await casparCG.play(params);
    } else {
      // PLAY without clip (resume from LOAD)
      return await casparCG.play({ channel, layer });
    }
  } catch (error) {
    console.error('Play command failed:', error);
    throw error;
  }
}

export async function loadBg(casparCG, channel, layer, clip, options = {}) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    const params = {
      channel,
      layer,
      clip: formatClipPath(clip),
      auto: options.auto ?? true
    };

    if (options.loop) {
      params.loop = true;
    }

    // Use frame-based values if available (more precise), otherwise convert from seconds
    const frameRate = clip.frameRate ?? options.frameRate ?? 25;

    if (clip.inPointFrames !== undefined && clip.inPointFrames !== null) {
      // Use frame-based value directly
      params.seek = clip.inPointFrames;
    } else if (options.inPoint !== undefined && options.inPoint !== null) {
      // Fallback: convert from seconds
      params.seek = Math.floor(options.inPoint * frameRate);
    }

    if (clip.outPointFrames !== undefined && clip.outPointFrames !== null) {
      // Calculate length from frame-based values
      const inFrames = clip.inPointFrames || 0;
      params.length = clip.outPointFrames - inFrames;
    } else if (options.outPoint !== undefined && options.outPoint !== null) {
      // Fallback: convert from seconds
      params.length = Math.floor((options.outPoint - (options.inPoint || 0)) * frameRate);
    }

    return await casparCG.loadbg(params);
  } catch (error) {
    console.error('LoadBg command failed:', error);
    throw error;
  }
}

export async function pause(casparCG, channel, layer) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.pause({ channel, layer });
  } catch (error) {
    console.error('Pause command failed:', error);
    throw error;
  }
}

export async function resume(casparCG, channel, layer) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.resume({ channel, layer });
  } catch (error) {
    console.error('Resume command failed:', error);
    throw error;
  }
}

export async function stop(casparCG, channel, layer) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.stop({ channel, layer });
  } catch (error) {
    console.error('Stop command failed:', error);
    throw error;
  }
}

export async function clear(casparCG, channel, layer = null) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    const params = { channel };
    if (layer !== null) {
      params.layer = layer;
    }
    return await casparCG.clear(params);
  } catch (error) {
    console.error('Clear command failed:', error);
    throw error;
  }
}

export async function call(casparCG, channel, layer, command) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.call({ channel, layer, ...command });
  } catch (error) {
    console.error('Call command failed:', error);
    throw error;
  }
}

export async function cgAdd(casparCG, channel, layer, template, playOnLoad = true, data = {}) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.cgAdd({
      channel,
      layer,
      template,
      playOnLoad,
      data: JSON.stringify(data)
    });
  } catch (error) {
    console.error('CG Add command failed:', error);
    throw error;
  }
}

export async function cgPlay(casparCG, channel, layer) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.cgPlay({ channel, layer });
  } catch (error) {
    console.error('CG Play command failed:', error);
    throw error;
  }
}

export async function cgStop(casparCG, channel, layer) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.cgStop({ channel, layer });
  } catch (error) {
    console.error('CG Stop command failed:', error);
    throw error;
  }
}

export async function cgUpdate(casparCG, channel, layer, data) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    return await casparCG.cgUpdate({
      channel,
      layer,
      data: JSON.stringify(data)
    });
  } catch (error) {
    console.error('CG Update command failed:', error);
    throw error;
  }
}

// Helper to format clip path for CasparCG
// CasparCG expects paths relative to media folder, with forward slashes, no extension
function formatClipPath(clipInfo) {
  if (!clipInfo) return '';

  // If clipInfo is an object with relativePath, use that (preferred)
  // Otherwise treat it as a string path
  let path;
  if (typeof clipInfo === 'object' && clipInfo.relativePath) {
    // Already computed relative path without extension
    return clipInfo.relativePath.replace(/\\/g, '/');
  } else if (typeof clipInfo === 'object' && clipInfo.path) {
    path = clipInfo.path;
  } else {
    path = String(clipInfo);
  }

  // Normalize path separators
  let formatted = path.replace(/\\/g, '/');

  // If it's an absolute path, extract just the filename
  // This is a fallback when relativePath isn't available
  const parts = formatted.split('/');
  const filename = parts[parts.length - 1];

  // Remove common video/image extensions (CasparCG adds them automatically)
  const mediaExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.mpeg', '.mpg', '.mxf', '.ts', '.m2ts', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tga', '.tiff'];
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) {
    const ext = filename.toLowerCase().slice(lastDot);
    if (mediaExtensions.includes(ext)) {
      return filename.slice(0, lastDot);
    }
  }

  return filename;
}

// Execute raw AMCP command string
export async function executeRawCommand(casparCG, commandString) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    // Parse the command string to determine the method to call
    const parts = commandString.trim().split(/\s+/);
    const cmd = parts[0].toUpperCase();

    // For most raw commands, we can try to use the generic command method
    // casparcg-connection v6.3.3 may support createCommand or similar
    if (typeof casparCG.createCommand === 'function') {
      const command = casparCG.createCommand(commandString);
      return await casparCG.execute(command);
    }

    // Fallback: try to map common commands
    switch (cmd) {
      case 'PLAY':
      case 'LOAD':
      case 'LOADBG':
      case 'PAUSE':
      case 'RESUME':
      case 'STOP':
      case 'CLEAR':
        // These should be handled by specific methods, but try generic if available
        break;
    }

    // Last resort: throw informative error
    throw new Error(`Raw AMCP command execution not supported: ${cmd}. Use specific command types instead.`);
  } catch (error) {
    console.error('Raw command failed:', error);
    throw error;
  }
}

export default {
  play,
  loadBg,
  pause,
  resume,
  stop,
  clear,
  call,
  cgAdd,
  cgPlay,
  cgStop,
  cgUpdate,
  executeRawCommand
};
