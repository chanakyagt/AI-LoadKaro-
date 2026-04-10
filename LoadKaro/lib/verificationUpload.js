/**
 * Upload verification documents to Supabase Storage, create DB tracking rows,
 * then flip verification_status to 'pending' only on success.
 *
 * Uses fetch() to read local file URIs as blobs — works reliably across all
 * Expo SDK versions without expo-file-system EncodingType issues.
 */
import { supabase, isSupabaseConfigured } from './supabase';

const BUCKET = 'verification-docs';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);

const MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function getExtension(filename) {
  return (filename || '').split('.').pop()?.toLowerCase() ?? '';
}

function guessMime(filename) {
  return MIME_MAP[getExtension(filename)] || 'application/octet-stream';
}

/**
 * Validate that every selected file has an allowed extension.
 * @param {[string, { name: string; uri: string }][]} entries
 * @returns {{ valid: boolean; badKey?: string; badName?: string }}
 */
export function validateFileFormats(entries) {
  for (const [docKey, file] of entries) {
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { valid: false, badKey: docKey, badName: file.name };
    }
  }
  return { valid: true };
}

/**
 * @param {{
 *   variant: 'user' | 'truck';
 *   entityId: string;
 *   userId: string;
 *   files: Record<string, { name: string; uri: string } | null>;
 * }} opts
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function submitVerificationDocs({ variant, entityId, userId, files }) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase not configured.' };
  }

  const entries = Object.entries(files).filter(([, f]) => f?.uri);
  if (entries.length === 0) {
    return { ok: false, error: 'Please select at least one document.' };
  }

  const formatCheck = validateFileFormats(entries);
  if (!formatCheck.valid) {
    const allowed = [...ALLOWED_EXTENSIONS].join(', ');
    return {
      ok: false,
      error: `"${formatCheck.badName}" is not a supported format.\n\nAllowed: ${allowed}`,
    };
  }

  const entityType = variant === 'truck' ? 'truck' : 'user';

  // 1. Create submission row
  const { data: submission, error: subErr } = await supabase
    .from('verification_submissions')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      submitted_by: userId,
    })
    .select('id')
    .single();

  if (subErr || !submission?.id) {
    return { ok: false, error: subErr?.message || 'Failed to create submission.' };
  }

  const submissionId = submission.id;
  const docRows = [];

  // 2. Upload each file (use fetch → blob from local URI)
  for (const [docKey, file] of entries) {
    try {
      const mime = guessMime(file.name);
      const ts = Date.now();
      const safeName = (file.name || 'doc').replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${entityType}/${entityId}/${submissionId}/${docKey}/${ts}-${safeName}`;

      const response = await fetch(file.uri);
      const blob = await response.blob();

      const arrayBuf = await new Response(blob).arrayBuffer();

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, arrayBuf, {
          contentType: mime,
          upsert: false,
        });

      if (upErr) {
        console.warn(`[verificationUpload] upload ${docKey}:`, upErr.message);
        return { ok: false, error: `Upload failed for ${docKey}: ${upErr.message}` };
      }

      docRows.push({
        submission_id: submissionId,
        entity_type: entityType,
        entity_id: entityId,
        doc_key: docKey,
        bucket: BUCKET,
        path: storagePath,
        original_filename: file.name || safeName,
        mime_type: mime,
        size_bytes: arrayBuf.byteLength,
      });
    } catch (e) {
      console.warn(`[verificationUpload] file read ${docKey}:`, e);
      return { ok: false, error: `Could not read file for ${docKey}.` };
    }
  }

  // 3. Insert document rows
  if (docRows.length > 0) {
    const { error: docErr } = await supabase
      .from('verification_documents')
      .insert(docRows);

    if (docErr) {
      return { ok: false, error: `Failed to save document records: ${docErr.message}` };
    }
  }

  // 4. Flip verification_status to 'pending' (only after all uploads succeeded)
  const table = entityType === 'user' ? 'users' : 'trucks';
  const { error: statusErr } = await supabase
    .from(table)
    .update({ verification_status: 'pending' })
    .eq('id', entityId);

  if (statusErr) {
    console.warn('[verificationUpload] status update:', statusErr.message);
    return { ok: false, error: `Documents uploaded but status update failed: ${statusErr.message}` };
  }

  return { ok: true };
}
