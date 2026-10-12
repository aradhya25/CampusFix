const multer = require('multer');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10, fieldSize: 10 * 1024, parts: 11 },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Image must be a JPEG, PNG, or WebP file');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

function imageHasValidSignature(file) {
  if (!file?.buffer) return false;
  const bytes = file.buffer;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  const expected = { 'image/jpeg': isJpeg, 'image/png': isPng, 'image/webp': isWebp };
  return Boolean(expected[file.mimetype]);
}

function parseImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Image must be 5 MB or smaller' });
    }
    if (error instanceof multer.MulterError) return res.status(400).json({ message: error.message });
    return res.status(error.status || 400).json({ message: error.message });
  });
}

function validateImageSignature(req, res, next) {
  if (req.file && !imageHasValidSignature(req.file)) {
    return res.status(400).json({ message: 'The selected file content does not match a supported image type' });
  }
  return next();
}

module.exports = { MAX_IMAGE_BYTES, imageHasValidSignature, parseImage, validateImageSignature };
