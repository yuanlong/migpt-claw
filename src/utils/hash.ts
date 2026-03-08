import * as crypto from 'node:crypto';

/**
 * MD5 哈希
 */
export function md5(data: string | Buffer): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * SHA1 哈希
 */
export function sha1(data: string | Buffer): string {
  return crypto.createHash('sha1').update(data).digest('base64');
}

/**
 * SHA256 HMAC
 */
export function sha256(snonce: string, msg: string): string {
  return crypto.createHmac('sha256', Buffer.from(snonce, 'base64')).update(msg).digest('base64');
}

/**
 * 签名 nonce（用于 MIoT）
 * 参考 migpt-next 实现
 */
export function signNonce(ssecurity: string, nonce: string): string {
  const m = crypto.createHash('sha256');
  m.update(ssecurity, 'base64');
  m.update(nonce, 'base64');
  return m.digest().toString('base64');
}

/**
 * 生成 UUID
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * 生成随机字符串
 */
export function randomString(len: number): string {
  if (len < 1) return '';
  const s = Math.random().toString(36).slice(2);
  return s + randomString(len - s.length);
}

/**
 * 生成随机噪声（用于 MIoT nonce）
 * 参考 MiService Python 实现：urandom(8) + int(time.time() / 60).to_bytes(4, "big")
 */
export function randomNoise(): string {
  const randomBytes = crypto.randomBytes(8);
  const timeInMinutes = Math.floor(Date.now() / 1000 / 60);
  // 使用 Uint32BE 写入 4 字节时间戳（大端序）
  const timeBuffer = Buffer.alloc(4);
  timeBuffer.writeUInt32BE(timeInMinutes >>> 0, 0);
  return Buffer.concat([randomBytes, timeBuffer]).toString('base64');
}

/**
 * RC4 加密
 */
export function rc4Encrypt(key: Buffer, data: Buffer): Buffer {
  const ksa = (key: Buffer): number[] => {
    const S = new Array(256);
    for (let i = 0; i < 256; i++) {
      S[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % key.length]) & 0xff;
      [S[i], S[j]] = [S[j], S[i]];
    }
    return S;
  };

  const prga = (S: number[], data: Buffer): Buffer => {
    const result = Buffer.alloc(data.length);
    let i = 0;
    let j = 0;
    for (let n = 0; n < data.length; n++) {
      i = (i + 1) & 0xff;
      j = (j + S[i]) & 0xff;
      [S[i], S[j]] = [S[j], S[i]];
      const K = S[(S[i] + S[j]) & 0xff];
      result[n] = data[n] ^ K;
    }
    return result;
  };

  const S = ksa(key);
  return prga(S, data);
}

/**
 * RC4 解密（与加密相同）
 */
export function rc4Decrypt(key: Buffer, data: Buffer): Buffer {
  return rc4Encrypt(key, data);
}
