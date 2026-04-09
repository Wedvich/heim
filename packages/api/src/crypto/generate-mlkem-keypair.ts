/* oxlint-disable no-console */
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");

const pk = publicKey.export({ type: "spki", format: "der" });
const sk = privateKey.export({ type: "pkcs8", format: "der" });

console.log(`MEK_PUBLIC_KEY=${pk.toString("base64")}`);
console.log(`MEK_SECRET_KEY=${sk.toString("base64")}`);
