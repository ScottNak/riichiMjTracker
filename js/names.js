// Display names for yaku and dora, in the three languages the app can show.
// Every name lives here and only here; the analyzer returns ids.

export const LANGUAGES = ['jp', 'romaji', 'en'];

export const YAKU_NAMES = {
  riichi:         { jp: '立直', romaji: 'Riichi', en: 'Riichi' },
  doubleRiichi:   { jp: 'ダブル立直', romaji: 'Double Riichi', en: 'Double Riichi' },
  ippatsu:        { jp: '一発', romaji: 'Ippatsu', en: 'One Shot' },
  menzenTsumo:    { jp: 'ツモ', romaji: 'Menzen Tsumo', en: 'Fully Concealed Self-Draw' },
  pinfu:          { jp: '平和', romaji: 'Pinfu', en: 'All Sequences' },
  tanyao:         { jp: '断么九', romaji: 'Tanyao', en: 'All Simples' },
  iipeikou:       { jp: '一盃口', romaji: 'Iipeikou', en: 'Pure Double Sequence' },
  yakuhai:        { jp: '役牌', romaji: 'Yakuhai', en: 'Dragon' },
  seatWind:       { jp: '自風', romaji: 'Jikaze', en: 'Seat Wind' },
  roundWind:      { jp: '場風', romaji: 'Bakaze', en: 'Round Wind' },
  haitei:         { jp: '海底', romaji: 'Haitei', en: 'Last Tile Draw' },
  houtei:         { jp: '河底', romaji: 'Houtei', en: 'Last Tile Discard' },
  rinshan:        { jp: '嶺上開花', romaji: 'Rinshan Kaihou', en: 'After a Kan' },
  chankan:        { jp: '槍槓', romaji: 'Chankan', en: 'Robbing a Kan' },
  chiitoitsu:     { jp: '七対子', romaji: 'Chiitoitsu', en: 'Seven Pairs' },
  chanta:         { jp: '全帯', romaji: 'Chanta', en: 'Half Outside Hand' },
  ittsu:          { jp: '一通', romaji: 'Ittsu', en: 'Pure Straight' },
  sanshokuDoujun: { jp: '三色', romaji: 'Sanshoku Doujun', en: 'Mixed Triple Sequence' },
  sanshokuDoukou: { jp: '三色同刻', romaji: 'Sanshoku Doukou', en: 'Triple Triplets' },
  toitoi:         { jp: '対々', romaji: 'Toitoi', en: 'All Triplets' },
  sanankou:       { jp: '三暗刻', romaji: 'Sanankou', en: 'Three Concealed Triplets' },
  sankantsu:      { jp: '三槓子', romaji: 'Sankantsu', en: 'Three Kans' },
  shousangen:     { jp: '小三元', romaji: 'Shousangen', en: 'Little Three Dragons' },
  honroutou:      { jp: '混老頭', romaji: 'Honroutou', en: 'All Terminals and Honors' },
  honitsu:        { jp: '混一色', romaji: 'Honitsu', en: 'Half Flush' },
  junchan:        { jp: '純全', romaji: 'Junchan', en: 'Fully Outside Hand' },
  ryanpeikou:     { jp: '二盃口', romaji: 'Ryanpeikou', en: 'Twice Pure Double Sequence' },
  chinitsu:       { jp: '清一色', romaji: 'Chinitsu', en: 'Full Flush' },

  kokushi:        { jp: '国士無双', romaji: 'Kokushi Musou', en: 'Thirteen Orphans' },
  kokushi13:      { jp: '国士無双十三面', romaji: 'Kokushi Musou 13-Wait', en: 'Thirteen Orphans, 13-Sided Wait' },
  suuankou:       { jp: '四暗刻', romaji: 'Suuankou', en: 'Four Concealed Triplets' },
  suuankouTanki:  { jp: '四暗刻単騎', romaji: 'Suuankou Tanki', en: 'Four Concealed Triplets, Single Wait' },
  daisangen:      { jp: '大三元', romaji: 'Daisangen', en: 'Big Three Dragons' },
  shousuushii:    { jp: '小四喜', romaji: 'Shousuushii', en: 'Little Four Winds' },
  daisuushii:     { jp: '大四喜', romaji: 'Daisuushii', en: 'Big Four Winds' },
  tsuuiisou:      { jp: '字一色', romaji: 'Tsuuiisou', en: 'All Honors' },
  ryuuiisou:      { jp: '緑一色', romaji: 'Ryuuiisou', en: 'All Green' },
  chinroutou:     { jp: '清老頭', romaji: 'Chinroutou', en: 'All Terminals' },
  chuuren:        { jp: '九蓮宝燈', romaji: 'Chuuren Poutou', en: 'Nine Gates' },
  junseiChuuren:  { jp: '純正九蓮宝燈', romaji: 'Junsei Chuuren Poutou', en: 'True Nine Gates' },
  suukantsu:      { jp: '四槓子', romaji: 'Suukantsu', en: 'Four Kans' },
  tenhou:         { jp: '天和', romaji: 'Tenhou', en: 'Blessing of Heaven' },
  chihou:         { jp: '地和', romaji: 'Chihou', en: 'Blessing of Earth' },

  dora:           { jp: 'ドラ', romaji: 'Dora', en: 'Dora' },
  akaDora:        { jp: '赤ドラ', romaji: 'Aka Dora', en: 'Red Five' },
  uraDora:        { jp: '裏ドラ', romaji: 'Ura Dora', en: 'Ura Dora' },
  nukiDora:       { jp: '抜きドラ', romaji: 'Nuki Dora', en: 'North Dora' },
};

// Honor tile names, indexed from East (tile index 27).
const HONOR_NAMES = {
  jp: ['東', '南', '西', '北', '白', '發', '中'],
  romaji: ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'],
  en: ['East', 'South', 'West', 'North', 'White', 'Green', 'Red'],
};

// Display name for one analyzer yaku entry, e.g. { id: 'yakuhai', han: 1, tile: 31 } -> '役牌 白'
export function yakuName(yaku, language) {
  const name = YAKU_NAMES[yaku.id][language];
  if (yaku.tile === undefined) return name;
  const tileName = HONOR_NAMES[language][yaku.tile - 27];
  return language === 'jp' ? `${name} ${tileName}` : `${name}: ${tileName}`;
}

// Round labels: 東2局 1本場 in Japanese, East 2 + 1 otherwise (romaji uses the English form).
const ROUND_WINDS = { jp: ['東', '南', '西', '北'], en: ['East', 'South', 'West', 'North'] };

export function windName(wind, language) {
  return (language === 'jp' ? ROUND_WINDS.jp : ROUND_WINDS.en)[wind % 4];
}

export function roundLabel(wind, handNumber, honba, language) {
  if (language === 'jp') return `${windName(wind, language)}${handNumber}局${honba ? ` ${honba}本場` : ''}`;
  return `${windName(wind, language)} ${handNumber}${honba ? ` + ${honba}` : ''}`;
}
