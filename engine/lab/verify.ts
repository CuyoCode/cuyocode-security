// Puerta de aislamiento: las pruebas avanzadas solo corren si el objetivo
// pertenece a un laboratorio verificado. Sin verificación → bloqueo.

import { dockerAvailable, labStatus } from './docker';
import { getNodeLabPort } from './node-manager';

export interface IsolationCheck {
  ok: boolean;
  reasons: string[];
}

/** Verifica que el objetivo sea del laboratorio (loopback publicado por el lab). */
export async function assertLabIsolation(labId: string, target: string): Promise<IsolationCheck> {
  const reasons: string[] = [];
  const avail = await dockerAvailable();
  if (!avail.binary) reasons.push('Docker no instalado');
  else if (!avail.daemon) reasons.push('Daemon Docker no accesible');
  if (reasons.length > 0) return { ok: false, reasons };

  const lab = await labStatus(labId);
  if (!lab) {
    reasons.push(`Laboratorio "${labId}" inexistente o detenido`);
    return { ok: false, reasons };
  }
  if (!/running|up/i.test(lab.status)) {
    reasons.push(`Laboratorio "${labId}" no está en ejecución (${lab.status})`);
    return { ok: false, reasons };
  }
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return { ok: false, reasons: [`Objetivo no URL: ${target}`] };
  }
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    reasons.push(`El objetivo ${url.hostname} no es el loopback publicado por el laboratorio`);
    return { ok: false, reasons };
  }
  return { ok: true, reasons: [`Laboratorio "${labId}" verificado (${lab.image})`] };
}

/**
 * Puerta para laboratorios Node (sin Docker): verifica que el laboratorio esté
 * registrado y vivo en este proceso, que el objetivo sea su loopback+puerto, y
 * que responda. Aislamiento más débil que Docker: mismo SO, por eso solo se
 * admiten datos sintéticos y la app objetivo es código propio auditado.
 */
export async function assertNodeLabIsolation(labId: string, target: string): Promise<IsolationCheck> {
  const port = getNodeLabPort(labId);
  if (!port) {
    return { ok: false, reasons: [`Laboratorio node "${labId}" inexistente o detenido`] };
  }
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return { ok: false, reasons: [`Objetivo no URL: ${target}`] };
  }
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    return { ok: false, reasons: [`El objetivo ${url.hostname} no es el loopback del laboratorio "${labId}"`] };
  }
  const urlPort = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (urlPort !== port) {
    return { ok: false, reasons: [`El puerto ${urlPort} no pertenece al laboratorio "${labId}" (esperado ${port})`] };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    timer.unref?.();
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    await res.arrayBuffer().catch(() => new ArrayBuffer(0));
    if (res.status !== 200) return { ok: false, reasons: [`El laboratorio "${labId}" no responde (estado ${res.status})`] };
  } catch {
    return { ok: false, reasons: [`El laboratorio "${labId}" no responde en 127.0.0.1:${port}`] };
  }
  return { ok: true, reasons: [`Laboratorio node "${labId}" verificado en 127.0.0.1:${port}`] };
}
