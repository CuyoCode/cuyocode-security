// Re-export de compatibilidad: la validación canónica vive en engine/scope/targets.
export {
  LIMITS,
  ValidationError,
  assertSafeObject,
  assertNoArgs,
  assertSingleArg,
  cleanText,
  cleanLabel,
  validateFolderTarget,
  validateUrlTarget,
  validateServerTarget,
  validateCreateProject,
  validateId,
  newId,
  urlHost,
} from '../../../engine/scope/targets';
