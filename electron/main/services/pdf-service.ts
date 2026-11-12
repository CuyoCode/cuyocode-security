// Exportación PDF real: renderiza el informe HTML en una ventana oculta y
// usa Chromium printToPDF. Sin dependencias externas.

import { BrowserWindow } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function exportPdf(html: string): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-pdf-'));
  const file = path.join(dir, 'report.html');
  fs.writeFileSync(file, html, 'utf8');
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await win.loadFile(file);
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      landscape: false,
      // Electron documenta los márgenes en pulgadas (0.5 in ≈ 1.27 cm).
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
  } finally {
    try {
      win.destroy();
    } catch {
      /* ya cerrada */
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
