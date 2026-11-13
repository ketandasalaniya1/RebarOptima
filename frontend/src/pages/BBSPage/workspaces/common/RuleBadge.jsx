import React from 'react';
import { RULE_CLASSIFICATION } from './ruleConstants.js';

export { RULE_CLASSIFICATION };

export default function RuleBadge({ classification, source, note }) {
  let label = 'Designer Value';
  let badgeClass = 'bbs-rule-badge-designer';
  let title = note || 'Specified directly by structural designer';

  switch (classification) {
    case RULE_CLASSIFICATION.VERIFIED_STATUTORY_RULE:
      label = '✓ Statutory Rule';
      badgeClass = 'bbs-rule-badge-code';
      title = source ? `Statutory Mandate: ${source}` : 'Statutory Code Mandate';
      break;
    case RULE_CLASSIFICATION.PURE_GEOMETRIC_MATH:
      label = '📐 Geometric Math';
      badgeClass = 'bbs-rule-badge-math';
      title = source || 'Exact Euclidean Centerline Geometry';
      break;
    case RULE_CLASSIFICATION.SITE_PRACTICE_ASSUMPTION:
      label = '⚠ Site Practice';
      badgeClass = 'bbs-rule-badge-assumption';
      title = note || 'Empirical site fabrication practice (overridable)';
      break;
    case RULE_CLASSIFICATION.PROJECT_SPECIFIC_REQUIREMENT:
      label = '📋 Project Spec';
      badgeClass = 'bbs-rule-badge-spec';
      title = note || 'Project contractual specification';
      break;
    case RULE_CLASSIFICATION.SOFTWARE_IMPLEMENTATION_ASSUMPTION:
      label = '💻 Software Assumption';
      badgeClass = 'bbs-rule-badge-assumption';
      title = note || 'Software layout assumption — requires designer review';
      break;
    case RULE_CLASSIFICATION.UNVERIFIED_DO_NOT_IMPLEMENT_AS_APPROVED_RULE:
      label = '❌ Unverified Rule';
      badgeClass = 'bbs-rule-badge-unverified';
      title = 'Unverified rule — DO NOT implement as approved rule without designer verification';
      break;
    case RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE:
    default:
      label = '⚙ Designer Value';
      badgeClass = 'bbs-rule-badge-designer';
      break;
  }

  return (
    <span className={`bbs-rule-badge ${badgeClass}`} title={title}>
      {label}
    </span>
  );
}
