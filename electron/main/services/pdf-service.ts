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
      margins: { top: 12000, bottom: 12000, left: 12000, right: 12000 },
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
