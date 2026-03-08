import { jsonDecode } from './parse.js';
import * as pako from 'pako';
import { randomNoise, signNonce } from './hash.js';
import { createHmac } from 'crypto';
import { Debugger } from './debug.js';
import type { MiPass } from '../mi/typing.js';

/**
 * 解析登录响应中的认证参数
 * 参考 migpt-next 实现
 */
export function parseAuthPass(res: string): Partial<{
  code: number;
  description: string;
  captchaUrl: string;
  notificationUrl: string;
} & MiPass> {
  try {
    // 如果传入的是 HttpResponse 对象，提取 data 字段
    return (
      jsonDecode(
        res
          .replace('&&&START&&&', '') // 去除前缀
          .replace(/:(\d{9,})/g, ':"$1"'), // 把 userId 和 nonce 转成 string
      ) ?? {}
    );
  } catch {
    return {};
  }
}

export function encodeQuery(data: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(data)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value == null ? '' : value.toString())}`,
    )
    .join('&');
}

export function decodeQuery(str: string) {
  const data: any = {};
  if (!str) {
    return data;
  }
  const ss: any = str.split('&');
  for (let i = 0; i < ss.length; i++) {
    const s = ss[i].split('=');
    if (s.length != 2) {
      continue;
    }
    const k = decodeURIComponent(s[0]);
    let v: any = decodeURIComponent(s[1]);
    if (/^\[{/.test(v)) {
      try {
        v = jsonDecode(v);
      } catch {
        // ignore
      }
    }
    data[k] = v;
  }
  return data;
}

/**
 * URL 编码对象为 form 格式
 */
export function encodeFormData(data: Record<string, any>): string {
  return Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

interface MIoTRequest {
  data: string;
  signature: string;
  _nonce: string;
}

// RC4 实现（用于兼容旧版本和响应解密）
class RC4 {
  private i: number = 0;
  private j: number = 0;
  private S: Buffer;

  constructor(key: Buffer) {
    this.S = Buffer.alloc(256);
    for (let idx = 0; idx < 256; idx++) {
      this.S[idx] = idx;
    }
    let j = 0;
    for (let idx = 0; idx < 256; idx++) {
      j = (j + this.S[idx] + key[idx % key.length]) & 0xff;
      [this.S[idx], this.S[j]] = [this.S[j], this.S[idx]];
    }
  }

  update(data: Buffer): Buffer {
    const result = Buffer.alloc(data.length);
    for (let n = 0; n < data.length; n++) {
      this.i = (this.i + 1) & 0xff;
      this.j = (this.j + this.S[this.i]) & 0xff;
      [this.S[this.i], this.S[this.j]] = [this.S[this.j], this.S[this.i]];
      const K = this.S[(this.S[this.i] + this.S[this.j]) & 0xff];
      result[n] = data[n] ^ K;
    }
    return result;
  }
}

/**
 * MIoT 签名算法 - 参考 MiService Python 实现
 * 签名格式：uri&snonce&nonce&data=xxx
 * 使用 HMAC-SHA256
 * 注意：只签名，不加密数据！
 */
function signMIoT(uri: string, snonce: string, nonce: string, data: string): string {
  const msg = `${uri}&${snonce}&${nonce}&data=${data}`;
  const key = Buffer.from(snonce, 'base64');
  return createHmac('sha256', key).update(msg).digest('base64');
}

/**
 * MIoT 请求编码 - 参考 MiService sign_data
 * 只签名，不加密数据
 */
export function encodeMIoT(uri: string, data: any, ssecurity: string): MIoTRequest {
  const nonce = randomNoise();
  const snonce = signNonce(ssecurity, nonce) as string;
  // Python 的 json.dumps 默认格式：": " 和 ", "
  // JavaScript 的 JSON.stringify 默认紧凑格式，需要手动替换
  const json = JSON.stringify(data).replace(/:/g, ': ').replace(/,/g, ', ');

  // HMAC-SHA256 签名
  const signature = signMIoT(uri, snonce, nonce, json);

  if (Debugger.debug) {
    console.log('encodeMIoT 签名详情:', {
      uri,
      ssecurity: ssecurity.slice(0, 20) + '...',
      nonce,
      snonce,
      json,
      signature,
      signMsg: `${uri}&${snonce}&${nonce}&data=${json}`,
    });
  }

  return {
    _nonce: nonce,
    data: json,
    signature: signature,
  };
}

export function decodeMIoT(
  ssecurity: string,
  nonce: string,
  data: string,
  gzip?: boolean,
): Promise<any | undefined> {
  // 先尝试直接解析 JSON（MiService 响应是明文）
  try {
    const res = jsonDecode(data);
    if (res) {
      return Promise.resolve(res);
    }
  } catch {
    // ignore
  }
  
  // 如果直接解析失败，尝试 RC4 解密（兼容旧版本）
  let decrypted: Buffer;
  try {
    const key = Buffer.from(signNonce(ssecurity, nonce), 'base64');
    const rc4 = new RC4(key);
    rc4.update(Buffer.alloc(1024));
    decrypted = Buffer.from(rc4.update(Buffer.from(data, 'base64')));
    // 如果 RC4 解密成功，尝试 gzip 解压
    if (gzip) {
      try {
        decrypted = Buffer.from(pako.ungzip(decrypted));
      } catch (err) {
        // ignore gzip error
      }
    }
  } catch {
    // 如果不是 RC4 加密的数据，直接使用原始数据
    decrypted = Buffer.from(data, 'base64');
    // 如果需要 gzip 解压
    if (gzip) {
      try {
        decrypted = Buffer.from(pako.ungzip(decrypted));
      } catch (err) {
        // ignore gzip error
      }
    }
  }
  
  const res = jsonDecode(decrypted.toString());
  if (!res) {
    console.error('❌ decodeMIoT failed');
  }
  return Promise.resolve(res);
}
