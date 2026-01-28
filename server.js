require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const sharp = require('sharp');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/generated', express.static('generated'));
app.use('/backgrounds', express.static('backgrounds'));
app.use('/props', express.static('props'));

// Ensure directories exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('generated')) fs.mkdirSync('generated');
if (!fs.existsSync('props')) fs.mkdirSync('props');
if (!fs.existsSync('backgrounds')) fs.mkdirSync('backgrounds');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Background removal using rembg (Python AI model)
async function removeBackground(inputPath) {
  const outputPath = inputPath.replace(/\.[^.]+$/, '-nobg.png');

  return new Promise((resolve, reject) => {
    // Use python3 on Linux, python on Windows
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const py = spawn(pythonCmd, [
      path.join(__dirname, 'remove_bg.py'),
      inputPath,
      outputPath
    ]);

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });

    py.on('close', (code) => {
      if (code === 0) {
        const buffer = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath); // cleanup temp file
        resolve(buffer);
      } else {
        reject(new Error(`rembg failed: ${stderr || stdout}`));
      }
    });

    py.on('error', (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/') ||
                    /\.(jpg|jpeg|png|webp|jfif|gif|bmp)$/i.test(file.originalname);
    cb(null, isImage);
  }
});

// Upload jewelry image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  res.json({
    filename: req.file.filename,
    path: '/uploads/' + req.file.filename
  });
});

// Remove background only - get cutout
app.post('/api/cutout', async (req, res) => {
  try {
    const { jewelryImage } = req.body;

    if (!jewelryImage) {
      return res.status(400).json({ error: 'Missing jewelry image' });
    }

    const imagePath = path.join(__dirname, 'uploads', path.basename(jewelryImage));
    if (!fs.existsSync(imagePath)) {
      return res.status(400).json({ error: 'Jewelry image not found' });
    }

    console.log('Removing background with rembg...');

    const removedBgBuffer = await removeBackground(imagePath);

    // Save the cutout
    const timestamp = Date.now();
    const cutoutFilename = `cutout-${timestamp}.png`;
    await sharp(removedBgBuffer).png().toFile(path.join(__dirname, 'generated', cutoutFilename));

    console.log('Cutout saved:', cutoutFilename);

    res.json({
      success: true,
      cutout: '/generated/' + cutoutFilename
    });

  } catch (error) {
    console.error('Cutout error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Upload a background image
const bgStorage = multer.diskStorage({
  destination: 'backgrounds/',
  filename: (req, file, cb) => {
    const name = file.originalname
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, name + ext);
  }
});
const bgUpload = multer({
  storage: bgStorage,
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  }
});

app.post('/api/upload-background', bgUpload.single('background'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: '/backgrounds/' + req.file.filename
  });
});

// Favorites storage
const favoritesFile = path.join(__dirname, 'favorites.json');
function loadFavorites() {
  if (fs.existsSync(favoritesFile)) {
    return JSON.parse(fs.readFileSync(favoritesFile, 'utf8'));
  }
  return { backgrounds: [], props: [] };
}
function saveFavorites(favs) {
  fs.writeFileSync(favoritesFile, JSON.stringify(favs, null, 2));
}

// List available backgrounds (favorites first)
app.get('/api/backgrounds', (req, res) => {
  const bgDir = path.join(__dirname, 'backgrounds');
  if (!fs.existsSync(bgDir)) {
    return res.json([]);
  }
  const favs = loadFavorites();
  const backgrounds = fs.readdirSync(bgDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map(f => ({
      name: f.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
      filename: f,
      path: '/backgrounds/' + f,
      favorite: favs.backgrounds.includes(f)
    }))
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  res.json(backgrounds);
});

// Delete background
app.delete('/api/backgrounds/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'backgrounds', path.basename(req.params.filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    // Remove from favorites if present
    const favs = loadFavorites();
    favs.backgrounds = favs.backgrounds.filter(f => f !== req.params.filename);
    saveFavorites(favs);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Toggle background favorite
app.post('/api/backgrounds/:filename/favorite', (req, res) => {
  const favs = loadFavorites();
  const filename = req.params.filename;
  if (favs.backgrounds.includes(filename)) {
    favs.backgrounds = favs.backgrounds.filter(f => f !== filename);
  } else {
    favs.backgrounds.push(filename);
  }
  saveFavorites(favs);
  res.json({ success: true, favorite: favs.backgrounds.includes(filename) });
});

// Upload a prop image
const propStorage = multer.diskStorage({
  destination: 'props/',
  filename: (req, file, cb) => {
    // Clean filename: lowercase, replace spaces with dashes
    const name = file.originalname
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    cb(null, name + '.png');
  }
});
const propUpload = multer({
  storage: propStorage,
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'image/png');
  }
});

app.post('/api/upload-prop', propUpload.single('prop'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PNG file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: '/props/' + req.file.filename
  });
});

// List available props (favorites first)
app.get('/api/props', (req, res) => {
  const propsDir = path.join(__dirname, 'props');
  if (!fs.existsSync(propsDir)) {
    return res.json([]);
  }
  const favs = loadFavorites();
  const props = fs.readdirSync(propsDir)
    .filter(f => /\.(png|webp)$/i.test(f))
    .map(f => ({
      name: f.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
      filename: f,
      path: '/props/' + f,
      favorite: favs.props.includes(f)
    }))
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  res.json(props);
});

// Delete prop
app.delete('/api/props/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'props', path.basename(req.params.filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    const favs = loadFavorites();
    favs.props = favs.props.filter(f => f !== req.params.filename);
    saveFavorites(favs);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Toggle prop favorite
app.post('/api/props/:filename/favorite', (req, res) => {
  const favs = loadFavorites();
  const filename = req.params.filename;
  if (favs.props.includes(filename)) {
    favs.props = favs.props.filter(f => f !== filename);
  } else {
    favs.props.push(filename);
  }
  saveFavorites(favs);
  res.json({ success: true, favorite: favs.props.includes(filename) });
});

// Generate styled image using background library
app.post('/api/generate', async (req, res) => {
  try {
    const { jewelryImage, background, props: selectedProps = [], composition = 'centered', compositionPrompt = '', jewelryPos = null, jewelryScale = 0.45, propPositions = {} } = req.body;

    if (!jewelryImage || !background) {
      return res.status(400).json({ error: 'Missing jewelry image or background' });
    }

    const imagePath = path.join(__dirname, 'uploads', path.basename(jewelryImage));
    if (!fs.existsSync(imagePath)) {
      return res.status(400).json({ error: 'Jewelry image not found' });
    }

    const bgPath = path.join(__dirname, 'backgrounds', path.basename(background));
    if (!fs.existsSync(bgPath)) {
      return res.status(400).json({ error: 'Background not found' });
    }

    console.log('Step 1: Removing background with rembg...');

    // Step 1: Remove background using rembg (local AI)
    const removedBgBuffer = await removeBackground(imagePath);
    console.log('Background removed');

    // Save the cutout for debugging/preview
    const cutoutPath = path.join(__dirname, 'generated', 'cutout-' + Date.now() + '.png');
    await sharp(removedBgBuffer).png().toFile(cutoutPath);
    console.log('Background removed, saved cutout');

    // Get jewelry dimensions
    const jewelryMeta = await sharp(removedBgBuffer).metadata();

    console.log('Step 2: Loading background from library...');

    // Step 2: Load background from library
    const bgBuffer = fs.readFileSync(bgPath);

    console.log(`Step 3: Compositing (mode: ${composition})...`);

    // Step 3: Composite jewelry onto background
    // First, check if we have a primary prop to size against
    let primaryPropLeft = null, primaryPropTop = null, primaryPropWidth = null, primaryPropHeight = null;

    const boxProps = selectedProps.filter(p => p.includes('box-'));
    let primaryProp = boxProps[0] || selectedProps[0];

    if ((composition === 'in-box' || composition === 'on-prop') && primaryProp) {
      const propPath = path.join(__dirname, 'props', path.basename(primaryProp));
      if (fs.existsSync(propPath)) {
        const propMeta = await sharp(propPath).metadata();
        // Scale prop to be larger for composition modes
        const propScale = composition === 'in-box' ? 3.0 : 2.5;
        primaryPropWidth = Math.round(propMeta.width * propScale);
        primaryPropHeight = Math.round(propMeta.height * propScale);
        primaryPropLeft = Math.round((1024 - primaryPropWidth) / 2);
        primaryPropTop = Math.round((1024 - primaryPropHeight) / 2);
      }
    }

    // Determine jewelry size - use scale from frontend if provided
    let targetSize;

    if (jewelryScale && jewelryScale > 0) {
      // Use scale from drag preview (scale is 0-1 representing % of 1024px frame)
      targetSize = Math.round(1024 * jewelryScale);
    } else if (composition === 'in-box' && primaryPropWidth) {
      targetSize = Math.round(Math.min(primaryPropWidth, primaryPropHeight) * 0.5);
    } else if (composition === 'on-prop' && primaryPropWidth) {
      targetSize = Math.round(Math.min(primaryPropWidth, primaryPropHeight) * 0.7);
    } else {
      targetSize = Math.min(600, jewelryMeta.width, jewelryMeta.height);
    }

    const resizedJewelry = await sharp(removedBgBuffer)
      .resize(targetSize, targetSize, { fit: 'inside' })
      .toBuffer();

    const resizedMeta = await sharp(resizedJewelry).metadata();

    // Calculate jewelry position
    let left, top;

    // If drag position provided, use it
    if (jewelryPos && jewelryPos.x !== undefined && jewelryPos.y !== undefined) {
      left = Math.round(jewelryPos.x * 1024 - resizedMeta.width / 2);
      top = Math.round(jewelryPos.y * 1024 - resizedMeta.height / 2);
    } else if (composition === 'in-box' && primaryPropLeft !== null) {
      // Place jewelry in center of the box prop
      left = primaryPropLeft + Math.round((primaryPropWidth - resizedMeta.width) / 2);
      top = primaryPropTop + Math.round((primaryPropHeight - resizedMeta.height) / 2) + 20;
    } else if (composition === 'on-prop' && primaryPropLeft !== null) {
      // Place jewelry centered on the prop (overlapping)
      left = primaryPropLeft + Math.round((primaryPropWidth - resizedMeta.width) / 2);
      top = primaryPropTop + Math.round((primaryPropHeight - resizedMeta.height) / 2);
    } else if (composition === 'custom') {
      // Use hints from prompt
      const prompt = compositionPrompt.toLowerCase();
      let baseX = 512, baseY = 512;
      if (prompt.includes('left')) baseX = 300;
      if (prompt.includes('right')) baseX = 724;
      if (prompt.includes('top')) baseY = 350;
      if (hintBottom) baseY = 674;
      left = Math.round(baseX - resizedMeta.width / 2);
      top = Math.round(baseY - resizedMeta.height / 2);
    } else {
      // Default: centered with slight random offset
      const offsetX = Math.round((Math.random() - 0.5) * 40);
      const offsetY = Math.round((Math.random() - 0.5) * 20);
      left = Math.round((1024 - resizedMeta.width) / 2) + offsetX;
      top = Math.round((1024 - resizedMeta.height) / 2) + offsetY;
    }

    // Create drop shadow for grounding effect
    // Make a darkened, blurred copy of the jewelry as shadow
    const shadow = await sharp(resizedJewelry)
      .grayscale()
      .linear(0, 0)  // Make fully black while preserving alpha
      .blur(20)
      .ensureAlpha()
      .png()
      .toBuffer();

    // Build composite layers
    const layers = [
      {
        input: shadow,
        left: left,
        top: top + 12,
        blend: 'over',
        opacity: 0.3
      }
    ];

    // Add props
    if (selectedProps && selectedProps.length > 0) {
      console.log(`Adding ${selectedProps.length} props...`);

      const jewelrySize = Math.max(resizedMeta.width, resizedMeta.height);

      // For in-box/on-prop mode, add primary prop centered and large
      if ((composition === 'in-box' || composition === 'on-prop') && primaryProp && primaryPropLeft !== null) {
        const propPath = path.join(__dirname, 'props', path.basename(primaryProp));
        if (fs.existsSync(propPath)) {
          const propBuffer = await sharp(propPath)
            .resize(primaryPropWidth, primaryPropHeight, { fit: 'inside' })
            .toBuffer();

          layers.push({
            input: propBuffer,
            left: primaryPropLeft,
            top: primaryPropTop
          });
        }
      }

      // Position remaining props around the composition
      const remainingProps = (composition === 'in-box' || composition === 'on-prop')
        ? selectedProps.filter(p => p !== primaryProp)
        : selectedProps;

      const basePropSize = jewelrySize * 0.3;

      const defaultPropPositions = [
        { x: 0.15, y: 0.2 },
        { x: 0.85, y: 0.2 },
        { x: 0.15, y: 0.8 },
        { x: 0.85, y: 0.8 },
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 }
      ];

      for (let i = 0; i < remainingProps.length; i++) {
        const propFilename = remainingProps[i];
        const propPath = path.join(__dirname, 'props', path.basename(propFilename));

        if (fs.existsSync(propPath)) {
          // Use dragged position if available, otherwise use default
          const dragPos = propPositions[propFilename];
          const pos = dragPos || defaultPropPositions[i % defaultPropPositions.length];

          const propX = pos.x * 1024;
          const propY = pos.y * 1024;

          // Scale prop
          const propSize = Math.round(basePropSize);

          const propBuffer = await sharp(propPath)
            .resize(propSize, propSize, { fit: 'inside' })
            .toBuffer();

          const propMeta = await sharp(propBuffer).metadata();

          const finalX = Math.round(propX - propMeta.width / 2);
          const finalY = Math.round(propY - propMeta.height / 2);

          if (finalX > -50 && finalX < 1024 && finalY > -50 && finalY < 1024) {
            layers.push({
              input: propBuffer,
              left: Math.max(0, finalX),
              top: Math.max(0, finalY)
            });
          }
        }
      }
    }

    // Add jewelry on top
    layers.push({
      input: resizedJewelry,
      left: left,
      top: top
    });

    // Composite all layers
    const composited = await sharp(bgBuffer)
      .resize(1024, 1024)
      .composite(layers)
      .toBuffer();

    console.log('Step 4: Creating Shopify-optimized versions...');

    // Step 4: Save optimized versions for Shopify
    const timestamp = Date.now();
    const results = {};

    // Main: 2048x2048 WebP
    const mainFilename = `product-${timestamp}.webp`;
    await sharp(composited)
      .resize(2048, 2048, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .webp({ quality: 90 })
      .toFile(path.join(__dirname, 'generated', mainFilename));
    results.main = '/generated/' + mainFilename;

    // Medium: 1024x1024 WebP
    const mediumFilename = `product-${timestamp}-medium.webp`;
    await sharp(composited)
      .resize(1024, 1024)
      .webp({ quality: 85 })
      .toFile(path.join(__dirname, 'generated', mediumFilename));
    results.medium = '/generated/' + mediumFilename;

    // Thumbnail: 480x480 WebP
    const thumbFilename = `product-${timestamp}-thumb.webp`;
    await sharp(composited)
      .resize(480, 480)
      .webp({ quality: 80 })
      .toFile(path.join(__dirname, 'generated', thumbFilename));
    results.thumbnail = '/generated/' + thumbFilename;

    // Original PNG
    const originalFilename = `product-${timestamp}-original.png`;
    await sharp(composited)
      .png({ compressionLevel: 9 })
      .toFile(path.join(__dirname, 'generated', originalFilename));
    results.original = '/generated/' + originalFilename;

    // Also save the cutout (jewelry with transparent bg)
    const cutoutFilename = `product-${timestamp}-cutout.png`;
    await sharp(removedBgBuffer)
      .png()
      .toFile(path.join(__dirname, 'generated', cutoutFilename));
    results.cutout = '/generated/' + cutoutFilename;

    console.log('Done! Images saved:', results);

    res.json({
      success: true,
      images: results,
      image: results.main
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear uploaded images
app.post('/api/clear', (req, res) => {
  const uploads = fs.readdirSync('uploads');
  uploads.forEach(f => {
    if (/\.(jpg|jpeg|png|webp|jfif|gif|bmp)$/i.test(f)) {
      fs.unlinkSync(path.join(__dirname, 'uploads', f));
    }
  });
  res.json({ success: true });
});

// List uploaded images
app.get('/api/images', (req, res) => {
  const uploads = fs.readdirSync('uploads')
    .filter(f => /\.(jpg|jpeg|png|webp|jfif|gif|bmp)$/i.test(f))
    .map(f => ({ filename: f, path: '/uploads/' + f }));
  res.json(uploads);
});

// List generated images
app.get('/api/generated', (req, res) => {
  const generated = fs.readdirSync('generated')
    .filter(f => /\.(jpg|jpeg|png|webp|jfif|gif|bmp)$/i.test(f))
    .map(f => ({ filename: f, path: '/generated/' + f }));
  res.json(generated);
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`JewelStudio running at http://localhost:${PORT}`);
});
