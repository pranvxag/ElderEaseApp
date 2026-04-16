import { DEFAULT_USER_PROFILE, UserProfile } from '../constants/data';
import { STORAGE_KEYS, useStoredState } from './useStorage';

export function useProfile() {
  return useStoredState<UserProfile>(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER_PROFILE);
}
