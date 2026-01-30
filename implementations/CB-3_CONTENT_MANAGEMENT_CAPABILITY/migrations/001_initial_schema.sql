-- CB-3 Content Management Capability - Initial Schema
-- Platform Invariant: INV-002 (Strict Tenant Isolation) - All tables include tenant_id

-- Content Types (schema-driven content structure)
CREATE TABLE IF NOT EXISTS content_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_content_types_tenant ON content_types(tenant_id);
CREATE INDEX idx_content_types_slug ON content_types(tenant_id, slug);

-- Content Items (actual content instances)
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    content_type_id UUID NOT NULL REFERENCES content_types(id) ON DELETE CASCADE,
    slug VARCHAR(500) NOT NULL,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    data JSONB NOT NULL DEFAULT '{}',
    localized_data JSONB NOT NULL DEFAULT '{}',
    author_id VARCHAR(255) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    published_version INTEGER,
    current_version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, content_type_id, slug)
);

CREATE INDEX idx_content_items_tenant ON content_items(tenant_id);
CREATE INDEX idx_content_items_type ON content_items(tenant_id, content_type_id);
CREATE INDEX idx_content_items_status ON content_items(tenant_id, status);
CREATE INDEX idx_content_items_author ON content_items(tenant_id, author_id);
CREATE INDEX idx_content_items_slug ON content_items(tenant_id, slug);

-- Content Versions (version history for rollback)
CREATE TABLE IF NOT EXISTS content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    localized_data JSONB NOT NULL DEFAULT '{}',
    author_id VARCHAR(255) NOT NULL,
    change_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_item_id, version)
);

CREATE INDEX idx_content_versions_item ON content_versions(content_item_id);

-- Media Folders (for organizing media assets)
CREATE TABLE IF NOT EXISTS media_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES media_folders(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, path)
);

CREATE INDEX idx_media_folders_tenant ON media_folders(tenant_id);
CREATE INDEX idx_media_folders_parent ON media_folders(parent_id);

-- Media Assets (images, videos, documents)
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    duration INTEGER,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt_text TEXT,
    caption TEXT,
    folder_id UUID REFERENCES media_folders(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_media_assets_tenant ON media_assets(tenant_id);
CREATE INDEX idx_media_assets_type ON media_assets(tenant_id, media_type);
CREATE INDEX idx_media_assets_folder ON media_assets(tenant_id, folder_id);

-- Locales (supported languages per tenant)
CREATE TABLE IF NOT EXISTS locales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_locales_tenant ON locales(tenant_id);

-- Workflow Definitions (configurable publishing workflows)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);

-- Workflow Instances (active workflow executions)
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    current_step INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    assigned_to JSONB NOT NULL DEFAULT '[]',
    approvals JSONB NOT NULL DEFAULT '[]',
    comments JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_instances_tenant ON workflow_instances(tenant_id);
CREATE INDEX idx_workflow_instances_content ON workflow_instances(content_item_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(tenant_id, status);

-- Seed default workflow for all tenants (system workflow)
INSERT INTO workflow_definitions (id, tenant_id, name, slug, description, steps, is_default)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'system',
    'Standard Publishing',
    'standard-publishing',
    'Standard 3-step workflow: Draft → Review → Publish',
    '[
        {"name": "Draft", "status": "draft", "order": 0, "autoTransition": false},
        {"name": "Review", "status": "in_review", "order": 1, "requiredApprovers": 1, "autoTransition": false, "notifyRoles": ["editor", "admin"]},
        {"name": "Publish", "status": "published", "order": 2, "autoTransition": true}
    ]'::jsonb,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO workflow_definitions (id, tenant_id, name, slug, description, steps, is_default)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'system',
    'Direct Publishing',
    'direct-publishing',
    'Single-step workflow: Direct publish without review',
    '[
        {"name": "Draft", "status": "draft", "order": 0, "autoTransition": false},
        {"name": "Publish", "status": "published", "order": 1, "autoTransition": true}
    ]'::jsonb,
    false
) ON CONFLICT DO NOTHING;

INSERT INTO workflow_definitions (id, tenant_id, name, slug, description, steps, is_default)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'system',
    'Editorial Review',
    'editorial-review',
    'Enhanced workflow: Draft → Editorial Review → Legal Review → Publish',
    '[
        {"name": "Draft", "status": "draft", "order": 0, "autoTransition": false},
        {"name": "Editorial Review", "status": "in_review", "order": 1, "requiredApprovers": 1, "notifyRoles": ["editor"]},
        {"name": "Approval", "status": "approved", "order": 2, "requiredApprovers": 1, "notifyRoles": ["admin"]},
        {"name": "Publish", "status": "published", "order": 3, "autoTransition": true}
    ]'::jsonb,
    false
) ON CONFLICT DO NOTHING;
