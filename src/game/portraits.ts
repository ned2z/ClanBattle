import { berserker, blackmage, keyart, merchant, rogue, shield, whitemage } from './portraitData';
import type { ClassId } from './types';

export const PORTRAIT: Record<ClassId, string> = { shield, berserker, rogue, blackmage, whitemage, merchant };
export const KEYART = keyart;
