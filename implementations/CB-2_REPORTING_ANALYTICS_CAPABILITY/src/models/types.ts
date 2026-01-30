export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type Granularity = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
export type AggregationType = 'sum' | 'count' | 'avg' | 'min' | 'max';
export type WidgetType = 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'kpi_card';
export type ExportFormat = 'csv' | 'excel' | 'pdf';
export type ReportType = 'standard' | 'custom' | 'scheduled';

export interface Metric {
  id: string;
  tenantId: string;
  metricType: MetricType;
  metricName: string;
  value: number;
  dimensions: Record<string, string>;
  timestamp: Date;
  source?: string;
  createdAt: Date;
}

export interface Aggregation {
  id: string;
  tenantId: string;
  aggregationType: AggregationType;
  metricName: string;
  periodStart: Date;
  periodEnd: Date;
  granularity: Granularity;
  dimensions: Record<string, string>;
  sumValue: number;
  countValue: number;
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportDefinition {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  reportType: ReportType;
  config: ReportConfig;
  isSystem: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportConfig {
  metrics: string[];
  dimensions?: string[];
  filters?: QueryFilter[];
  groupBy?: string[];
  orderBy?: OrderBy[];
  limit?: number;
  dateRange?: DateRange;
  visualization?: WidgetType;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'between';
  value: unknown;
}

export interface OrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DateRange {
  start?: Date | string;
  end?: Date | string;
  preset?: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'this_year';
}

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  layout: WidgetLayout[];
  widgets: Widget[];
  isDefault: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetLayout {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Widget {
  id: string;
  tenantId: string;
  name: string;
  widgetType: WidgetType;
  config: WidgetConfig;
  dataSource: DataSource;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetConfig {
  title?: string;
  subtitle?: string;
  colors?: string[];
  showLegend?: boolean;
  showLabels?: boolean;
  format?: string;
  columns?: TableColumn[];
  thresholds?: Threshold[];
}

export interface TableColumn {
  field: string;
  header: string;
  format?: string;
  width?: number;
}

export interface Threshold {
  value: number;
  color: string;
  label?: string;
}

export interface DataSource {
  type: 'metric' | 'aggregation' | 'report' | 'query';
  metricName?: string;
  reportId?: string;
  query?: QueryOptions;
}

export interface QueryOptions {
  metrics: string[];
  dimensions?: string[];
  filters?: QueryFilter[];
  groupBy?: string[];
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
  dateRange?: DateRange;
  granularity?: Granularity;
}

export interface QueryResult {
  data: Record<string, unknown>[];
  metadata: {
    totalCount: number;
    limit: number;
    offset: number;
    executionTime: number;
  };
}

export interface ReportExecution {
  id: string;
  tenantId: string;
  reportDefinitionId: string;
  executedBy?: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultData?: Record<string, unknown>;
  exportUrl?: string;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}
