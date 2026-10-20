/* Deletes the local demo database and recreates it with the demo fixture.
 * Stop the dev server first, or restart it afterwards. */
import fs from "node:fs";
import { dbPath, openDatabase } from "../src/lib/db";
import { getMerchantSummary } from "../src/lib/domain/merchants";

const file = dbPath();
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
const db = openDatabase(file);
const { account, tier } = getMerchantSummary(db, "mer_coastal");
console.log(`Demo database recreated at ${file}`);
console.log(
  `Coastal Kitchen & Co.: ${account.available} available, ${account.pending} pending, ${account.lifetimeEarned} lifetime, ${account.redeemed} redeemed (${tier.current.name})`,
);
db.close();
