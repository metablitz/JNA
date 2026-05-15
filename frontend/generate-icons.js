// Run: node generate-icons.js
// Generates simple green pill PNG icons for PWA
const fs = require('fs');

function createPNG(size) {
  // Minimal PNG with green background + white pill emoji text
  // Using a pure-JS approach: write raw PNG bytes
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background: rounded rect green
  const radius = size * 0.2;
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.arcTo(size, 0, size, radius, radius);
  ctx.lineTo(size, size - radius);
  ctx.arcTo(size, size, size - radius, size, radius);
  ctx.lineTo(radius, size);
  ctx.arcTo(0, size, 0, size - radius, radius);
  ctx.lineTo(0, radius);
  ctx.arcTo(0, 0, radius, 0, radius);
  ctx.closePath();
  ctx.fill();

  // Text: JNA
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(size * 0.3)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JNA', size / 2, size * 0.42);

  ctx.font = `${Math.round(size * 0.14)}px Arial`;
  ctx.fillText('PHARMA', size / 2, size * 0.65);

  return canvas.toBuffer('image/png');
}

try {
  const buf192 = createPNG(192);
  const buf512 = createPNG(512);
  fs.writeFileSync('public/icon-192.png', buf192);
  fs.writeFileSync('public/icon-512.png', buf512);
  fs.writeFileSync('public/apple-touch-icon.png', createPNG(180));
  console.log('Icons generated: icon-192.png, icon-512.png, apple-touch-icon.png');
} catch (e) {
  console.log('canvas not available, creating SVG fallbacks...');
  const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size*0.2}" fill="#16a34a"/>
  <text x="${size/2}" y="${size*0.48}" font-size="${size*0.3}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" font-family="Arial" fill="white">JNA</text>
  <text x="${size/2}" y="${size*0.68}" font-size="${size*0.14}" text-anchor="middle" font-family="Arial" fill="white">PHARMA</text>
</svg>`;
  fs.writeFileSync('public/icon-192.svg', svg(192));
  fs.writeFileSync('public/icon-512.svg', svg(512));
  console.log('SVG icons created as fallback. For production, convert to PNG.');
}
