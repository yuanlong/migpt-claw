import { jsonEncode } from '../utils/parse.js';
import { decodeMIoT, encodeFormData, encodeMIoT } from '../utils/codec.js';
import { Http } from '../utils/http.js';
import { updateMiAccount } from './common.js';
import { Debugger } from '../utils/debug.js';
import type { MIoTDevice, MiAccount } from './typing.js';

type MIoTAccount = MiAccount & { device: MIoTDevice };

export class MIoT {
  account: MIoTAccount;

  constructor(account: MIoTAccount) {
    this.account = account;
  }

  static async getDevice(account: MIoTAccount): Promise<MIoTAccount> {
    if (account.sid !== 'xiaomiio') {
      return account;
    }
    const devices = await MIoT.__callMIoT(account, 'POST', '/home/device_list', {
      getVirtualModel: false,
      getHuamiDevices: 0,
    });
    if (Debugger.debug) {
      console.log('🐛 MIoT 设备列表：', jsonEncode(devices, { prettier: true }));
    }
    const device = (devices?.list ?? []).find((e: any) =>
      [e.did, e.name, e.mac].includes(account.did),
    );
    if (device) {
      account.device = device;
    }
    return account;
  }

  private static async __callMIoT(
    account: MIoTAccount,
    method: 'GET' | 'POST',
    path: string,
    _data?: any,
  ) {
    const url = `https://api.io.mi.com/app${path}`;
    const config = {
      account,
      setAccount: updateMiAccount(account),
      rawResponse: true,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
        'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
      },
      cookies: {
        userId: account.userId,
        serviceToken: account.serviceToken,
        PassportDeviceId: account.deviceId,
      },
    };

    const data = encodeMIoT(path, _data, account.pass!.ssecurity!);
    if (Debugger.debug) {
      console.log('MIoT 请求:', {
        url,
        method,
        cookies: config.cookies,
        body: data,
      });
    }

    let res: any;
    if (method === 'GET') {
      res = await Http.get(url, data, config);
    } else {
      // POST body 使用 application/x-www-form-urlencoded 格式
      const formData = encodeFormData(data);
      if (Debugger.debug) {
        console.log('POST body:', formData);
      }
      res = await Http.post(url, formData, {
        ...config,
        headers: {
          ...config.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    }
    
    // 检查错误
    if (res.status === 401) {
      console.error('❌ 401 错误响应:', res.data);
      return undefined;
    }
    
    // MiService 返回的是明文 JSON，直接解析
    if (res.data && typeof res.data === 'object' && res.data.code === 0) {
      return res.data.result;
    }
    
    // 如果是加密字符串，尝试解密
    if (typeof res.data === 'string') {
      try {
        res = await decodeMIoT(
          account.pass!.ssecurity!,
          data._nonce,
          res.data,
          res.headers['miot-content-encoding'] === 'GZIP',
        );
        return res?.result;
      } catch (e) {
        console.error('❌ 解密失败:', e);
        return undefined;
      }
    }
    
    console.error('❌ 未知响应格式:', res);
    return undefined;
  }

  private async _callMIoT(method: 'GET' | 'POST', path: string, data?: any) {
    return MIoT.__callMIoT(this.account, method, path, data);
  }

  /**
   * 获取 MIoT 设备列表
   */
  async getDevices(getVirtualModel = false, getHuamiDevices = 0) {
    const res = await this._callMIoT('POST', '/home/device_list', {
      getVirtualModel: getVirtualModel,
      getHuamiDevices: getHuamiDevices,
    });
    return res?.list;
  }

  /**
   * 获取 MIoT 设备属性值
   */
  async getProperty(scope: number, property: number) {
    const res = await this._callMIoTSpec('prop/get', [
      {
        did: this.account.device.did,
        siid: scope,
        piid: property,
      },
    ]);
    return (res ?? [])?.[0]?.value;
  }

  /**
   * 设置 MIoT 设备属性值
   */
  async setProperty(scope: number, property: number, value: any) {
    const res = await this._callMIoTSpec('prop/set', [
      {
        did: this.account.device.did,
        siid: scope,
        piid: property,
        value: value,
      },
    ]);
    return (res ?? [])?.[0]?.code === 0;
  }

  /**
   * 调用 MIoT 设备能力指令
   */
  async doAction(scope: number, action: number, args: any = []) {
    const res = await this._callMIoTSpec('action', {
      did: this.account.device.did,
      siid: scope,
      aiid: action,
      in: Array.isArray(args) ? args : [args],
    });
    return res?.code === 0;
  }

  /**
   * 调用 MIoT 设备 RPC 指令
   */
  rpc(method: string, params: any, id = 1) {
    return this._callMIoT('POST', `/home/rpc/${this.account.device.did}`, {
      id,
      method,
      params,
    });
  }

  private _callMIoTSpec(command: string, params: any, datasource = 2) {
    return this._callMIoT('POST', `/miotspec/${command}`, {
      params,
      datasource,
    });
  }
}
