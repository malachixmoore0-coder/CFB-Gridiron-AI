import type { Weather } from '../engine/types';

/**
 * A curated sample slate of marquee / rivalry matchups so the Slate tab has
 * something to chew on when no live schedule is loaded. It is NOT a real
 * week's schedule — the pipeline swaps in the actual games.
 */
export interface SlateGame {
  id: string;
  awayId: string;
  homeId: string;
  label: string;
  weather?: Weather;
  primetime?: boolean;
  neutralSite?: boolean;
}

export const SAMPLE_SLATE: SlateGame[] = [
  { id: 'mich-osu', awayId: 'michigan', homeId: 'ohio-state', label: 'The Game', weather: 'cold' },
  { id: 'aub-ala', awayId: 'auburn', homeId: 'alabama', label: 'Iron Bowl', primetime: true },
  { id: 'tex-ou', awayId: 'texas', homeId: 'oklahoma', label: 'Red River Rivalry', neutralSite: true },
  { id: 'uga-fla', awayId: 'georgia', homeId: 'florida', label: "World's Largest Outdoor Cocktail Party", neutralSite: true },
  { id: 'nd-usc', awayId: 'notre-dame', homeId: 'usc', label: 'Jeweled Shillelagh', primetime: true },
  { id: 'ore-wash', awayId: 'oregon', homeId: 'washington', label: 'Cascade Clash', weather: 'rain' },
  { id: 'clem-fsu', awayId: 'clemson', homeId: 'florida-state', label: 'ACC heavyweight bout' },
  { id: 'psu-mich', awayId: 'penn-state', homeId: 'michigan', label: 'Big House in November', weather: 'wind' },
  { id: 'lsu-tamu', awayId: 'lsu', homeId: 'texas-am', label: 'Kyle Field at night', primetime: true },
  { id: 'miss-msst', awayId: 'ole-miss', homeId: 'mississippi-state', label: 'Egg Bowl' },
  { id: 'ttu-byu', awayId: 'texas-tech', homeId: 'byu', label: 'Big 12 title preview', weather: 'cold' },
  { id: 'army-navy', awayId: 'army', homeId: 'navy', label: 'Army–Navy', neutralSite: true },
  { id: 'boise-sdsu', awayId: 'boise-state', homeId: 'san-diego-state', label: 'Group of Five headliner' },
  { id: 'jmu-app', awayId: 'james-madison', homeId: 'app-state', label: 'Sun Belt at The Rock' },
];
