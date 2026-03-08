/**
 * 小米账号类型定义
 */
export interface MiAccount {
  /** 小米 ID（数字） */
  userId?: string;
  /** 密码 */
  password?: string;
  /** 登录凭证 */
  passToken?: string;
  /** 服务类型 */
  sid: 'micoapi' | 'xiaomiio';
  /** 设备 ID */
  deviceId?: string;
  /** 服务 Token */
  serviceToken?: string;
  /** 登录态 */
  pass?: MiPass;
  /** 设备标识（名称/ID/MAC） */
  did?: string;
  /** 设备信息 */
  device?: MiNADevice | MIoTDevice;
}

/**
 * 登录态
 */
export interface MiPass {
  code: number;
  qs?: string;
  _sign?: string;
  callback?: string;
  location?: string;
  nonce?: string;
  ssecurity?: string;
  passToken?: string;
  notificationUrl?: string;
  cUserId?: string;
}

/**
 * MiNA 设备
 */
export interface MiNADevice {
  deviceID: string;
  deviceId?: string;
  miotDID: string;
  name: string;
  alias: string;
  mac: string;
  hardware: string;
  serialNumber: string;
  rom: string;
  deviceSNProfile?: string;
  extra?: {
    fw_version: string;
  };
}

/**
 * MIoT 设备
 */
export interface MIoTDevice {
  did: string;
  name: string;
  mac: string;
  model: string;
  extra?: {
    fw_version: string;
  };
}

/**
 * 对话消息
 */
export interface MiConversation {
  query: string;
  time: number;
  answers: Array<{
    type: string;
    tts?: string;
    url?: string;
  }>;
}

/**
 * 对话列表
 */
export interface MiConversations {
  records: MiConversation[];
  hasMore: boolean;
  cursor?: number;
}
