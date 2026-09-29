import type { Biome, City, ClassDef, ClassId, EquipItem, MapNode, NodeKind, Skill } from './types';

// ---------------- MAP ----------------
export const MAP_W = 450;
export const MAP_H = 700;
export const proj = (lon: number, lat: number) => ({ x: (lon - 97) * 50, y: (20.8 - lat) * 45 });

const rawCities: Omit<City, 'x' | 'y'>[] = [
  { id: 'bkk', name: 'กรุงเทพฯ', en: 'Bangkok', lon: 100.5, lat: 13.75, tier: 1 },
  { id: 'pat', name: 'พัทยา', en: 'Pattaya', lon: 100.95, lat: 12.95, tier: 1 },
  { id: 'kan', name: 'กาญจนบุรี', en: 'Kanchanaburi', lon: 99.53, lat: 14.02, tier: 2 },
  { id: 'hh', name: 'หัวหิน', en: 'Hua Hin', lon: 99.9, lat: 12.57, tier: 2 },
  { id: 'ns', name: 'นครสวรรค์', en: 'Nakhon Sawan', lon: 100.12, lat: 15.7, tier: 2 },
  { id: 'kr', name: 'นครราชสีมา', en: 'Korat', lon: 102.1, lat: 14.97, tier: 3 },
  { id: 'pl', name: 'พิษณุโลก', en: 'Phitsanulok', lon: 100.26, lat: 16.82, tier: 3 },
  { id: 'kk', name: 'ขอนแก่น', en: 'Khon Kaen', lon: 102.83, lat: 16.44, tier: 4 },
  { id: 'sur', name: 'สุราษฎร์ธานี', en: 'Surat Thani', lon: 99.33, lat: 9.14, tier: 4 },
  { id: 'ud', name: 'อุดรธานี', en: 'Udon Thani', lon: 102.79, lat: 17.41, tier: 5 },
  { id: 'cm', name: 'เชียงใหม่', en: 'Chiang Mai', lon: 98.98, lat: 18.79, tier: 5 },
  { id: 'ub', name: 'อุบลราชธานี', en: 'Ubon', lon: 104.85, lat: 15.24, tier: 6 },
  { id: 'phu', name: 'ภูเก็ต', en: 'Phuket', lon: 98.45, lat: 7.95, tier: 6 },
  { id: 'hy', name: 'หาดใหญ่', en: 'Hat Yai', lon: 100.47, lat: 7.0, tier: 7 },
  { id: 'cr', name: 'เชียงราย', en: 'Chiang Rai', lon: 99.83, lat: 19.91, tier: 8 },
  { id: 'ayu', name: 'อยุธยา', en: 'Ayutthaya', lon: 100.57, lat: 14.35, tier: 1 },
  { id: 'skt', name: 'สุโขทัย', en: 'Sukhothai', lon: 99.82, lat: 17.0, tier: 3 },
  { id: 'lpg', name: 'ลำปาง', en: 'Lampang', lon: 99.5, lat: 18.29, tier: 5 },
  { id: 'nan', name: 'น่าน', en: 'Nan', lon: 100.78, lat: 18.78, tier: 7 },
  { id: 'loei', name: 'เลย', en: 'Loei', lon: 101.72, lat: 17.49, tier: 5 },
  { id: 'npm', name: 'นครพนม', en: 'Nakhon Phanom', lon: 104.55, lat: 17.3, tier: 6 },
  { id: 'brm', name: 'บุรีรัมย์', en: 'Buriram', lon: 103.1, lat: 14.99, tier: 4 },
  { id: 'cti', name: 'จันทบุรี', en: 'Chanthaburi', lon: 102.1, lat: 12.62, tier: 2 },
  { id: 'cpn', name: 'ชุมพร', en: 'Chumphon', lon: 99.1, lat: 10.5, tier: 3 },
  { id: 'nst', name: 'นครศรีธรรมราช', en: 'Nakhon Si', lon: 99.96, lat: 8.43, tier: 5 },
  { id: 'kbi', name: 'กระบี่', en: 'Krabi', lon: 98.92, lat: 8.08, tier: 5 },
];
export const CITIES: City[] = rawCities.map((c) => ({ ...c, ...proj(c.lon, c.lat) }));
export const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c])) as Record<string, City>;

export const ROADS: [string, string][] = [
  ['cr', 'cm'], ['cr', 'nan'], ['cm', 'lpg'], ['lpg', 'nan'], ['lpg', 'skt'], ['nan', 'pl'], ['skt', 'pl'], ['skt', 'ns'],
  ['pl', 'loei'], ['pl', 'kk'], ['loei', 'ud'], ['ud', 'kk'], ['ud', 'npm'], ['npm', 'ub'], ['kk', 'kr'], ['kk', 'ub'],
  ['kr', 'brm'], ['brm', 'ub'], ['ns', 'ayu'], ['ns', 'kan'], ['ns', 'kr'], ['ayu', 'bkk'], ['ayu', 'kr'], ['bkk', 'kan'],
  ['bkk', 'pat'], ['bkk', 'hh'], ['kan', 'hh'], ['pat', 'cti'], ['kr', 'cti'], ['hh', 'cpn'], ['cpn', 'sur'], ['sur', 'kbi'],
  ['sur', 'nst'], ['kbi', 'phu'], ['kbi', 'hy'], ['nst', 'hy'],
];

const outlineLL: [number, number][] = [
  [99.9, 20.45], [100.1, 20.35], [100.5, 20.15], [100.45, 19.6], [101.2, 19.55], [101.05, 18.45], [101.7, 17.9],
  [102.6, 17.95], [103.3, 18.4], [104.0, 18.3], [104.7, 17.45], [104.8, 16.5], [105.4, 15.85], [105.6, 15.0],
  [105.2, 14.3], [104.5, 14.4], [103.0, 14.35], [102.4, 13.6], [102.5, 12.7], [102.8, 12.2], [102.9, 11.7],
  [102.3, 12.2], [101.7, 12.68], [101.0, 12.65], [100.9, 13.3], [100.6, 13.5], [100.0, 13.4], [99.95, 12.6],
  [99.8, 11.8], [99.3, 10.8], [99.2, 10.3], [99.3, 9.5], [99.9, 9.3], [100.2, 8.4], [100.4, 7.7], [100.6, 7.2],
  [101.3, 6.9], [102.1, 6.2], [101.8, 5.8], [101.1, 6.0], [100.4, 6.5], [100.1, 6.5], [99.7, 7.1], [99.3, 7.6],
  [98.4, 7.8], [98.25, 8.3], [98.3, 9.0], [98.6, 10.0], [99.2, 11.0], [99.6, 11.8], [99.2, 12.5], [99.1, 13.2],
  [98.6, 14.0], [98.2, 15.0], [98.6, 15.8], [98.9, 16.5], [97.8, 17.7], [97.6, 18.5], [97.4, 18.9], [97.8, 19.75],
  [98.5, 19.7], [99.0, 20.0], [99.5, 20.2],
];
export const OUTLINE = outlineLL.map(([lo, la]) => proj(lo, la));

// ---------------- CLASSES ----------------
export const CLASSES: Record<ClassId, ClassDef> = {
  shield: {
    id: 'shield', name: 'อัศวินโล่', short: 'โล่', icon: '🛡️', color: '#60a5fa',
    base: { hp: 150, mp: 30, atk: 14, mag: 6, def: 18, res: 11, spd: 8, crit: 5 },
    growth: { hp: 19, mp: 3, atk: 2.2, mag: 0.8, def: 2.8, res: 1.7, spd: 0.6, crit: 0 },
    skills: ['s_taunt', 's_bash', 's_fort'], desc: 'แท็งค์แนวหน้า ปกป้องเพื่อน',
  },
  berserker: {
    id: 'berserker', name: 'นักรบดาบใหญ่', short: 'ดาบใหญ่', icon: '⚔️', color: '#f87171',
    base: { hp: 125, mp: 25, atk: 22, mag: 5, def: 10, res: 6, spd: 10, crit: 10 },
    growth: { hp: 15, mp: 2.5, atk: 3.4, mag: 0.6, def: 1.6, res: 1, spd: 0.8, crit: 0 },
    skills: ['b_cleave', 'b_storm', 'b_rage'], desc: 'ดาเมจกายภาพรุนแรง',
  },
  rogue: {
    id: 'rogue', name: 'นักฆ่ามีด', short: 'มีด', icon: '🗡️', color: '#a3e635',
    base: { hp: 95, mp: 30, atk: 17, mag: 8, def: 8, res: 8, spd: 16, crit: 20 },
    growth: { hp: 12, mp: 3, atk: 2.6, mag: 1, def: 1.2, res: 1.2, spd: 1.4, crit: 0.3 },
    skills: ['r_vital', 'r_poison', 'r_shadow'], desc: 'เร็ว คริติคอลสูง พิษร้าย',
  },
  blackmage: {
    id: 'blackmage', name: 'จอมเวทย์ดำ', short: 'เวทย์ดำ', icon: '🔮', color: '#c084fc',
    base: { hp: 80, mp: 60, atk: 6, mag: 24, def: 6, res: 14, spd: 11, crit: 5 },
    growth: { hp: 10, mp: 6, atk: 0.8, mag: 3.6, def: 1, res: 2.2, spd: 0.9, crit: 0 },
    skills: ['m_fire', 'm_blizzard', 'm_thunder'], desc: 'เวทย์ทำลายล้างหมู่',
  },
  whitemage: {
    id: 'whitemage', name: 'นักบวชเวทย์ขาว', short: 'เวทย์ขาว', icon: '✨', color: '#fde68a',
    base: { hp: 88, mp: 65, atk: 7, mag: 20, def: 8, res: 16, spd: 12, crit: 5 },
    growth: { hp: 11, mp: 6.5, atk: 0.9, mag: 3, def: 1.2, res: 2.4, spd: 0.9, crit: 0 },
    skills: ['w_heal', 'w_bless', 'w_revive'], desc: 'ฮีล บัฟ ชุบชีวิต',
  },
  merchant: {
    id: 'merchant', name: 'พ่อค้าผจญภัย', short: 'พ่อค้า', icon: '💰', color: '#fbbf24',
    base: { hp: 105, mp: 40, atk: 15, mag: 12, def: 11, res: 11, spd: 13, crit: 8 },
    growth: { hp: 13, mp: 4, atk: 2.2, mag: 1.8, def: 1.6, res: 1.6, spd: 1.1, crit: 0 },
    skills: ['c_coin', 'c_tonic', 'c_merc'], desc: 'ส่วนลดร้าน 15% • ทอง +25%',
  },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

// ---------------- SKILLS (68) ----------------
const S = (s: Skill) => s;
export const SKILLS: Skill[] = [
  // Shield
  S({ id: 's_taunt', name: 'ยั่วยุ', icon: '📣', cls: 'shield', kind: 'buff', target: 'self', power: 0, mp: 6, cd: 4, element: 'phys', effects: [{ type: 'taunt', chance: 1, turns: 3 }, { type: 'defUp', chance: 1, turns: 3, value: 0.5 }], desc: 'ดึงความสนใจศัตรู + ป้องกัน +50%' }),
  S({ id: 's_bash', name: 'โล่กระแทก', icon: '🛡️', cls: 'shield', kind: 'phys', target: 'enemy', power: 1.3, mp: 5, cd: 2, element: 'phys', effects: [{ type: 'stun', chance: 0.35, turns: 1 }], desc: 'โจมตี 130% มีโอกาสสตัน' }),
  S({ id: 's_fort', name: 'ป้อมปราการ', icon: '🏰', cls: 'shield', kind: 'buff', target: 'allies', power: 0, mp: 12, cd: 5, element: 'holy', effects: [{ type: 'defUp', chance: 1, turns: 3, value: 0.4 }], desc: 'ทุกคนป้องกัน +40%' }),
  // Berserker
  S({ id: 'b_cleave', name: 'ฟันทลายภูผา', icon: '🪓', cls: 'berserker', kind: 'phys', target: 'enemy', power: 2.3, mp: 8, cd: 2, element: 'phys', desc: 'ฟันเดี่ยว 230%' }),
  S({ id: 'b_storm', name: 'พายุดาบ', icon: '🌪️', cls: 'berserker', kind: 'phys', target: 'enemies', power: 1.1, mp: 12, cd: 3, element: 'phys', desc: 'ฟันศัตรูทั้งหมด 110%' }),
  S({ id: 'b_rage', name: 'เลือดเดือด', icon: '🔥', cls: 'berserker', kind: 'buff', target: 'self', power: 0, mp: 6, cd: 5, element: 'fire', effects: [{ type: 'atkUp', chance: 1, turns: 3, value: 0.6 }], desc: 'พลังโจมตี +60%' }),
  // Rogue
  S({ id: 'r_vital', name: 'แทงจุดตาย', icon: '🎯', cls: 'rogue', kind: 'phys', target: 'enemy', power: 1.7, mp: 7, cd: 2, element: 'phys', critBonus: 40, desc: '170% คริ +40%' }),
  S({ id: 'r_poison', name: 'มีดอาบพิษ', icon: '🧪', cls: 'rogue', kind: 'phys', target: 'enemy', power: 1.0, mp: 5, cd: 2, element: 'poison', effects: [{ type: 'poison', chance: 0.9, turns: 3, value: 0.07 }], desc: 'ติดพิษ 3 เทิร์น' }),
  S({ id: 'r_shadow', name: 'เงาพริบตา', icon: '👤', cls: 'rogue', kind: 'buff', target: 'self', power: 0, mp: 8, cd: 5, element: 'dark', effects: [{ type: 'evade', chance: 1, turns: 2, value: 0.5 }, { type: 'spdUp', chance: 1, turns: 3, value: 0.4 }], desc: 'หลบหลีก 50% + เร็วขึ้น' }),
  // Black mage
  S({ id: 'm_fire', name: 'ลูกไฟ', icon: '☄️', cls: 'blackmage', kind: 'mag', target: 'enemy', power: 1.9, mp: 8, cd: 1, element: 'fire', effects: [{ type: 'burn', chance: 0.4, turns: 2, value: 0.06 }], desc: 'ไฟ 190% ติดไฟลุก' }),
  S({ id: 'm_blizzard', name: 'พายุหิมะ', icon: '❄️', cls: 'blackmage', kind: 'mag', target: 'enemies', power: 1.15, mp: 14, cd: 3, element: 'ice', effects: [{ type: 'spdDown', chance: 0.5, turns: 2, value: 0.3 }], desc: 'น้ำแข็งหมู่ ช้าลง' }),
  S({ id: 'm_thunder', name: 'สายฟ้าพิโรธ', icon: '⚡', cls: 'blackmage', kind: 'mag', target: 'enemy', power: 2.4, mp: 14, cd: 3, element: 'thunder', effects: [{ type: 'stun', chance: 0.25, turns: 1 }], desc: 'สายฟ้า 240% สตัน' }),
  // White mage
  S({ id: 'w_heal', name: 'ฟื้นฟู', icon: '💚', cls: 'whitemage', kind: 'heal', target: 'ally', power: 2.2, mp: 8, cd: 1, element: 'holy', desc: 'ฮีลเดี่ยว' }),
  S({ id: 'w_bless', name: 'พรศักดิ์สิทธิ์', icon: '🌟', cls: 'whitemage', kind: 'heal', target: 'allies', power: 1.0, mp: 16, cd: 3, element: 'holy', effects: [{ type: 'regen', chance: 1, turns: 3, value: 0.05 }], desc: 'ฮีลหมู่ + ฟื้นฟูต่อเนื่อง' }),
  S({ id: 'w_revive', name: 'คืนชีพ', icon: '🕊️', cls: 'whitemage', kind: 'heal', target: 'deadAlly', power: 0, mp: 24, cd: 5, element: 'holy', revive: 0.4, desc: 'ชุบชีวิต 40% HP' }),
  // Merchant
  S({ id: 'c_coin', name: 'โยนถุงทอง', icon: '🪙', cls: 'merchant', kind: 'phys', target: 'enemy', power: 1.6, mp: 6, cd: 2, element: 'phys', gold: 6, desc: '160% + ได้ทอง' }),
  S({ id: 'c_tonic', name: 'ยาสูตรลับ', icon: '🍶', cls: 'merchant', kind: 'heal', target: 'ally', power: 1.8, mp: 8, cd: 2, element: 'holy', cleanse: true, desc: 'ฮีล + ล้างสถานะ' }),
  S({ id: 'c_merc', name: 'จ้างทหารรับจ้าง', icon: '🏹', cls: 'merchant', kind: 'phys', target: 'enemies', power: 1.0, mp: 14, cd: 4, element: 'phys', desc: 'ห่าธนูใส่ศัตรูทั้งหมด' }),
  // ---- COMMON (50) ----
  S({ id: 'x_double', name: 'ฟันสองจังหวะ', icon: '✂️', cls: 'any', kind: 'phys', target: 'enemy', power: 0.85, hits: 2, mp: 6, cd: 2, element: 'phys', desc: 'โจมตี 2 ครั้ง' }),
  S({ id: 'x_ironfist', name: 'หมัดเหล็ก', icon: '👊', cls: 'any', kind: 'phys', target: 'enemy', power: 1.35, mp: 5, cd: 2, element: 'phys', effects: [{ type: 'stun', chance: 0.2, turns: 1 }], desc: 'หมัด 135% สตัน' }),
  S({ id: 'x_boltarrow', name: 'ธนูอัสนี', icon: '🌩️', cls: 'any', kind: 'mag', target: 'enemy', power: 1.4, mp: 7, cd: 1, element: 'thunder', desc: 'สายฟ้าเดี่ยว' }),
  S({ id: 'x_hellfire', name: 'เพลิงนรก', icon: '🔥', cls: 'any', kind: 'mag', target: 'enemies', power: 1.0, mp: 14, cd: 3, element: 'fire', effects: [{ type: 'burn', chance: 0.35, turns: 2, value: 0.05 }], desc: 'ไฟหมู่ ติดไฟลุก' }),
  S({ id: 'x_icespear', name: 'หอกน้ำแข็ง', icon: '🧊', cls: 'any', kind: 'mag', target: 'enemy', power: 1.6, mp: 8, cd: 2, element: 'ice', effects: [{ type: 'spdDown', chance: 0.6, turns: 2, value: 0.3 }], desc: 'น้ำแข็ง ช้าลง' }),
  S({ id: 'x_darkwave', name: 'คลื่นมืด', icon: '🌑', cls: 'any', kind: 'mag', target: 'enemies', power: 1.0, mp: 13, cd: 3, element: 'dark', effects: [{ type: 'atkDown', chance: 0.5, turns: 2, value: 0.3 }], desc: 'มืดหมู่ ลดโจมตี' }),
  S({ id: 'x_judgement', name: 'แสงพิพากษา', icon: '☀️', cls: 'any', kind: 'mag', target: 'enemy', power: 1.8, mp: 10, cd: 2, element: 'holy', desc: 'แสงศักดิ์สิทธิ์ 180%' }),
  S({ id: 'x_drain', name: 'ดูดเลือด', icon: '🩸', cls: 'any', kind: 'phys', target: 'enemy', power: 1.2, mp: 6, cd: 2, element: 'dark', lifesteal: 0.5, desc: 'ดูด HP 50%' }),
  S({ id: 'x_spellblade', name: 'ดาบเวทย์', icon: '🗡️', cls: 'any', kind: 'mag', target: 'enemy', power: 1.45, mp: 7, cd: 1, element: 'wind', desc: 'ดาบลม 145%' }),
  S({ id: 'x_arrowrain', name: 'ฝนลูกศร', icon: '🏹', cls: 'any', kind: 'phys', target: 'random3', power: 0.8, mp: 9, cd: 2, element: 'phys', desc: 'สุ่มยิง 3 ครั้ง' }),
  S({ id: 'x_smoke', name: 'ระเบิดควัน', icon: '💨', cls: 'any', kind: 'debuff', target: 'enemies', power: 0, mp: 8, cd: 4, element: 'wind', effects: [{ type: 'spdDown', chance: 0.9, turns: 3, value: 0.35 }], desc: 'ศัตรูช้าลง' }),
  S({ id: 'x_warcry', name: 'ตะโกนศึก', icon: '📯', cls: 'any', kind: 'buff', target: 'allies', power: 0, mp: 12, cd: 5, element: 'phys', effects: [{ type: 'atkUp', chance: 1, turns: 3, value: 0.35 }], desc: 'ทุกคนโจมตี +35%' }),
  S({ id: 'x_barrier', name: 'เกราะเวทย์', icon: '🔰', cls: 'any', kind: 'buff', target: 'allies', power: 0.8, mp: 14, cd: 5, element: 'holy', effects: [{ type: 'shield', chance: 1, turns: 3 }], desc: 'โล่ดูดซับให้ทุกคน' }),
  S({ id: 'x_focus', name: 'สมาธิ', icon: '🧘', cls: 'any', kind: 'buff', target: 'self', power: 0, mp: 4, cd: 4, element: 'holy', effects: [{ type: 'magUp', chance: 1, turns: 3, value: 0.6 }], desc: 'เวทย์ +60%' }),
  S({ id: 'x_haste', name: 'เร่งกองทัพ', icon: '🏃', cls: 'any', kind: 'buff', target: 'allies', power: 0, mp: 14, cd: 5, element: 'wind', effects: [{ type: 'spdUp', chance: 1, turns: 3, value: 0.35 }], desc: 'ทุกคนเร็ว +35%' }),
  S({ id: 'x_holywater', name: 'น้ำมนต์', icon: '💧', cls: 'any', kind: 'heal', target: 'ally', power: 1.5, mp: 7, cd: 1, element: 'holy', desc: 'ฮีลเดี่ยว' }),
  S({ id: 'x_purify', name: 'ชำระล้าง', icon: '🫧', cls: 'any', kind: 'heal', target: 'ally', power: 0.8, mp: 6, cd: 2, element: 'holy', cleanse: true, desc: 'ล้างสถานะ + ฮีล' }),
  S({ id: 'x_cobra', name: 'พิษงูเห่า', icon: '🐍', cls: 'any', kind: 'phys', target: 'enemy', power: 0.8, mp: 7, cd: 3, element: 'poison', effects: [{ type: 'poison', chance: 1, turns: 4, value: 0.08 }], desc: 'พิษร้ายแรง 4 เทิร์น' }),
  S({ id: 'x_rend', name: 'เฉือนเลือด', icon: '🩹', cls: 'any', kind: 'phys', target: 'enemy', power: 1.1, mp: 6, cd: 2, element: 'phys', effects: [{ type: 'bleed', chance: 0.8, turns: 3, value: 0.06 }], desc: 'เลือดไหล' }),
  S({ id: 'x_quake', name: 'แผ่นดินไหว', icon: '🌋', cls: 'any', kind: 'phys', target: 'enemies', power: 1.15, mp: 15, cd: 4, element: 'phys', effects: [{ type: 'stun', chance: 0.12, turns: 1 }], desc: 'สั่นสะเทือนหมู่' }),
  S({ id: 'x_tornado', name: 'พายุทอร์นาโด', icon: '🌀', cls: 'any', kind: 'mag', target: 'enemies', power: 1.05, mp: 13, cd: 3, element: 'wind', desc: 'ลมหมู่' }),
  S({ id: 'x_pierce', name: 'หอกทะลวง', icon: '🔱', cls: 'any', kind: 'phys', target: 'enemy', power: 1.5, mp: 7, cd: 2, element: 'phys', pierce: 0.5, desc: 'เจาะเกราะ 50%' }),
  S({ id: 'x_armorbreak', name: 'ค้อนทุบเกราะ', icon: '🔨', cls: 'any', kind: 'phys', target: 'enemy', power: 1.1, mp: 6, cd: 3, element: 'phys', effects: [{ type: 'defDown', chance: 0.9, turns: 3, value: 0.4 }], desc: 'ลดป้องกัน 40%' }),
  S({ id: 'x_curse', name: 'สาปแช่ง', icon: '💀', cls: 'any', kind: 'debuff', target: 'enemy', power: 0, mp: 8, cd: 3, element: 'dark', effects: [{ type: 'atkDown', chance: 1, turns: 3, value: 0.35 }, { type: 'defDown', chance: 1, turns: 3, value: 0.35 }], desc: 'ลดโจมตี+ป้องกัน' }),
  S({ id: 'x_chains', name: 'โซ่ตรวน', icon: '⛓️', cls: 'any', kind: 'phys', target: 'enemy', power: 0.6, mp: 9, cd: 4, element: 'phys', effects: [{ type: 'stun', chance: 0.65, turns: 1 }], desc: 'สตันสูง' }),
  S({ id: 'x_awaken', name: 'ปลุกพลัง', icon: '💪', cls: 'any', kind: 'buff', target: 'self', power: 0, mp: 7, cd: 5, element: 'phys', effects: [{ type: 'atkUp', chance: 1, turns: 3, value: 0.4 }, { type: 'spdUp', chance: 1, turns: 3, value: 0.25 }], desc: 'โจมตี+ความเร็ว' }),
  S({ id: 'x_tigerspirit', name: 'จิตพยัคฆ์', icon: '🐯', cls: 'any', kind: 'buff', target: 'self', power: 0, mp: 6, cd: 5, element: 'phys', effects: [{ type: 'atkUp', chance: 1, turns: 4, value: 0.3 }, { type: 'regen', chance: 1, turns: 3, value: 0.05 }], desc: 'โจมตี + ฟื้นฟู' }),
  S({ id: 'x_mist', name: 'ม่านหมอก', icon: '🌫️', cls: 'any', kind: 'buff', target: 'allies', power: 0, mp: 12, cd: 5, element: 'wind', effects: [{ type: 'evade', chance: 1, turns: 2, value: 0.3 }], desc: 'ทุกคนหลบ 30%' }),
  S({ id: 'x_stonewall', name: 'กำแพงศิลา', icon: '🪨', cls: 'any', kind: 'buff', target: 'self', power: 2.0, mp: 8, cd: 4, element: 'phys', effects: [{ type: 'shield', chance: 1, turns: 3 }, { type: 'defUp', chance: 1, turns: 3, value: 0.3 }], desc: 'โล่หนา + ป้องกัน' }),
  S({ id: 'x_dragon', name: 'ลมหายใจมังกร', icon: '🐉', cls: 'any', kind: 'mag', target: 'enemies', power: 1.55, mp: 24, cd: 5, element: 'fire', effects: [{ type: 'burn', chance: 0.5, turns: 2, value: 0.06 }], desc: 'ไฟมังกรหมู่' }),
  S({ id: 'x_meteor', name: 'ดาวตก', icon: '🌠', cls: 'any', kind: 'mag', target: 'random3', power: 1.1, mp: 15, cd: 3, element: 'fire', desc: 'อุกกาบาต 3 ลูก' }),
  S({ id: 'x_chainbolt', name: 'สายฟ้าโซ่', icon: '⚡', cls: 'any', kind: 'mag', target: 'enemies', power: 0.95, mp: 13, cd: 3, element: 'thunder', effects: [{ type: 'stun', chance: 0.1, turns: 1 }], desc: 'สายฟ้ากระโดด' }),
  S({ id: 'x_frostnova', name: 'หนามน้ำแข็ง', icon: '❄️', cls: 'any', kind: 'mag', target: 'enemies', power: 0.95, mp: 12, cd: 3, element: 'ice', effects: [{ type: 'spdDown', chance: 0.35, turns: 2, value: 0.3 }], desc: 'น้ำแข็งหมู่' }),
  S({ id: 'x_poisonarrow', name: 'ศรพิษ', icon: '🎋', cls: 'any', kind: 'phys', target: 'enemy', power: 1.05, mp: 5, cd: 2, element: 'poison', effects: [{ type: 'poison', chance: 0.7, turns: 3, value: 0.06 }], desc: 'ศรติดพิษ' }),
  S({ id: 'x_thunderblade', name: 'ดาบอัสนี', icon: '🌩️', cls: 'any', kind: 'phys', target: 'enemy', power: 1.5, mp: 7, cd: 2, element: 'thunder', desc: 'ดาบสายฟ้า 150%' }),
  S({ id: 'x_knee', name: 'เข่าลอยมวยไทย', icon: '🦵', cls: 'any', kind: 'phys', target: 'enemy', power: 1.8, mp: 8, cd: 3, element: 'phys', effects: [{ type: 'stun', chance: 0.25, turns: 1 }], desc: 'เข่าลอย 180% สตัน' }),
  S({ id: 'x_elbow', name: 'ศอกกลับ', icon: '💥', cls: 'any', kind: 'phys', target: 'enemy', power: 1.5, mp: 6, cd: 2, element: 'phys', critBonus: 30, desc: 'ศอก คริ +30%' }),
  S({ id: 'x_manaburst', name: 'ระเบิดมานา', icon: '💠', cls: 'any', kind: 'mag', target: 'enemy', power: 2.6, mp: 20, cd: 4, element: 'wind', desc: 'เวทย์บริสุทธิ์ 260%' }),
  S({ id: 'x_moonlight', name: 'แสงจันทร์', icon: '🌙', cls: 'any', kind: 'heal', target: 'allies', power: 0.75, mp: 13, cd: 3, element: 'holy', desc: 'ฮีลหมู่' }),
  S({ id: 'x_naga', name: 'พรนาคราช', icon: '🐲', cls: 'any', kind: 'buff', target: 'allies', power: 0, mp: 12, cd: 5, element: 'holy', effects: [{ type: 'regen', chance: 1, turns: 4, value: 0.06 }], desc: 'ฟื้นฟูต่อเนื่องหมู่' }),
  S({ id: 'x_hawkeye', name: 'ตาเหยี่ยว', icon: '🦅', cls: 'any', kind: 'phys', target: 'enemy', power: 1.3, mp: 5, cd: 1, element: 'phys', critBonus: 50, desc: 'แม่นยำ คริ +50%' }),
  S({ id: 'x_groundslam', name: 'ทุบพื้น', icon: '🪵', cls: 'any', kind: 'phys', target: 'enemies', power: 0.9, mp: 12, cd: 3, element: 'phys', effects: [{ type: 'defDown', chance: 0.5, turns: 2, value: 0.3 }], desc: 'หมู่ ลดป้องกัน' }),
  S({ id: 'x_deathshadow', name: 'เงามรณะ', icon: '☠️', cls: 'any', kind: 'mag', target: 'enemy', power: 2.1, mp: 12, cd: 3, element: 'dark', desc: 'มืด 210%' }),
  S({ id: 'x_claws', name: 'กรงเล็บพยัคฆ์', icon: '🐾', cls: 'any', kind: 'phys', target: 'enemy', power: 0.6, hits: 3, mp: 8, cd: 2, element: 'phys', desc: 'ข่วน 3 ครั้ง' }),
  S({ id: 'x_cannon', name: 'ปืนใหญ่สนาม', icon: '💣', cls: 'any', kind: 'phys', target: 'enemies', power: 1.3, mp: 18, cd: 4, element: 'fire', desc: 'ยิงปืนใหญ่หมู่' }),
  S({ id: 'x_grenade', name: 'ระเบิดมือ', icon: '🧨', cls: 'any', kind: 'phys', target: 'random3', power: 0.95, mp: 10, cd: 3, element: 'fire', effects: [{ type: 'burn', chance: 0.3, turns: 2, value: 0.05 }], desc: 'ระเบิดสุ่ม 3 ลูก' }),
  S({ id: 'x_ambush', name: 'ซุ่มโจมตี', icon: '🥷', cls: 'any', kind: 'phys', target: 'enemy', power: 2.3, mp: 10, cd: 4, element: 'phys', desc: 'ลอบโจมตี 230%' }),
  S({ id: 'x_banner', name: 'ธงชัยเฉลิมพล', icon: '🚩', cls: 'any', kind: 'buff', target: 'allies', power: 0, mp: 16, cd: 6, element: 'holy', effects: [{ type: 'atkUp', chance: 1, turns: 3, value: 0.25 }, { type: 'defUp', chance: 1, turns: 3, value: 0.25 }], desc: 'โจมตี+ป้องกันหมู่' }),
  S({ id: 'x_ration', name: 'เสบียงสนาม', icon: '🍙', cls: 'any', kind: 'heal', target: 'allies', power: 0.6, mp: 10, cd: 3, element: 'holy', desc: 'ฮีลหมู่เล็กน้อย' }),
  S({ id: 'x_unbind', name: 'ปลดพันธนาการ', icon: '🔓', cls: 'any', kind: 'heal', target: 'allies', power: 0.4, mp: 12, cd: 4, element: 'holy', cleanse: true, desc: 'ล้างสถานะหมู่' }),
];

// ---- EXPANSION: 40 skills with rarity (0 Normal, 1 Rare, 2 Legendary, 3 Unique) ----
const R = (s: Skill, rarity: number) => ({ ...s, rarity });
SKILLS.push(
  R(S({ id: 'y_slash3', name: 'ดาบสามจังหวะ', icon: '🗡️', cls: 'any', kind: 'phys', target: 'enemy', power: 0.62, hits: 3, mp: 8, cd: 2, element: 'phys', desc: 'ฟันต่อเนื่อง 3 ครั้ง' }), 0),
  R(S({ id: 'y_shieldthrow', name: 'ขว้างโล่', icon: '🥏', cls: 'any', kind: 'phys', target: 'enemy', power: 1.35, mp: 6, cd: 2, element: 'phys', effects: [{ type: 'stun', chance: 0.22, turns: 1 }], desc: 'ขว้างโล่ มีโอกาสสตัน' }), 0),
  R(S({ id: 'y_firearrow', name: 'ศรเพลิง', icon: '🏹', cls: 'any', kind: 'phys', target: 'enemy', power: 1.3, mp: 6, cd: 1, element: 'fire', effects: [{ type: 'burn', chance: 0.4, turns: 2, value: 0.05 }], desc: 'ธนูไฟ ติดไฟลุก' }), 0),
  R(S({ id: 'y_frostbite', name: 'ลมหนาวกัด', icon: '🌬️', cls: 'any', kind: 'mag', target: 'enemy', power: 1.35, mp: 7, cd: 1, element: 'ice', effects: [{ type: 'spdDown', chance: 0.5, turns: 2, value: 0.25 }], desc: 'ลมเย็น ทำให้ช้าลง' }), 0),
  R(S({ id: 'y_spark', name: 'ประกายไฟฟ้า', icon: '✨', cls: 'any', kind: 'mag', target: 'random3', power: 0.72, mp: 8, cd: 2, element: 'thunder', desc: 'ประกายไฟสุ่ม 3 ครั้ง' }), 0),
  R(S({ id: 'y_mend', name: 'สมานแผล', icon: '🩹', cls: 'any', kind: 'heal', target: 'ally', power: 1.3, mp: 7, cd: 1, element: 'holy', effects: [{ type: 'regen', chance: 1, turns: 2, value: 0.04 }], desc: 'ฮีล + ฟื้นฟูต่อเนื่อง' }), 0),
  R(S({ id: 'y_guard', name: 'ตั้งการ์ด', icon: '🛡', cls: 'any', kind: 'buff', target: 'self', power: 1.0, mp: 5, cd: 4, element: 'phys', effects: [{ type: 'defUp', chance: 1, turns: 2, value: 0.5 }, { type: 'shield', chance: 1, turns: 2 }], desc: 'ป้องกัน +50% และโล่' }), 0),
  R(S({ id: 'y_sandthrow', name: 'สาดทราย', icon: '🏜️', cls: 'any', kind: 'debuff', target: 'enemy', power: 0, mp: 5, cd: 3, element: 'wind', effects: [{ type: 'spdDown', chance: 0.9, turns: 2, value: 0.3 }, { type: 'atkDown', chance: 0.6, turns: 2, value: 0.2 }], desc: 'ศัตรูช้าลงและอ่อนแรง' }), 0),
  R(S({ id: 'y_headbutt', name: 'โขกหัว', icon: '🤕', cls: 'any', kind: 'phys', target: 'enemy', power: 1.25, mp: 5, cd: 2, element: 'phys', effects: [{ type: 'stun', chance: 0.3, turns: 1 }], desc: 'โขกหัวมึนงง' }), 0),
  R(S({ id: 'y_leech', name: 'ปลิงดูดพลัง', icon: '🪱', cls: 'any', kind: 'mag', target: 'enemy', power: 1.15, mp: 7, cd: 2, element: 'dark', lifesteal: 0.35, desc: 'เวทมืด ดูด HP 35%' }), 0),
  R(S({ id: 'y_herb', name: 'สมุนไพรป่า', icon: '🌿', cls: 'any', kind: 'heal', target: 'allies', power: 0.5, mp: 10, cd: 3, element: 'holy', cleanse: true, desc: 'ฮีลหมู่เล็กน้อย + ล้างสถานะ' }), 0),
  R(S({ id: 'y_quickstab', name: 'แทงฉับไว', icon: '⚡', cls: 'any', kind: 'phys', target: 'enemy', power: 1.15, mp: 4, cd: 1, element: 'phys', critBonus: 25, desc: 'แทงเร็ว คริ +25%' }), 0),

  R(S({ id: 'y_crescent', name: 'ดาบจันทร์เสี้ยว', icon: '🌙', cls: 'any', kind: 'phys', target: 'enemies', power: 1.2, mp: 13, cd: 3, element: 'wind', desc: 'คลื่นดาบเสี้ยวจันทร์ใส่ศัตรูทั้งหมด' }), 1),
  R(S({ id: 'y_inferno', name: 'ทะเลเพลิง', icon: '🔥', cls: 'any', kind: 'mag', target: 'enemies', power: 1.25, mp: 16, cd: 3, element: 'fire', effects: [{ type: 'burn', chance: 0.5, turns: 3, value: 0.05 }], desc: 'เพลิงท่วมสนาม ติดไฟลุก' }), 1),
  R(S({ id: 'y_glacier', name: 'ธารน้ำแข็ง', icon: '🏔️', cls: 'any', kind: 'mag', target: 'enemies', power: 1.2, mp: 15, cd: 3, element: 'ice', effects: [{ type: 'spdDown', chance: 0.6, turns: 2, value: 0.35 }], desc: 'ธารน้ำแข็งถล่ม ช้าลงหมู่' }), 1),
  R(S({ id: 'y_thunderstorm', name: 'พายุฝนฟ้าคะนอง', icon: '⛈️', cls: 'any', kind: 'mag', target: 'random3', power: 1.1, mp: 14, cd: 3, element: 'thunder', effects: [{ type: 'stun', chance: 0.15, turns: 1 }], desc: 'ฟ้าผ่าสุ่ม 3 ครั้ง' }), 1),
  R(S({ id: 'y_holynova', name: 'ระเบิดแสงศักดิ์สิทธิ์', icon: '🌟', cls: 'any', kind: 'mag', target: 'enemies', power: 1.15, mp: 14, cd: 3, element: 'holy', desc: 'แสงศักดิ์สิทธิ์ระเบิดทั่วสนาม' }), 1),
  R(S({ id: 'y_venomcloud', name: 'หมอกพิษ', icon: '☁️', cls: 'any', kind: 'debuff', target: 'enemies', power: 0, mp: 12, cd: 4, element: 'poison', effects: [{ type: 'poison', chance: 0.85, turns: 3, value: 0.06 }], desc: 'หมอกพิษปกคลุมศัตรูทั้งหมด' }), 1),
  R(S({ id: 'y_bladedance', name: 'ระบำดาบ', icon: '💃', cls: 'any', kind: 'phys', target: 'random3', power: 1.0, mp: 12, cd: 3, element: 'phys', critBonus: 20, desc: 'ร่ายรำฟันสุ่ม 3 ครั้ง คริสูง' }), 1),
  R(S({ id: 'y_sanctuary', name: 'เขตศักดิ์สิทธิ์', icon: '⛩️', cls: 'any', kind: 'heal', target: 'allies', power: 1.0, mp: 18, cd: 4, element: 'holy', effects: [{ type: 'regen', chance: 1, turns: 3, value: 0.06 }], desc: 'ฮีลหมู่ + ฟื้นฟูต่อเนื่อง' }), 1),
  R(S({ id: 'y_berserk', name: 'คลั่งศึก', icon: '😤', cls: 'any', kind: 'buff', target: 'self', power: 0, mp: 8, cd: 5, element: 'fire', effects: [{ type: 'atkUp', chance: 1, turns: 3, value: 0.8 }, { type: 'spdUp', chance: 1, turns: 3, value: 0.3 }], desc: 'ATK +80% SPD +30%' }), 1),
  R(S({ id: 'y_ironwall', name: 'กำแพงเหล็ก', icon: '🧱', cls: 'any', kind: 'buff', target: 'allies', power: 0.7, mp: 16, cd: 5, element: 'phys', effects: [{ type: 'defUp', chance: 1, turns: 3, value: 0.45 }, { type: 'shield', chance: 1, turns: 3 }], desc: 'ป้องกันหมู่ + โล่' }), 1),
  R(S({ id: 'y_soulreap', name: 'เคียวเก็บวิญญาณ', icon: '🌒', cls: 'any', kind: 'phys', target: 'enemy', power: 1.9, mp: 12, cd: 3, element: 'dark', lifesteal: 0.4, desc: 'ฟันมืด 190% ดูด HP' }), 1),
  R(S({ id: 'y_hex', name: 'คำสาปลึกลับ', icon: '🔯', cls: 'any', kind: 'debuff', target: 'enemies', power: 0, mp: 13, cd: 4, element: 'dark', effects: [{ type: 'atkDown', chance: 0.8, turns: 3, value: 0.3 }, { type: 'defDown', chance: 0.8, turns: 3, value: 0.3 }], desc: 'สาปศัตรูทั้งหมด ลด ATK/DEF' }), 1),
  R(S({ id: 'y_earthspike', name: 'หนามปฐพี', icon: '⛰️', cls: 'any', kind: 'phys', target: 'enemies', power: 1.1, mp: 13, cd: 3, element: 'phys', effects: [{ type: 'stun', chance: 0.15, turns: 1 }], desc: 'หนามหินทะลุพื้น' }), 1),
  R(S({ id: 'y_windslash', name: 'คมลมตัดฟ้า', icon: '🍃', cls: 'any', kind: 'mag', target: 'enemy', power: 2.1, mp: 11, cd: 2, element: 'wind', desc: 'คมลมเดี่ยว 210%' }), 1),

  R(S({ id: 'y_phoenix', name: 'วิหคเพลิงฟีนิกซ์', icon: '🐦‍🔥', cls: 'any', kind: 'mag', target: 'enemies', power: 1.75, mp: 26, cd: 5, element: 'fire', effects: [{ type: 'burn', chance: 0.7, turns: 3, value: 0.07 }], desc: 'อัญเชิญวิหคเพลิงแผดเผาทั้งสนาม' }), 2),
  R(S({ id: 'y_absolutezero', name: 'ศูนย์สัมบูรณ์', icon: '❄️', cls: 'any', kind: 'mag', target: 'enemies', power: 1.6, mp: 26, cd: 5, element: 'ice', effects: [{ type: 'spdDown', chance: 0.8, turns: 3, value: 0.4 }, { type: 'stun', chance: 0.25, turns: 1 }], desc: 'แช่แข็งทั้งสนาม สตัน' }), 2),
  R(S({ id: 'y_judgmentday', name: 'วันพิพากษา', icon: '⚖️', cls: 'any', kind: 'mag', target: 'enemies', power: 1.75, mp: 26, cd: 5, element: 'holy', desc: 'เสาแสงพิพากษาถล่มทุกศัตรู' }), 2),
  R(S({ id: 'y_thousandcuts', name: 'พันคมดาบ', icon: '⚔️', cls: 'any', kind: 'phys', target: 'enemy', power: 0.52, hits: 6, mp: 20, cd: 4, element: 'phys', critBonus: 15, desc: 'ฟัน 6 ครั้งติดต่อกัน' }), 2),
  R(S({ id: 'y_garuda', name: 'ครุฑพ่าห์', icon: '🦅', cls: 'any', kind: 'phys', target: 'enemies', power: 1.65, mp: 24, cd: 5, element: 'wind', desc: 'พญาครุฑโฉบกวาดทั้งสนาม' }), 2),
  R(S({ id: 'y_revival', name: 'ปาฏิหาริย์คืนชีพ', icon: '👼', cls: 'any', kind: 'heal', target: 'deadAlly', power: 0, mp: 28, cd: 5, element: 'holy', revive: 0.8, desc: 'ชุบชีวิต 80% HP' }), 2),
  R(S({ id: 'y_divineshield', name: 'โล่เทวะ', icon: '🔱', cls: 'any', kind: 'buff', target: 'allies', power: 1.5, mp: 24, cd: 6, element: 'holy', effects: [{ type: 'shield', chance: 1, turns: 3 }, { type: 'defUp', chance: 1, turns: 3, value: 0.3 }], desc: 'โล่เทพหนาให้ทุกคน' }), 2),
  R(S({ id: 'y_blackhole', name: 'หลุมดำ', icon: '🕳️', cls: 'any', kind: 'mag', target: 'enemies', power: 1.65, mp: 26, cd: 5, element: 'dark', effects: [{ type: 'atkDown', chance: 0.6, turns: 2, value: 0.4 }], desc: 'หลุมดำดูดกลืนทุกศัตรู' }), 2),
  R(S({ id: 'y_meteorstorm', name: 'พายุอุกกาบาต', icon: '☄️', cls: 'any', kind: 'mag', target: 'random3', power: 1.65, mp: 26, cd: 5, element: 'fire', desc: 'อุกกาบาตยักษ์ 3 ลูก' }), 2),

  R(S({ id: 'y_hanuman', name: 'หนุมานชาญสมร', icon: '🐒', cls: 'any', kind: 'phys', target: 'enemies', power: 2.1, mp: 34, cd: 6, element: 'phys', critBonus: 20, effects: [{ type: 'stun', chance: 0.35, turns: 1 }], desc: '[UNIQUE] พลังวานรเทพ ทุบทั้งสนาม' }), 3),
  R(S({ id: 'y_ramasoon', name: 'ขวานรามสูร', icon: '🪓', cls: 'any', kind: 'mag', target: 'enemies', power: 2.2, mp: 34, cd: 6, element: 'thunder', effects: [{ type: 'stun', chance: 0.3, turns: 1 }], desc: '[UNIQUE] ขวานสายฟ้าแห่งรามสูร' }), 3),
  R(S({ id: 'y_mekhala', name: 'แก้วมณีเมขลา', icon: '💎', cls: 'any', kind: 'mag', target: 'enemy', power: 3.5, mp: 30, cd: 5, element: 'holy', pierce: 0.4, desc: '[UNIQUE] ลำแสงแก้วมณี 350%' }), 3),
  R(S({ id: 'y_brahmastra', name: 'ศรพรหมาสตร์', icon: '🎯', cls: 'any', kind: 'phys', target: 'enemy', power: 3.6, mp: 30, cd: 5, element: 'wind', pierce: 0.7, critBonus: 30, desc: '[UNIQUE] ศรเทพ เจาะเกราะ 70%' }), 3),
  R(S({ id: 'y_amrita', name: 'น้ำอมฤต', icon: '🏺', cls: 'any', kind: 'heal', target: 'allies', power: 2.0, mp: 32, cd: 6, element: 'holy', cleanse: true, effects: [{ type: 'regen', chance: 1, turns: 3, value: 0.08 }], desc: '[UNIQUE] ฮีลหมู่มหาศาล + ล้างสถานะ' }), 3),
);
for (const s of SKILLS) if (s.cls === 'any' && s.rarity === undefined) s.rarity = ['x_meteor', 'x_manaburst', 'x_banner', 'x_cannon', 'x_deathshadow', 'x_barrier'].includes(s.id) ? 1 : s.id === 'x_dragon' ? 2 : 0;

export const SKILL_RARITY = [
  { name: 'Normal', th: 'ธรรมดา', color: '#cbd5e1', chance: 85 },
  { name: 'Rare', th: 'หายาก', color: '#3b9cff', chance: 10 },
  { name: 'Legendary', th: 'ตำนาน', color: '#ffb020', chance: 4 },
  { name: 'Unique', th: 'ยูนีค', color: '#ff3d7f', chance: 1 },
];

const U = (s: Skill) => ({ ...s, ult: true });
SKILLS.push(
  U(S({ id: 'u_shield', name: 'ป้อมปราการนิรันดร์', icon: '🏰', cls: 'shield', kind: 'buff', target: 'allies', power: 2.2, mp: 0, cd: 0, element: 'holy', effects: [{ type: 'shield', chance: 1, turns: 3 }, { type: 'defUp', chance: 1, turns: 3, value: 0.5 }], desc: 'โล่หนาพิเศษ + ป้องกัน +50% ทั้งทีม' })),
  U(S({ id: 'u_berserker', name: 'ดาบพิฆาตฟ้า', icon: '⚔️', cls: 'berserker', kind: 'phys', target: 'enemies', power: 2.6, mp: 0, cd: 0, element: 'phys', critBonus: 20, desc: 'ฟันคลื่นดาบยักษ์ใส่ศัตรูทั้งหมด 260%' })),
  U(S({ id: 'u_rogue', name: 'พันเงาสังหาร', icon: '👤', cls: 'rogue', kind: 'phys', target: 'enemy', power: 0.95, hits: 5, mp: 0, cd: 0, element: 'dark', critBonus: 40, desc: 'แยกเงาฟัน 5 ครั้ง คริ +40%' })),
  U(S({ id: 'u_blackmage', name: 'มหาอัคคีกัลป์', icon: '🔥', cls: 'blackmage', kind: 'mag', target: 'enemies', power: 2.5, mp: 0, cd: 0, element: 'fire', effects: [{ type: 'burn', chance: 0.8, turns: 3, value: 0.07 }], desc: 'เพลิงบรรลัยกัลป์เผาทั้งสนาม' })),
  U(S({ id: 'u_whitemage', name: 'แสงแห่งการฟื้นคืน', icon: '👼', cls: 'whitemage', kind: 'heal', target: 'allies', power: 2.2, mp: 0, cd: 0, element: 'holy', revive: 0.5, effects: [{ type: 'regen', chance: 1, turns: 3, value: 0.06 }], desc: 'ฮีลทั้งทีม + ชุบชีวิตทุกคนที่ล้ม' })),
  U(S({ id: 'u_merchant', name: 'ฝนทองคำ', icon: '💰', cls: 'merchant', kind: 'phys', target: 'enemies', power: 2.1, mp: 0, cd: 0, element: 'phys', gold: 20, desc: 'โปรยเหรียญทองถล่มศัตรู + ได้ทองมหาศาล' })),
  U(S({ id: 'u_paladin', name: 'พิพากษาศักดิ์สิทธิ์', icon: '⚜️', cls: 'shield', kind: 'mag', target: 'enemies', power: 2.5, mp: 0, cd: 0, element: 'holy', effects: [{ type: 'stun', chance: 0.3, turns: 1 }], desc: 'เสาแสงพิพากษาทั้งสนาม สตัน' })),
  U(S({ id: 'u_guardian', name: 'กำแพงเทพเจ้า', icon: '🛡️', cls: 'shield', kind: 'buff', target: 'allies', power: 3.2, mp: 0, cd: 0, element: 'holy', effects: [{ type: 'shield', chance: 1, turns: 3 }, { type: 'defUp', chance: 1, turns: 3, value: 0.7 }, { type: 'regen', chance: 1, turns: 3, value: 0.05 }], desc: 'โล่เทพ + DEF +70% + ฟื้นฟูทั้งทีม' })),
  U(S({ id: 'u_berserk', name: 'อสูรคลั่งพันหมัด', icon: '😡', cls: 'berserker', kind: 'phys', target: 'enemy', power: 0.95, hits: 6, mp: 0, cd: 0, element: 'fire', lifesteal: 0.4, desc: 'ถล่ม 6 ครั้ง ดูดเลือด 40%' })),
  U(S({ id: 'u_dragoon', name: 'มังกรทะยานฟ้า', icon: '🐲', cls: 'berserker', kind: 'phys', target: 'enemies', power: 2.9, mp: 0, cd: 0, element: 'fire', effects: [{ type: 'burn', chance: 0.6, turns: 2, value: 0.06 }], desc: 'กระโดดพุ่งพร้อมเปลวมังกร 290%' })),
  U(S({ id: 'u_assassin', name: 'ปลิดวิญญาณ', icon: '☠️', cls: 'rogue', kind: 'phys', target: 'enemy', power: 5.2, mp: 0, cd: 0, element: 'dark', pierce: 0.8, critBonus: 60, desc: 'สังหารเป้าเดียว 520% เจาะเกราะ 80%' })),
  U(S({ id: 'u_ranger', name: 'ห่าศรพิรุณ', icon: '🏹', cls: 'rogue', kind: 'phys', target: 'random3', power: 1.8, mp: 0, cd: 0, element: 'wind', critBonus: 30, desc: 'ศรฝนถล่ม 3 ระลอก' })),
  U(S({ id: 'u_archmage', name: 'อุกกาบาตวันสิ้นโลก', icon: '☄️', cls: 'blackmage', kind: 'mag', target: 'enemies', power: 3.1, mp: 0, cd: 0, element: 'fire', desc: 'อุกกาบาตยักษ์ถล่มทั้งสนาม 310%' })),
  U(S({ id: 'u_necro', name: 'ประตูนรก', icon: '🕳️', cls: 'blackmage', kind: 'mag', target: 'enemies', power: 2.6, mp: 0, cd: 0, element: 'dark', lifesteal: 0.3, effects: [{ type: 'atkDown', chance: 0.8, turns: 3, value: 0.35 }], desc: 'เปิดประตูนรก ดูด HP + ลด ATK' })),
  U(S({ id: 'u_bishop', name: 'ปาฏิหาริย์สวรรค์', icon: '✝️', cls: 'whitemage', kind: 'heal', target: 'allies', power: 3.2, mp: 0, cd: 0, element: 'holy', revive: 0.85, cleanse: true, desc: 'ฮีลมหาศาล ชุบชีวิต 85% ล้างสถานะ' })),
  U(S({ id: 'u_sage', name: 'ดาราจักรศักดิ์สิทธิ์', icon: '🌠', cls: 'whitemage', kind: 'mag', target: 'enemies', power: 2.7, mp: 0, cd: 0, element: 'holy', lifesteal: 0.25, desc: 'ดาวตกศักดิ์สิทธิ์ ฟื้น HP ตัวเอง' })),
  U(S({ id: 'u_smith', name: 'ค้อนเทพหลอมโลก', icon: '🔨', cls: 'merchant', kind: 'phys', target: 'enemies', power: 2.8, mp: 0, cd: 0, element: 'fire', effects: [{ type: 'defDown', chance: 1, turns: 3, value: 0.45 }], desc: 'ทุบพื้นสะเทือนโลก ลด DEF 45%' })),
  U(S({ id: 'u_alchemist', name: 'ยาอายุวัฒนะ', icon: '⚗️', cls: 'merchant', kind: 'heal', target: 'allies', power: 2.4, mp: 0, cd: 0, element: 'poison', revive: 0.6, effects: [{ type: 'atkUp', chance: 1, turns: 3, value: 0.35 }, { type: 'regen', chance: 1, turns: 3, value: 0.06 }], desc: 'ยาวิเศษ ฮีล ชุบชีวิต ATK +35%' })),
);

export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<string, Skill>;
export const COMMON_SKILLS = SKILLS.filter((s) => s.cls === 'any').map((s) => s.id);

export const STATUS_INFO: Record<string, { icon: string; name: string; bad: boolean }> = {
  poison: { icon: '🟢', name: 'พิษ', bad: true }, burn: { icon: '🔥', name: 'ไฟลุก', bad: true },
  bleed: { icon: '🩸', name: 'เลือดไหล', bad: true }, stun: { icon: '💫', name: 'สตัน', bad: true },
  regen: { icon: '💚', name: 'ฟื้นฟู', bad: false }, atkUp: { icon: '⚔', name: 'ATK↑', bad: false },
  defUp: { icon: '🛡', name: 'DEF↑', bad: false }, spdUp: { icon: '💨', name: 'SPD↑', bad: false },
  magUp: { icon: '🔮', name: 'MAG↑', bad: false }, atkDown: { icon: '⬇', name: 'ATK↓', bad: true },
  defDown: { icon: '💔', name: 'DEF↓', bad: true }, spdDown: { icon: '🐌', name: 'SPD↓', bad: true },
  taunt: { icon: '📣', name: 'ยั่วยุ', bad: false }, shield: { icon: '🔰', name: 'โล่', bad: false },
  evade: { icon: '👤', name: 'หลบ', bad: false },
};

export const ELEMENT_COLOR: Record<string, string> = {
  phys: '#fde68a', fire: '#fb923c', ice: '#7dd3fc', thunder: '#facc15', dark: '#a78bfa',
  holy: '#fef9c3', poison: '#84cc16', wind: '#5eead4',
};

// ---------------- ENEMIES ----------------
export interface EnemyTpl { name: string; icon: string; hp: number; atk: number; mag: number; def: number; res: number; spd: number; skills: string[]; weak?: string; minTier: number }
export const ENEMIES: EnemyTpl[] = [
  { name: 'โจรป่า', icon: '🥷', hp: 0.9, atk: 1, mag: 0.5, def: 0.8, res: 0.8, spd: 1.1, skills: ['x_double', 'x_rend'], weak: 'fire', minTier: 1 },
  { name: 'ทหารหนีทัพ', icon: '💂', hp: 1, atk: 1, mag: 0.5, def: 1, res: 0.8, spd: 1, skills: ['x_pierce', 'x_grenade'], weak: 'thunder', minTier: 1 },
  { name: 'หมาป่าสงคราม', icon: '🐺', hp: 0.8, atk: 1.05, mag: 0.3, def: 0.7, res: 0.7, spd: 1.35, skills: ['x_claws'], weak: 'fire', minTier: 1 },
  { name: 'งูจงอางยักษ์', icon: '🐍', hp: 0.9, atk: 0.9, mag: 0.8, def: 0.8, res: 1, spd: 1.2, skills: ['x_cobra'], weak: 'ice', minTier: 2 },
  { name: 'ผีกระสือ', icon: '👻', hp: 0.8, atk: 0.6, mag: 1.2, def: 0.6, res: 1.3, spd: 1.15, skills: ['x_darkwave', 'x_drain'], weak: 'holy', minTier: 2 },
  { name: 'ช้างศึกคลั่ง', icon: '🐘', hp: 1.9, atk: 1.25, mag: 0.3, def: 1.3, res: 0.8, spd: 0.7, skills: ['x_quake', 'x_groundslam'], weak: 'thunder', minTier: 3 },
  { name: 'เสือสมิง', icon: '🐅', hp: 1.2, atk: 1.25, mag: 0.6, def: 0.9, res: 0.9, spd: 1.3, skills: ['x_claws', 'x_tigerspirit'], weak: 'holy', minTier: 3 },
  { name: 'ยักษ์วัดแจ้ง', icon: '👹', hp: 1.8, atk: 1.3, mag: 0.8, def: 1.2, res: 1, spd: 0.8, skills: ['x_ironfist', 'x_awaken'], weak: 'holy', minTier: 4 },
  { name: 'ปอบ', icon: '🧟', hp: 1.3, atk: 1, mag: 1, def: 1, res: 1, spd: 0.9, skills: ['x_drain', 'x_curse'], weak: 'fire', minTier: 4 },
  { name: 'รถถังร้าง', icon: '🪖', hp: 2.1, atk: 1.2, mag: 0.4, def: 1.7, res: 0.7, spd: 0.6, skills: ['x_cannon', 'x_stonewall'], weak: 'thunder', minTier: 5 },
  { name: 'พญานาคพิโรธ', icon: '🐉', hp: 2, atk: 1.1, mag: 1.4, def: 1.2, res: 1.4, spd: 1, skills: ['x_dragon', 'x_frostnova'], weak: 'ice', minTier: 6 },
  { name: 'แม่ทัพวิญญาณ', icon: '💀', hp: 1.8, atk: 1.3, mag: 1.3, def: 1.2, res: 1.2, spd: 1.05, skills: ['x_deathshadow', 'x_banner', 'x_chains'], weak: 'holy', minTier: 7 },
];

// ---------------- NPC PARTIES ----------------
export const NPC_SEED: { name: string; icon: string; color: string; level: number; fame: number }[] = [
  { name: 'ราชันย์สยาม', icon: '👑', color: '#facc15', level: 24, fame: 6000 },
  { name: 'กองพันพยัคฆ์เหลือง', icon: '🐯', color: '#fb923c', level: 20, fame: 4200 },
  { name: 'อัศวินนาคา', icon: '🐲', color: '#34d399', level: 17, fame: 3000 },
  { name: 'เงามรณะ', icon: '🦇', color: '#a78bfa', level: 15, fame: 2200 },
  { name: 'ดาบคู่ล้านนา', icon: '⚔️', color: '#f87171', level: 12, fame: 1500 },
  { name: 'หมาป่าอีสาน', icon: '🐺', color: '#94a3b8', level: 10, fame: 1000 },
  { name: 'ใบมีดทะเลใต้', icon: '🌊', color: '#38bdf8', level: 8, fame: 650 },
  { name: 'ห้าวหาญพาณิชย์', icon: '💰', color: '#fde047', level: 6, fame: 400 },
  { name: 'ลูกเสือชาวบ้าน', icon: '⛺', color: '#86efac', level: 4, fame: 200 },
  { name: 'มือใหม่หัดรบ', icon: '🐣', color: '#fef08a', level: 2, fame: 80 },
];

export const MEMBER_NAMES = ['สมชาย', 'มานี', 'ปิติ', 'ชูใจ', 'วีระ', 'มาลี', 'ธงชัย', 'สุดา', 'เดชา', 'นภา', 'ก้อง', 'ฟ้า', 'ภูผา', 'ดาว', 'ขุนแผน', 'ทองดี', 'แก้ว', 'อินทร์', 'สายฟ้า', 'จันทร์'];

// ---------------- EQUIPMENT ----------------
const W = ['ดาบเหล็ก', 'ดาบเงิน', 'ดาบเพลิง', 'ดาบมังกร', 'ดาบราชันย์'];
const A = ['เสื้อหนัง', 'เกราะโซ่', 'เกราะเหล็ก', 'เกราะนาค', 'เกราะเทพ'];
const C = ['แหวนทองแดง', 'ตะกรุดเงิน', 'พระเครื่องทอง', 'เขี้ยวเสือ', 'มงกุฎพยัคฆ์'];
export const EQUIPS: EquipItem[] = [];
export const RARITY = [
  { name: 'ธรรมดา', color: '#d6d3c4', mult: 1, prefix: '' },
  { name: 'หายาก', color: '#60a5fa', mult: 1.3, prefix: '✦' },
  { name: 'มหากาพย์', color: '#c084fc', mult: 1.65, prefix: '✦✦' },
];
for (let t = 1; t <= 5; t++) {
  EQUIPS.push({ iid: '', rarity: 0, id: 'w' + t, name: W[t - 1], slot: 'weapon', tier: t, icon: '🗡️', bonus: { atk: 5 * t * t + 3, mag: 5 * t * t + 3 }, price: 60 * t * t + 20 * t });
  EQUIPS.push({ iid: '', rarity: 0, id: 'a' + t, name: A[t - 1], slot: 'armor', tier: t, icon: '🥋', bonus: { def: 4 * t * t + 3, res: 4 * t * t + 3, hp: 25 * t * t }, price: 55 * t * t + 20 * t });
  EQUIPS.push({ iid: '', rarity: 0, id: 'c' + t, name: C[t - 1], slot: 'acc', tier: t, icon: '📿', bonus: { spd: 2 * t + 1, crit: 3 * t, mp: 10 * t }, price: 50 * t * t + 30 * t });
}

export const ITEMS = [
  { id: 'potion', name: 'ยาสมุนไพร', icon: '🧃', desc: 'ฟื้น HP 40%', price: 25 },
  { id: 'hipotion', name: 'ยาหม้อใหญ่', icon: '🍵', desc: 'ฟื้น HP 80%', price: 70 },
  { id: 'ether', name: 'น้ำมนต์มานา', icon: '🔷', desc: 'ฟื้น MP 50%', price: 45 },
  { id: 'phoenix', name: 'ขนนกการเวก', icon: '🪶', desc: 'ชุบชีวิต 50%', price: 140 },
] as const;

export const CITY_BIOME: Record<string, Biome> = {
  cr: 'forest', cm: 'forest', pl: 'forest', bkk: 'plain', pat: 'plain', kan: 'plain', hh: 'plain', ns: 'plain',
  kr: 'dry', kk: 'dry', ud: 'dry', ub: 'dry', sur: 'tropical', phu: 'tropical', hy: 'tropical',
  ayu: 'plain', skt: 'plain', lpg: 'forest', nan: 'forest', loei: 'forest', npm: 'dry', brm: 'dry', cti: 'tropical', cpn: 'tropical', nst: 'tropical', kbi: 'tropical',
};

export type Landmark = 'palace' | 'brickruins' | 'buddhaRuins' | 'goldMountain' | 'whiteTemple' | 'beachTowers' | 'bridge' | 'seaPier' | 'dragonGate' | 'khmer' | 'bigBuddhaGold' | 'dino' | 'boats' | 'lotus' | 'candle' | 'bigBuddhaWhite' | 'lanterns' | 'carriage' | 'crossTemple' | 'misty' | 'tallStupa' | 'stadium' | 'cathedral' | 'coastRock' | 'whiteStupa' | 'karst';
export type CityPerk = 'gear' | 'item' | 'inn' | 'train' | 'xp';
export interface CityInfo { emblem: string; title: string; color: string; wall: number; roofs: number[]; ground: number; landmark: Landmark; perk: CityPerk; desc: string }
export const PERK_INFO: Record<CityPerk, { icon: string; name: string; desc: string }> = {
  gear: { icon: '⚒️', name: 'เมืองช่างตีเหล็ก', desc: 'อุปกรณ์ลดราคา 25%' },
  item: { icon: '🧪', name: 'เมืองสมุนไพร', desc: 'ไอเทมลดราคา 35%' },
  inn: { icon: '🛏️', name: 'เมืองแห่งการพักผ่อน', desc: 'พักโรงเตี๊ยมฟรี' },
  train: { icon: '📖', name: 'เมืองสำนักดาบ', desc: 'สำนักฝึก: โอกาสสกิลหายาก x2' },
  xp: { icon: '⭐', name: 'เมืองนักรบ', desc: 'เควสที่นี่ให้ EXP x1.5' },
};
export const CITY_INFO: Record<string, CityInfo> = {
  bkk: { emblem: '👑', title: 'นครหลวงแห่งราชันย์', color: '#ffcf4a', wall: 0xfff4e0, roofs: [0xe0583a, 0x3aa058, 0xffcf4a], ground: 0x9ad872, landmark: 'palace', perk: 'gear', desc: 'พระบรมมหาราชวังสีทองอร่าม' },
  ayu: { emblem: '🧱', title: 'กรุงเก่าอิฐแดง', color: '#d06a4a', wall: 0xe8b890, roofs: [0xb84a2a, 0xa05a3a], ground: 0xa8d070, landmark: 'brickruins', perk: 'train', desc: 'ซากปรางค์อิฐแดงแห่งอาณาจักรโบราณ' },
  skt: { emblem: '🪷', title: 'รุ่งอรุณแห่งความสุข', color: '#e8d8a8', wall: 0xf0e4c8, roofs: [0x8a7a5a, 0xc0a870], ground: 0xa0d478, landmark: 'buddhaRuins', perk: 'xp', desc: 'พระพุทธรูปใหญ่ท่ามกลางซากโบราณ' },
  cm: { emblem: '🏔️', title: 'กุหลาบแห่งล้านนา', color: '#f0a8c0', wall: 0xf4e0c8, roofs: [0x8a3a2a, 0xa0482a], ground: 0x7cc862, landmark: 'goldMountain', perk: 'item', desc: 'พระธาตุทองบนยอดดอย' },
  cr: { emblem: '🤍', title: 'วิหารสีขาวแห่งทิศเหนือ', color: '#e8f0ff', wall: 0xffffff, roofs: [0xdfe8f8, 0xc0d0e8], ground: 0x7cc862, landmark: 'whiteTemple', perk: 'train', desc: 'วัดขาวประดับกระจกเงินระยิบ' },
  lpg: { emblem: '🐴', title: 'นครรถม้า', color: '#c89a60', wall: 0xf0dcc0, roofs: [0x7a4a2a, 0x9a5a30], ground: 0x88cc66, landmark: 'carriage', perk: 'inn', desc: 'รถม้าและบ้านไม้สักล้านนา' },
  nan: { emblem: '🙏', title: 'เมืองกระซิบรัก', color: '#d890b0', wall: 0xf8ecd8, roofs: [0xd04a3a, 0xe0a030], ground: 0x78c460, landmark: 'crossTemple', perk: 'xp', desc: 'วิหารจตุรมุขภาพจิตรกรรมกระซิบรัก' },
  pl: { emblem: '🌟', title: 'เมืองพระพุทธชินราช', color: '#ffd24a', wall: 0xfff0d8, roofs: [0xc04a2a, 0x2a6ab0], ground: 0x90d06a, landmark: 'bigBuddhaGold', perk: 'item', desc: 'พระพุทธรูปทองคำองค์ใหญ่' },
  ns: { emblem: '🐉', title: 'ประตูสู่มังกรแดง', color: '#e04a3a', wall: 0xffe8d0, roofs: [0xd02a2a, 0xffc020], ground: 0x9ad872, landmark: 'dragonGate', perk: 'gear', desc: 'ซุ้มประตูมังกรจีนแห่งปากน้ำโพ' },
  kan: { emblem: '🌉', title: 'สะพานข้ามแม่น้ำ', color: '#6ab0d8', wall: 0xf0e8d8, roofs: [0x4a7a9a, 0xb05a3a], ground: 0x8ad06a, landmark: 'bridge', perk: 'xp', desc: 'สะพานเหล็กและรถไฟสายมรณะ' },
  hh: { emblem: '🏖️', title: 'วังริมทะเล', color: '#7ad8e8', wall: 0xfffaf0, roofs: [0x3aa0b8, 0xf0f0f0], ground: 0xb0dc80, landmark: 'seaPier', perk: 'inn', desc: 'พระราชวังไม้ริมหาดทรายขาว' },
  pat: { emblem: '🌴', title: 'นครแห่งราตรี', color: '#ff7ac0', wall: 0xf4f4ff, roofs: [0xff6ab0, 0x5ac0f0], ground: 0xa8dc78, landmark: 'beachTowers', perk: 'inn', desc: 'ตึกระฟ้าริมชายหาดสีสดใส' },
  cti: { emblem: '💎', title: 'นครแห่งอัญมณี', color: '#6ae0c0', wall: 0xfaf4ec, roofs: [0x3a8ac0, 0xa04ad0], ground: 0x80d070, landmark: 'cathedral', perk: 'gear', desc: 'มหาวิหารคาทอลิกและตลาดพลอย' },
  kr: { emblem: '🏛️', title: 'ประตูสู่อีสาน', color: '#d8a868', wall: 0xe8d0a8, roofs: [0xa86a3a, 0x8a5a3a], ground: 0xc8d078, landmark: 'khmer', perk: 'train', desc: 'ปราสาทหินพิมายแบบขอม' },
  brm: { emblem: '⚽', title: 'ปราสาทหินและสนามรบ', color: '#4a8ae0', wall: 0xe8d4b0, roofs: [0x3a6ad0, 0xe0e0e0], ground: 0xc8cc70, landmark: 'stadium', perk: 'xp', desc: 'ปราสาทพนมรุ้งและสนามประลองยักษ์' },
  kk: { emblem: '🦖', title: 'ดินแดนไดโนเสาร์', color: '#7ac04a', wall: 0xf4e8d0, roofs: [0x6aa03a, 0xd08030], ground: 0xc0d070, landmark: 'dino', perk: 'item', desc: 'ฟอสซิลไดโนเสาร์ยักษ์กลางเมือง' },
  ud: { emblem: '🌺', title: 'ทะเลบัวแดง', color: '#ff5a8a', wall: 0xfff0f0, roofs: [0xe04a6a, 0x5aa04a], ground: 0xb8d078, landmark: 'lotus', perk: 'inn', desc: 'บึงบัวแดงสุดสายตา' },
  loei: { emblem: '👺', title: 'เมืองผีตาโขนในหมอก', color: '#9a7ae0', wall: 0xf0e8f8, roofs: [0x7a4ad0, 0xe04a4a], ground: 0x78c064, landmark: 'misty', perk: 'train', desc: 'ภูเขาหมอกและหน้ากากผีตาโขน' },
  npm: { emblem: '🌊', title: 'พระธาตุริมโขง', color: '#ffe07a', wall: 0xfff8e8, roofs: [0xd0a030, 0xe06a3a], ground: 0xb8cc72, landmark: 'tallStupa', perk: 'xp', desc: 'พระธาตุพนมขาวทองสูงเสียดฟ้า' },
  ub: { emblem: '🕯️', title: 'นครแห่งเทียนพรรษา', color: '#ffb040', wall: 0xfff0d8, roofs: [0xe0902a, 0xc04a2a], ground: 0xc4ce74, landmark: 'candle', perk: 'gear', desc: 'เทียนพรรษาแกะสลักยักษ์' },
  cpn: { emblem: '🪨', title: 'ประตูสู่ปักษ์ใต้', color: '#5ac0a0', wall: 0xf8f4e8, roofs: [0x3a9a7a, 0xe07a3a], ground: 0x88d070, landmark: 'coastRock', perk: 'item', desc: 'ประภาคารบนโขดหินริมทะเล' },
  sur: { emblem: '🛶', title: 'เมืองคนดีตลาดน้ำ', color: '#4ab0e0', wall: 0xfaf0e0, roofs: [0x2a8ac0, 0xd06a3a], ground: 0x80cc6a, landmark: 'boats', perk: 'item', desc: 'เรือหางยาวและตลาดน้ำคึกคัก' },
  nst: { emblem: '🛕', title: 'นครพระธาตุขาว', color: '#fff8e0', wall: 0xffffff, roofs: [0xd0a030, 0xc04a2a], ground: 0x80d06a, landmark: 'whiteStupa', perk: 'train', desc: 'พระบรมธาตุเจดีย์สีขาวยอดทอง' },
  kbi: { emblem: '⛰️', title: 'ผาหินปูนกลางทะเล', color: '#3ac0b0', wall: 0xfaf4e8, roofs: [0x2aa0a0, 0xe0b040], ground: 0x78cc6a, landmark: 'karst', perk: 'xp', desc: 'ภูเขาหินปูนตั้งตระหง่าน' },
  phu: { emblem: '☸️', title: 'ไข่มุกอันดามัน', color: '#ffffff', wall: 0xfffaf4, roofs: [0x3ab0d0, 0xf0f0f0], ground: 0x88d470, landmark: 'bigBuddhaWhite', perk: 'inn', desc: 'พระใหญ่หินอ่อนขาวบนเขา' },
  hy: { emblem: '🏮', title: 'นครโคมแดงแดนใต้', color: '#ff4a3a', wall: 0xfff0e0, roofs: [0xd02a2a, 0xffc020], ground: 0x80cc6a, landmark: 'lanterns', perk: 'gear', desc: 'ตลาดโคมแดงและศาลเจ้าจีน' },
};

// ---------------- CLASS 2 & ULTIMATES ----------------
export interface Class2Def { id: string; base: ClassId; name: string; en: string; icon: string; color: string; desc: string; mul: Partial<Record<'hp' | 'mp' | 'atk' | 'mag' | 'def' | 'res' | 'spd' | 'crit', number>>; skill: string; ult: string }
export const CLASS2_LEVEL = 10;
export const CLASS2: Record<string, Class2Def> = {
  paladin: { id: 'paladin', base: 'shield', name: 'พาลาดิน', en: 'Paladin', icon: '⚜️', color: '#ffe07a', desc: 'อัศวินศักดิ์สิทธิ์ ป้องกัน + เวทแสง', mul: { hp: 1.12, mag: 1.35, res: 1.2 }, skill: 'y_holynova', ult: 'u_paladin' },
  guardian: { id: 'guardian', base: 'shield', name: 'การ์เดียน', en: 'Guardian', icon: '🏯', color: '#8ab8ff', desc: 'ผู้พิทักษ์เหล็ก ป้องกันสูงสุด', mul: { hp: 1.25, def: 1.35, res: 1.15 }, skill: 'y_ironwall', ult: 'u_guardian' },
  berserk: { id: 'berserk', base: 'berserker', name: 'เบอร์เซิร์กเกอร์', en: 'Berserker', icon: '😡', color: '#ff4a3a', desc: 'นักรบคลั่ง ATK สูงสุด ดูดเลือด', mul: { atk: 1.35, hp: 1.1, crit: 1.3 }, skill: 'y_berserk', ult: 'u_berserk' },
  dragoon: { id: 'dragoon', base: 'berserker', name: 'ดราก้อนไนท์', en: 'Dragon Knight', icon: '🐲', color: '#ff9a3a', desc: 'อัศวินมังกร ดาเมจหมู่ธาตุไฟ', mul: { atk: 1.2, def: 1.15, mag: 1.2 }, skill: 'x_dragon', ult: 'u_dragoon' },
  assassin: { id: 'assassin', base: 'rogue', name: 'แอสแซสซิน', en: 'Assassin', icon: '🗡️', color: '#b06aff', desc: 'นักฆ่าเงา คริติคอลรุนแรง', mul: { atk: 1.25, spd: 1.2, crit: 1.6 }, skill: 'x_ambush', ult: 'u_assassin' },
  ranger: { id: 'ranger', base: 'rogue', name: 'เรนเจอร์', en: 'Ranger', icon: '🏹', color: '#6ad06a', desc: 'พรานธนู โจมตีหลายเป้า', mul: { atk: 1.2, spd: 1.15, hp: 1.1 }, skill: 'x_arrowrain', ult: 'u_ranger' },
  archmage: { id: 'archmage', base: 'blackmage', name: 'อาร์คเมจ', en: 'Archmage', icon: '🌌', color: '#5ab0ff', desc: 'จอมเวทสูงสุด MAG มหาศาล', mul: { mag: 1.4, mp: 1.25 }, skill: 'x_meteor', ult: 'u_archmage' },
  necro: { id: 'necro', base: 'blackmage', name: 'เนโครแมนเซอร์', en: 'Necromancer', icon: '💀', color: '#8a4ad0', desc: 'จอมเวทมืด ดูดพลังชีวิต สาปแช่ง', mul: { mag: 1.25, hp: 1.2, res: 1.15 }, skill: 'x_deathshadow', ult: 'u_necro' },
  bishop: { id: 'bishop', base: 'whitemage', name: 'บิชอป', en: 'Bishop', icon: '✝️', color: '#fff3b0', desc: 'นักบวชสูงสุด ฮีลและชุบชีวิต', mul: { mag: 1.3, mp: 1.3, res: 1.2 }, skill: 'y_sanctuary', ult: 'u_bishop' },
  sage: { id: 'sage', base: 'whitemage', name: 'เซจ', en: 'Sage', icon: '📿', color: '#7ae0d0', desc: 'นักปราชญ์ ฮีล + เวทโจมตี', mul: { mag: 1.3, spd: 1.12, hp: 1.1 }, skill: 'x_manaburst', ult: 'u_sage' },
  smith: { id: 'smith', base: 'merchant', name: 'แบล็กสมิธ', en: 'Blacksmith', icon: '⚒️', color: '#ff8a4a', desc: 'ช่างตีเหล็ก ทุบเกราะ ATK สูง', mul: { atk: 1.3, def: 1.2, hp: 1.1 }, skill: 'x_armorbreak', ult: 'u_smith' },
  alchemist: { id: 'alchemist', base: 'merchant', name: 'อัลเคมิสต์', en: 'Alchemist', icon: '⚗️', color: '#9ae05a', desc: 'นักเล่นแร่ แปรธาตุ พิษและยา', mul: { mag: 1.35, spd: 1.1, mp: 1.2 }, skill: 'y_venomcloud', ult: 'u_alchemist' },
};
export const CLASS2_OF: Record<ClassId, [string, string]> = { shield: ['paladin', 'guardian'], berserker: ['berserk', 'dragoon'], rogue: ['assassin', 'ranger'], blackmage: ['archmage', 'necro'], whitemage: ['bishop', 'sage'], merchant: ['smith', 'alchemist'] };
export const BASE_ULT: Record<ClassId, string> = { shield: 'u_shield', berserker: 'u_berserker', rogue: 'u_rogue', blackmage: 'u_blackmage', whitemage: 'u_whitemage', merchant: 'u_merchant' };
export const ULT_IDS = [...Object.values(BASE_ULT), ...Object.values(CLASS2).map((c) => c.ult)];

export const BIOME_NAME: Record<Biome, string> = { forest: 'ป่าสนภาคเหนือ', plain: 'ทุ่งนาภาคกลาง', dry: 'ที่ราบแห้งแล้งอีสาน', tropical: 'ป่าเขตร้อนภาคใต้' };
export const TARGET_NAME: Record<string, string> = { enemy: 'ศัตรูเดี่ยว', enemies: 'ศัตรูทั้งหมด', random3: 'สุ่ม 3 ครั้ง', ally: 'พันธมิตร 1 คน', allies: 'พันธมิตรทั้งหมด', self: 'ตนเอง', deadAlly: 'พันธมิตรที่ล้ม' };
export const KIND_NAME: Record<string, string> = { phys: 'กายภาพ', mag: 'เวทมนตร์', heal: 'ฟื้นฟู', buff: 'เสริมพลัง', debuff: 'ลดพลัง' };
export const ELEMENT_NAME: Record<string, string> = { phys: 'กายภาพ', fire: 'ไฟ', ice: 'น้ำแข็ง', thunder: 'สายฟ้า', dark: 'มืด', holy: 'แสง', poison: 'พิษ', wind: 'ลม' };

// ---------------- MAP NETWORK (cities + 6 waypoints per road + branches) ----------------
export function inPoly(x: number, y: number, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KIND_INFO: Record<NodeKind, { prefix: string[]; en: string }> = {
  city: { prefix: [''], en: 'City' },
  village: { prefix: ['บ้าน', 'หมู่บ้าน'], en: 'Village' },
  shrine: { prefix: ['วัด', 'ศาลเจ้า'], en: 'Shrine' },
  fort: { prefix: ['ด่าน', 'ป้อม'], en: 'Fort' },
  camp: { prefix: ['ค่ายโจร', 'รังโจร'], en: 'Bandit Camp' },
  ruin: { prefix: ['ซากเมือง', 'โบราณสถาน'], en: 'Ruins' },
  lake: { prefix: ['บึง', 'หนอง'], en: 'Lake' },
};
export const NODE_KIND_INFO: Record<NodeKind, { icon: string; th: string; desc: string; color: string }> = {
  city: { icon: '🏯', th: 'เมืองใหญ่', desc: 'เควส ร้านค้า โรงเตี๊ยม สำนักฝึก', color: '#f6c453' },
  village: { icon: '🏡', th: 'หมู่บ้าน', desc: 'พักฟื้น HP 25% ทุกครั้งที่แวะ', color: '#86efac' },
  shrine: { icon: '⛩️', th: 'ศาลเจ้า', desc: 'ฟื้น MP 60% • ครั้งแรก +ชื่อเสียง', color: '#c4b5fd' },
  fort: { icon: '🏰', th: 'ด่านทหาร', desc: 'ครั้งแรก รับเสบียงยา', color: '#93c5fd' },
  camp: { icon: '⛺', th: 'ค่ายโจร', desc: 'ศึกบังคับ! ชนะได้ทองเพิ่ม (ครั้งเดียว)', color: '#f87171' },
  ruin: { icon: '🏛️', th: 'ซากโบราณ', desc: 'ครั้งแรก ค้นหาสมบัติ / อุปกรณ์', color: '#fcd34d' },
  lake: { icon: '💧', th: 'บึงน้ำ', desc: 'ฟื้น HP 15% และ MP 25%', color: '#67e8f9' },
};
const SUFFIX = ['หนองบัว', 'ดอนแก้ว', 'ป่าตาล', 'โคกสูง', 'นาดี', 'ห้วยทราย', 'สันทราย', 'ทุ่งใหญ่', 'วังน้ำเย็น', 'หัวฝาย', 'ท่าช้าง', 'บึงทอง', 'ป่าแดง', 'เขาหลวง', 'ดงเย็น', 'โพธิ์งาม', 'หินลาด', 'ม่วงหวาน', 'ไผ่ล้อม', 'น้ำใส', 'ดอยงาม', 'ทับทิม', 'ลำพูน', 'หนองหิน', 'ศรีสุข', 'ตะวันแดง', 'เมฆขาว', 'ช้างเผือก', 'ปากน้ำ', 'แม่ริม', 'บ่อทอง', 'สามแยก', 'คลองสวย', 'สายลม', 'พระธาตุ', 'ป่าเหียง', 'นาคราช', 'ดาวเรือง', 'ทองหลาง', 'จันทร์เพ็ญ', 'ไทรงาม', 'กุหลาบ', 'ห้วยหิน', 'มะขามเตี้ย', 'หงส์ทอง', 'บัวแดง', 'ดอนตาล', 'ท่าทราย'];
const KIND_WEIGHT: [NodeKind, number][] = [['village', 34], ['shrine', 14], ['fort', 12], ['camp', 16], ['ruin', 15], ['lake', 9]];

export const NODES: MapNode[] = CITIES.map((c) => ({ id: c.id, name: c.name, en: c.en, kind: 'city' as NodeKind, x: c.x, y: c.y, tier: c.tier, biome: CITY_BIOME[c.id] }));
export const EDGES: [string, string][] = [];
{
  const rnd = mulberry(20240611);
  let nameIdx = 0;
  const pickKind = () => { let r = rnd() * 100; for (const [k, w] of KIND_WEIGHT) { if ((r -= w) < 0) return k; } return 'village' as NodeKind; };
  const roadChains: string[][] = [];
  ROADS.forEach(([a, b], ri) => {
    const A = CITY[a], B = CITY[b];
    const dx = B.x - A.x, dy = B.y - A.y; const len = Math.hypot(dx, dy); const nx = -dy / len, ny = dx / len;
    const bend = (rnd() - 0.5) * len * 0.22;
    const chain = [a];
    const NW = Math.max(3, Math.min(6, Math.round(len / 9)));
    for (let i = 1; i <= NW; i++) {
      const t = i / (NW + 1);
      let off = Math.sin(t * Math.PI) * bend + (rnd() - 0.5) * Math.min(22, len * 0.16);
      let x = 0, y = 0;
      for (let k = 0; k < 8; k++) { x = A.x + dx * t + nx * off; y = A.y + dy * t + ny * off; if (inPoly(x, y, OUTLINE)) break; off *= 0.5; }
      const kind = pickKind();
      const pre = KIND_INFO[kind].prefix[Math.floor(rnd() * KIND_INFO[kind].prefix.length)];
      const id = `w${ri}_${i}`;
      NODES.push({ id, name: `${pre}${SUFFIX[nameIdx++ % SUFFIX.length]}`, en: KIND_INFO[kind].en, kind, x, y, tier: A.tier + (B.tier - A.tier) * t, biome: t < 0.5 ? CITY_BIOME[a] : CITY_BIOME[b] });
      chain.push(id);
    }
    chain.push(b);
    for (let i = 0; i < chain.length - 1; i++) EDGES.push([chain[i], chain[i + 1]]);
    roadChains.push(chain);
  });
  // branch shortcuts between nearby waypoints of different roads
  const wps = NODES.filter((n) => n.kind !== 'city');
  const deg: Record<string, number> = {};
  const has = (a: string, b: string) => EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (const n of wps) {
    if ((deg[n.id] ?? 0) >= 1 || rnd() < 0.35) continue;
    const road = n.id.split('_')[0];
    let best: MapNode | null = null; let bd = 26;
    for (const m of wps) {
      if (m.id.split('_')[0] === road || (deg[m.id] ?? 0) >= 1) continue;
      const d = Math.hypot(m.x - n.x, m.y - n.y);
      if (d < bd && d > 6 && inPoly((m.x + n.x) / 2, (m.y + n.y) / 2, OUTLINE)) { bd = d; best = m; }
    }
    if (best && !has(n.id, best.id)) { EDGES.push([n.id, best.id]); deg[n.id] = 1; deg[best.id] = 1; }
  }
}
export const NODE = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<string, MapNode>;
