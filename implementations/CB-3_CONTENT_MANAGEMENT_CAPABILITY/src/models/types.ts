export type ContentStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export type FieldType = 
  | 'text' 
  | 'richtext' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'select' 
  | 'multiselect' 
  | 'media' 
  | 'reference' 
  | 'json';

export type MediaType = 'image' | 'video' | 'document' | 'audio';

export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
  localized: boolean;
  options?: string[];
  validations?: Record<string, any>;
  defaultValue?: any;
}

export interface ContentType {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  fields: FieldDefinition[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentItem {
  id: string;
  tenantId: string;
  contentTypeId: string;
  slug: string;
  title: string;
  status: ContentStatus;
  data: Record<string, any>;
  localizedData: Record<string, Record<string, any>>;
  authorId: string;
  publishedAt?: Date;
  publishedVersion?: number;
  currentVersion: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentVersion {
  id: string;
  contentItemId: string;
  version: number;
  data: Record<string, any>;
  localizedData: Record<string, Record<string, any>>;
  authorId: string;
  changeLog?: string;
  createdAt: Date;
}

export interface MediaAsset {
  id: string;
  tenantId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  url: string;
  thumbnailUrl?: string;
  altText?: string;
  caption?: string;
  folderId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaFolder {
  id: string;
  tenantId: string;
  name: string;
  parentId?: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Locale {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  steps: WorkflowStep[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  name: string;
  status: ContentStatus;
  order: number;
  requiredApprovers?: number;
  autoTransition?: boolean;
  notifyRoles?: string[];
}

export interface WorkflowInstance {
  id: string;
  tenantId: string;
  contentItemId: string;
  workflowDefinitionId: string;
  currentStep: number;
  status: WorkflowStatus;
  assignedTo?: string[];
  approvals: WorkflowApproval[];
  comments: WorkflowComment[];
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowApproval {
  stepIndex: number;
  approverId: string;
  approved: boolean;
  comment?: string;
  approvedAt: Date;
}

export interface WorkflowComment {
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface ContentFilter {
  tenantId: string;
  contentTypeId?: string;
  status?: ContentStatus;
  authorId?: string;
  locale?: string;
  search?: string;
}

export interface MediaFilter {
  tenantId: string;
  mediaType?: MediaType;
  folderId?: string;
  search?: string;
}

export interface CreateContentTypeInput {
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  fields: FieldDefinition[];
}

export interface CreateContentItemInput {
  tenantId: string;
  contentTypeId: string;
  slug: string;
  title: string;
  data: Record<string, any>;
  authorId: string;
  localizedData?: Record<string, Record<string, any>>;
}

export interface UpdateContentItemInput {
  title?: string;
  slug?: string;
  data?: Record<string, any>;
  localizedData?: Record<string, Record<string, any>>;
  changeLog?: string;
}
