import { Rule } from './types';
import { licenseHeaderRule, binaryFileRule } from './category/license';
import { macroKeywordRule, preprocessorPairingRule, usingBeforeIncludeRule, includeInExternCRule, externDeclarationRule } from './category/preprocessor';
import { allocaRule, reallocRule, unsafeMemFuncRule, sensitiveMemoryRule, memAllocValidationRule, sizeofPointerRule } from './category/memory';
import { checkSecureFuncReturnRule, destMaxAndCountRule, destMaxCorrectRule, wrapSecureFuncRule, macroRenameSecureFuncRule, secureLibraryRule, customSecureFunctionRule } from './category/functions';
import { unsafeAlgorithmRule, externalDataProcessStartRule, stdStringForSensitiveRule, formatStringRule, formatTypeMismatchRule, exitFuncRule, killProcessRule, raceconditionRule, publicAddressRule, randSecurityRule, bufferSizeRule, tempFileSharedDirRule, generalUnsafeFuncRule } from './category/security';
import { doubleIncrementRule, divisionByZeroRule, integerWideningRule } from './category/expressions';
import { safeLoopExitRule, assertRuntimeRule } from './category/control';
import { oversizedHeaderRule, oversizedSourceRule, oversizedFunctionRule, oversizedNestingRule, oversizedComplexityRule } from './category/fileMetrics';
import { warningSuppressRule, redundantCodeRule, duplicateCodeRule } from './category/duplicates';
import { duplicateFileRule, oversizedDirectoryRule } from './category/workspace';

export const ALL_RULES: Rule[] = [
  // Fatal
  licenseHeaderRule,
  unsafeAlgorithmRule,
  externalDataProcessStartRule,
  // Error (严重)
  macroKeywordRule,
  stdStringForSensitiveRule,
  destMaxAndCountRule,
  formatStringRule,
  usingBeforeIncludeRule,
  destMaxCorrectRule,
  binaryFileRule,
  sensitiveMemoryRule,
  bufferSizeRule,
  tempFileSharedDirRule,
  formatTypeMismatchRule,
  doubleIncrementRule,
  exitFuncRule,
  includeInExternCRule,
  externDeclarationRule,
  allocaRule,
  wrapSecureFuncRule,
  killProcessRule,
  secureLibraryRule,
  reallocRule,
  preprocessorPairingRule,
  divisionByZeroRule,
  publicAddressRule,
  memAllocValidationRule,
  // Warning (一般)
  macroRenameSecureFuncRule,
  oversizedHeaderRule,
  checkSecureFuncReturnRule,
  duplicateFileRule,
  warningSuppressRule,
  randSecurityRule,
  oversizedDirectoryRule,
  unsafeMemFuncRule,
  assertRuntimeRule,
  oversizedSourceRule,
  oversizedNestingRule,
  sizeofPointerRule,
  redundantCodeRule,
  oversizedFunctionRule,
  customSecureFunctionRule,
  raceconditionRule,
  oversizedComplexityRule,
  integerWideningRule,
  generalUnsafeFuncRule,
  duplicateCodeRule,
  // Info (建议)
  safeLoopExitRule,
];
