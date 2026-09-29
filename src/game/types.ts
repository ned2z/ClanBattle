export type ClassId = 'shield' | 'berserker' | 'rogue' | 'blackmage' | 'whitemage' | 'merchant';
export type Element = 'phys' | 'fire' | 'ice' | 'thunder' | 'dark' | 'holy' | 'poison' | 'wind';
export type TargetType = 'enemy' | 'enemies' | 'random3' | 'ally' | 'allies' | 'self' | 'deadAlly';
export type SkillKind = 'phys' | 'mag' | 'heal' | 'buff' | 'debuff';
export type StatusType =
  | 'poison' | 'burn' | 'bleed' | 'stun' | 'regen'
  | 'atkUp' | 'defUp' | 'spdUp' | 'magUp'
  | 'atkDown' | 'defDown' | 'spdDown'
  | 'taunt' | 'shield' | 'evade';

export interface Effect { type: StatusType; chance: number; turns: number; value?: number }

export interface Skill {
  id: string;
  name: string;
  icon: string;
  cls: ClassId | 'any';
  kind: SkillKind;
  target: TargetType;
  power: number;
  mp: number;
  cd: number;
  element: Element;
  hits?: number;
  lifesteal?: number;
  pierce?: number;
  critBonus?: number;
  cleanse?: boolean;
  revive?: number;
  gold?: number;
  effects?: Effect[];
  desc: string;
  rarity?: number;
  ult?: boolean;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  short: string;
  icon: string;
  color: string;
  base: Stats;
  growth: Stats;
  skills: string[];
  desc: string;
}

export interface Stats { hp: number; mp: number; atk: number; mag: number; def: number; res: number; spd: number; crit: number }

export type Tactic = 'aggressive' | 'balanced' | 'conserve' | 'attack';
export type Targeting = 'lowest' | 'random' | 'strongest';

export interface SkillSlot { id: string; enabled: boolean; level: number }

export interface EquipItem { id: string; iid: string; name: string; slot: 'weapon' | 'armor' | 'acc'; tier: number; rarity: number; bonus: Partial<Stats>; price: number; icon: string }

export interface Member {
  id: string;
  name: string;
  cls: ClassId;
  cls2?: string;
  level: number;
  xp: number;
  sp: number;
  hp: number;
  mp: number;
  skills: SkillSlot[];
  tactic: Tactic;
  targeting: Targeting;
  healAt: number;
  equip: { weapon?: EquipItem; armor?: EquipItem; acc?: EquipItem };
}

export interface City { id: string; name: string; en: string; lon: number; lat: number; tier: number; x: number; y: number }

export type QuestType = 'hunt' | 'deliver' | 'bounty' | 'wins';
export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  desc: string;
  target: number;
  progress: number;
  targetCity?: string;
  targetParty?: string;
  rewardGold: number;
  rewardFame: number;
  rewardXp: number;
  from: string;
}

export interface NpcParty {
  id: string;
  name: string;
  icon: string;
  level: number;
  fame: number;
  classes: ClassId[];
  color: string;
}

export interface Inventory { potion: number; hipotion: number; ether: number; phoenix: number }

export interface Travel { path: string[]; seg: number; t: number }

export interface GameState {
  partyName: string;
  members: Member[];
  gold: number;
  fame: number;
  score: number;
  day: number;
  location: string;
  inv: Inventory;
  quests: Quest[];
  cityQuests: Record<string, Quest[]>;
  npcs: NpcParty[];
  stats: { kills: number; wins: number; battles: number; npcWins: number; quests: number };
  settings: { autoPotion: boolean; autoRevive: boolean };
  reachedTop: boolean;
  travel: Travel | null;
  bag: EquipItem[];
  log: LogEntry[];
  visited: string[];
}

export interface LogEntry { id: number; day: number; type: 'win' | 'lose' | 'npc' | 'quest' | 'level' | 'city' | 'loot' | 'info'; text: string; sub?: string }

export interface Status { type: StatusType; turns: number; value: number }

export interface Unit {
  uid: string;
  memberId?: string;
  name: string;
  icon: string;
  cls?: ClassId;
  color: string;
  side: 'ally' | 'enemy';
  level: number;
  maxHp: number; hp: number; maxMp: number; mp: number;
  atk: number; mag: number; def: number; res: number; spd: number; crit: number;
  statuses: Status[];
  cds: Record<string, number>;
  skills: SkillSlot[];
  tactic: Tactic;
  targeting: Targeting;
  healAt: number;
  atb: number;
  alive: boolean;
  weak?: Element;
  ult: number;
  ultId?: string;
  cls2?: string;
}

export interface HitResult {
  uid: string;
  dmg?: number;
  heal?: number;
  mpHeal?: number;
  crit?: boolean;
  miss?: boolean;
  status?: StatusType[];
  killed?: boolean;
  revived?: boolean;
  weak?: boolean;
  shielded?: number;
}

export interface ActionEvent {
  actor: string;
  label: string;
  icon: string;
  element: Element;
  kind: SkillKind | 'attack' | 'item' | 'skip' | 'dot';
  isSkill: boolean;
  skillId?: string;
  ult?: boolean;
  hits: HitResult[];
  log: string;
  gold?: number;
}

export type Biome = 'forest' | 'plain' | 'dry' | 'tropical';
export type NodeKind = 'city' | 'village' | 'shrine' | 'fort' | 'camp' | 'ruin' | 'lake';
export interface MapNode { id: string; name: string; en: string; kind: NodeKind; x: number; y: number; tier: number; biome: Biome }

export interface EnemyGroup {
  biome?: Biome;
  units: Unit[];
  npcId?: string;
  title: string;
  level: number;
}
