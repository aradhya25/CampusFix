const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ quiet: true });
const { cloudinary, uploadImage } = require('../src/services/cloudinary');

test('Cloudinary v2 upload stream receives options before its callback', async () => {
  const originalUploadStream = cloudinary.uploader.upload_stream;
  const originalConfig = { ...cloudinary.config() };
  const envNames = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const testValues = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: '123456789012345',
    CLOUDINARY_API_SECRET: 'test-api-secret-for-unit-test',
  };
  Object.assign(process.env, testValues);
  let received;
  cloudinary.uploader.upload_stream = (options, callback) => {
    received = { callback, options };
    return {
      on() { return this; },
      end(buffer) {
        received.buffer = buffer;
        callback(null, {
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/test.png',
          public_id: 'campusfix/issues/test',
          format: 'png',
          bytes: buffer.length,
        });
      },
    };
  };

  try {
    const bytes = Buffer.from('test image data');
    const result = await uploadImage(bytes);
    assert.equal(typeof received.callback, 'function');
    assert.deepEqual(received.options, { folder: 'campusfix/issues', resource_type: 'image' });
    assert.equal(received.buffer, bytes);
    assert.deepEqual(result, {
      url: 'https://res.cloudinary.com/test-cloud/image/upload/test.png',
      publicId: 'campusfix/issues/test',
      format: 'png',
      bytes: bytes.length,
    });
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
    cloudinary.config(originalConfig);
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
});
