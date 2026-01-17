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

      if (options.inPoint !== undefined && options.inPoint !== null) {
        params.seek = Math.floor(options.inPoint * (options.frameRate || 25));
      }

      if (options.outPoint !== undefined && options.outPoint !== null) {
        params.length = Math.floor((options.outPoint - (options.inPoint || 0)) * (options.frameRate || 25));
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

    if (options.inPoint !== undefined && options.inPoint !== null) {
      params.seek = Math.floor(options.inPoint * (options.frameRate || 25));
    }

    if (options.outPoint !== undefined && options.outPoint !== null) {
      params.length = Math.floor((options.outPoint - (options.inPoint || 0)) * (options.frameRate || 25));
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
// CasparCG expects paths relative to media folder, with forward slashes
function formatClipPath(path) {
  if (!path) return '';

  // Remove file extension for video files (CasparCG adds it automatically)
  let formatted = path.replace(/\\/g, '/');

  // If it's an absolute path, we need to extract just the filename/relative path
  // This assumes the media is in CasparCG's media folder
  const parts = formatted.split('/');
  const filename = parts[parts.length - 1];

  // Remove common video extensions
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.mpeg', '.mpg', '.mxf', '.ts', '.m2ts'];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  if (videoExtensions.includes(ext)) {
    return filename.slice(0, filename.lastIndexOf('.'));
  }

  return filename;
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
  cgUpdate
};
