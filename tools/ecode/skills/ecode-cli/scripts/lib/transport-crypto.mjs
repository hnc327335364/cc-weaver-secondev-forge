import {
  constants,
  createCipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import { CliError, EXIT } from './errors.mjs';

const SM2 = Object.freeze({
  p: BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF'),
  a: BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC'),
  b: BigInt('0x28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93'),
  n: BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123'),
  gx: BigInt('0x32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7'),
  gy: BigInt('0xBC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0'),
});

const mod = (value, modulus = SM2.p) => ((value % modulus) + modulus) % modulus;

function inverse(value, modulus = SM2.p) {
  let a = mod(value, modulus);
  let b = modulus;
  let x0 = 1n;
  let x1 = 0n;
  while (b !== 0n) {
    const q = a / b;
    [a, b] = [b, a % b];
    [x0, x1] = [x1, x0 - q * x1];
  }
  if (a !== 1n) throw new CliError('ENCRYPTION_ERROR', 'Invalid elliptic-curve value', { exitCode: EXIT.ENCRYPTION });
  return mod(x0, modulus);
}

function pointAdd(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.x === right.x && mod(left.y + right.y) === 0n) return null;
  let slope;
  if (left.x === right.x && left.y === right.y) {
    slope = mod((3n * left.x * left.x + SM2.a) * inverse(2n * left.y));
  } else {
    slope = mod((right.y - left.y) * inverse(right.x - left.x));
  }
  const x = mod(slope * slope - left.x - right.x);
  const y = mod(slope * (left.x - x) - left.y);
  return { x, y };
}

function pointMultiply(point, scalar) {
  let result = null;
  let addend = point;
  let value = scalar;
  while (value > 0n) {
    if (value & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    value >>= 1n;
  }
  return result;
}

function fixed32(value) {
  return Buffer.from(value.toString(16).padStart(64, '0'), 'hex');
}

function hashSm3(...parts) {
  try {
    const hash = createHash('sm3');
    for (const part of parts) hash.update(part);
    return hash.digest();
  } catch {
    throw new CliError('ENCRYPTION_UNSUPPORTED', 'Node runtime does not provide SM3', { exitCode: EXIT.ENCRYPTION });
  }
}

function sm2Kdf(shared, length) {
  const blocks = [];
  let counter = 1;
  while (Buffer.concat(blocks).length < length) {
    const ct = Buffer.alloc(4);
    ct.writeUInt32BE(counter++);
    blocks.push(hashSm3(fixed32(shared.x), fixed32(shared.y), ct));
  }
  return Buffer.concat(blocks).subarray(0, length);
}

function parseSm2PublicKey(publicKey) {
  let hex = String(publicKey || '').replace(/\s+/g, '').replace(/^0x/i, '');
  if (hex.length > 128) hex = hex.slice(-128);
  if (!/^[0-9a-fA-F]{128}$/.test(hex)) {
    throw new CliError('ENCRYPTION_CONFIG_ERROR', 'Security response contains an invalid SM2 public key', { exitCode: EXIT.ENCRYPTION });
  }
  const point = { x: BigInt(`0x${hex.slice(0, 64)}`), y: BigInt(`0x${hex.slice(64)}`) };
  if (point.x >= SM2.p || point.y >= SM2.p || mod(point.y * point.y - (point.x ** 3n + SM2.a * point.x + SM2.b)) !== 0n) {
    throw new CliError('ENCRYPTION_CONFIG_ERROR', 'SM2 public key is not on expected curve', { exitCode: EXIT.ENCRYPTION });
  }
  return point;
}

function randomScalar() {
  let scalar = 0n;
  while (scalar === 0n) scalar = (BigInt(`0x${randomBytes(32).toString('hex')}`) % (SM2.n - 1n)) + 1n;
  return scalar;
}

export function sm2EncryptFrontend(value, publicKey, { scalar } = {}) {
  const target = parseSm2PublicKey(publicKey);
  const message = Buffer.from(Buffer.from(String(value), 'utf8').toString('base64'), 'utf8');
  const ephemeral = scalar === undefined ? randomScalar() : BigInt(scalar);
  if (ephemeral <= 0n || ephemeral >= SM2.n) {
    throw new CliError('ENCRYPTION_ERROR', 'SM2 test scalar is outside valid range', { exitCode: EXIT.ENCRYPTION });
  }
  const c1 = pointMultiply({ x: SM2.gx, y: SM2.gy }, ephemeral);
  const shared = pointMultiply(target, ephemeral);
  if (!c1 || !shared) throw new CliError('ENCRYPTION_ERROR', 'SM2 point multiplication failed', { exitCode: EXIT.ENCRYPTION });
  const mask = sm2Kdf(shared, message.length);
  if (mask.every((byte) => byte === 0)) return sm2EncryptFrontend(value, publicKey);
  const c2 = Buffer.alloc(message.length);
  for (let index = 0; index < message.length; index += 1) c2[index] = message[index] ^ mask[index];
  const c3 = hashSm3(fixed32(shared.x), message, fixed32(shared.y));
  return Buffer.concat([Buffer.from([4]), fixed32(c1.x), fixed32(c1.y), c3, c2]).toString('hex');
}

function asciiHex(value, suffix = '') {
  return `${Buffer.from(String(value), 'utf8').toString('hex')}0a${suffix}`;
}

function replaceWafTokens(value) {
  return value
    .replace(/\+/g, '_s-s_')
    .replace(/on/g, '_s-1_')
    .replace(/oN/g, '_s-2_')
    .replace(/On/g, '_s-3_')
    .replace(/ON/g, '_s-4_')
    .replace(/=/g, '_s-5_')
    .replace(/0X/g, '_s-6_')
    .replace(/0x/g, '_s-7_')
    .replace(/\//g, '_s-9_');
}

function ecbEncrypt(algorithm, content, key) {
  try {
    const cipher = createCipheriv(algorithm, Buffer.from(key, 'utf8'), null);
    cipher.setAutoPadding(true);
    return Buffer.concat([cipher.update(Buffer.from(content, 'utf8')), cipher.final()]).toString('base64');
  } catch (error) {
    throw new CliError('ENCRYPTION_UNSUPPORTED', `Node runtime cannot perform ${algorithm}`, {
      exitCode: EXIT.ENCRYPTION,
      details: { cause: error?.code || error?.name },
    });
  }
}

function normalizeRsaPublicKey(value) {
  const text = String(value || '').trim();
  if (!text) throw new CliError('ENCRYPTION_CONFIG_ERROR', 'Security response is missing RSA public key', { exitCode: EXIT.ENCRYPTION });
  if (/-----BEGIN [A-Z ]+-----/.test(text)) return text;
  const body = text.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') || '';
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

function createRsaPublicKey(value) {
  const text = String(value || '').trim();
  const attempts = [];
  if (/-----BEGIN [A-Z ]+-----/.test(text)) attempts.push(() => createPublicKey(text));
  const compact = text.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    const der = Buffer.from(compact, 'base64');
    attempts.push(() => createPublicKey({ key: der, format: 'der', type: 'spki' }));
    attempts.push(() => createPublicKey({ key: der, format: 'der', type: 'pkcs1' }));
  }
  attempts.push(() => createPublicKey(normalizeRsaPublicKey(text)));
  for (const attempt of attempts) {
    try { return attempt(); } catch { /* Try next supported representation. */ }
  }
  throw new CliError('ENCRYPTION_CONFIG_ERROR', 'Security response contains an invalid RSA public key', { exitCode: EXIT.ENCRYPTION });
}

export function encryptAesRsa(contents, info, { sessionKey = randomSessionKey() } = {}) {
  if (Buffer.byteLength(sessionKey, 'utf8') !== 16) {
    throw new CliError('ENCRYPTION_ERROR', 'Transport session key must be 16 bytes', { exitCode: EXIT.ENCRYPTION });
  }
  let encryptedKey;
  try {
    const key = createRsaPublicKey(info.rsa_pub);
    encryptedKey = publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(sessionKey, 'utf8')).toString('base64');
  } catch (error) {
    throw new CliError('ENCRYPTION_CONFIG_ERROR', 'RSA public key encryption failed', {
      exitCode: EXIT.ENCRYPTION,
      details: { cause: error?.code || error?.name },
    });
  }
  return {
    key: asciiHex(encryptedKey),
    encrypted: contents.map((content) => String(content) === '' ? '' : asciiHex(replaceWafTokens(ecbEncrypt('aes-128-ecb', String(content), sessionKey)), '_ec_')),
  };
}

export function encryptSm4Sm2(contents, info, { sessionKey = randomSessionKey(), scalar } = {}) {
  if (Buffer.byteLength(sessionKey, 'utf8') !== 16) {
    throw new CliError('ENCRYPTION_ERROR', 'Transport session key must be 16 bytes', { exitCode: EXIT.ENCRYPTION });
  }
  const encryptedKey = sm2EncryptFrontend(`${sessionKey}${info.sm2_code || ''}`, info.sm2_pub, { scalar });
  return {
    key: encryptedKey,
    encrypted: contents.map((content) => String(content) === '' ? '' : asciiHex(ecbEncrypt('sm4-ecb', String(content), sessionKey), '_ec_')),
  };
}

export function randomSessionKey() {
  return randomBytes(8).toString('hex');
}

export function prepareTransport(contents, securityInfo, options = {}) {
  if (typeof securityInfo?.status !== 'boolean') {
    throw new CliError('ENCRYPTION_CONFIG_ERROR', 'Security response is missing boolean status', { exitCode: EXIT.ENCRYPTION });
  }
  if (!securityInfo.status) return { key: '', encrypted: [...contents], mode: 'plain' };
  if (typeof securityInfo.cryptoAlg !== 'boolean') {
    throw new CliError('ENCRYPTION_CONFIG_ERROR', 'Security response is missing boolean cryptoAlg', { exitCode: EXIT.ENCRYPTION });
  }
  if (securityInfo.cryptoAlg) return { ...encryptSm4Sm2(contents, securityInfo, options), mode: 'sm4-sm2' };
  return { ...encryptAesRsa(contents, securityInfo, options), mode: 'aes-rsa' };
}
