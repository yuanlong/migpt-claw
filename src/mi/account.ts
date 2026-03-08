import { encodeQuery, parseAuthPass } from '../utils/codec.js';
import { md5, sha1 } from '../utils/hash.js';
import { Http } from '../utils/http.js';
import { MiNA } from './mina.js';
import { MIoT } from './miot.js';
import type { MiAccount } from './typing.js';

const kLoginAPI = 'https://account.xiaomi.com/pass';

export async function getAccount(_account: MiAccount): Promise<MiAccount | undefined> {
  let account = _account;
  
  // 打印使用的认证方式
  console.log('🔐 认证信息:', {
    userId: account.userId,
    hasPassToken: !!account.passToken,
    hasPassword: !!account.password,
    hasServiceToken: !!account.serviceToken,
    authMode: account.password ? 'password' : (account.passToken ? 'passToken' : 'unknown'),
  });
  
  // 如果已经提供了 passToken 和 serviceToken，尝试直接使用缓存的登录态
  if (account.passToken && account.serviceToken && account.pass?.ssecurity) {
    console.log('🔄 尝试使用缓存的登录态 (passToken + serviceToken + ssecurity)...');
    account.pass = {
      code: 0,
      passToken: account.passToken,
      ssecurity: account.pass.ssecurity,
      nonce: account.pass.nonce || '',
    };
    // 尝试直接获取设备列表，如果失败再重新登录
    // 根据 sid 选择调用对应的服务
    let devices: any;
    if (account.sid === 'micoapi') {
      devices = await MiNA.getDevice(account as any);
    } else if (account.sid === 'xiaomiio') {
      devices = await MIoT.getDevice(account as any);
    } else {
      devices = account;
    }
    if (devices.device) {
      console.log('✅ 使用缓存的登录态成功');
      return devices;
    }
    // 缓存失效，继续登录流程
    console.log('⚠️ 缓存的登录态已失效，使用密码重新登录...');
  }
  
  // 优先使用密码登录（如果有密码）
  if (account.password) {
    console.log('🔑 使用密码登录（passToken 作为 Cookie 辅助）...');
  } else if (account.passToken) {
    console.log('⚠️ 仅有 passToken 无法直接登录，passToken 需要配合密码使用');
  }
  
  let res = await Http.get(
    `${kLoginAPI}/serviceLogin`,
    { sid: account.sid, _json: true, _locale: 'zh_CN' },
    { cookies: _getLoginCookies(account) },
  );
  if (res.isError) {
    console.error('❌ 登录失败', res);
    return undefined;
  }
  let pass = parseAuthPass(res);
  console.log('📝 serviceLogin 响应:', { code: pass.code, description: pass.description,res: res });
  
  if (pass.code !== 0) {
    // 登录态失效，重新登录
    console.log('📝 登录态失效，尝试重新认证...');
    
    if (!account.password) {
      console.error('❌ 缺少密码，无法重新登录。请配置 password 字段。');
      return undefined;
    }
    
    const data = {
      _json: 'true',
      qs: pass.qs,
      sid: account.sid,
      _sign: pass._sign,
      callback: pass.callback,
      user: account.userId,
      hash: md5(account.password).toUpperCase(),
    };
    res = await Http.post(`${kLoginAPI}/serviceLoginAuth2`, encodeQuery(data), {
      cookies: _getLoginCookies(account),
    });
    if (res.isError) {
      console.error('❌ OAuth2 登录失败', res);
      return undefined;
    }
    console.log('返回结果：', res.data);
    pass = parseAuthPass(res);
    console.log('📝 serviceLoginAuth2 响应:', {
      code: pass.code,
      hasPassToken: !!pass.passToken,
      hasSsecurity: !!pass.ssecurity,
      description: pass.description,
    });
  }
  if (pass.location?.includes('identity/authStart')) {
    console.error('❌ 本次登录需要验证码，请检查 passToken 是否正确');
    console.log('💡 当前使用的 passToken:', account.passToken?.slice(0, 20) + '...');
    return undefined;
  }
  if (!pass.location || !pass.nonce || !pass.ssecurity) {
    console.error('❌ 登录失败，请检查你的账号密码是否正确');
    console.log('📋 返回数据:', {
      hasLocation: !!pass.location,
      hasNonce: !!pass.nonce,
      hasSsecurity: !!pass.ssecurity,
      hasPassToken: !!pass.passToken,
      code: pass.code,
      description: pass.description,
    });
    return undefined;
  }
  console.log('✅ 登录成功，获取 serviceToken...');
  // 刷新登录态
  const serviceToken = await _getServiceToken(pass);
  if (!serviceToken) {
    return undefined;
  }
  console.log('✅ 获取 serviceToken 成功',{account:account,serviceToken:serviceToken});
  account = { ...account, pass: pass as any, serviceToken };
  console.log('📱 正在获取设备信息... account.did =', account.did);
  console.log('📱 使用的 deviceId:', account.deviceId);
  
  // 根据 sid 选择调用对应的服务
  if (account.sid === 'micoapi') {
    account = await MiNA.getDevice(account as any);
    console.log('📱 MiNA.getDevice 结果：account.device =', account?.device);
  } else if (account.sid === 'xiaomiio') {
    account = await MIoT.getDevice(account as any);
    console.log('📱 MIoT.getDevice 结果：account.device =', account?.device);
  }
  
  if (account.did && !account.device) {
    console.error(`❌ 找不到设备：${account.did}`);
    console.log(
      '🐛 请检查你的 did 与米家中的设备名称是否一致。注意错别字、空格和大小写，比如：音响 👉 音箱',
    );
    console.log(
      '💡 建议打开 debug 选项，查看目标设备的真实 name、miotDID 或 mac 地址，更新 did 参数',
    );
    return undefined;
  }
  console.log('✅ 设备信息获取成功:', (account.device as any)?.name || (account.device as any)?.alias);
  return account;
}

function _getLoginCookies(account: MiAccount): Record<string, string | undefined> {
  return {
    userId: account.userId,
    deviceId: account.deviceId,
    passToken: account.pass?.passToken,
    sdkVersion: '3.9',
  };
}

async function _getServiceToken(pass: any): Promise<string | undefined> {
  const { location, nonce, ssecurity } = pass ?? {};
  if (!location || !nonce || !ssecurity) {
    console.error('❌ 无法获取 serviceToken，缺少必要参数');
    return undefined;
  }
  const nsec = `nonce=${nonce}&${ssecurity}`;
  const clientSign = sha1(nsec);
  const url = location + '&clientSign=' + encodeURIComponent(clientSign);
  
  const res = await Http.get(url, {}, { rawResponse: true });
  
  // 从 set-cookie 中提取 serviceToken
  const cookies = res.headers?.['set-cookie'] ?? [];
  for (const cookie of cookies) {
    const match = cookie.match(/serviceToken=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  console.error('❌ 获取 Mi Service Token 失败');
  return undefined;
}
