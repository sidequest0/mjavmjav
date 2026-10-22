import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
const require = createRequire('/crew/agent/work/7178ea079fc7822f/package.json');
const { chromium, webkit, devices, expect } = require('@playwright/test');
const dir = '/crew/agent/state/job18-evidence';
mkdirSync(dir, { recursive: true });
const results = { startedAt: new Date().toISOString(), commit: 'e580755201ba5fe2b47b3cd3105f9a0d0e067ae0', pairings: [], events: [], browsers: {}, policy: 'After caching and reload, abort every HTTP request (including local); ICE servers [] throughout. Native Chromium getUserMedia with file-backed fake camera, no scanner or SDP injection.' };
const mark = (event, detail = {}) => { const row = { at: new Date().toISOString(), event, ...detail }; results.events.push(row); console.log(JSON.stringify(row)); writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2)); };
const processes = [], contexts = [];
async function instrument(context) {
  await context.addInitScript(() => {
    window.evidenceDocument = crypto.randomUUID(); window.evidencePeers = []; window.evidenceChannels = []; window.evidenceCamera = [];
    const NativePC = window.RTCPeerConnection;
    function observe(channel) { const item = { channel, openAt: null }; window.evidenceChannels.push(item); channel.addEventListener('open', () => { item.openAt = performance.now(); }); }
    window.RTCPeerConnection = class extends NativePC {
      constructor(config) { super(config); window.evidencePeers.push(this); this.addEventListener('datachannel', ({ channel }) => observe(channel)); }
      createDataChannel(...args) { const channel = super.createDataChannel(...args); observe(channel); return channel; }
    };
    const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => { const stream = await native(constraints); window.evidenceCamera.push({ constraints, stream }); return stream; };
  });
}
async function phone(engine, profile, file, label) {
  const args = engine === chromium ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${file}`] : [];
  const browser = await engine.launch({ args }); processes.push(browser); results.browsers[label] = { version: browser.version(), profile };
  const context = await browser.newContext({ ...devices[profile], recordVideo: { dir: `${dir}/raw-video`, size: { width: 412, height: 850 } } });
  contexts.push(context); await instrument(context);
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', err => mark('page-error', { label, message: err.message }));
  await page.goto('http://127.0.0.1:8791/nearby');
  await expect(page.locator('#offline-ready')).toContainText('Saved for offline play');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.route('**/*', route => { mark('http-blocked', { label, url: route.request().url() }); return route.abort(); });
  await page.reload(); await expect(page.locator('#make-code')).toBeVisible();
  const document = await page.evaluate(() => window.evidenceDocument);
  mark('cached-reload', { label, document });
  return { browser, context, page, file, label, document, video: page.video() };
}
async function cameraFile(source, file) {
  const png = `${file}.png`;
  await source.locator('#pair-qr').screenshot({ path: png });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-vf', 'scale=640:640:flags=neighbor,pad=960:960:160:160:white', '-pix_fmt', 'yuv420p', '-r', '10', '-frames:v', '1', file]);
}
async function scan(source, target) { await cameraFile(source.page, target.file); await target.page.locator('#scan-code').click(); }
async function pair(host, guest, iteration) {
  mark('pair-start', { iteration });
  await host.page.locator('#make-code').click(); await expect(host.page.locator('#pair-qr')).toBeVisible();
  await cameraFile(host.page, guest.file);
  const start = performance.now();
  const firstScanClock = await guest.page.evaluate(() => performance.now());
  await guest.page.locator('#scan-code').click();
  await expect(guest.page.locator('#pair-qr')).toBeVisible();
  await scan(guest, host);
  for (const p of [host, guest]) await expect(p.page.locator('#pair-status')).toHaveText('Two nearby cats connected.', { timeout: 30000 });
  const elapsedMs = Math.round(performance.now() - start);
  const secondScanToChannelMs = await host.page.evaluate(() => ({ openAt: window.evidenceChannels.at(-1).openAt }));
  const info = [];
  for (const p of [host, guest]) info.push(await p.page.evaluate(() => ({ iceServers: window.evidencePeers.at(-1).getConfiguration().iceServers, candidates: window.evidencePeers.at(-1).localDescription.sdp.split('\r\n').filter(x => x.startsWith('a=candidate:')).map(x => ({ type: x.match(/typ (\S+)/)?.[1], mdns: x.includes('.local') })), cameraRequests: window.evidenceCamera.length, tracksEnded: window.evidenceCamera.every(x => x.stream.getTracks().every(t => t.readyState === 'ended')), document: window.evidenceDocument })));
  expect(elapsedMs).toBeLessThan(30000); for (const p of info) { expect(p.iceServers).toEqual([]); expect(p.tracksEnded).toBe(true); }
  const result = { iteration, elapsedMs, measure: 'guest first scan click through both connected UI states; includes reply QR screenshot/file conversion, second scan and browser assertion overhead', peers: info };
  results.pairings.push(result); mark('pair-connected', result);
}
async function dropAndReset(host, guest) {
  mark('real-drop-start');
  await guest.page.evaluate(() => window.evidencePeers.at(-1).close());
  for (const p of [host, guest]) {
    await expect(p.page.locator('#pair-status')).toContainText('Connection dropped', { timeout: 15000 });
    await expect(p.page.locator('#nearby-play')).toBeDisabled();
  }
  mark('real-drop-both-shown');
  for (const p of [host, guest]) { await p.page.locator('#pair-again').click(); expect(await p.page.evaluate(() => window.evidenceDocument)).toBe(p.document); }
}
async function lock(page, cell) {
  await page.locator('#bonk-throw').click(); await page.locator(`#bonk-map button[data-cell="${cell}"]`).click(); await page.locator('#bonk-lock').click();
  await expect(page.locator('#bonk-lock')).toHaveText('plan locked ✓');
}
try {
  const host = await phone(chromium, 'Pixel 7', `${dir}/host.y4m`, 'host');
  const guest = await phone(chromium, 'Pixel 7', `${dir}/guest.y4m`, 'guest');
  for (let iteration = 1; iteration <= 5; iteration++) {
    await pair(host, guest, iteration);
    if (iteration === 1) {
      mark('full-game-start');
      await host.page.locator('#nearby-play').click(); await guest.page.locator('#nearby-play').click();
      for (let turn = 1; turn <= 3; turn++) {
        await expect(host.page.locator('#bonk-status')).toContainText(`Turn ${turn}/8`, { timeout: 12000 });
        await lock(host.page, 35); await lock(guest.page, 0);
        await expect(host.page.locator('#bonk-status')).toHaveText('The fish have landed.', { timeout: 12000 });
      }
      for (const p of [host, guest]) await expect(p.page.locator('#round-status')).toContainText('Round over. Both cats got bonked!', { timeout: 6000 });
      mark('full-game-complete', { result: 'Both cats got bonked after three played turns; terminal round-over on both screens' });
      await Promise.all([host.page.screenshot({path:`${dir}/host-game.png`}),guest.page.screenshot({path:`${dir}/guest-game.png`})]);
    }
    if (iteration < 5) await dropAndReset(host, guest);
  }
  results.worstMs = Math.max(...results.pairings.map(x => x.elapsedMs));
  await host.context.close(); await guest.context.close();
  await host.video.saveAs(`${dir}/chromium-host.webm`); await guest.video.saveAs(`${dir}/chromium-guest.webm`);
  await host.browser.close(); await guest.browser.close();
  mark('chromium-complete', { worstMs: results.worstMs });
} catch (error) {
  mark('failure', { message: error.stack }); process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  for (const browser of processes) await browser.close().catch(() => {});
  writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2));
}
