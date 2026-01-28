const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const bgDir = path.join(__dirname, 'backgrounds');
if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir);

async function createBackgrounds() {
  const backgrounds = [
    // Solid colors
    { name: 'white', color: { r: 255, g: 255, b: 255 } },
    { name: 'black', color: { r: 20, g: 20, b: 20 } },
    { name: 'cream', color: { r: 245, g: 240, b: 230 } },
    { name: 'blush', color: { r: 245, g: 220, b: 215 } },
    { name: 'sage', color: { r: 200, g: 210, b: 190 } },
    { name: 'navy', color: { r: 30, g: 40, b: 60 } },
    { name: 'charcoal', color: { r: 50, g: 50, b: 55 } },
    { name: 'taupe', color: { r: 180, g: 165, b: 150 } },
    { name: 'slate', color: { r: 100, g: 110, b: 120 } },
    { name: 'terracotta', color: { r: 180, g: 120, b: 100 } },
  ];

  for (const bg of backgrounds) {
    // Create base color
    const img = sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: bg.color
      }
    });

    await img.jpeg({ quality: 90 }).toFile(path.join(bgDir, `${bg.name}.jpg`));
    console.log(`Created: ${bg.name}.jpg`);
  }

  // Create gradient backgrounds
  const gradients = [
    { name: 'gradient-warm', top: { r: 255, g: 245, b: 235 }, bottom: { r: 240, g: 220, b: 200 } },
    { name: 'gradient-cool', top: { r: 240, g: 245, b: 250 }, bottom: { r: 200, g: 210, b: 225 } },
    { name: 'gradient-dark', top: { r: 60, g: 60, b: 65 }, bottom: { r: 30, g: 30, b: 35 } },
  ];

  for (const g of gradients) {
    // Create vertical gradient using raw pixel data
    const width = 1024, height = 1024;
    const pixels = Buffer.alloc(width * height * 3);

    for (let y = 0; y < height; y++) {
      const t = y / height;
      const r = Math.round(g.top.r + (g.bottom.r - g.top.r) * t);
      const gr = Math.round(g.top.g + (g.bottom.g - g.top.g) * t);
      const b = Math.round(g.top.b + (g.bottom.b - g.top.b) * t);

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        pixels[idx] = r;
        pixels[idx + 1] = gr;
        pixels[idx + 2] = b;
      }
    }

    await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 90 })
      .toFile(path.join(bgDir, `${g.name}.jpg`));
    console.log(`Created: ${g.name}.jpg`);
  }

  // Create textured backgrounds (noise overlay)
  const textured = [
    { name: 'marble-white', base: { r: 245, g: 243, b: 240 }, noise: 15 },
    { name: 'concrete-grey', base: { r: 160, g: 160, b: 158 }, noise: 20 },
    { name: 'paper-cream', base: { r: 250, g: 245, b: 235 }, noise: 8 },
  ];

  for (const t of textured) {
    const width = 1024, height = 1024;
    const pixels = Buffer.alloc(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      const noise = (Math.random() - 0.5) * t.noise * 2;
      pixels[i * 3] = Math.max(0, Math.min(255, t.base.r + noise));
      pixels[i * 3 + 1] = Math.max(0, Math.min(255, t.base.g + noise));
      pixels[i * 3 + 2] = Math.max(0, Math.min(255, t.base.b + noise));
    }

    await sharp(pixels, { raw: { width, height, channels: 3 } })
      .blur(1.5)
      .jpeg({ quality: 90 })
      .toFile(path.join(bgDir, `${t.name}.jpg`));
    console.log(`Created: ${t.name}.jpg`);
  }

  console.log('\nDone! Created backgrounds in:', bgDir);
}

createBackgrounds().catch(console.error);
