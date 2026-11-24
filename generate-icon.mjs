import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(directory, 'assets', 'Logo.svg');
const assets = path.join(directory, 'assets');
const pngPath = path.join(assets, 'icon.png');
const icoPath = path.join(assets, 'icon.ico');

await mkdir(assets, { recursive: true });
const svg = await readFile(source);
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
await writeFile(pngPath, png);
await writeFile(icoPath, await pngToIco(pngPath));
