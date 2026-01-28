const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const propsDir = path.join(__dirname, 'props');
if (!fs.existsSync(propsDir)) fs.mkdirSync(propsDir);

async function createBoxes() {
  const boxes = [
    { name: 'box-black-velvet', outer: { r: 30, g: 30, b: 35 }, inner: { r: 20, g: 20, b: 25 }, lid: { r: 40, g: 40, b: 45 } },
    { name: 'box-navy-velvet', outer: { r: 25, g: 35, b: 60 }, inner: { r: 15, g: 25, b: 50 }, lid: { r: 35, g: 45, b: 70 } },
    { name: 'box-burgundy', outer: { r: 80, g: 30, b: 40 }, inner: { r: 60, g: 20, b: 30 }, lid: { r: 100, g: 40, b: 50 } },
    { name: 'box-cream', outer: { r: 240, g: 235, b: 220 }, inner: { r: 250, g: 245, b: 235 }, lid: { r: 230, g: 225, b: 210 } },
    { name: 'box-white', outer: { r: 250, g: 250, b: 250 }, inner: { r: 255, g: 255, b: 255 }, lid: { r: 240, g: 240, b: 240 } },
    { name: 'box-brown-leather', outer: { r: 90, g: 60, b: 40 }, inner: { r: 180, g: 160, b: 140 }, lid: { r: 100, g: 70, b: 50 } },
  ];

  for (const box of boxes) {
    const width = 180, height = 140;
    const pixels = Buffer.alloc(width * height * 4);

    // Draw an open jewelry box from above (bird's eye view)
    const boxLeft = 20, boxRight = 160, boxTop = 50, boxBottom = 130;
    const innerPadding = 12;
    const lidTop = 5, lidBottom = 55, lidLeft = 25, lidRight = 155;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let color = null;
        let alpha = 0;

        // Lid (behind, at top)
        if (x >= lidLeft && x <= lidRight && y >= lidTop && y <= lidBottom) {
          color = box.lid;
          alpha = 255;
          // Add slight gradient for depth
          const lidGradient = 1 - (y - lidTop) / (lidBottom - lidTop) * 0.2;
          color = {
            r: Math.round(box.lid.r * lidGradient),
            g: Math.round(box.lid.g * lidGradient),
            b: Math.round(box.lid.b * lidGradient)
          };
        }

        // Box outer
        if (x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom) {
          color = box.outer;
          alpha = 255;
        }

        // Box inner (velvet lining)
        if (x >= boxLeft + innerPadding && x <= boxRight - innerPadding &&
            y >= boxTop + innerPadding && y <= boxBottom - innerPadding) {
          color = box.inner;
          alpha = 255;
          // Subtle texture
          const noise = (Math.random() - 0.5) * 8;
          color = {
            r: Math.max(0, Math.min(255, box.inner.r + noise)),
            g: Math.max(0, Math.min(255, box.inner.g + noise)),
            b: Math.max(0, Math.min(255, box.inner.b + noise))
          };
        }

        // Edge highlight on box
        if (x >= boxLeft && x <= boxLeft + 3 && y >= boxTop && y <= boxBottom) {
          color = { r: Math.min(255, box.outer.r + 30), g: Math.min(255, box.outer.g + 30), b: Math.min(255, box.outer.b + 30) };
        }

        if (color && alpha > 0) {
          pixels[idx] = color.r;
          pixels[idx + 1] = color.g;
          pixels[idx + 2] = color.b;
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
      .toFile(path.join(propsDir, `${box.name}.png`));
    console.log(`Created: ${box.name}.png`);
  }

  // Create ring slot inserts
  const slots = [
    { name: 'ring-slot-black', color: { r: 25, g: 25, b: 30 } },
    { name: 'ring-slot-cream', color: { r: 245, g: 240, b: 230 } },
  ];

  for (const slot of slots) {
    const width = 100, height = 60;
    const pixels = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Create a padded slot shape
        const slotWidth = 80;
        const slotHeight = 40;
        const cx = width / 2;
        const cy = height / 2;

        const inSlot = x >= (cx - slotWidth/2) && x <= (cx + slotWidth/2) &&
                       y >= (cy - slotHeight/2) && y <= (cy + slotHeight/2);

        if (inSlot) {
          // Add groove in middle
          const grooveDepth = Math.abs(x - cx) < 8 ? 0.7 : 1;
          pixels[idx] = Math.round(slot.color.r * grooveDepth);
          pixels[idx + 1] = Math.round(slot.color.g * grooveDepth);
          pixels[idx + 2] = Math.round(slot.color.b * grooveDepth);
          pixels[idx + 3] = 255;
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
      .toFile(path.join(propsDir, `${slot.name}.png`));
    console.log(`Created: ${slot.name}.png`);
  }

  console.log('\nDone! Jewelry boxes created.');
}

createBoxes().catch(console.error);
