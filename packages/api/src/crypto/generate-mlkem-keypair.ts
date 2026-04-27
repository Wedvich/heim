import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");
const pk = (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
const sk = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("base64");

console.log(`MLKEM_PUBLIC_KEY=${pk}`);
console.log(`MLKEM_SECRET_KEY=${sk}`);
