<template>
  <div id="app">
    <header>
      <h1>LRC Editor</h1>
      <div class="file-controls">
        <label for="lrc-file">LRC File: </label>
        <input type="file" id="lrc-file" accept=".lrc" @change="loadLrcFile">
        
        <label for="audio-file">Audio File: </label>
        <input type="file" id="audio-file" accept="audio/*" @change="loadAudioFile">
        
        <button @click="saveLrc" :disabled="!lyrics.length">Save LRC</button>
      </div>
    </header>
    
    <div class="editor-container">
      <div class="audio-player" v-if="audioSrc">
        <audio ref="audioPlayer" :src="audioSrc" controls @timeupdate="updateCurrentTime"></audio>
        <div class="audio-controls">
          <button @click="playAudio">Play</button>
          <button @click="pauseAudio">Pause</button>
          <div class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</div>
        </div>
        <div class="waveform-container" ref="waveformContainer"></div>
      </div>
      
      <div class="timeline-container">
        <div class="timeline-header">
          <div class="timeline-scale">
            <div v-for="i in timelineMarkers" :key="i" class="timeline-marker">
              {{ formatTime(i) }}
            </div>
          </div>
          <div class="zoom-controls">
            <button @click="zoomIn">Zoom In</button>
            <button @click="zoomOut">Zoom Out</button>
            <span>{{ Math.round(timelineDuration) }}s visible</span>
          </div>
        </div>
        
        <div class="timeline-content" ref="timelineContent">
          <div class="playhead" :style="{ left: playheadPosition + 'px' }"></div>
          
          <div 
            v-for="(lyric, index) in lyrics" 
            :key="index" 
            class="lyric-item"
            :class="{ 'active': currentLyricIndex === index }"
            :style="getLyricStyle(index)"
            @mousedown="startDrag($event, index)">
            <div class="lyric-time">{{ formatTime(lyric.time) }}</div>
            <div class="lyric-text">{{ lyric.text }}</div>
          </div>
        </div>
      </div>
      
      <div class="lyrics-editor">
        <div class="lyrics-list">
          <div 
            v-for="(lyric, index) in lyrics" 
            :key="index" 
            class="lyric-editor-item"
            :class="{ 'active': currentLyricIndex === index }"
            @click="selectLyric(index)">
            <div class="lyric-controls">
              <button @click.stop="setCurrentTime(lyric.time)">{{ formatTime(lyric.time) }}</button>
              <button @click.stop="captureLyricTime(index)">⏱️</button>
              <button @click.stop="removeLyric(index)">🗑️</button>
            </div>
            <input 
              type="text" 
              v-model="lyric.text" 
              @focus="selectLyric(index)"
              @keydown.enter="addNewLyric(index + 1)">
          </div>
        </div>
        
        <div class="editor-controls">
          <button @click="addNewLyric()">Add New Lyric</button>
          <button @click="sortLyrics">Sort by Time</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      lyrics: [],
      audioSrc: null,
      currentTime: 0,
      duration: 0,
      currentLyricIndex: -1,
      timelineWidth: 0,
      timelineDuration: 60, // Default 60 seconds visible in timeline
      isDragging: false,
      draggedLyricIndex: -1,
      dragStartX: 0,
      zoomLevel: 1,
      wavesurfer: null
    };
  },
  computed: {
    timelineMarkers() {
      // Generate timeline markers every 5 seconds
      const markers = [];
      for (let i = 0; i <= this.timelineDuration; i += 5) {
        markers.push(i);
      }
      return markers;
    },
    playheadPosition() {
      return (this.currentTime / this.timelineDuration) * this.timelineWidth;
    }
  },
  mounted() {
    this.updateTimelineWidth();
    window.addEventListener('resize', this.updateTimelineWidth);
    window.addEventListener('mousemove', this.onDrag);
    window.addEventListener('mouseup', this.stopDrag);
    
    // Set up Electron menu event listeners if in Electron environment
    if (window.electron) {
      window.electron.onMenuOpenLrc(() => {
        this.openLrcFileElectron();
      });
      
      window.electron.onMenuOpenAudio(() => {
        this.openAudioFileElectron();
      });
      
      window.electron.onMenuSaveLrc(() => {
        this.saveLrcElectron();
      });
      
      window.electron.onMenuPlayPause(() => {
        if (this.$refs.audioPlayer) {
          if (this.$refs.audioPlayer.paused) {
            this.playAudio();
          } else {
            this.pauseAudio();
          }
        }
      });
      
      window.electron.onMenuAddLyric(() => {
        this.addNewLyric();
      });
    }
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.updateTimelineWidth);
    window.removeEventListener('mousemove', this.onDrag);
    window.removeEventListener('mouseup', this.stopDrag);
    
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
    }
    
    // Clean up Electron event listeners
    if (window.electron) {
      window.electron.removeAllListeners('menu-open-lrc');
      window.electron.removeAllListeners('menu-open-audio');
      window.electron.removeAllListeners('menu-save-lrc');
      window.electron.removeAllListeners('menu-play-pause');
      window.electron.removeAllListeners('menu-add-lyric');
    }
  },
  methods: {
    updateTimelineWidth() {
      if (this.$refs.timelineContent) {
        this.timelineWidth = this.$refs.timelineContent.clientWidth;
      }
    },
    loadLrcFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        this.parseLrcContent(content);
      };
      reader.readAsText(file);
    },
    
    // Electron-specific method to open LRC file using native dialog
    async openLrcFileElectron() {
      if (!window.electron) return;
      
      try {
        const result = await window.electron.openLrcFile();
        if (result && result.content) {
          this.parseLrcContent(result.content);
        }
      } catch (error) {
        console.error('Error opening LRC file:', error);
      }
    },
    parseLrcContent(content) {
      // Reset lyrics array
      this.lyrics = [];
      
      // Parse LRC content
      const lines = content.split('\n');
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\](.*)/;
      
      lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const hundredths = parseInt(match[3], 10);
          const text = match[4].trim();
          
          const time = minutes * 60 + seconds + hundredths / 100;
          
          this.lyrics.push({
            time,
            text
          });
        }
      });
      
      // Sort lyrics by time
      this.sortLyrics();
    },
    loadAudioFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // Create object URL for the audio file
      this.audioSrc = URL.createObjectURL(file);
      
      // Once the audio is loaded, get its duration
      this.$nextTick(() => {
        const audio = this.$refs.audioPlayer;
        audio.onloadedmetadata = () => {
          this.duration = audio.duration;
          // Adjust timeline duration based on audio length
          this.timelineDuration = Math.min(120, Math.ceil(audio.duration / 30) * 30);
          
          // Initialize waveform
          this.initWaveform();
        };
      });
    },
    
    // Electron-specific method to open audio file using native dialog
    async openAudioFileElectron() {
      if (!window.electron) return;
      
      try {
        const result = await window.electron.openAudioFile();
        if (result && result.filePath) {
          // In Electron, we can use the file path directly
          this.audioSrc = 'file://' + result.filePath;
          
          // Once the audio is loaded, get its duration
          this.$nextTick(() => {
            const audio = this.$refs.audioPlayer;
            audio.onloadedmetadata = () => {
              this.duration = audio.duration;
              // Adjust timeline duration based on audio length
              this.timelineDuration = Math.min(120, Math.ceil(audio.duration / 30) * 30);
              
              // Initialize waveform
              this.initWaveform();
            };
          });
        }
      } catch (error) {
        console.error('Error opening audio file:', error);
      }
    },
    initWaveform() {
      // Ensure we have both the audio and container
      if (!this.audioSrc || !this.$refs.waveformContainer) return;
      
      // Load wavesurfer.js if needed
      if (!window.WaveSurfer) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/wavesurfer.js@6.6.3/dist/wavesurfer.min.js';
        script.onload = () => this.createWaveform();
        document.head.appendChild(script);
      } else {
        this.createWaveform();
      }
    },
    createWaveform() {
      // Clean up old instance if it exists
      if (this.wavesurfer) {
        this.wavesurfer.destroy();
      }
      
      // Create new WaveSurfer instance
      this.wavesurfer = WaveSurfer.create({
        container: this.$refs.waveformContainer,
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        cursorColor: '#ff0000',
        height: 80,
        barWidth: 2,
        barGap: 1,
        responsive: true
      });
      
      // Load the audio file
      this.wavesurfer.load(this.audioSrc);
      
      // Set up interaction between wavesurfer and audio player
      this.wavesurfer.on('ready', () => {
        console.log('Waveform ready');
        
        this.wavesurfer.on('click', (e) => {
          if (this.$refs.audioPlayer) {
            const clickPosition = this.wavesurfer.getCurrentTime();
            this.$refs.audioPlayer.currentTime = clickPosition;
          }
        });
      });
      
      this.wavesurfer.on('error', (e) => {
        console.error('Waveform error:', e);
      });
    },
    updateCurrentTime() {
      if (this.$refs.audioPlayer) {
        this.currentTime = this.$refs.audioPlayer.currentTime;
        this.updateCurrentLyric();
        
        // Update wavesurfer progress if it exists and is ready
        if (this.wavesurfer && this.wavesurfer.isReady) {
          this.wavesurfer.seekTo(this.currentTime / this.duration);
        }
      }
    },
    updateCurrentLyric() {
      // Find the current lyric based on the current time
      let found = false;
      for (let i = this.lyrics.length - 1; i >= 0; i--) {
        if (this.lyrics[i].time <= this.currentTime) {
          this.currentLyricIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        this.currentLyricIndex = -1;
      }
    },
    playAudio() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.play();
      }
    },
    pauseAudio() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.pause();
      }
    },
    formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const hundredths = Math.floor((seconds % 1) * 100);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
    },
    setCurrentTime(time) {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.currentTime = time;
        this.currentTime = time;
      }
    },
    selectLyric(index) {
      this.currentLyricIndex = index;
    },
    captureLyricTime(index) {
      if (index >= 0 && index < this.lyrics.length) {
        this.lyrics[index].time = this.currentTime;
        this.sortLyrics();
      }
    },
    addNewLyric(index) {
      const newLyric = {
        time: this.currentTime,
        text: ''
      };
      
      if (index !== undefined && index >= 0 && index <= this.lyrics.length) {
        this.lyrics.splice(index, 0, newLyric);
      } else {
        this.lyrics.push(newLyric);
      }
      
      this.sortLyrics();
      
      // Focus the new lyric input after Vue updates the DOM
      this.$nextTick(() => {
        const inputs = document.querySelectorAll('.lyric-editor-item input');
        const focusIndex = index !== undefined ? index : this.lyrics.length - 1;
        if (inputs[focusIndex]) {
          inputs[focusIndex].focus();
        }
      });
    },
    removeLyric(index) {
      if (index >= 0 && index < this.lyrics.length) {
        this.lyrics.splice(index, 1);
        if (this.currentLyricIndex === index) {
          this.currentLyricIndex = -1;
        } else if (this.currentLyricIndex > index) {
          this.currentLyricIndex--;
        }
      }
    },
    sortLyrics() {
      this.lyrics.sort((a, b) => a.time - b.time);
    },
    getLyricStyle(index) {
      const lyric = this.lyrics[index];
      const nextLyric = this.lyrics[index + 1];
      
      let startPosition = (lyric.time / this.timelineDuration) * this.timelineWidth;
      let width;
      
      if (nextLyric) {
        // Calculate width based on time difference to next lyric
        const endPosition = (nextLyric.time / this.timelineDuration) * this.timelineWidth;
        width = endPosition - startPosition;
        // Set minimum width for very short lyrics
        width = Math.max(width, 100);
      } else {
        // Last lyric - fixed width
        width = 150;
      }
      
      return {
        left: startPosition + 'px',
        width: width + 'px'
      };
    },
    startDrag(event, index) {
      this.isDragging = true;
      this.draggedLyricIndex = index;
      this.dragStartX = event.clientX;
      this.originalTime = this.lyrics[index].time;
    },
    onDrag(event) {
      if (!this.isDragging || this.draggedLyricIndex < 0) return;
      
      const deltaX = event.clientX - this.dragStartX;
      const timeDelta = (deltaX / this.timelineWidth) * this.timelineDuration;
      
      // Calculate new time and ensure it's within bounds
      let newTime = Math.max(0, this.originalTime + timeDelta);
      if (this.$refs.audioPlayer) {
        newTime = Math.min(newTime, this.$refs.audioPlayer.duration);
      }
      
      // Update the lyric time
      this.lyrics[this.draggedLyricIndex].time = newTime;
    },
    stopDrag() {
      if (this.isDragging) {
        this.isDragging = false;
        this.sortLyrics();
      }
    },
    zoomIn() {
      if (this.timelineDuration > 10) {  // Minimum 10 seconds view
        this.timelineDuration = this.timelineDuration * 0.8;
        this.zoomLevel = this.zoomLevel * 1.25;
      }
    },
    zoomOut() {
      if (this.timelineDuration < this.duration * 1.5) {  // Maximum 1.5x the audio duration
        this.timelineDuration = this.timelineDuration * 1.25;
        this.zoomLevel = this.zoomLevel * 0.8;
      }
    },
    saveLrc() {
      let lrcContent = '';
      
      // Generate LRC content
      this.lyrics.forEach(lyric => {
        const minutes = Math.floor(lyric.time / 60);
        const seconds = Math.floor(lyric.time % 60);
        const hundredths = Math.floor((lyric.time % 1) * 100);
        
        lrcContent += `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]${lyric.text}\n`;
      });
      
      // For web browser environment
      if (!window.electron) {
        // Create a blob and download link
        const blob = new Blob([lrcContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lyrics.lrc';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // For Electron environment, use the native save dialog
        this.saveLrcElectron(lrcContent);
      }
    },
    
    // Electron-specific method to save LRC file using native dialog
    async saveLrcElectron(content) {
      if (!window.electron) return;
      
      if (!content) {
        content = '';
        // Generate LRC content
        this.lyrics.forEach(lyric => {
          const minutes = Math.floor(lyric.time / 60);
          const seconds = Math.floor(lyric.time % 60);
          const hundredths = Math.floor((lyric.time % 1) * 100);
          
          content += `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]${lyric.text}\n`;
        });
      }
      
      try {
        const result = await window.electron.saveLrcFile(content);
        if (result && result.success) {
          console.log('LRC file saved successfully:', result.filePath);
        }
      } catch (error) {
        console.error('Error saving LRC file:', error);
      }
    }
  }
};
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Roboto', sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  background-color: #2c3e50;
  color: white;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  margin: 0;
  font-size: 24px;
}

.file-controls {
  display: flex;
  gap: 15px;
  align-items: center;
}

.file-controls label {
  margin-right: 5px;
}

.editor-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 15px;
}

.audio-player {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.audio-player audio {
  width: 100%;
}

.audio-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.time-display {
  margin-left: auto;
  font-family: monospace;
}

.waveform-container {
  height: 80px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-top: 10px;
  overflow: hidden;
}

.timeline-container {
  position: relative;
  border: 1px solid #ccc;
  background-color: #fff;
  margin-bottom: 20px;
  height: 150px;
  overflow: hidden;
}

.timeline-header {
  height: 30px;
  border-bottom: 1px solid #ddd;
  background-color: #f0f0f0;
  position: relative;
  padding: 5px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeline-scale {
  display: flex;
  position: relative;
  height: 100%;
}

.timeline-marker {
  position: absolute;
  font-size: 10px;
  color: #666;
  top: 5px;
  transform: translateX(-50%);
}

.zoom-controls {
  display: flex;
  align-items: center;
  padding-right: 10px;
  gap: 5px;
}

.zoom-controls span {
  font-size: 12px;
  color: #666;
  margin-left: 5px;
}

.timeline-content {
  position: relative;
  height: 120px;
  overflow-x: auto;
  overflow-y: hidden;
}

.playhead {
  position: absolute;
  top: 0;
  height: 100%;
  width: 2px;
  background-color: red;
  z-index: 10;
}

.lyric-item {
  position: absolute;
  top: 10px;
  padding: 5px 10px;
  background-color: #e1f5fe;
  border: 1px solid #b3e5fc;
  border-radius: 4px;
  cursor: move;
  z-index: 5;
  min-width: 100px;
  text-align: center;
  overflow: hidden;
}

.lyric-item.active {
  background-color: #4fc3f7;
  color: white;
}

.lyric-time {
  font-size: 10px;
  color: #555;
  margin-bottom: 2px;
}

.lyric-text {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.lyrics-editor {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #ccc;
  background-color: white;
}

.lyrics-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.lyric-editor-item {
  display: flex;
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.lyric-editor-item.active {
  background-color: #e3f2fd;
}

.lyric-controls {
  display: flex;
  gap: 5px;
  margin-right: 10px;
}

.lyric-editor-item input {
  flex: 1;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.editor-controls {
  padding: 10px;
  display: flex;
  gap: 10px;
  border-top: 1px solid #ddd;
}

button {
  padding: 5px 10px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #3aa776;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.lyric-controls button {
  padding: 2px 5px;
  font-size: 12px;
}
</style>