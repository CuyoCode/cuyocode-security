import { describe, expect, it } from 'vitest';
import {
  auditStatusLabel,
  displayTarget,
  findingStatusLabel,
  formatDate,
  profileLabel,
  severityLabel,
  shortTarget,
  verificationLabel,
} from '../../src/lib/labels';

describe('etiquetas de presentación', () => {
  it('traduce enums sin inventar valores', () => {
    expect(severityLabel('critical')).toBe('Crítico');
    expect(severityLabel('desconocido')).toBe('desconocido');
    expect(auditStatusLabel('done')).toBe('Completada');
    expect(findingStatusLabel('false-positive')).toBe('Falso positivo');
    expect(verificationLabel('evidence-found')).toBe('Evidencia encontrada');
    expect(profileLabel('local-code-deep')).toBe('Código local profundo');
  });

  it('oculta rutas internas en objetivos de demo', () => {
    expect(displayTarget('C:\\repo\\tests\\fixtures\\vuln-app')).toBe('Fixture sintético (demo)');
    expect(displayTarget('http://127.0.0.1:3117/')).toBe('Laboratorio Node (demo)');
    expect(displayTarget('https://ejemplo.com')).toBe('https://ejemplo.com');
    expect(shortTarget('https://ejemplo.com/' + 'x'.repeat(80), 20)).toHaveLength(20);
  });

  it('formatea fechas inválidas sin romper', () => {
    expect(formatDate('no-es-fecha')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});
