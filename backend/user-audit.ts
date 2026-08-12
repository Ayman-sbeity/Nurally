import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './src/config/db';
import { User } from './src/models/User';

async function main() {
  await connectDatabase();
  const users = await User.find().select('email phone role').lean();
  console.log(`\ntotal users: ${users.length}`);
  const noPhone = users.filter((u) => !u.phone);
  console.log(`without phone: ${noPhone.length}  ${noPhone.map((u) => u.email).join(', ')}`);

  const byPhone = new Map<string, number>();
  for (const u of users) {
    if (!u.phone) continue;
    const key = u.phone.replace(/[^\d+]/g, '');
    byPhone.set(key, (byPhone.get(key) ?? 0) + 1);
  }
  const dupes = [...byPhone.entries()].filter(([, n]) => n > 1);
  console.log(`duplicate phones: ${dupes.length}`);
  for (const [p, n] of dupes) console.log(`   ${p} x${n}`);

  console.log('\nindexes on users:');
  const idx = await mongoose.connection.collection('users').indexes();
  for (const i of idx) console.log(`   ${i.name}  key=${JSON.stringify(i.key)} unique=${i.unique ?? false} partial=${JSON.stringify(i.partialFilterExpression ?? null)}`);
  await disconnectDatabase();
  await mongoose.connection.close();
}
main().catch(async (e) => { console.error(e); await mongoose.connection.close(); process.exit(1); });
