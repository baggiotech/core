import { describe, it, expect } from 'vitest';
import {
  maskSensitiveFields,
  applyMaskValue,
  normalizeFieldPolicies,
  formatRevisionPayload,
} from '../../governance/index.js';

describe('Governance: Field-Level Masking', () => {
  it('masks fields when user role is not permitted', () => {
    const data = {
      id: 'usr_1',
      name: 'John Doe',
      salary: 15000,
      email: 'john.doe@example.com',
      ssn: '123-45-6789',
    };

    const policies = [
      { field: 'salary', allowedRoles: ['admin'] },
      { field: 'email', allowedRoles: ['admin', 'editor'], mask: 'partial' as const },
      { field: 'ssn', allowedRoles: ['admin'], mask: 'redact' as const },
    ];

    // Viewer role: salary and ssn redacted, email masked partially
    const maskedForViewer = maskSensitiveFields(data, 'viewer', policies);
    expect(maskedForViewer.salary).toBe('***');
    expect(maskedForViewer.ssn).toBe('***');
    expect(maskedForViewer.email).toBe('j***e@example.com');
    expect(maskedForViewer.name).toBe('John Doe');

    // Editor role: salary and ssn redacted, email visible
    const maskedForEditor = maskSensitiveFields(data, 'editor', policies);
    expect(maskedForEditor.salary).toBe('***');
    expect(maskedForEditor.email).toBe('john.doe@example.com');

    // Admin role: all visible
    const maskedForAdmin = maskSensitiveFields(data, 'admin', policies);
    expect(maskedForAdmin.salary).toBe(15000);
    expect(maskedForAdmin.ssn).toBe('123-45-6789');
    expect(maskedForAdmin.email).toBe('john.doe@example.com');
  });

  it('supports record mapping format and nested keys', () => {
    const record = {
      id: 'rec_1',
      meta: {
        api_key: 'sk_live_secret123',
        public_name: 'Baggio',
      },
    };

    const policies = {
      'meta.api_key': { allowedRoles: ['admin'], mask: 'redact' },
    };

    const masked = maskSensitiveFields(record, 'viewer', policies);
    expect(masked.meta.api_key).toBe('***');
    expect(masked.meta.public_name).toBe('Baggio');
  });

  it('handles array of records seamlessly', () => {
    const records = [
      { id: '1', secret: 'abc' },
      { id: '2', secret: 'xyz' },
    ];

    const masked = maskSensitiveFields(records, 'viewer', [{ field: 'secret', allowedRoles: ['admin'] }]);
    expect(masked[0].secret).toBe('***');
    expect(masked[1].secret).toBe('***');
  });
});

describe('Governance: Revisions Payload Formatting', () => {
  it('formats revision payload with defaults', () => {
    const payload = formatRevisionPayload({
      tenant_id: 'tenant-1',
      table_name: 'crm_entities',
      record_id: 'rec-1',
      old_data: { status: 'draft' },
      new_data: { status: 'published' },
      user_id: 'user-123',
      user_email: 'admin@baggio.tech',
    });

    expect(payload.id).toBeDefined();
    expect(payload.tenant_id).toBe('tenant-1');
    expect(payload.table_name).toBe('crm_entities');
    expect(payload.operation).toBe('UPDATE');
    expect(JSON.parse(payload.old_data)).toEqual({ status: 'draft' });
    expect(JSON.parse(payload.new_data)).toEqual({ status: 'published' });
    expect(payload.user_id).toBe('user-123');
    expect(payload.user_email).toBe('admin@baggio.tech');
  });
});
