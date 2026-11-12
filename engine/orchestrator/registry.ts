// Registro único de motores: lo usan el proceso principal y la CLI headless.

import type { EngineFn } from './types';
import { reconEngine } from '../static/recon';
import { secretsEngine } from '../static/secrets';
import { depsEngine } from '../static/deps';
import { patternsEngine } from '../static/patterns';
import { gitleaksEngine } from '../static/adapters/gitleaks';
import { semgrepEngine } from '../static/adapters/semgrep';
import { trivyEngine } from '../static/adapters/trivy';
import { httpEngine } from '../dynamic/http';
import { tlsEngine } from '../dynamic/tls';
import { cookiesEngine } from '../dynamic/cookies';
import { nucleiEngine } from '../dynamic/adapters/nuclei';
import { zapBaselineEngine, zapFullEngine } from '../dynamic/adapters/zap';
import { portsEngine } from '../server/ports';
import { nmapEngine } from '../server/adapters/nmap';

export const BASE_ENGINES: Record<string, EngineFn> = {
  'recon': reconEngine,
  'secrets-builtin': secretsEngine,
  'deps-npm-audit': depsEngine,
  'patterns-builtin': patternsEngine,
  'gitleaks': gitleaksEngine,
  'semgrep': semgrepEngine,
  'trivy': trivyEngine,
  'http-passive': httpEngine,
  'tls-check': tlsEngine,
  'cookies-review': cookiesEngine,
  'zap-baseline': zapBaselineEngine,
  'zap-full': zapFullEngine,
  'nuclei-selected': nucleiEngine,
  'ports-tcp': portsEngine,
  'nmap': nmapEngine,
};
