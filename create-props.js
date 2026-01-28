const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const propsDir = path.join(__dirname, 'props');
if (!fs.existsSync(propsDir)) fs.mkdirSync(propsDir);

async function createProps() {
  // Create simple placeholder props (circles, leaves shapes)
  // Users should replace these with real prop images

  const props = [
    { name: 'pearl-white', color: { r: 250, g: 248, b: 245 }, size: 60 },
    { name: 'pearl-cream', color: { r: 245, g: 235, b: 220 }, size: 50 },
    { name: 'pearl-pink', color: { r: 250, g: 220, b: 225 }, size: 55 },
    { name: 'pearl-gold', color: { r: 220, g: 190, b: 140 }, size: 45 },
    { name: 'bead-black', color: { r: 30, g: 30, b: 35 }, size: 40 },
    { name: 'bead-silver', color: { r: 180, g: 185, b: 190 }, size: 35 },
  ];

  for (const prop of props) {
    const size = prop.size;
    const padding = 10;
    const totalSize = size + padding * 2;

    // Create a circular pearl/bead with gradient-like shading
    const pixels = Buffer.alloc(totalSize * totalSize * 4);
    const cx = totalSize / 2;
    const cy = totalSize / 2;
    const radius = size / 2;

    for (let y = 0; y < totalSize; y++) {
      for (let x = 0; x < totalSize; x++) {
        const idx = (y * totalSize + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          // Inside the circle - create a pearl-like gradient
          const normalDist = dist / radius;
          // Highlight in top-left
          const highlightX = -0.3, highlightY = -0.3;
          const highlightDist = Math.sqrt((dx/radius - highlightX) ** 2 + (dy/radius - highlightY) ** 2);
          const highlight = Math.max(0, 1 - highlightDist) * 0.4;

          const brightness = 1 - normalDist * 0.3 + highlight;

          pixels[idx] = Math.min(255, Math.round(prop.color.r * brightness));
          pixels[idx + 1] = Math.min(255, Math.round(prop.color.g * brightness));
          pixels[idx + 2] = Math.min(255, Math.round(prop.color.b * brightness));

          // Soft edge
          const edgeDist = radius - dist;
          const alpha = edgeDist < 2 ? Math.round((edgeDist / 2) * 255) : 255;
          pixels[idx + 3] = alpha;
        } else {
          // Outside - transparent
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 0;
        }
      }
    }

    await sharp(pixels, { raw: { width: totalSize, height: totalSize, channels: 4 } })
      .png()
      .toFile(path.join(propsDir, `${prop.name}.png`));
    console.log(`Created: ${prop.name}.png`);
  }

  // Create some leaf-like shapes
  const leaves = [
    { name: 'leaf-green', color: { r: 80, g: 120, b: 70 } },
    { name: 'leaf-sage', color: { r: 140, g: 160, b: 130 } },
    { name: 'leaf-eucalyptus', color: { r: 120, g: 150, b: 140 } },
  ];

  for (const leaf of leaves) {
    const width = 80, height = 120;
    const pixels = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Leaf shape: ellipse that tapers at ends
        const cx = width / 2;
        const cy = height / 2;
        const normalY = (y - cy) / (height / 2);
        const leafWidth = (1 - normalY * normalY) * (width / 2) * 0.8;
        const dx = Math.abs(x - cx);

        if (dx < leafWidth && y > 5 && y < height - 5) {
          const edgeDist = leafWidth - dx;
          const alpha = edgeDist < 3 ? Math.round((edgeDist / 3) * 255) : 255;

          // Add some color variation
          const variation = (Math.sin(y * 0.1) * 10);
          pixels[idx] = Math.min(255, Math.max(0, leaf.color.r + variation));
          pixels[idx + 1] = Math.min(255, Math.max(0, leaf.color.g + variation));
          pixels[idx + 2] = Math.min(255, Math.max(0, leaf.color.b + variation));
          pixels[idx + 3] = alpha;
        } else {
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 0;
        }
      }
    }

    await sharp(pixels, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(path.join(propsDir, `${leaf.name}.png`));
    console.log(`Created: ${leaf.name}.png`);
  }

  // Create petal shapes
  const petals = [
    { name: 'petal-pink', color: { r: 250, g: 200, b: 210 } },
    { name: 'petal-white', color: { r: 255, g: 250, b: 250 } },
    { name: 'petal-red', color: { r: 180, g: 60, b: 80 } },
  ];

  for (const petal of petals) {
    const width = 70, height = 90;
    const pixels = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Petal: rounded at top, tapers to point at bottom
        const cx = width / 2;
        const normalY = y / height;
        const petalWidth = Math.sin(normalY * Math.PI) * (width / 2) * 0.9;
        const dx = Math.abs(x - cx);

        if (dx < petalWidth) {
          const edgeDist = petalWidth - dx;
          const alpha = edgeDist < 4 ? Math.round((edgeDist / 4) * 255) : 255;

          // Gradient from center
          const centerDist = dx / (petalWidth || 1);
          const brightness = 1 - centerDist * 0.15;

          pixels[idx] = Math.min(255, Math.round(petal.color.r * brightness));
          pixels[idx + 1] = Math.min(255, Math.round(petal.color.g * brightness));
          pixels[idx + 2] = Math.min(255, Math.round(petal.color.b * brightness));
          pixels[idx + 3] = alpha;
        } else {
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 0;
        }
      }
    }

    await sharp(pixels, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(path.join(propsDir, `${petal.name}.png`));
    console.log(`Created: ${petal.name}.png`);
  }

  console.log('\nDone! Props created in:', propsDir);
  console.log('\nTip: Replace these placeholders with real prop images (PNG with transparent background)');
}

createProps().catch(console.error);
