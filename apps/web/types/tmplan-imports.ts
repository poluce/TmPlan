import { z } from 'zod'

export const ImportSourceTypeSchema = z.enum(['doc-convert', 'ai-guide', 'markdown-ast', 'manual'])
export type ImportSourceType = z.infer<typeof ImportSourceTypeSchema>

export const MergeActionSchema = z.enum(['fill', 'replace', 'append', 'conflict', 'staged'])
export type MergeAction = z.infer<typeof MergeActionSchema>

export const MergeSummarySchema = z.object({
  filled: z.number().int().nonnegative().default(0),
  replaced: z.number().int().nonnegative().default(0),
  appended: z.number().int().nonnegative().default(0),
  conflicts: z.number().int().nonnegative().default(0),
  staged: z.number().int().nonnegative().default(0),
})
export type MergeSummary = z.infer<typeof MergeSummarySchema>

export const FieldSourceRecordSchema = z.object({
  field_key: z.string(),
  source_type: ImportSourceTypeSchema,
  source_label: z.string(),
  source_files: z.array(z.string()).default([]),
  import_id: z.string(),
  recorded_at: z.string(),
  merge_action: MergeActionSchema.default('staged'),
  value_preview: z.string().default(''),
})
export type FieldSourceRecord = z.infer<typeof FieldSourceRecordSchema>

export const FieldSourceRegistrySchema = z.object({
  fields: z.record(z.string(), z.array(FieldSourceRecordSchema)).default({}),
})
export type FieldSourceRegistry = z.infer<typeof FieldSourceRegistrySchema>

export const ImportRecordSchema = z.object({
  import_id: z.string(),
  imported_at: z.string(),
  source_type: ImportSourceTypeSchema,
  source_files: z.array(z.string()).default([]),
  field_keys: z.array(z.string()).default([]),
  project_name: z.string().default(''),
  modules_imported: z.array(z.string()).default([]),
  decisions_imported: z.array(z.number()).default([]),
  merge_summary: MergeSummarySchema.default({
    filled: 0,
    replaced: 0,
    appended: 0,
    conflicts: 0,
    staged: 0,
  }),
})
export type ImportRecord = z.infer<typeof ImportRecordSchema>

export const ImportManifestSchema = z.object({
  imports: z.array(ImportRecordSchema).default([]),
})
export type ImportManifest = z.infer<typeof ImportManifestSchema>
