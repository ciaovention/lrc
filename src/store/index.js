import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    lyrics: [],
    audioFile: null,
    currentTime: 0,
    duration: 0,
    playing: false,
    currentLyricIndex: -1
  },
  
  mutations: {
    SET_LYRICS(state, lyrics) {
      state.lyrics = lyrics;
    },
    
    ADD_LYRIC(state, { lyric, index }) {
      if (index !== undefined) {
        state.lyrics.splice(index, 0, lyric);
      } else {
        state.lyrics.push(lyric);
      }
    },
    
    UPDATE_LYRIC(state, { index, time, text }) {
      if (index >= 0 && index < state.lyrics.length) {
        if (time !== undefined) state.lyrics[index].time = time;
        if (text !== undefined) state.lyrics[index].text = text;
      }
    },
    
    REMOVE_LYRIC(state, index) {
      if (index >= 0 && index < state.lyrics.length) {
        state.lyrics.splice(index, 1);
      }
    },
    
    SORT_LYRICS(state) {
      state.lyrics.sort((a, b) => a.time - b.time);
    },
    
    SET_AUDIO_FILE(state, file) {
      state.audioFile = file;
    },
    
    SET_CURRENT_TIME(state, time) {
      state.currentTime = time;
    },
    
    SET_DURATION(state, duration) {
      state.duration = duration;
    },
    
    SET_PLAYING(state, playing) {
      state.playing = playing;
    },
    
    SET_CURRENT_LYRIC_INDEX(state, index) {
      state.currentLyricIndex = index;
    }
  },
  
  actions: {
    loadLrcFile({ commit }, content) {
      const lines = content.split('\n');
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\](.*)/;
      const lyrics = [];
      
      lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const hundredths = parseInt(match[3], 10);
          const text = match[4].trim();
          
          const time = minutes * 60 + seconds + hundredths / 100;
          
          lyrics.push({
            time,
            text
          });
        }
      });
      
      commit('SET_LYRICS', lyrics);
      commit('SORT_LYRICS');
    },
    
    updateCurrentLyric({ commit, state }) {
      let foundIndex = -1;
      
      for (let i = state.lyrics.length - 1; i >= 0; i--) {
        if (state.lyrics[i].time <= state.currentTime) {
          foundIndex = i;
          break;
        }
      }
      
      commit('SET_CURRENT_LYRIC_INDEX', foundIndex);
    },
    
    exportLrc({ state }) {
      let lrcContent = '';
      
      state.lyrics.forEach(lyric => {
        const minutes = Math.floor(lyric.time / 60);
        const seconds = Math.floor(lyric.time % 60);
        const hundredths = Math.floor((lyric.time % 1) * 100);
        
        lrcContent += `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]${lyric.text}\n`;
      });
      
      return lrcContent;
    }
  }
});