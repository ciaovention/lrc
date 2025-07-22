// Simple loader for WaveSurfer.js
document.addEventListener('DOMContentLoaded', function() {
  // Script already loaded, do nothing
  if (window.WaveSurfer) return;
  
  console.log('Pre-loading WaveSurfer.js');
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/wavesurfer.js@6.6.3/dist/wavesurfer.min.js';
  document.head.appendChild(script);
});