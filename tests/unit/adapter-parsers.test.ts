import { describe, expect, it } from 'vitest';
import { parseZapReport } from '../../engine/dynamic/adapters/zap';
import { parseNucleiJsonl } from '../../engine/dynamic/adapters/nuclei';
import { parseNmapXml } from '../../engine/server/adapters/nmap';

const ZAP_JSON = JSON.stringify({
  site: [
    {
      '@name': 'https://objetivo.test',
      alerts: [
        {
          alert: 'X-Content-Type-Options Header Missing',
          riskcode: '1',
          confidence: 'High',
          desc: 'Falta la cabecera.',
          solution: 'Agregar nosniff.',
          reference: 'https://example.com',
          instances: [{ uri: 'https://objetivo.test/', evidence: '' }],
        },
        {
          alert: 'SQL Injection',
          riskcode: '3',
          confidence: 'Medium',
          desc: 'Posible inyección.',
          solution: 'Parametrizar.',
          instances: [{ uri: 'https://objetivo.test/?id=1', evidence: 'error sql' }],
        },
      ],
    },
  ],
});

const NUCLEI_JSONL = [
  JSON.stringify({
    'template-id': 'http-missing-security-headers',
    info: { name: 'Missing Headers', severity: 'info', description: 'desc', reference: ['https://example.com'] },
    'matched-at': 'https://objetivo.test/',
  }),
  'línea corrupta',
  JSON.stringify({
    'template-id': 'cve-2021-44228',
    info: { name: 'Log4Shell', severity: 'critical', description: 'RCE' },
    'matched-at': 'https://objetivo.test/',
  }),
].join('\n');

const NMAP_XML = `<?xml version="1.0"?>
<nmaprun><host><ports>
<port protocol="tcp" portid="22"><state state="open"/><service name="ssh" product="OpenSSH" version="9.5"/></port>
<port protocol="tcp" portid="80"><state state="closed"/><service name="http"/></port>
<port protocol="tcp" portid="443"><state state="open"/><service name="https" product="nginx" version="1.24"/></port>
</ports></host></nmaprun>`;

describe('parsers de adaptadores', () => {
  it('ZAP mapea riesgo y conserva evidencia', () => {
    const out = parseZapReport(ZAP_JSON, 'https://objetivo.test', '2.14');
    expect(out.length).toBe(2);
    expect(out.find((f) => f.severity === 'high')?.title).toContain('SQL Injection');
    expect(out.find((f) => f.severity === 'low')?.source).toBe('zap/2.14');
  });

  it('ZAP rechaza informe corrupto', () => {
    expect(() => parseZapReport('no-json', 'x', '1')).toThrow();
  });

  it('Nuclei parsea JSONL y salta líneas corruptas', () => {
    const out = parseNucleiJsonl(NUCLEI_JSONL, 'https://objetivo.test', '3.3');
    expect(out.length).toBe(2);
    expect(out.find((f) => f.severity === 'critical')?.ruleId).toContain('cve-2021-44228');
  });

  it('Nmap extrae solo puertos con estado', () => {
    const ports = parseNmapXml(NMAP_XML);
    expect(ports.length).toBe(3);
    expect(ports.filter((p) => p.state === 'open').length).toBe(2);
    expect(ports[0]?.service).toBe('ssh');
    expect(ports[0]?.version).toContain('OpenSSH');
  });
});
