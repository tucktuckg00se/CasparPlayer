const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Cache directory for thumbnails
let cacheDir = null;

function setCacheDirectory(dir) {
  cacheDir = dir;
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

function getThumbnailPath(filePath) {
  if (!cacheDir) return null;

  // Create a unique filename based on path and modification time
  const hash = Buffer.from(filePath).toString('base64').replace(/[\/\\=+]/g, '_');
  return path.join(cacheDir, `${hash}.jpg`);
}

async function thumbnailExists(filePath) {
  const thumbPath = getThumbnailPath(filePath);
  if (!thumbPath) return false;

  try {
    await fs.promises.access(thumbPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function getVideoMetadata(filePath) {
  return new Promise((resolve) => {
    // Use ffprobe to get video metadata
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      try {
        const data = JSON.parse(output);
        const videoStream = data.streams?.find(s => s.codec_type === 'video');
        const audioStream = data.streams?.find(s => s.codec_type === 'audio');

        resolve({
          duration: parseFloat(data.format?.duration) || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : '',
          codec: videoStream?.codec_name || '',
          frameRate: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 0,
          bitrate: parseInt(data.format?.bit_rate) || 0,
          hasAudio: !!audioStream
        });
      } catch (error) {
        resolve(null);
      }
    });

    ffprobe.on('error', () => {
      resolve(null);
    });
  });
}

async function generateVideoThumbnail(filePath, outputPath) {
  return new Promise((resolve) => {
    // Use ffmpeg to generate thumbnail at 10% into the video
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', filePath,
      '-ss', '00:00:01', // Seek to 1 second
      '-vframes', '1',
      '-vf', 'scale=200:-1',
      '-q:v', '5',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

async function getImageMetadata(filePath) {
  return new Promise((resolve) => {
    // Use ffprobe to get image metadata
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      filePath
    ]);

    let output = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      try {
        const data = JSON.parse(output);
        const stream = data.streams?.[0];

        resolve({
          width: stream?.width || 0,
          height: stream?.height || 0,
          resolution: stream ? `${stream.width}x${stream.height}` : '',
          codec: stream?.codec_name || ''
        });
      } catch {
        resolve(null);
      }
    });

    ffprobe.on('error', () => {
      resolve(null);
    });
  });
}

async function generateImageThumbnail(filePath, outputPath) {
  return new Promise((resolve) => {
    // Use ffmpeg to resize image
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', filePath,
      '-vf', 'scale=200:-1',
      '-q:v', '5',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

async function generateThumbnail(filePath, fileType) {
  const thumbPath = getThumbnailPath(filePath);
  if (!thumbPath) {
    return { thumbnail: null, metadata: null };
  }

  let metadata = null;
  let thumbnailGenerated = false;

  // Check if thumbnail already exists
  const exists = await thumbnailExists(filePath);
  if (exists) {
    // Get metadata even if thumbnail exists
    if (fileType === 'video') {
      metadata = await getVideoMetadata(filePath);
    } else if (fileType === 'image') {
      metadata = await getImageMetadata(filePath);
    }

    return {
      thumbnail: thumbPath,
      metadata
    };
  }

  // Generate new thumbnail
  if (fileType === 'video') {
    metadata = await getVideoMetadata(filePath);
    thumbnailGenerated = await generateVideoThumbnail(filePath, thumbPath);
  } else if (fileType === 'image') {
    metadata = await getImageMetadata(filePath);
    thumbnailGenerated = await generateImageThumbnail(filePath, thumbPath);
  }

  return {
    thumbnail: thumbnailGenerated ? thumbPath : null,
    metadata
  };
}

async function clearThumbnailCache() {
  if (!cacheDir) return;

  try {
    const files = await fs.promises.readdir(cacheDir);
    for (const file of files) {
      await fs.promises.unlink(path.join(cacheDir, file));
    }
  } catch (error) {
    console.error('Error clearing thumbnail cache:', error);
  }
}

async function removeThumbnail(filePath) {
  const thumbPath = getThumbnailPath(filePath);
  if (!thumbPath) return;

  try {
    await fs.promises.unlink(thumbPath);
  } catch {
    // Ignore if doesn't exist
  }
}

module.exports = {
  setCacheDirectory,
  getThumbnailPath,
  thumbnailExists,
  generateThumbnail,
  getVideoMetadata,
  getImageMetadata,
  generateVideoThumbnail,
  generateImageThumbnail,
  clearThumbnailCache,
  removeThumbnail
};
