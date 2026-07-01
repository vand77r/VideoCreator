import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

// Map of style presets to ASS Subtitle Styling parameters
const STYLE_PRESETS = {
  // 1. Hormozi Pop: Montserrat, centered (Alignment 5), green highlight, yellow secondary, thick border, uppercase
  1: {
    fontName: 'Montserrat,Impact,Arial Black',
    fontSize: 44,
    primaryColor: '&H00FFFFFF',      // White
    secondaryColor: '&H0000FF00',    // Neon Green (highlight)
    outlineColor: '&H00000000',      // Black outline
    backColor: '&H00000000',
    outline: 4,
    shadow: 0,
    alignment: 5,                    // Center screen
    marginV: 0,
    borderStyle: 1,
    uppercase: true
  },
  // 2. Cinematic Drama: Georgia/Playfair, bottom, soft white, clean drop shadow
  2: {
    fontName: 'Playfair Display,Georgia,Times New Roman',
    fontSize: 28,
    primaryColor: '&H00EFEFEF',
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    outline: 1.5,
    shadow: 1.5,
    alignment: 2,                    // Bottom center
    marginV: 140,                    // Raised from very bottom
    borderStyle: 1,
    uppercase: false
  },
  // 3. Cyberpunk Neon: Courier New, pink and cyan border, centered
  3: {
    fontName: 'Courier New,Consolas,Monospace',
    fontSize: 38,
    primaryColor: '&H00FFFF00',      // Neon Cyan
    secondaryColor: '&H00FF00FF',    // Neon Pink
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    outline: 3,
    shadow: 0,
    alignment: 5,
    marginV: 0,
    borderStyle: 1,
    uppercase: false
  },
  // 4. Retro Film: Typewriter (Courier New), white text inside dark rectangular box
  4: {
    fontName: 'Courier New,Courier,monospace',
    fontSize: 30,
    primaryColor: '&H00FFFFFF',
    secondaryColor: '&H0000FFFF',    // Yellow highlight
    outlineColor: '&H00000000',
    backColor: '&H90000000',         // Semitransparent black backing box
    outline: 0,
    shadow: 0,
    alignment: 2,
    marginV: 150,
    borderStyle: 3,                  // Opaque box background
    uppercase: false
  },
  // 5. Bold Minimalist: Inter/Arial, clean, large yellow underline/highlight, raised bottom
  5: {
    fontName: 'Inter,Arial,Helvetica',
    fontSize: 40,
    primaryColor: '&H00FFFFFF',
    secondaryColor: '&H0000FFFF',    // Yellow
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    outline: 3,
    shadow: 0,
    alignment: 2,
    marginV: 180,
    borderStyle: 1,
    uppercase: false
  },
  // 6. Glitch Warp: Arial Black, red border, yellow primary, centered
  6: {
    fontName: 'Arial Black,Impact,Arial',
    fontSize: 46,
    primaryColor: '&H0000FFFF',      // Yellow
    secondaryColor: '&H000000FF',    // Red outline
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    outline: 4,
    shadow: 0,
    alignment: 5,
    marginV: 0,
    borderStyle: 1,
    uppercase: true
  },
  // 7. Comic Book: Comic Sans, yellow text, thick black border, centered
  7: {
    fontName: 'Comic Sans MS,Arial,Helvetica',
    fontSize: 42,
    primaryColor: '&H0000FFFF',      // Yellow
    secondaryColor: '&H00FFFFFF',    // White
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    outline: 5,                      // Very thick border
    shadow: 2,
    alignment: 5,
    marginV: 0,
    borderStyle: 1,
    uppercase: false
  },
  // 8. Clean Corporate: Roboto/Arial, white text inside dark gray box, bottom
  8: {
    fontName: 'Roboto,Arial,Helvetica',
    fontSize: 26,
    primaryColor: '&H00FFFFFF',
    secondaryColor: '&H00CCCCCC',
    outlineColor: '&H00000000',
    backColor: '&HB0333333',         // Dark gray box
    outline: 0,
    shadow: 0,
    alignment: 2,
    marginV: 120,
    borderStyle: 3,
    uppercase: false
  },
  // 9. Fast & Furious: Impact, orange primary, black border, tilted/slanted (italic), centered
  9: {
    fontName: 'Impact,Arial Black,Arial',
    fontSize: 50,
    primaryColor: '&H0000A5FF',      // Orange
    secondaryColor: '&H00FFFFFF',    // White
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    outline: 4,
    shadow: 0,
    alignment: 5,
    marginV: 0,
    borderStyle: 1,
    uppercase: true,
    italic: true
  },
  // 10. Aesthetic Vlog: Pacfico/Comic Sans, pastel pink primary, white border, bottom raised
  10: {
    fontName: 'Pacifico,Comic Sans MS,Arial',
    fontSize: 34,
    primaryColor: '&H00D8C0FF',      // Pastel Pink
    secondaryColor: '&H00FFFFFF',    // White
    outlineColor: '&H00808080',      // Gray border
    backColor: '&H00000000',
    outline: 2.5,
    shadow: 1,
    alignment: 2,
    marginV: 160,
    borderStyle: 1,
    uppercase: false
  }
};

export class VideoService {
  /**
   * Helper to execute a CLI command as a Promise.
   */
  runCommand(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Command error: ${cmd}`);
          console.error(stderr);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Probes the duration of an audio file in seconds.
   */
  getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  }

  /**
   * Renders a single vertical video (1080x1350) from assets, voiceover, and captions.
   */
  async renderVideo({
    assets,
    voiceoverPath,
    wordTimings,
    musicPath,
    stylePreset,
    orderOfInsertion,
    outputPath,
    titleText,
    voiceoverEnabled = true,
    slideDuration = 3,
    musicVolume = 0.15,
    animationSpeed = 'normal',
    allowedAnimations = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    tableRows = [],
    variationIndex = 0,       // Which variation this is (0, 1, 2...) — drives animation + shuffle differences
    musicStartTime = 0,       // Start offset (seconds) into the music file
    musicSectionDuration = 0, // How long to play (0 = full track / loop)
    sameTextThroughout = false,
    captionPosition = 'bottom',
    captionsEnabled = true,
    videoAudioSettings = {}
  }) {
    const tempDir = path.dirname(outputPath);
    const jobId = path.basename(outputPath, '.mp4');
    const tempFiles = [];

    try {
      // 2. Prepare visual assets — shuffle differently per variation
      let processedAssets = [...assets];
      if (!orderOfInsertion) {
        for (let i = processedAssets.length - 1; i > 0; i--) {
          const j = (i * 2654435761 + variationIndex * 1234567) % (i + 1);
          [processedAssets[i], processedAssets[Math.abs(j)]] = [processedAssets[Math.abs(j)], processedAssets[i]];
        }
      }

      // 1. Compute per-asset durations: videos use their actual length, images use slideDuration
      const parsedSlideDuration = parseFloat(slideDuration || 3);
      const perAssetDurations = [];
      for (const asset of processedAssets) {
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv'].includes(path.extname(asset).toLowerCase());
        if (isVideo) {
          try {
            const vidDur = await this.getAudioDuration(asset);
            perAssetDurations.push(vidDur);
          } catch {
            perAssetDurations.push(parsedSlideDuration);
          }
        } else {
          perAssetDurations.push(parsedSlideDuration);
        }
      }

      let renderDuration;
      if (voiceoverEnabled && voiceoverPath) {
        const totalDuration = await this.getAudioDuration(voiceoverPath);
        renderDuration = totalDuration + 0.3;
      } else {
        renderDuration = perAssetDurations.reduce((sum, d) => sum + d, 0);
      }

      const numAssets = processedAssets.length;
      console.log(`[VideoService] Total duration: ${renderDuration}s, assets: ${numAssets}`);

      // 3. Render processed 4:5 MP4 clips for each asset
      const clipPaths = [];
      const videoAudioTracks = [];
      let cumulativeMs = 0;
      for (let i = 0; i < numAssets; i++) {
        const asset = processedAssets[i];
        const clipFilename = `clip_${jobId}_${i}.mp4`;
        const clipPath = path.join(tempDir, clipFilename);
        tempFiles.push(clipPath);

        const isVideo = ['.mp4', '.mov', '.avi', '.mkv'].includes(path.extname(asset).toLowerCase());
        const clipDuration = voiceoverEnabled && voiceoverPath
          ? renderDuration / numAssets
          : perAssetDurations[i];

        if (isVideo) {
          console.log(`[VideoService] Processing video clip ${i}: ${asset} (${clipDuration.toFixed(1)}s)`);
          await this.processVideoAsset(asset, clipPath, clipDuration);

          const audioSetting = videoAudioSettings[path.basename(asset)];
          if (audioSetting && audioSetting.useOriginalAudio) {
            const audioClipPath = path.join(tempDir, `vaudio_${jobId}_${i}.mp3`);
            tempFiles.push(audioClipPath);
            try {
              await this.extractVideoAudioTrack(asset, audioClipPath, clipDuration, audioSetting.volume ?? 1.0);
              videoAudioTracks.push({ path: audioClipPath, startMs: cumulativeMs });
            } catch (e) {
              console.warn(`[VideoService] Asset ${asset} has no usable audio track, skipping.`);
            }
          }
        } else {
          console.log(`[VideoService] Processing image clip ${i} (variation ${variationIndex}): ${asset} (${clipDuration.toFixed(1)}s)`);
          await this.processImageAsset({
            inputPath: asset,
            outputPath: clipPath,
            duration: clipDuration,
            stylePreset,
            index: i,
            animationSpeed,
            allowedAnimations,
            variationIndex
          });
        }
        clipPaths.push(clipPath);
        cumulativeMs += clipDuration * 1000;
      }

      // 4. Concatenate visual clips
      const concatListPath = path.join(tempDir, `concat_${jobId}.txt`);
      tempFiles.push(concatListPath);

      const concatListContent = clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(concatListPath, concatListContent);

      const tempConcatedVideo = path.join(tempDir, `concated_${jobId}.mp4`);
      tempFiles.push(tempConcatedVideo);

      console.log(`[VideoService] Concatenating clips into: ${tempConcatedVideo}`);
      await this.runCommand(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${tempConcatedVideo}"`);

      // 5. Generate Advanced SubStation Alpha (.ass) subtitle file.
      // Crucial Fix: Write to a relative path file to avoid backslash/colon filter syntax errors on Windows!
      const assFilename = `subs_${jobId}.ass`;
      const assPath = path.join(process.cwd(), assFilename); // Save in current working directory of server
      tempFiles.push(assPath);
      
      this.generateAssFile({
        wordTimings, 
        stylePreset, 
        titleText, 
        totalDuration: renderDuration, 
        outputPath: assPath,
        tableRows,
        voiceoverEnabled,
        sameTextThroughout,
        captionPosition,
        captionsEnabled
      });

      // 6. Assemble everything (Visual + Voiceover + Music + Subtitles)
      console.log(`[VideoService] Performing final merge and subtitle burn using relative ASS...`);
      await this.assembleFinalOutput({
        videoPath: tempConcatedVideo,
        voiceoverPath: voiceoverEnabled ? voiceoverPath : null,
        musicPath,
        assFilename,
        outputPath,
        duration: renderDuration,
        musicVolume,
        musicStartTime,
        musicSectionDuration,
        videoAudioTracks
      });

      console.log(`[VideoService] Final render completed: ${outputPath}`);
      return outputPath;

    } catch (error) {
      console.error('[VideoService] Rendering failed:', error);
      throw error;
    } finally {
      // 7. Cleanup temp files
      console.log(`[VideoService] Cleaning up temporary files...`);
      for (const tempFile of tempFiles) {
        if (fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            console.warn(`Failed to delete temp file: ${tempFile}`);
          }
        }
      }
    }
  }

  /**
   * Processes a video asset to fit 1080x1350 4:5 vertical format, trims/loops it, and removes audio.
   */
  async processVideoAsset(inputPath, outputPath, duration) {
    // scale to cover 1080x1350, crop center, set 30fps, trim to duration, strip audio
    const filter = `scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350`;
    
    // We stream/loop the video just in case it is shorter than the desired duration
    const cmd = `ffmpeg -y -stream_loop -1 -i "${inputPath}" -vf "${filter}" -t ${duration} -r 30 -an -pix_fmt yuv420p "${outputPath}"`;
    await this.runCommand(cmd);
  }

  /**
   * Extracts (and loops/trims) a video asset's own audio track at a given volume,
   * matching the duration of its visual clip so it can be mixed back at the right offset.
   */
  async extractVideoAudioTrack(inputPath, outputPath, duration, volume = 1.0) {
    const cmd = `ffmpeg -y -stream_loop -1 -i "${inputPath}" -t ${duration} -vn -filter:a "volume=${volume}" -ac 2 -ar 44100 "${outputPath}"`;
    await this.runCommand(cmd);
  }

  /**
   * Processes an image asset to a 1080x1350 4:5 vertical MP4 clip, applying a Capcut-style animation.
   */
  async processImageAsset({
    inputPath,
    outputPath,
    duration,
    stylePreset,
    index,
    animationSpeed = 'normal',
    allowedAnimations = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    variationIndex = 0
  }) {
    // Select an animation: cycle through allowedAnimations, offset by variationIndex so
    // each variation picks a different animation for each clip position.
    let animIndex = 0;
    if (allowedAnimations && allowedAnimations.length > 0) {
      animIndex = allowedAnimations[(index + variationIndex) % allowedAnimations.length];
    } else {
      animIndex = (stylePreset + index + variationIndex) % 10;
    }

    let filter = '';
    // Scale image slightly larger to give pan/zoom animations room to move
    const preScale = 'scale=1620:2025:force_original_aspect_ratio=increase,crop=1620:2025';
    const totalFrames = Math.round(30 * duration);

    // Speed multiplier — controls how fast/slow animations move
    let speedMult = 1.0;
    if (animationSpeed === 'slow') speedMult = 0.5;
    if (animationSpeed === 'fast') speedMult = 2.0;

    switch (animIndex) {
      case 0: // Ken Burns Slow Zoom In
        // zoompan: 'on' is frame counter — valid here
        filter = `${preScale},zoompan=z='min(zoom+${(0.0015 * speedMult).toFixed(5)},1.25)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350`;
        break;
      case 1: // Ken Burns Slow Zoom Out
        filter = `${preScale},zoompan=z='max(1.25-${(0.0015 * speedMult).toFixed(5)}*on,1.0)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350`;
        break;
      case 2: // Slide Left (pan left to right)
        // crop filter: 't' is time in seconds — valid here
        filter = `scale=1440:1350:force_original_aspect_ratio=increase,crop=1440:1350,crop=1080:1350:'min((iw-1080)*(t*${speedMult.toFixed(3)}/${duration.toFixed(3)}),iw-1080)':0`;
        break;
      case 3: // Slide Right (pan right to left)
        filter = `scale=1440:1350:force_original_aspect_ratio=increase,crop=1440:1350,crop=1080:1350:'max((iw-1080)*(1-t*${speedMult.toFixed(3)}/${duration.toFixed(3)}),0)':0`;
        break;
      case 4: // Slide Up (pan bottom to top)
        filter = `scale=1080:1800:force_original_aspect_ratio=increase,crop=1080:1800,crop=1080:1350:0:'min((ih-1350)*(t*${speedMult.toFixed(3)}/${duration.toFixed(3)}),ih-1350)'`;
        break;
      case 5: // Flutters — gentle rhythmic pulse zoom
        filter = `${preScale},zoompan=z='1.06+0.04*sin(2*3.14159*on*${speedMult.toFixed(3)}/10)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350`;
        break;
      case 6: // Echo Pull — strong zoom arc (in then out)
        filter = `${preScale},zoompan=z='1.08+0.12*sin(3.14159*on*${speedMult.toFixed(3)}/${totalFrames})':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350`;
        break;
      case 7: // Pull Vibration — zoom in + camera shake
        filter = `${preScale},zoompan=z='1.12+0.04*sin(2*3.14159*on*${speedMult.toFixed(3)}/6)':d=${totalFrames}:x='iw/2-(iw/zoom/2)+15*sin(on*${speedMult.toFixed(3)})':y='ih/2-(ih/zoom/2)+15*cos(on*${speedMult.toFixed(3)})':s=1080x1350`;
        break;
      case 8: // Mist Dissipates — blur clears over time
        // IMPORTANT: boxblur uses 'n' (frame index), NOT 'on' or 't'
        filter = `scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,boxblur=lr='max(${(12 * speedMult).toFixed(1)}-n*${(speedMult * 0.25).toFixed(3)},0)':lp=1`;
        break;
      case 9: // Slash Vibration — oscillating rotation tilt
        // IMPORTANT: rotate filter uses 't' (time in seconds), NOT 'on'
        filter = `scale=1200:1500:force_original_aspect_ratio=increase,crop=1200:1500,rotate=angle='0.05*sin(2*3.14159*t*${speedMult.toFixed(3)}/8)':ow=1080:oh=1350:c=black`;
        break;
      default:
        filter = `${preScale},zoompan=z='1.1+0.08*on/${totalFrames}':d=${totalFrames}:x='(iw-iw/zoom)*(on/${totalFrames})':y='(ih-ih/zoom)/2':s=1080x1350`;
        break;
    }

    // Style-specific overlay effects
    if (stylePreset === 6) {
      // Glitch Warp: white flash at start
      filter += `,drawbox=y=0:color=white@0.3:t=max:enable='lt(n,5)'`;
    }
    if (stylePreset === 4) {
      // Retro Film: grain noise
      filter += `,noise=alls=15:allf=t+u`;
    }

    const cmd = `ffmpeg -y -loop 1 -i "${inputPath}" -vf "${filter}" -t ${duration} -r 30 -pix_fmt yuv420p "${outputPath}"`;
    await this.runCommand(cmd);
  }

  /**
   * Renders a video with per-slide overrides for the editor re-render flow.
   */
  async renderVideoWithOverrides({
    assets,
    slideOverrides,
    voiceoverPath,
    wordTimings,
    musicPath,
    stylePreset,
    outputPath,
    titleText,
    quoteText,
    voiceoverEnabled = false,
    musicVolume = 0.15,
    animationSpeed = 'normal',
    musicStartTime = 0,
    musicSectionDuration = 0,
    sameTextThroughout = false,
    captionPosition = 'bottom',
    tableRows: inputTableRows = null
  }) {
    const tempDir = path.dirname(outputPath);
    const jobId = path.basename(outputPath, '.mp4');
    const tempFiles = [];

    try {
      const numAssets = assets.length;
      const renderDuration = slideOverrides.reduce((sum, s) => sum + s.duration, 0);

      const clipPaths = [];
      for (let i = 0; i < numAssets; i++) {
        const asset = assets[i];
        const override = slideOverrides[i] || { duration: 3, animation: 0 };
        const clipFilename = `clip_${jobId}_${i}.mp4`;
        const clipPath = path.join(tempDir, clipFilename);
        tempFiles.push(clipPath);

        const isVideo = ['.mp4', '.mov', '.avi', '.mkv'].includes(path.extname(asset).toLowerCase());

        if (isVideo) {
          await this.processVideoAsset(asset, clipPath, override.duration);
        } else {
          await this.processImageAsset({
            inputPath: asset,
            outputPath: clipPath,
            duration: override.duration,
            stylePreset,
            index: i,
            animationSpeed,
            allowedAnimations: [override.animation],
            variationIndex: 0
          });
        }
        clipPaths.push(clipPath);
      }

      const concatListPath = path.join(tempDir, `concat_${jobId}.txt`);
      tempFiles.push(concatListPath);
      const concatListContent = clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(concatListPath, concatListContent);

      const tempConcatedVideo = path.join(tempDir, `concated_${jobId}.mp4`);
      tempFiles.push(tempConcatedVideo);
      await this.runCommand(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${tempConcatedVideo}"`);

      const assFilename = `subs_${jobId}.ass`;
      const assPath = path.join(process.cwd(), assFilename);
      tempFiles.push(assPath);

      const tableRows = inputTableRows || (quoteText ? [{ title: titleText, quote: quoteText, startTime: 0, textAnimation: 'none', textBackground: 'black' }] : []);
      this.generateAssFile({
        wordTimings: voiceoverEnabled ? wordTimings : null,
        stylePreset,
        titleText,
        totalDuration: renderDuration,
        outputPath: assPath,
        tableRows,
        voiceoverEnabled,
        sameTextThroughout,
        captionPosition
      });

      await this.assembleFinalOutput({
        videoPath: tempConcatedVideo,
        voiceoverPath: voiceoverEnabled ? voiceoverPath : null,
        musicPath,
        assFilename,
        outputPath,
        duration: renderDuration,
        musicVolume,
        musicStartTime,
        musicSectionDuration
      });

      return outputPath;
    } catch (error) {
      console.error('[VideoService] Re-render failed:', error);
      throw error;
    } finally {
      for (const tempFile of tempFiles) {
        if (fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch (e) {}
        }
      }
    }
  }

  /**
   * Builds ASS override tag for text background box.
   */
  buildBackgroundTag(textBackground) {
    if (!textBackground || textBackground === 'none') return '';
    if (textBackground === 'black') return 'BgBlack';
    if (textBackground === 'dark-gray') return 'BgGray';
    return '';
  }

  /**
   * Builds ASS animation tags for typed and blur-out effects.
   */
  buildAnimationTags(textAnimation, startMs, endMs) {
    if (!textAnimation || textAnimation === 'none') return '';
    const duration = endMs - startMs;

    if (textAnimation === 'typed') {
      // Fade in from left using \fad and \move isn't great for typed — use \kf karaoke fill
      // \K = karaoke fill duration in centiseconds — reveals text left-to-right
      const durationCs = Math.round(duration / 10);
      return `{\\K${durationCs}}`;
    }

    if (textAnimation === 'blur-out') {
      // Start clear, blur out at the end: \blur0 -> \blur15 + fade out
      const fadeStart = Math.round(duration * 0.6);
      const fadeDuration = duration - fadeStart;
      return `{\\blur0\\t(${fadeStart},${duration},\\blur15\\alpha&HFF&)}`;
    }

    return '';
  }

  /**
   * Formats millisecond timestamps to ASS format (H:MM:SS.CC)
   */
  formatAssTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);

    const pad = (num, size) => num.toString().padStart(size, '0');
    return `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(centiseconds, 2)}`;
  }

  /**
   * Generates a styled .ass subtitle file with word-by-word highlighting and title overlay.
   */
  generateAssFile({
    wordTimings,
    stylePreset,
    titleText,
    totalDuration,
    outputPath,
    tableRows = [],
    voiceoverEnabled = true,
    sameTextThroughout = false,
    captionPosition = 'bottom',
    captionsEnabled = true
  }) {
    const style = STYLE_PRESETS[stylePreset] || STYLE_PRESETS[1];

    const fontName = style.fontName.split(',')[0].trim();
    const fontSize = style.fontSize;
    const primaryCol = style.primaryColor;
    const secondaryCol = style.secondaryColor;
    const outlineCol = style.outlineColor;
    const backCol = style.backColor;
    const bold = -1;
    const italic = style.italic ? -1 : 0;
    const outline = style.outline;
    const shadow = style.shadow;
    const borderStyle = style.borderStyle;

    // ASS alignment: 2=bottom-center, 5=middle-center, 8=top-center
    let alignment, marginV;
    if (captionPosition === 'top') {
      alignment = 8;
      marginV = 60;
    } else if (captionPosition === 'center') {
      alignment = 5;
      marginV = 0;
    } else {
      alignment = 2;
      marginV = style.marginV > 0 ? style.marginV : 140;
    }

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1350
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryCol},${secondaryCol},${outlineCol},${backCol},${bold},${italic},0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},30,30,${marginV},1
Style: BgBlack,${fontName},${fontSize},${primaryCol},${secondaryCol},&H00000000,&H80000000,${bold},${italic},0,0,100,100,0,0,3,4,0,${alignment},30,30,${marginV},1
Style: BgGray,${fontName},${fontSize},${primaryCol},${secondaryCol},&H00333333,&H80333333,${bold},${italic},0,0,100,100,0,0,3,4,0,${alignment},30,30,${marginV},1
Style: Title,Montserrat,50,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,8,30,30,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // 1. Add title overlay if present (displays for first 2.5 seconds at the top)
    if (captionsEnabled && titleText) {
      const displayTitle = style.uppercase ? titleText.toUpperCase() : titleText;
      assContent += `Dialogue: 0,0:00:00.00,0:00:02.50,Title,,0,0,0,,${displayTitle}\n`;
    }

    // 2. Generate Caption lines — always render from tableRows with per-row timing
    if (captionsEnabled && tableRows && tableRows.length > 0) {
      const activeRows = tableRows.filter(r => r.quote && r.quote.trim().length > 0);

      if (sameTextThroughout && activeRows.length > 0) {
        let quoteText = activeRows[0].quote.trim();
        if (style.uppercase) quoteText = quoteText.toUpperCase();
        const row = activeRows[0];
        const styleName = this.buildBackgroundTag(row.textBackground) || 'Default';
        const animTags = this.buildAnimationTags(row.textAnimation, 0, totalDuration * 1000);
        const endTimeStr = this.formatAssTime(totalDuration * 1000);
        assContent += `Dialogue: 0,0:00:00.00,${endTimeStr},${styleName},,0,0,0,,${animTags}${quoteText}\n`;
      } else if (activeRows.length > 0) {
        for (let i = 0; i < activeRows.length; i++) {
          const row = activeRows[i];
          let quoteText = row.quote.trim();
          if (style.uppercase) quoteText = quoteText.toUpperCase();

          const startMs = (parseFloat(row.startTime) || 0) * 1000;
          let endMs;
          if (i < activeRows.length - 1) {
            const nextStart = (parseFloat(activeRows[i + 1].startTime) || 0) * 1000;
            endMs = nextStart > startMs ? nextStart : totalDuration * 1000;
          } else {
            endMs = totalDuration * 1000;
          }

          const styleName = this.buildBackgroundTag(row.textBackground) || 'Default';
          const animTags = this.buildAnimationTags(row.textAnimation, startMs, endMs);
          const startTimeStr = this.formatAssTime(startMs);
          const endTimeStr = this.formatAssTime(endMs);

          assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},${styleName},,0,0,0,,${animTags}${quoteText}\n`;
        }
      }
    }

    fs.writeFileSync(outputPath, assContent, 'utf-8');
    console.log(`[VideoService] ASS file written to: ${outputPath} (${assContent.split('Dialogue:').length - 1} dialogue lines)`);
  }

  /**
   * Assembles final output by combining visual, voiceover, music, and burning subtitles.
   */
  async assembleFinalOutput({
    videoPath,
    voiceoverPath,
    musicPath,
    assFilename,
    outputPath,
    duration,
    musicVolume = 0.15,
    musicStartTime = 0,
    musicSectionDuration = 0,
    videoAudioTracks = []  // [{ path, startMs }] — volume already baked in at extraction time
  }) {
    const escapedAssFilename = assFilename.replace(/\\/g, '/');
    const videoFilter = `subtitles='${escapedAssFilename}'`;
    const parsedMusicVol = parseFloat(musicVolume || 0.15);
    const hasExtraTracks = videoAudioTracks && videoAudioTracks.length > 0;

    // Build music input flags: seek to startTime, optionally limit section length
    const musicStartFlag = musicStartTime > 0 ? `-ss ${musicStartTime.toFixed(3)} ` : '';
    const buildMusicInput = (p) => `${musicStartFlag}-stream_loop -1 -i "${p}"`;
    // Music-only (no voiceover) scenario boosts volume since it's the sole audio source
    const musicVolForMix = (voiceoverPath || hasExtraTracks) ? parsedMusicVol : Math.min(parsedMusicVol * 3.5, 0.65);

    // No additional audio at all — just burn subtitles onto silent video
    if (!voiceoverPath && !musicPath && !hasExtraTracks) {
      const cmd = `ffmpeg -y -i "${videoPath}" -vf "${videoFilter}" -t ${duration} -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;
      await this.runCommand(cmd);
      return;
    }

    // Build inputs and filter_complex generically so any combination of
    // voiceover + music + per-clip original video audio can be mixed together.
    let inputsCmd = `-i "${videoPath}"`;
    let inputIndex = 1;
    const filterParts = [];
    const mixLabels = [];

    if (voiceoverPath) {
      inputsCmd += ` -i "${voiceoverPath}"`;
      filterParts.push(`[${inputIndex}:a]volume=1.0[vover]`);
      mixLabels.push('[vover]');
      inputIndex++;
    }
    if (musicPath) {
      inputsCmd += ` ${buildMusicInput(musicPath)}`;
      filterParts.push(`[${inputIndex}:a]volume=${musicVolForMix}[bgmusic]`);
      mixLabels.push('[bgmusic]');
      inputIndex++;
    }
    videoAudioTracks.forEach((track, i) => {
      inputsCmd += ` -i "${track.path}"`;
      const delayMs = Math.max(0, Math.round(track.startMs));
      filterParts.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs}[vtrack${i}]`);
      mixLabels.push(`[vtrack${i}]`);
      inputIndex++;
    });

    filterParts.push(`${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0[a]`);
    const filterComplex = filterParts.join('; ');

    const cmd = `ffmpeg -y ${inputsCmd} -filter_complex "${filterComplex}" ` +
          `-map 0:v -map "[a]" -vf "${videoFilter}" -t ${duration} -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k "${outputPath}"`;

    await this.runCommand(cmd);
  }
}
