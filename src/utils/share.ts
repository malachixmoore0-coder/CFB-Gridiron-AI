/**
 * Share cards.
 *
 * A bettor's group chat is the cheapest acquisition channel there is, so the
 * app draws its own image: a 1080×1350 card (the ratio Instagram and iMessage
 * both treat kindly) with the pick, the model's number and a small wordmark.
 *
 * Web draws to a canvas and hands the browser a download. Native has no canvas
 * here, so it reports back honestly and the UI offers copyable text instead —
 * the same content, one tap further away.
 */
import { Platform } from 'react-native';

export interface CardSpec {
  title: string;
  subtitle: string;
  /** Big centred line — the pick itself. */
  headline: string;
  /** Up to four label/value pairs along the bottom. */
  stats: { label: string; value: string; tone?: 'money' | 'plain' }[];
  footer: string;
  /** Branded cards carry the accent bar and wordmark; basic ones do not. */
  branded: boolean;
}

const BG = '#0A0806';
const INK = '#F6EFE2';
const DIM = '#B5A68A';
const MONEY = '#2FD37A';
const GOLD = '#FFB020';
const WORDMARK = 'CFB GRIDIRON AI';

/** Draw and hand back a PNG. Returns false when the platform cannot draw one. */
export async function shareCard(spec: CardSpec, filename = 'cfb-gridiron-card.png'): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) return false;

  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);

  // A soft money-coloured wash behind the headline so the card reads at thumbnail size.
  const wash = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, W * 0.8);
  wash.addColorStop(0, 'rgba(255,176,32,0.18)');
  wash.addColorStop(1, 'rgba(255,176,32,0)');
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);

  if (spec.branded) {
    g.fillStyle = MONEY;
    g.fillRect(0, 0, W, 14);
  }

  g.textAlign = 'center';
  g.fillStyle = GOLD;
  g.font = '700 30px system-ui, sans-serif';
  g.fillText(spec.title.toUpperCase(), W / 2, 190);

  g.fillStyle = DIM;
  g.font = '600 32px system-ui, sans-serif';
  g.fillText(spec.subtitle, W / 2, 250);

  g.fillStyle = INK;
  const size = spec.headline.length > 18 ? 96 : spec.headline.length > 12 ? 120 : 148;
  g.font = `900 ${size}px system-ui, sans-serif`;
  g.fillText(spec.headline, W / 2, H * 0.5);

  const n = Math.min(spec.stats.length, 4);
  const slot = W / (n || 1);
  spec.stats.slice(0, 4).forEach((s, i) => {
    const x = slot * i + slot / 2;
    g.fillStyle = DIM;
    g.font = '800 24px system-ui, sans-serif';
    g.fillText(s.label.toUpperCase(), x, H * 0.68);
    g.fillStyle = s.tone === 'money' ? MONEY : INK;
    g.font = '900 56px system-ui, sans-serif';
    g.fillText(s.value, x, H * 0.74);
  });

  g.fillStyle = DIM;
  g.font = '600 26px system-ui, sans-serif';
  g.fillText(spec.footer, W / 2, H - 150);

  if (spec.branded) {
    g.fillStyle = MONEY;
    g.font = '900 34px system-ui, sans-serif';
    g.fillText(WORDMARK, W / 2, H - 80);
  }

  const url = c.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** The same card as text, for platforms (and people) that would rather paste. */
export function cardText(spec: CardSpec): string {
  const stats = spec.stats.map((s) => `${s.label}: ${s.value}`).join('  ·  ');
  return `${spec.title}\n${spec.headline}\n${stats}\n${spec.footer}`;
}
