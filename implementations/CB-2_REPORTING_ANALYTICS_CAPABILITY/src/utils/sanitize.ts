const ALLOWED_GRANULARITIES = ['minute', 'hour', 'day', 'week', 'month', 'year'];
const ALLOWED_METRIC_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const ALLOWED_DIMENSION_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const ALLOWED_FIELD_PATTERN = /^(dimensions\.)?[a-zA-Z][a-zA-Z0-9_]*$/;
const ALLOWED_ORDER_DIRECTIONS = ['asc', 'desc'];

export function sanitizeIdentifier(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '');
  return sanitized;
}

export function validateGranularity(granularity: string): boolean {
  return ALLOWED_GRANULARITIES.includes(granularity);
}

export function validateMetricName(metricName: string): boolean {
  return ALLOWED_METRIC_PATTERN.test(metricName);
}

export function validateDimensionKey(key: string): boolean {
  return ALLOWED_DIMENSION_PATTERN.test(key);
}

export function validateFieldName(field: string): boolean {
  return ALLOWED_FIELD_PATTERN.test(field);
}

export function validateOrderDirection(direction: string): boolean {
  return ALLOWED_ORDER_DIRECTIONS.includes(direction.toLowerCase());
}

export function sanitizeMetricNames(metrics: string[]): string[] {
  return metrics.filter(m => validateMetricName(m)).map(m => sanitizeIdentifier(m));
}

export function sanitizeGroupByFields(fields: string[]): string[] {
  return fields.filter(f => validateFieldName(f));
}

export function extractDimensionKey(field: string): string | null {
  if (field.startsWith('dimensions.')) {
    const key = field.replace('dimensions.', '');
    if (validateDimensionKey(key)) {
      return sanitizeIdentifier(key);
    }
    return null;
  }
  return null;
}

export function validateTenantId(tenantId: string): boolean {
  if (!tenantId || typeof tenantId !== 'string') {
    return false;
  }
  if (tenantId.length > 255) {
    return false;
  }
  const pattern = /^[a-zA-Z0-9_-]+$/;
  return pattern.test(tenantId);
}
