const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Determine the platform
const platform = os.platform();

console.log('=== LRC Editor Build Script ===');
console.log(`Detected platform: ${platform}`);

// Create a basic icon file if it doesn't exist
const iconDir = path.join(__dirname, 'build');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Create a very simple 1x1 pixel PNG file for the icon
// This is just to make electron-builder happy
const createSimplePng = () => {
  const iconPath = path.join(iconDir, 'icon.png');
  
  // If icon already exists, don't overwrite it
  if (fs.existsSync(iconPath)) {
    console.log('Icon file already exists, using existing file.');
    return;
  }
  
  // A minimal valid PNG file (1x1 transparent pixel)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  fs.writeFileSync(iconPath, pngData);
  console.log('Created a simple icon file for the build process.');
};

createSimplePng();

// First build the Vue app
console.log('Building Vue application...');
const vueBuilder = spawn('npm', ['run', 'build'], { stdio: 'inherit', shell: true });

vueBuilder.on('close', (code) => {
  if (code !== 0) {
    console.error(`Vue build failed with code ${code}`);
    process.exit(code);
  }
  
  console.log('Vue application built successfully.');
  console.log('Building Electron package...');
  
  // Now run electron-builder with simpler options
  let electronBuilderArgs = ['electron-builder'];
  
  if (platform === 'darwin') {
    console.log('Building for macOS...');
    electronBuilderArgs.push('--mac');
    // Only build for current architecture to simplify
    electronBuilderArgs.push(`--${os.arch()}`);
  } else if (platform === 'win32') {
    console.log('Building for Windows...');
    electronBuilderArgs.push('--win');
    electronBuilderArgs.push(`--${os.arch()}`);
  } else if (platform === 'linux') {
    console.log('Building for Linux...');
    electronBuilderArgs.push('--linux');
    electronBuilderArgs.push(`--${os.arch()}`);
  }
  
  const electronBuilder = spawn('npx', electronBuilderArgs, { stdio: 'inherit', shell: true });
  
  electronBuilder.on('close', (code) => {
    if (code !== 0) {
      console.error(`Electron build failed with code ${code}`);
      process.exit(code);
    }
    
    console.log('Electron application built successfully!');
    console.log('Your packaged application should be in the dist_electron directory.');
  });
});