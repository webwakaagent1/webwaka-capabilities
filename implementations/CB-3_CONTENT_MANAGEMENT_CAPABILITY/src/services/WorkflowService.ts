import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { 
  WorkflowDefinition, 
  WorkflowInstance, 
  WorkflowStep,
  WorkflowApproval,
  WorkflowComment,
  WorkflowStatus,
  ContentStatus 
} from '../models/types';
import { contentItemService } from './ContentItemService';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowService {
  async createWorkflowDefinition(
    tenantId: string,
    name: string,
    slug: string,
    steps: WorkflowStep[],
    description?: string,
    isDefault = false
  ): Promise<WorkflowDefinition> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (isDefault) {
        await client.query(
          'UPDATE workflow_definitions SET is_default = FALSE WHERE tenant_id = $1',
          [tenantId]
        );
      }

      this.validateSteps(steps);

      const id = uuidv4();
      const result = await client.query(
        `INSERT INTO workflow_definitions (id, tenant_id, name, slug, description, steps, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, tenantId, name, slug, description || null, JSON.stringify(steps), isDefault]
      );

      await client.query('COMMIT');
      const workflow = this.mapRowToWorkflowDefinition(result.rows[0]);
      logger.info('Workflow definition created', { id: workflow.id, tenantId, slug });
      return workflow;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWorkflowDefinition(id: string, tenantId: string): Promise<WorkflowDefinition | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM workflow_definitions 
         WHERE id = $1 AND (tenant_id = $2 OR tenant_id = 'system')`,
        [id, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToWorkflowDefinition(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getDefaultWorkflow(tenantId: string): Promise<WorkflowDefinition | null> {
    const client = await pool.connect();
    try {
      let result = await client.query(
        'SELECT * FROM workflow_definitions WHERE tenant_id = $1 AND is_default = TRUE',
        [tenantId]
      );
      
      if (result.rows.length === 0) {
        result = await client.query(
          "SELECT * FROM workflow_definitions WHERE tenant_id = 'system' AND is_default = TRUE"
        );
      }
      
      return result.rows.length > 0 ? this.mapRowToWorkflowDefinition(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async listWorkflowDefinitions(tenantId: string): Promise<WorkflowDefinition[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM workflow_definitions 
         WHERE tenant_id = $1 OR tenant_id = 'system'
         ORDER BY is_default DESC, name ASC`,
        [tenantId]
      );
      return result.rows.map(this.mapRowToWorkflowDefinition);
    } finally {
      client.release();
    }
  }

  async startWorkflow(
    tenantId: string,
    contentItemId: string,
    workflowDefinitionId?: string,
    assignedTo?: string[]
  ): Promise<WorkflowInstance> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let workflowDef: WorkflowDefinition | null;
      if (workflowDefinitionId) {
        workflowDef = await this.getWorkflowDefinition(workflowDefinitionId, tenantId);
      } else {
        workflowDef = await this.getDefaultWorkflow(tenantId);
      }

      if (!workflowDef) {
        throw new Error('Workflow definition not found');
      }

      const existingResult = await client.query(
        `SELECT id FROM workflow_instances 
         WHERE content_item_id = $1 AND tenant_id = $2 AND status IN ('pending', 'in_progress')`,
        [contentItemId, tenantId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('Content already has an active workflow');
      }

      const id = uuidv4();
      const result = await client.query(
        `INSERT INTO workflow_instances 
         (id, tenant_id, content_item_id, workflow_definition_id, current_step, status, assigned_to)
         VALUES ($1, $2, $3, $4, 0, 'in_progress', $5)
         RETURNING *`,
        [id, tenantId, contentItemId, workflowDef.id, JSON.stringify(assignedTo || [])]
      );

      const firstStep = workflowDef.steps[0];
      if (firstStep) {
        await contentItemService.updateStatus(contentItemId, tenantId, firstStep.status);
      }

      await client.query('COMMIT');
      const instance = this.mapRowToWorkflowInstance(result.rows[0]);
      logger.info('Workflow started', { id: instance.id, tenantId, contentItemId });
      return instance;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWorkflowInstance(id: string, tenantId: string): Promise<WorkflowInstance | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM workflow_instances WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToWorkflowInstance(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getActiveWorkflowForContent(contentItemId: string, tenantId: string): Promise<WorkflowInstance | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM workflow_instances 
         WHERE content_item_id = $1 AND tenant_id = $2 AND status IN ('pending', 'in_progress')
         ORDER BY created_at DESC LIMIT 1`,
        [contentItemId, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToWorkflowInstance(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async approveStep(
    instanceId: string,
    tenantId: string,
    approverId: string,
    approved: boolean,
    comment?: string
  ): Promise<WorkflowInstance | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const instance = await this.getWorkflowInstance(instanceId, tenantId);
      if (!instance) {
        await client.query('ROLLBACK');
        return null;
      }

      if (instance.status !== 'in_progress') {
        throw new Error('Workflow is not in progress');
      }

      const workflowDef = await this.getWorkflowDefinition(instance.workflowDefinitionId, tenantId);
      if (!workflowDef) {
        throw new Error('Workflow definition not found');
      }

      const currentStep = workflowDef.steps[instance.currentStep];
      const approval: WorkflowApproval = {
        stepIndex: instance.currentStep,
        approverId,
        approved,
        comment,
        approvedAt: new Date(),
      };

      const approvals = [...instance.approvals, approval];

      if (!approved) {
        await client.query(
          `UPDATE workflow_instances 
           SET status = 'rejected', approvals = $1, updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3`,
          [JSON.stringify(approvals), instanceId, tenantId]
        );

        await contentItemService.updateStatus(instance.contentItemId, tenantId, 'draft');
        await client.query('COMMIT');
        return this.getWorkflowInstance(instanceId, tenantId);
      }

      const stepApprovals = approvals.filter(a => a.stepIndex === instance.currentStep && a.approved);
      const requiredApprovers = currentStep.requiredApprovers || 1;

      if (stepApprovals.length >= requiredApprovers) {
        const nextStepIndex = instance.currentStep + 1;
        
        if (nextStepIndex >= workflowDef.steps.length) {
          await client.query(
            `UPDATE workflow_instances 
             SET status = 'completed', current_step = $1, approvals = $2, completed_at = NOW(), updated_at = NOW()
             WHERE id = $3 AND tenant_id = $4`,
            [nextStepIndex - 1, JSON.stringify(approvals), instanceId, tenantId]
          );

          await contentItemService.updateStatus(instance.contentItemId, tenantId, 'published');
        } else {
          const nextStep = workflowDef.steps[nextStepIndex];
          await client.query(
            `UPDATE workflow_instances 
             SET current_step = $1, approvals = $2, updated_at = NOW()
             WHERE id = $3 AND tenant_id = $4`,
            [nextStepIndex, JSON.stringify(approvals), instanceId, tenantId]
          );

          await contentItemService.updateStatus(instance.contentItemId, tenantId, nextStep.status);
        }
      } else {
        await client.query(
          `UPDATE workflow_instances SET approvals = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
          [JSON.stringify(approvals), instanceId, tenantId]
        );
      }

      await client.query('COMMIT');
      const updatedInstance = await this.getWorkflowInstance(instanceId, tenantId);
      logger.info('Workflow step approved', { instanceId, tenantId, approverId, approved });
      return updatedInstance;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async addComment(
    instanceId: string,
    tenantId: string,
    authorId: string,
    content: string
  ): Promise<WorkflowInstance | null> {
    const client = await pool.connect();
    try {
      const instance = await this.getWorkflowInstance(instanceId, tenantId);
      if (!instance) return null;

      const comment: WorkflowComment = {
        authorId,
        content,
        createdAt: new Date(),
      };

      const comments = [...instance.comments, comment];

      await client.query(
        `UPDATE workflow_instances SET comments = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
        [JSON.stringify(comments), instanceId, tenantId]
      );

      return this.getWorkflowInstance(instanceId, tenantId);
    } finally {
      client.release();
    }
  }

  async cancelWorkflow(instanceId: string, tenantId: string): Promise<WorkflowInstance | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE workflow_instances 
         SET status = 'rejected', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'in_progress')
         RETURNING *`,
        [instanceId, tenantId]
      );

      if (result.rows.length > 0) {
        logger.info('Workflow cancelled', { instanceId, tenantId });
        return this.mapRowToWorkflowInstance(result.rows[0]);
      }
      return null;
    } finally {
      client.release();
    }
  }

  private validateSteps(steps: WorkflowStep[]): void {
    if (steps.length < 2) {
      throw new Error('Workflow must have at least 2 steps');
    }

    const validStatuses: ContentStatus[] = ['draft', 'in_review', 'approved', 'published', 'archived'];
    for (const step of steps) {
      if (!step.name || !step.status) {
        throw new Error('Each step must have a name and status');
      }
      if (!validStatuses.includes(step.status)) {
        throw new Error(`Invalid status: ${step.status}`);
      }
    }
  }

  private mapRowToWorkflowDefinition(row: any): WorkflowDefinition {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      steps: row.steps || [],
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToWorkflowInstance(row: any): WorkflowInstance {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contentItemId: row.content_item_id,
      workflowDefinitionId: row.workflow_definition_id,
      currentStep: row.current_step,
      status: row.status,
      assignedTo: row.assigned_to || [],
      approvals: row.approvals || [],
      comments: row.comments || [],
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const workflowService = new WorkflowService();
