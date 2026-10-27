import { describe, expect, it } from 'vitest';
import {
  ValidationError,
  assertNoArgs,
  validateCreateProject,
  validateId,
} from '../../electron/main/ipc/validation';

describe('validación IPC', () => {
  it('rechaza argumentos en canales sin argumentos', () => {
    expect(() => assertNoArgs([])).not.toThrow();
    expect(() => assertNoArgs(['x'])).toThrow(ValidationError);
  });

  it('rechaza claves de prototipo', () => {
    const evil = JSON.parse('{"__proto__":{"x":1},"name":"a","kind":"url","target":"https://a.com"}');
    expect(() => validateCreateProject(evil)).toThrow(ValidationError);
  });

  it('valida proyecto carpeta inexistente', () => {
    expect(() =>
      validateCreateProject({ name: 'p', kind: 'folder', target: 'relativa/no-absoluta' }),
    ).toThrow(/absoluta/);
    expect(() =>
      validateCreateProject({ name: 'p', kind: 'folder', target: 'C:\\no-existe-xyz-123' }),
    ).toThrow(ValidationError);
  });

  it('valida URLs: esquema, credenciales y host', () => {
    expect(() =>
      validateCreateProject({ name: 'p', kind: 'url', target: 'ftp://a.com' }),
    ).toThrow(/http/);
    expect(() =>
      validateCreateProject({ name: 'p', kind: 'url', target: 'https://user:pass@a.com' }),
    ).toThrow(/credenciales/);
    const ok = validateCreateProject({ name: 'p', kind: 'url', target: 'https://a.com/app' });
    expect(ok.target).toContain('https://a.com');
  });

  it('valida servidores host[:puerto]', () => {
    expect(validateCreateProject({ name: 's', kind: 'server', target: 'srv-lan' }).target).toBe(
      'srv-lan:22',
    );
    expect(validateCreateProject({ name: 's', kind: 'server', target: 'h:2222' }).target).toBe(
      'h:2222',
    );
    expect(() =>
      validateCreateProject({ name: 's', kind: 'server', target: 'h:99999' }),
    ).toThrow(/Puerto/);
    expect(() =>
      validateCreateProject({ name: 's', kind: 'server', target: 'http://h' }),
    ).toThrow(ValidationError);
  });

  it('rechaza nombres vacíos, largos y tipos inválidos', () => {
    expect(() => validateCreateProject({ name: ' ', kind: 'url', target: 'https://a.com' })).toThrow(
      ValidationError,
    );
    expect(() =>
      validateCreateProject({ name: 'x'.repeat(81), kind: 'url', target: 'https://a.com' }),
    ).toThrow(/máximo/);
    expect(() =>
      validateCreateProject({ name: 'p', kind: 'otro', target: 'https://a.com' }),
    ).toThrow(/Tipo/);
  });

  it('valida identificadores', () => {
    expect(() => validateId('../x')).toThrow(ValidationError);
    expect(() => validateId('x'.repeat(65))).toThrow(ValidationError);
    expect(validateId('abc-123-XYZ')).toBe('abc-123-XYZ');
  });
});
