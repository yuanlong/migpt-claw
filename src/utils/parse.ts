export function jsonEncode<T>(obj: T, options?: { prettier?: boolean }) {
  const { prettier } = options ?? {};
  try {
    return JSON.stringify(obj, undefined, prettier ? 4 : 0);
  } catch (_) {
    return undefined;
  }
}

export function jsonDecode<T = any>(json: string | null | undefined) {
  if (!json) {
    return undefined;
  }
  try {
    return JSON.parse(json) as T;
  } catch (_) {
    return undefined;
  }
}

/**
 * 清理 JSON 字符串并解码
 */
export function cleanJsonAndDecode(input: string | undefined | null) {
  if (input == undefined) return undefined;
  const pattern = /(\{[\s\S]*?"\s*:\s*[\s\S]*?})/;
  const match = input.match(pattern);

  if (!match) {
    return undefined;
  }

  return jsonDecode(match[0]);
}

/**
 * 获取数组第一个元素
 */
export function firstOf<T>(items?: T[]) {
  return items ? (items.length < 1 ? undefined : items[0]) : undefined;
}

/**
 * 获取数组最后一个元素
 */
export function lastOf<T>(items?: T[]) {
  return items?.length ? items[items.length - 1] : undefined;
}

/**
 * 休眠
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 断言
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
