import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function canonicalApproval(approval) {
  return JSON.stringify({
    operation: approval.operation,
    approvedBy: approval.approvedBy,
    changeTicket: approval.changeTicket,
    approvedAt: approval.approvedAt,
    expiresAt: approval.expiresAt,
    archiveUri: approval.archiveUri,
    reconciliationReportSha256: approval.reconciliationReportSha256
  });
}

export function validateControlledApproval(env = process.env, options = {}) {
  const errors = [];
  const file = env[options.fileVariable || 'FIRESTORE_CUTOVER_APPROVAL_FILE'];
  const publicKey = env[options.publicKeyVariable || 'FIRESTORE_CUTOVER_APPROVAL_PUBLIC_KEY'];
  if (!file) errors.push('FIRESTORE_CUTOVER_APPROVAL_FILE is required.');
  if (!publicKey) errors.push('FIRESTORE_CUTOVER_APPROVAL_PUBLIC_KEY is required.');
  if (errors.length) return errors;
  let approval;
  try { approval = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); } catch { return ['Controlled approval file is unreadable JSON.']; }
  for (const field of ['operation', 'approvedBy', 'changeTicket', 'approvedAt', 'expiresAt', 'archiveUri', 'reconciliationReportSha256', 'signature']) if (typeof approval[field] !== 'string' || !approval[field]) errors.push(`Approval field ${field} is required.`);
  const expectedOperation = options.operation || 'firestore-decommission';
  if (approval.operation !== expectedOperation) errors.push(`Approval operation must be ${expectedOperation}.`);
  if (approval.expiresAt && Date.parse(approval.expiresAt) <= Date.now()) errors.push('Controlled approval has expired.');
  try {
    const archive = new URL(approval.archiveUri);
    if (!['gs:', 's3:', 'r2:', 'https:'].includes(archive.protocol) || !archive.pathname || archive.pathname === '/') errors.push('Approval archiveUri is not an immutable archive URI.');
  } catch { errors.push('Approval archiveUri is invalid.'); }
  if (approval.signature) {
    try {
      const valid = crypto.verify(null, Buffer.from(canonicalApproval(approval)), publicKey, Buffer.from(approval.signature, 'base64'));
      if (!valid) errors.push('Controlled approval signature is invalid.');
    } catch { errors.push('Controlled approval signature could not be verified.'); }
  }
  return errors;
}
