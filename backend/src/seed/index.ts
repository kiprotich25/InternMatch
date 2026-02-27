import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedSampleInternships } from './sampleInternships';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/internship_match';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    await seedSampleInternships();
    // You can add more seeders here (companies, users, etc.)
    // eslint-disable-next-line no-console
    console.log('Seeding completed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Seeding failed', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();

