import { readJSON, writeJSON } from '../utils/io.js';
import { getAccount } from './account.js';
import { MiNA } from './mina.js';
import { MIoT } from './miot.js';
import { Debugger } from '../utils/debug.js';
import type { MiAccount, MiPass } from './typing.js';

interface Store {
  miot?: MiAccount;
  mina?: MiAccount;
}

const kConfigFile = '.mi.json';

export function updateMiAccount(account: MiAccount): (updated: MiAccount) => void {
  return (updated: MiAccount) => {
    if (updated.serviceToken) {
      account.serviceToken = updated.serviceToken;
    }
    if (updated.deviceId) {
      account.deviceId = updated.deviceId;
    }
    if (updated.pass?.ssecurity) {
      if (!account.pass) account.pass = { code: 0 } as MiPass;
      (account.pass as MiPass).ssecurity = updated.pass.ssecurity;
    }
    if (updated.pass?.nonce) {
      if (!account.pass) account.pass = { code: 0 } as MiPass;
      (account.pass as MiPass).nonce = updated.pass.nonce;
    }
    if (updated.pass?.passToken) {
      if (!account.pass) account.pass = { code: 0 } as MiPass;
      (account.pass as MiPass).passToken = updated.pass.passToken;
    }
  };
}

export async function getMiService(config: {
  service: 'miot' | 'mina';
  userId?: string;
  password?: string;
  passToken?: string;
  did?: string;
  relogin?: boolean;
}): Promise<MiNA | MIoT | undefined> {
  const { service, relogin, ...rest } = config;
  const overrides: any = relogin ? {} : rest;

  // 如果有 passToken，同时设置 pass 对象
  if (overrides.passToken) {
    overrides.pass = {
      ...overrides.pass,
      passToken: overrides.passToken,
    };
  }

  const store: Store = (await readJSON(kConfigFile)) ?? {};
  
  // 从缓存中获取 deviceId，如果没有则生成新的（16 位随机大写字母）
  let deviceId = store[service]?.deviceId;
  if (!deviceId) {
    deviceId = Array(16).fill(0).map(() => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
  }
  
  // 构建账户信息，优先使用传入的参数，其次使用缓存
  let account = {
    deviceId,
    ...store[service],
    ...overrides,
    sid: service === 'miot' ? 'xiaomiio' : 'micoapi',
  } as MiAccount;
  
  // 从缓存中补充 pass 信息（如果有）
  const cached = store[service];
  if (cached?.pass) {
    account.pass = {
      ...account.pass,
      ...cached.pass,
    };
  }
  
  // 检查是否有足够的凭证
  // passToken 是可选的辅助凭证，password 是必需的登录凭证
  const hasPassword = !!account.userId && !!account.password;
  
  if (!hasPassword) {
    console.error('❌ 缺少必需的登录凭证：需要 userId 和 password');
    console.log('💡 passToken 是可选的辅助凭证，不能完全替代密码');
    console.log('💡 配置示例：{ userId: "123", password: "xxx", passToken: "yyy" }');
    return;
  }

  const result = await getAccount(account);
  if (Debugger.debug) {
    console.log('💡 getAccount 结果：',{result:result});
  }
  if (!result?.serviceToken || !result.pass?.ssecurity) {
    return undefined;
  }
  store[service] = result;
  await writeJSON(kConfigFile, store);
  return service === 'miot' ? new MIoT(result as any) : new MiNA(result as any);
}
