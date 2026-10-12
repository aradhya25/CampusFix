require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function createStaff() {
  const { MONGODB_URI, STAFF_NAME, STAFF_EMAIL, STAFF_PASSWORD } = process.env;
  if (!MONGODB_URI || !STAFF_NAME || !STAFF_EMAIL || !STAFF_PASSWORD) {
    throw new Error('Set MONGODB_URI, STAFF_NAME, STAFF_EMAIL, and STAFF_PASSWORD before running this command');
  }
  if (STAFF_PASSWORD.length < 12) throw new Error('STAFF_PASSWORD must be at least 12 characters');

  await mongoose.connect(MONGODB_URI);
  const email = STAFF_EMAIL.trim().toLowerCase();
  if (await User.exists({ email })) throw new Error('That email already belongs to an account; no changes were made');
  const user = await User.create({ name: STAFF_NAME.trim(), email, password: STAFF_PASSWORD, role: 'staff' });
  console.log(`Created staff account: ${user.email}`);
}

createStaff()
  .catch((error) => {
    console.error(`Staff setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
