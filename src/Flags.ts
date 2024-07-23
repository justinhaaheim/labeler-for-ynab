import {getBooleanParamFlagWithoutDefault} from './getParamFlag';

export function getIsDevMode(): boolean {
  // If the URL param is set always follow that. If not that, fall back to environment
  return getBooleanParamFlagWithoutDefault('dev') ?? import.meta.env.DEV;
}
