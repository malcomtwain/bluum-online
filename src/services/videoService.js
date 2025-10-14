const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require('electron');

ffmpeg.setFfmpegPath(ffmpegPath);

class VideoService {
  constructor() {
    this.outputDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Bluum_Videos');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir);
    }
  }

  async generateVideo(options) {
    const {
      mainVideo,
      secondaryVideo,
      hook,
      music,
      textSettings,
      outputFileName,
    } = options;

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add main video
      command.input(mainVideo)
        .inputOptions([`-t ${textSettings.duration.part1}`]);

      // Add secondary video
      command.input(secondaryVideo)
        .inputOptions([`-t ${textSettings.duration.part2}`]);

      // Add background music if provided
      if (music) {
        command.input(music)
          .inputOptions(['-stream_loop -1']); // Loop music if shorter than video
      }

      // Set output options
      command
        .complexFilter([
          // Concatenate videos
          '[0:v][1:v]concat=n=2:v=1:a=0[outv]',
          // Add text overlay
          {
            filter: 'drawtext',
            options: {
              text: hook,
              fontfile: this.getFontPath(textSettings.selectedFonts[0]),
              fontsize: textSettings.textSize,
              fontcolor: textSettings.textColor,
              x: '(w-text_w)/2', // Center horizontally
              y: '(h-text_h)/2', // Center vertically
              enable: 'between(t,0,5)', // Show text for first 5 seconds
            },
            inputs: 'outv',
            outputs: 'texted'
          }
        ])
        .outputOptions([
          '-c:v libx264', // Use H.264 codec
          '-preset fast', // Encoding preset
          '-crf 23', // Quality setting
          '-c:a aac', // Audio codec
          '-shortest' // End when shortest input ends
        ])
        .toFormat('mp4')
        .on('progress', (progress) => {
          ipcRenderer.send('video-progress', {
            filename: outputFileName,
            percent: Math.round(progress.percent)
          });
        })
        .on('end', () => resolve(outputFileName))
        .on('error', reject)
        .save(path.join(this.outputDir, outputFileName));
    });
  }

  async generateBatch(options) {
    const {
      mainVideo,
      secondaryVideos,
      hooks,
      music,
      textSettings,
      numberOfVideos
    } = options;

    const results = [];
    const errors = [];

    for (let i = 0; i < numberOfVideos; i++) {
      try {
        // Randomly select secondary video and hook
        const secondaryVideo = secondaryVideos[Math.floor(Math.random() * secondaryVideos.length)];
        const hook = hooks[Math.floor(Math.random() * hooks.length)];
        const font = textSettings.useAllFonts
          ? textSettings.selectedFonts[Math.floor(Math.random() * textSettings.selectedFonts.length)]
          : textSettings.selectedFonts[0];

        const outputFileName = `bluum_${Date.now()}_${i}.mp4`;
        
        const result = await this.generateVideo({
          mainVideo,
          secondaryVideo,
          hook,
          music,
          textSettings: { ...textSettings, selectedFonts: [font] },
          outputFileName
        });

        results.push(result);
      } catch (error) {
        errors.push({ index: i, error: error.message });
      }
    }

    return { results, errors };
  }

  getFontPath(fontName) {
    // Map font names to actual font files
    // This would need to be implemented based on your font file locations
    const fontMap = {
      'Arial': '/System/Library/Fonts/Arial.ttf',
      'TikTok Sans': path.join(__dirname, '../assets/fonts/TikTokSans.ttf'),
      // Add other font mappings
    };

    return fontMap[fontName] || fontMap['Arial']; // Default to Arial if font not found
  }
}

export default new VideoService(); 