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

// Parse a single CLS line with correct framerate calculation
// Format: "clip/name" TYPE size datetime frames numerator/denominator
// FPS = denominator / numerator (e.g., 100/2997 -> 2997/100 = 29.97 fps)
function parseClsLine(line) {
  // Match: "name" TYPE size datetime frames num/den
  const match = line.match(/^"([^"]+)"\s+(\w+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\/(\d+)/);
  if (!match) return null;

  const [, clip, type, size, datetime, frames, numerator, denominator] = match;

  // Calculate correct framerate: FPS = denominator / numerator
  const numVal = parseInt(numerator, 10);
  const denVal = parseInt(denominator, 10);
  const framerate = numVal > 0 ? denVal / numVal : 0;

  return {
    clip,
    type,
    size: parseInt(size, 10),
    datetime: parseInt(datetime, 10),
    frames: parseInt(frames, 10),
    framerate
  };
}

// Fix framerate for library-parsed clip data (fallback)
// If framerate > 120, assume it's the raw denominator and try heuristic fixes
function fixClipFramerate(clip) {
  if (!clip?.framerate || (clip.framerate > 0 && clip.framerate <= 120)) {
    return clip;
  }
  // Heuristic: common values like 2997 -> 29.97, 5994 -> 59.94
  // These are typically denominator values where numerator was 100
  return { ...clip, framerate: clip.framerate / 100 };
}

// CLS - List media files with metadata
export async function cls(casparCG, subDirectory = null) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    const params = subDirectory ? { subDirectory } : {};
    const result = await casparCG.cls(params);
    if (result?.request) {
      const response = await result.request;

      // Log raw response for debugging framerate issues
      console.log('CLS response:', response);

      // If response.message contains raw text, parse it ourselves for correct framerate
      if (response.message && typeof response.message === 'string') {
        const lines = response.message.split('\n').filter(l => l.trim());
        const parsed = lines.map(parseClsLine).filter(Boolean);
        if (parsed.length > 0) {
          console.log('CLS parsed from raw message:', parsed.slice(0, 3));
          return parsed;
        }
      }

      // Fallback to library-parsed data with framerate fix
      const data = response.data || [];
      return data.map(fixClipFramerate);
    }
    return [];
  } catch (error) {
    console.error('CLS command failed:', error);
    throw error;
  }
}

// Parse a single THUMBNAIL LIST line
// Format: "clip/name" datetime size
function parseThumbnailListLine(line) {
  const match = line.match(/^"([^"]+)"\s+(\d+T\d+)\s+(\d+)/);
  if (!match) return null;

  const [, clip, datetime, size] = match;
  return {
    clip,
    datetime,
    size: parseInt(size, 10)
  };
}

// THUMBNAIL LIST - Get list of available thumbnails
export async function thumbnailList(casparCG) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    const result = await casparCG.thumbnailList({});
    if (result?.request) {
      const response = await result.request;

      console.log('THUMBNAIL LIST response:', response);

      // Parse raw message if available
      if (response.message && typeof response.message === 'string') {
        const lines = response.message.split('\n').filter(l => l.trim());
        const parsed = lines.map(parseThumbnailListLine).filter(Boolean);
        if (parsed.length > 0) {
          console.log('Thumbnails parsed from raw message:', parsed.length, 'items');
          return parsed;
        }
      }

      // Fallback to library-parsed data
      return response.data || [];
    }
    return [];
  } catch (error) {
    console.error('THUMBNAIL LIST command failed:', error);
    throw error;
  }
}

// THUMBNAIL RETRIEVE - Get thumbnail as base64 PNG
export async function thumbnailRetrieve(casparCG, filename) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    // Ensure filename is quoted for AMCP command (required for paths with spaces)
    const quotedFilename = filename.includes(' ') && !filename.startsWith('"')
      ? `"${filename}"`
      : filename;

    console.log('THUMBNAIL RETRIEVE:', quotedFilename);
    const result = await casparCG.thumbnailRetrieve({ filename: quotedFilename });
    if (result?.request) {
      const response = await result.request;
      console.log('THUMBNAIL RETRIEVE response:', response);

      // The thumbnail data might be in response.data or response.message
      if (response.data) {
        return response.data;
      }

      // If data is in message (raw base64 string)
      if (response.message && typeof response.message === 'string') {
        // Remove any whitespace/newlines from base64 data
        return response.message.trim();
      }

      return null;
    }
    return null;
  } catch (error) {
    console.error('Thumbnail retrieve failed for', filename, ':', error);
    throw error;
  }
}

// THUMBNAIL GENERATE - Trigger thumbnail creation
export async function thumbnailGenerate(casparCG, filename) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    // Ensure filename is quoted for AMCP command (required for paths with spaces)
    const quotedFilename = filename.includes(' ') && !filename.startsWith('"')
      ? `"${filename}"`
      : filename;

    console.log('THUMBNAIL GENERATE:', quotedFilename);
    const result = await casparCG.thumbnailGenerate({ filename: quotedFilename });
    if (result?.request) {
      const response = await result.request;
      console.log('THUMBNAIL GENERATE response:', response);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Thumbnail generate failed for', filename, ':', error);
    throw error;
  }
}

// INFO - Get channel/layer information including frame rate
export async function info(casparCG, channel = null, layer = null) {
  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  try {
    const params = {};
    if (channel !== null) {
      params.channel = channel;
    }
    if (layer !== null) {
      params.layer = layer;
    }
    const result = await casparCG.info(params);
    if (result?.request) {
      const response = await result.request;
      return response.data || null;
    }
    return null;
  } catch (error) {
    console.error('INFO command failed:', error);
    throw error;
  }
}

// Parse frame rate from format string like "720p5000", "1080i2997", "720p50", etc.
function parseFrameRateFromFormat(format) {
  if (!format) return null;

  // Try 4-digit format first (e.g., "5000", "2997", "5994", "2398")
  const match4 = format.match(/[ip](\d{4})$/i);
  if (match4) {
    return parseInt(match4[1], 10) / 100; // 5000 -> 50, 2997 -> 29.97
  }

  // Try 2-digit format (e.g., "720p50", "1080i25")
  const match2 = format.match(/[ip](\d{2})$/i);
  if (match2) {
    return parseInt(match2[1], 10); // 50 -> 50, 25 -> 25
  }

  // Try extracting any trailing digits after resolution marker
  const matchAny = format.match(/[ip](\d+)$/i);
  if (matchAny) {
    const num = parseInt(matchAny[1], 10);
    // If > 100, assume it's in hundredths (like 2997 = 29.97)
    return num > 100 ? num / 100 : num;
  }

  // Legacy format names
  if (format.toUpperCase().includes('PAL')) return 25;
  if (format.toUpperCase().includes('NTSC')) return 29.97;

  return null;
}

// Parse resolution from format string like "720p5000" or "1080i5000"
function parseResolutionFromFormat(format) {
  if (!format) return null;
  const match = format.match(/^(\d+)([pi])/i);
  if (match) return `${match[1]}${match[2].toLowerCase()}`;
  if (format.toUpperCase().includes('PAL')) return '576i';
  if (format.toUpperCase().includes('NTSC')) return '480i';
  return format;
}

// Parse channel info from INFO response (handles array or object)
export function parseChannelInfo(infoData, channelId = null) {
  if (!infoData) return null;

  // Handle array response (e.g., from INFO without channel param)
  if (Array.isArray(infoData)) {
    const entry = channelId !== null
      ? infoData.find(e => e.channel === channelId)
      : infoData[0];
    if (entry) {
      return {
        frameRate: entry.frameRate || parseFrameRateFromFormat(entry.format),
        resolution: parseResolutionFromFormat(entry.format),
        format: entry.format
      };
    }
    return null;
  }

  // Handle single object response
  if (typeof infoData === 'object') {
    return {
      frameRate: infoData.frameRate || infoData.framerate || parseFrameRateFromFormat(infoData.format),
      resolution: parseResolutionFromFormat(infoData.format),
      format: infoData.format
    };
  }

  return null;
}

// Backward compatible wrapper - parse frame rate from INFO channel response
export function parseChannelFrameRate(infoData, channelId = null) {
  return parseChannelInfo(infoData, channelId)?.frameRate || null;
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
  executeRawCommand,
  cls,
  thumbnailList,
  thumbnailRetrieve,
  thumbnailGenerate,
  info,
  parseChannelFrameRate,
  parseChannelInfo
};
