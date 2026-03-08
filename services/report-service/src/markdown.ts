import Handlebars from 'handlebars';
import type { Report } from '@shire/shared-types';

const REPORT_TEMPLATE = `# {{title}}

**Version:** {{version}} | **Status:** {{status}}

## Executive Summary

{{sections.executiveSummary}}

{{#if sections.architectureOverview}}
## Architecture Overview

{{sections.architectureOverview}}

{{/if}}
{{#if sections.problems.length}}
## Problems

{{#each sections.problems}}
### {{this.title}}

- **Severity:** {{this.severity}}
- **Description:** {{this.description}}
{{#if this.impact}}- **Impact:** {{this.impact}}{{/if}}

{{/each}}
{{/if}}
{{#if sections.recommendations.length}}
## Recommendations

{{#each sections.recommendations}}
### {{this.title}}

- **Priority:** {{this.priority}}
- **Description:** {{this.description}}
{{#if this.effort}}- **Effort:** {{this.effort}}{{/if}}

{{/each}}
{{/if}}
{{#if sections.actionPlan.length}}
## Action Plan

| Step | Title | Description | Responsible | Deadline |
|------|-------|-------------|-------------|----------|
{{#each sections.actionPlan}}
| {{this.step}} | {{this.title}} | {{this.description}} | {{#if this.responsible}}{{this.responsible}}{{else}}-{{/if}} | {{#if this.deadline}}{{this.deadline}}{{else}}-{{/if}} |
{{/each}}

{{/if}}
`;

const compiledTemplate = Handlebars.compile(REPORT_TEMPLATE);

export function generateMarkdown(report: Report): string {
  return compiledTemplate(report).trim();
}
