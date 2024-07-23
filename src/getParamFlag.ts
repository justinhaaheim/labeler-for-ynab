export function getBooleanParamFlag(
  flag: string,
  defaultValue?: boolean,
): boolean {
  const paramFlagValue = getBooleanParamFlagWithoutDefault(flag);

  if (paramFlagValue == null) {
    // The default value for paramFlags is false, unless they explicitly provide a
    // defaultValue via the config
    return defaultValue ?? false;
  }

  return paramFlagValue;
}

export function getBooleanParamFlagWithoutDefault(
  flag: string,
): boolean | null {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get(flag) == null) {
    return null;
  }

  return urlParams.get(flag) !== '0';
}

export function getStringParamFlag(
  flag: string,
  defaultValue?: string,
): string | null {
  const urlParams = new URLSearchParams(window.location.search);

  const param = urlParams.get(flag);

  return param ?? defaultValue ?? null;
}

export function getIntParamFlagWithoutDefault(flag: string): number | null {
  const urlParams = new URLSearchParams(window.location.search);

  const param = urlParams.get(flag);
  const parsedParam =
    param == null || isNaN(parseInt(param)) ? null : parseInt(param);

  return parsedParam ?? null;
}

export function getIntParamFlag(flag: string, defaultValue: number): number {
  const parsedParamFlagNullable = getIntParamFlagWithoutDefault(flag);

  return parsedParamFlagNullable ?? defaultValue;
}
