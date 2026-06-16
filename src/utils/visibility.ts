import { User } from '../types';
import { Plant } from '../types';
import { getAccessiblePlantIds } from './projectAccess';

export function redactIfNotAccessible(text: string | undefined | null, itemPlantId: string | undefined, user: Pick<User, 'plant' | 'plantIds'>, plants: Plant[]): string {
  if (!text) return '';
  if (!itemPlantId) return '[redacted]';
  const accessible = getAccessiblePlantIds(user, plants);
  return accessible.includes(itemPlantId) ? text : '[redacted]';
}

export function isPlantAccessible(itemPlantId: string | undefined, user: Pick<User, 'plant' | 'plantIds'>, plants: Plant[]): boolean {
  if (!itemPlantId) return false;
  const accessible = getAccessiblePlantIds(user, plants);
  return accessible.includes(itemPlantId);
}
