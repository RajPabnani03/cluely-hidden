/**
 * Browser stand-in for `@tauri-apps/api/core`.
 * Loaded via vite alias only when running `npm run dev:browser`.
 */
import { handleInvoke } from "./bus";

export type InvokeArgs = Record<string, unknown>;

export async function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  return handleInvoke<T>(cmd, args);
}

/** Generated placeholder used in place of real screen captures. */
function placeholderImage(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <rect width="1440" height="900" fill="hsl(${hue},18%,9%)"/>
  <rect x="40" y="36" width="860" height="560" rx="12" fill="hsl(${hue},22%,14%)" stroke="hsl(${hue},20%,26%)"/>
  <rect x="40" y="36" width="860" height="30" rx="12" fill="hsl(${hue},20%,18%)"/>
  <circle cx="62" cy="51" r="5" fill="#f87171"/><circle cx="80" cy="51" r="5" fill="#fbbf24"/><circle cx="98" cy="51" r="5" fill="#34d399"/>
  <rect x="120" y="46" width="300" height="10" rx="5" fill="hsl(${hue},18%,28%)"/>
  <rect x="64" y="90" width="420" height="14" rx="7" fill="hsl(${hue},30%,30%)"/>
  <rect x="64" y="118" width="560" height="10" rx="5" fill="hsl(${hue},18%,24%)"/>
  <rect x="64" y="140" width="500" height="10" rx="5" fill="hsl(${hue},18%,24%)"/>
  <rect x="64" y="162" width="620" height="10" rx="5" fill="hsl(${hue},18%,24%)"/>
  <rect x="64" y="196" width="180" height="26" rx="13" fill="hsl(${(hue + 140) % 360},60%,40%)"/>
  <rect x="930" y="36" width="470" height="300" rx="12" fill="hsl(${(hue + 20) % 360},22%,16%)" stroke="hsl(${hue},20%,26%)"/>
  <circle cx="1165" cy="140" r="42" fill="hsl(${(hue + 40) % 360},45%,38%)"/>
  <rect x="1050" y="200" width="230" height="12" rx="6" fill="hsl(${hue},25%,32%)"/>
  <rect x="1090" y="224" width="150" height="10" rx="5" fill="hsl(${hue},18%,26%)"/>
  <rect x="930" y="356" width="470" height="240" rx="12" fill="hsl(${hue},22%,13%)" stroke="hsl(${hue},20%,26%)"/>
  <rect x="954" y="380" width="200" height="12" rx="6" fill="hsl(${hue},28%,34%)"/>
  <rect x="954" y="406" width="400" height="8" rx="4" fill="hsl(${hue},18%,22%)"/>
  <rect x="954" y="424" width="380" height="8" rx="4" fill="hsl(${hue},18%,22%)"/>
  <rect x="954" y="442" width="410" height="8" rx="4" fill="hsl(${hue},18%,22%)"/>
  <rect x="954" y="460" width="340" height="8" rx="4" fill="hsl(${hue},18%,22%)"/>
  <rect x="40" y="620" width="1360" height="240" rx="12" fill="hsl(${hue},20%,12%)" stroke="hsl(${hue},20%,24%)"/>
  <text x="700" y="750" font-family="monospace" font-size="20" fill="hsl(${hue},25%,45%)" text-anchor="middle">mock screen capture</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Mirror of Tauri's convertFileSrc — here every path maps to a generated image. */
export function convertFileSrc(filePath: string): string {
  return placeholderImage(filePath);
}
