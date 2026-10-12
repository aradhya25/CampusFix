const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Issue = require('../src/models/Issue');
const User = require('../src/models/User');
const imageStorage = require('../src/services/cloudinary');

const previousJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'image-upload-tests-only-secret';

test('authenticated issue creation validates images and stores a mocked Cloudinary result', async (t) => {
  const originals = {
    findById: User.findById,
    create: Issue.create,
    isConfigured: imageStorage.isConfigured,
    uploadImage: imageStorage.uploadImage,
    deleteImage: imageStorage.deleteImage,
    consoleError: console.error,
  };
  const observed = { creates: [], uploads: 0, deletions: [] };
  User.findById = (id) => ({ select: async () => ({ _id: id, id, name: 'Test Student', role: 'student' }) });
  imageStorage.isConfigured = () => true;
  imageStorage.uploadImage = async () => {
    observed.uploads += 1;
    return { url: 'https://res.cloudinary.com/test/image/upload/sample.png', publicId: 'campusfix/issues/sample', format: 'png', bytes: 8 };
  };
  imageStorage.deleteImage = async (publicId) => { observed.deletions.push(publicId); };
  console.error = () => {};
  Issue.create = async (issue) => {
    observed.creates.push(issue);
    return { _id: '507f1f77bcf86cd799439011', createdAt: new Date(), ...issue };
  };

  t.after(() => {
    User.findById = originals.findById;
    Issue.create = originals.create;
    imageStorage.isConfigured = originals.isConfigured;
    imageStorage.uploadImage = originals.uploadImage;
    imageStorage.deleteImage = originals.deleteImage;
    console.error = originals.consoleError;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/issues`;
  const token = jwt.sign({ sub: 'student1' }, process.env.JWT_SECRET);
  const fields = { title: 'Broken window', description: 'The window in the room is broken.', category: 'facilities', location: 'Room 12', priority: 'high' };
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = (bytes, type = 'image/png') => {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append('image', new Blob([bytes], { type }), 'issue.png');
    return body;
  };
  const post = (body, authenticated = true) => fetch(endpoint, {
    method: 'POST',
    headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
    body,
  });

  assert.equal((await post(form(pngBytes), false)).status, 401, 'unauthenticated uploads are rejected');
  assert.equal((await post(form(Buffer.from('not an image'), 'text/plain'))).status, 400, 'unsupported MIME types are rejected');
  assert.equal((await post(form(Buffer.from('not a png')))).status, 400, 'spoofed image MIME types are rejected by signature');
  const oversized = await post(form(Buffer.alloc(5 * 1024 * 1024 + 1)));
  assert.equal(oversized.status, 413, 'images over 5 MB are rejected');
  assert.equal(observed.uploads, 0);
  assert.equal(observed.creates.length, 0);

  const success = await post(form(pngBytes));
  assert.equal(success.status, 201);
  const response = await success.json();
  assert.equal(response.issue.image.url, 'https://res.cloudinary.com/test/image/upload/sample.png');
  assert.equal(response.issue.image.mimeType, 'image/png');
  assert.equal(observed.creates[0].priority, 'high');
  assert.equal(observed.uploads, 1);

  imageStorage.uploadImage = async () => {
    const error = new Error('Server returned unexpected status code - 403');
    error.http_code = 403;
    error.cloudinaryResponse = {
      httpStatus: 403,
      errorCode: null,
      message: 'Request forbidden due to missing permissions (actions=["create"])',
    };
    throw error;
  };
  const failedUpload = await post(form(pngBytes));
  assert.equal(failedUpload.status, 502);
  const failedUploadBody = await failedUpload.json();
  assert.match(failedUploadBody.message, /Cloudinary denied the upload/);
  assert.match(failedUploadBody.message, /API key can create uploads/);
  assert.match(failedUploadBody.message, /no issue was created/i);
  assert.deepEqual(failedUploadBody.providerError, {
    httpStatus: 403,
    errorCode: null,
    message: 'Request forbidden due to missing permissions (actions=["create"])',
  });
  assert.equal(observed.creates.length, 1);

  imageStorage.isConfigured = () => false;
  assert.equal((await post(form(pngBytes))).status, 503, 'missing provider configuration is reported safely');
  assert.equal(observed.creates.length, 1);

  imageStorage.isConfigured = () => true;
  imageStorage.uploadImage = async () => ({ url: 'https://res.cloudinary.com/test/orphan.png', publicId: 'orphan', format: 'png', bytes: 8 });
  Issue.create = async () => { throw new Error('database write failed'); };
  const failedSave = await post(form(pngBytes));
  assert.equal(failedSave.status, 500);
  assert.deepEqual(observed.deletions, ['orphan']);
});
