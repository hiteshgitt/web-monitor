// Prints a new RS256 private JWK for the OIDC_PRIVATE_JWK secret:
//   node scripts/genkey.mjs | npx wrangler secret put OIDC_PRIVATE_JWK
import { exportJWK, generateKeyPair } from 'jose';

const { privateKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
const jwk = await exportJWK(privateKey);
jwk.kid = `rl-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;
jwk.alg = 'RS256';
process.stdout.write(JSON.stringify(jwk));
