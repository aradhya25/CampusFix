
const cloudinary = require('cloudinary').v2;
const https = require('node:https');
const { AsyncLocalStorage } = require('node:async_hooks');

// Cloudinary SDK 2.11.0 turns uncommon HTTP statuses such as 403 into a generic
// error without reading the response body. Capture only safe error fields for
// our own signed image upload requests so the SDK API itself stays unchanged.
const uploadContext = new AsyncLocalStorage();
const sdkHandledStatuses = new Set([200, 400, 401, 404, 420, 429, 500]);
const originalHttpsRequest = https.request;

function redactProviderMessage(message) {
  let safeMessage = message.replace(/[\r\n\0]/g, ' ').slice(0, 500);
  for (const secret of [process.env.CLOUDINARY_API_SECRET, process.env.CLOUDINARY_API_KEY]) {
    if (secret) safeMessage = safeMessage.split(secret).join('[redacted]');
  }
  return safeMessage.replace(/(api[_-]?key|api[_-]?secret|signature|token|authorization)(["'=:\s]+)[^&\s,"'}]+/gi, '$1$2[redacted]');
}

function safeProviderResponse(response, rawBody) {
  let body;
  try { body = JSON.parse(rawBody); } catch { body = null; }
  const providerError = body?.error || {};
  return {
    httpStatus: Number(response.statusCode) || null,
    errorCode: typeof (providerError.code ?? providerError.http_code) === 'string' || typeof (providerError.code ?? providerError.http_code) === 'number'
      ? (providerError.code ?? providerError.http_code)
      : null,
    message: typeof providerError.message === 'string'
      ? redactProviderMessage(providerError.message)
      : null,
  };
}

https.request = function captureCloudinaryUploadError(...args) {
  const options = args[0];
  const host = typeof options === 'string' ? new URL(options).hostname : options?.hostname || options?.host;
  const path = typeof options === 'string' ? new URL(options).pathname : options?.path || '';
  const context = uploadContext.getStore();
  const callbackIndex = args.findIndex((argument, index) => index > 0 && typeof argument === 'function');

  if (!context || !String(host || '').endsWith('cloudinary.com') || !path.includes('/image/upload') || callbackIndex < 0) {
    return originalHttpsRequest.apply(this, args);
  }

  const sdkCallback = args[callbackIndex];
  args[callbackIndex] = (response) => {
    if (sdkHandledStatuses.has(response.statusCode)) return sdkCallback(response);

    const chunks = [];
    let byteCount = 0;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      context.providerResponse = safeProviderResponse(response, Buffer.concat(chunks).toString('utf8'));
      sdkCallback(response);
    };
    response.on('data', (chunk) => {
      if (byteCount >= 16 * 1024) return;
      const remaining = 16 * 1024 - byteCount;
      const safeChunk = Buffer.from(chunk).subarray(0, remaining);
      chunks.push(safeChunk);
      byteCount += safeChunk.length;
    });
    response.once('end', finish);
    response.once('error', finish);
  };
  return originalHttpsRequest.apply(this, args);
};

function isConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function configure() {
  if (!isConfigured()) {
    throw new Error('Cloudinary environment variables are missing');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function uploadImage(buffer) {
  configure();

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Promise.reject(new Error('Image buffer is empty or invalid'));
  }

  const context = { providerResponse: null };
  return new Promise((resolve, reject) => {
    const stream = uploadContext.run(context, () => cloudinary.uploader.upload_stream(
      {
        folder: 'campusfix/issues',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          if (context.providerResponse) error.cloudinaryResponse = context.providerResponse;
          return reject(error);
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error('Cloudinary returned an incomplete image result'));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    ));

    stream.on('error', reject);
    uploadContext.run(context, () => stream.end(buffer));
  });
}

async function deleteImage(publicId) {
  configure();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });
}

module.exports = {
  cloudinary,
  isConfigured,
  uploadImage,
  deleteImage,
};
