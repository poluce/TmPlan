use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

const TMPLAN_DIR: &str = ".tmplan";

// --- Enums ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Blocked,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ModuleLayer {
    Feature,
    Implementation,
}

impl Default for ModuleLayer {
    fn default() -> Self {
        ModuleLayer::Implementation
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ModuleStatus {
    Pending,
    InProgress,
    Completed,
}

impl Default for ModuleStatus {
    fn default() -> Self {
        ModuleStatus::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Medium
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictType {
    Deviation,
    Missing,
    Extra,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ImportSourceType {
    DocConvert,
    AiGuide,
    MarkdownAst,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MergeAction {
    Fill,
    Replace,
    Append,
    Conflict,
    Staged,
}

impl Default for MergeAction {
    fn default() -> Self {
        MergeAction::Staged
    }
}

// --- Structs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub schema_version: String,
    pub name: String,
    pub description: String,
    pub tech_stack: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleTask {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub status: TaskStatus,
    #[serde(default)]
    pub depends_on: Vec<String>,
    pub detail: String,
    #[serde(default)]
    pub files_to_create: Vec<String>,
    #[serde(default)]
    pub files_to_modify: Vec<String>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModulePlan {
    pub module: String,
    pub slug: String,
    #[serde(default)]
    pub layer: ModuleLayer,
    #[serde(default)]
    pub status: ModuleStatus,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub decision_refs: Vec<i64>,
    pub overview: String,
    #[serde(default)]
    pub priority: Priority,
    pub estimated_hours: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub tasks: Vec<ModuleTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionOption {
    pub id: String,
    pub label: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decision {
    pub decision_id: i64,
    pub question: String,
    pub context: String,
    pub options_presented: Vec<DecisionOption>,
    pub chosen: String,
    pub reason: String,
    pub impact: Vec<String>,
    pub affected_modules: Vec<String>,
    pub decided_at: String,
    pub supersedes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conflict {
    pub id: String,
    pub module: String,
    pub task_id: Option<String>,
    #[serde(rename = "type")]
    pub conflict_type: ConflictType,
    pub description: String,
    pub expected: Option<String>,
    pub actual: Option<String>,
    pub severity: Severity,
    pub detected_at: String,
    #[serde(default)]
    pub resolved: bool,
    pub resolved_at: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectStatus {
    pub overall_progress: f64,
    pub current_phase: String,
    pub modules_status: HashMap<String, String>,
    pub last_check_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub conflicts: Vec<Conflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MergeSummary {
    #[serde(default)]
    pub filled: i64,
    #[serde(default)]
    pub replaced: i64,
    #[serde(default)]
    pub appended: i64,
    #[serde(default)]
    pub conflicts: i64,
    #[serde(default)]
    pub staged: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRecord {
    pub import_id: String,
    pub imported_at: String,
    pub source_type: ImportSourceType,
    #[serde(default)]
    pub source_files: Vec<String>,
    #[serde(default)]
    pub field_keys: Vec<String>,
    pub project_name: String,
    #[serde(default)]
    pub modules_imported: Vec<String>,
    #[serde(default)]
    pub decisions_imported: Vec<i64>,
    #[serde(default)]
    pub merge_summary: MergeSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ImportManifest {
    #[serde(default)]
    pub imports: Vec<ImportRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldSourceRecord {
    pub field_key: String,
    pub source_type: ImportSourceType,
    pub source_label: String,
    #[serde(default)]
    pub source_files: Vec<String>,
    pub import_id: String,
    pub recorded_at: String,
    #[serde(default)]
    pub merge_action: MergeAction,
    #[serde(default)]
    pub value_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FieldSourceRegistry {
    #[serde(default)]
    pub fields: HashMap<String, Vec<FieldSourceRecord>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportMetadataPayload {
    #[serde(default)]
    pub manifest: ImportManifest,
    #[serde(default)]
    pub field_sources: FieldSourceRegistry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionFileRef {
    pub decision_id: i64,
    pub question: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EventQueryParams {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub target_id: Option<String>,
    #[serde(rename = "type")]
    pub event_type: Option<String>,
    pub actor: Option<String>,
    pub source: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonPatchOp {
    pub op: String,
    pub path: String,
    #[serde(default)]
    pub value: Option<serde_json::Value>,
    #[serde(default)]
    pub old_value: Option<serde_json::Value>,
    #[serde(default)]
    pub from: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PpfEvent {
    pub event_id: String,
    pub action_id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub target_id: String,
    #[serde(default)]
    pub patches: Vec<JsonPatchOp>,
    pub actor: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EventDayLog {
    pub date: String,
    #[serde(default)]
    pub events: Vec<PpfEvent>,
}

// --- Helper functions ---

fn tmplan_path(base_path: &str) -> std::path::PathBuf {
    Path::new(base_path).join(TMPLAN_DIR)
}

fn read_yaml_file<T: serde::de::DeserializeOwned>(file_path: &Path) -> Result<T, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;
    serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", file_path.display(), e))
}

fn read_yaml_file_or_default<T>(file_path: &Path) -> Result<T, String>
where
    T: serde::de::DeserializeOwned + Default,
{
    if !file_path.exists() {
        return Ok(T::default());
    }

    read_yaml_file(file_path)
}

fn write_yaml_file<T: Serialize>(file_path: &Path, data: &T) -> Result<(), String> {
    let content = serde_yaml::to_string(data)
        .map_err(|e| format!("Failed to serialize YAML: {}", e))?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }
    fs::write(file_path, content)
        .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))
}

fn write_yaml_file_if_missing<T: Serialize>(file_path: &Path, data: &T) -> Result<(), String> {
    if file_path.exists() {
        return Ok(());
    }

    write_yaml_file(file_path, data)
}

fn slugify_decision_question(question: &str) -> String {
    let mut slug = String::new();
    let mut in_separator = false;

    for ch in question.to_ascii_lowercase().chars() {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() {
            slug.push(ch);
            in_separator = false;
        } else if !in_separator {
            slug.push('-');
            in_separator = true;
        }
    }

    while slug.ends_with('-') {
        slug.pop();
    }

    slug.to_lowercase()
}

fn now_iso_timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn derive_module_status(module: &ModulePlan) -> ModuleStatus {
    if module.tasks.is_empty() {
        return module.status.clone();
    }

    if module.tasks.iter().all(|task| task.status == TaskStatus::Completed) {
        return ModuleStatus::Completed;
    }

    if module
        .tasks
        .iter()
        .any(|task| task.status == TaskStatus::InProgress || task.status == TaskStatus::Completed)
    {
        return ModuleStatus::InProgress;
    }

    ModuleStatus::Pending
}

fn calculate_progress(modules: &[ModulePlan]) -> f64 {
    if modules.is_empty() {
        return 0.0;
    }

    let mut total_tasks = 0_u64;
    let mut completed_tasks = 0_u64;

    for module in modules {
        for task in &module.tasks {
            total_tasks += 1;
            if task.status == TaskStatus::Completed {
                completed_tasks += 1;
            }
        }
    }

    if total_tasks == 0 {
        return 0.0;
    }

    ((completed_tasks as f64 / total_tasks as f64) * 100.0).round()
}

fn resolve_module_file_path(base_path: &str, module_slug: &str) -> Result<std::path::PathBuf, String> {
    let modules_path = tmplan_path(base_path).join("modules").join(format!("{}.yaml", module_slug));
    if modules_path.exists() {
        return Ok(modules_path);
    }

    let plans_path = tmplan_path(base_path)
        .join("plans")
        .join("modules")
        .join(format!("{}.yaml", module_slug));
    if plans_path.exists() {
        return Ok(plans_path);
    }

    Err(format!("Module file not found for slug {}", module_slug))
}

fn read_yaml_dir<T: serde::de::DeserializeOwned>(dir_path: &Path) -> Result<Vec<T>, String> {
    if !dir_path.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path.display(), e))?;

    let mut yaml_paths = Vec::new();
    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("yaml") {
            yaml_paths.push(path);
        }
    }

    yaml_paths.sort();

    let mut results = Vec::new();
    for path in yaml_paths {
        let item: T = read_yaml_file(&path)?;
        results.push(item);
    }

    Ok(results)
}

fn remove_yaml_files_except(dir_path: &Path, keep_file_names: &[String]) -> Result<(), String> {
    if !dir_path.exists() {
        return Ok(());
    }

    let keep: std::collections::HashSet<&str> = keep_file_names.iter().map(String::as_str).collect();
    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path.display(), e))?;

    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("yaml") {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| format!("Invalid UTF-8 file name: {}", path.display()))?;
        if keep.contains(file_name) {
            continue;
        }

        fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove {}: {}", path.display(), e))?;
    }

    Ok(())
}

fn events_dir(base_path: &str) -> std::path::PathBuf {
    tmplan_path(base_path).join("events")
}

fn is_event_log_file(file_name: &str) -> bool {
    let bytes = file_name.as_bytes();
    bytes.len() == 15
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && file_name.ends_with(".yaml")
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[8..10].iter().all(u8::is_ascii_digit)
}

fn sync_status_file(base_path: &str) -> Result<(), String> {
    let modules = read_all_modules(base_path.to_string())?;
    let status_path = tmplan_path(base_path).join("status.yaml");
    let current_status = if status_path.exists() {
        read_yaml_file::<ProjectStatus>(&status_path)?
    } else {
        ProjectStatus {
            overall_progress: 0.0,
            current_phase: String::new(),
            modules_status: HashMap::new(),
            last_check_at: now_iso_timestamp(),
            updated_at: now_iso_timestamp(),
            conflicts: Vec::new(),
        }
    };

    let mut modules_status = HashMap::new();
    for module in &modules {
        modules_status.insert(
            module.slug.clone(),
            match derive_module_status(module) {
                ModuleStatus::Pending => "pending".to_string(),
                ModuleStatus::InProgress => "in_progress".to_string(),
                ModuleStatus::Completed => "completed".to_string(),
            },
        );
    }

    let now = now_iso_timestamp();
    let updated_status = ProjectStatus {
        overall_progress: calculate_progress(&modules),
        current_phase: current_status.current_phase,
        modules_status,
        last_check_at: now.clone(),
        updated_at: now,
        conflicts: current_status.conflicts,
    };

    write_yaml_file(&status_path, &updated_status)
}

fn read_day_log(base_path: &str, date: &str) -> Result<EventDayLog, String> {
    let file_path = events_dir(base_path).join(format!("{}.yaml", date));
    read_yaml_file_or_default::<EventDayLog>(&file_path)
}

// --- Tauri Commands ---

#[tauri::command]
pub fn read_project(base_path: String) -> Result<ProjectConfig, String> {
    let file_path = tmplan_path(&base_path).join("project.yaml");
    if file_path.exists() {
        return read_yaml_file(&file_path);
    }

    let plan_project_path = tmplan_path(&base_path).join("plans").join("project.yaml");
    read_yaml_file(&plan_project_path)
}

#[tauri::command]
pub fn read_all_modules(base_path: String) -> Result<Vec<ModulePlan>, String> {
    let modules_dir = tmplan_path(&base_path).join("modules");
    let modules = read_yaml_dir(&modules_dir)?;
    if !modules.is_empty() {
        return Ok(modules);
    }

    let plan_modules_dir = tmplan_path(&base_path).join("plans").join("modules");
    read_yaml_dir(&plan_modules_dir)
}

#[tauri::command]
pub fn read_all_decisions(base_path: String) -> Result<Vec<Decision>, String> {
    let dir_path = tmplan_path(&base_path).join("decisions");
    let decisions = read_yaml_dir(&dir_path)?;
    if !decisions.is_empty() {
        return Ok(decisions);
    }

    let plan_decisions_dir = tmplan_path(&base_path).join("plans").join("decisions");
    read_yaml_dir(&plan_decisions_dir)
}

#[tauri::command]
pub fn read_status(base_path: String) -> Result<ProjectStatus, String> {
    let file_path = tmplan_path(&base_path).join("status.yaml");
    read_yaml_file(&file_path)
}

#[tauri::command]
pub fn read_import_metadata(base_path: String) -> Result<ImportMetadataPayload, String> {
    let imports_dir = tmplan_path(&base_path).join("imports");
    let manifest = read_yaml_file_or_default::<ImportManifest>(&imports_dir.join("manifest.yaml"))?;
    let field_sources =
        read_yaml_file_or_default::<FieldSourceRegistry>(&imports_dir.join("field-sources.yaml"))?;

    Ok(ImportMetadataPayload {
        manifest,
        field_sources,
    })
}

#[tauri::command]
pub fn write_project(base_path: String, data: ProjectConfig) -> Result<(), String> {
    let file_path = tmplan_path(&base_path).join("project.yaml");
    write_yaml_file(&file_path, &data)
}

#[tauri::command]
pub fn write_module(base_path: String, data: ModulePlan) -> Result<(), String> {
    let dir_path = tmplan_path(&base_path).join("modules");
    let file_path = dir_path.join(format!("{}.yaml", data.slug));
    write_yaml_file(&file_path, &data)
}

#[tauri::command]
pub fn write_decision(base_path: String, data: Decision) -> Result<(), String> {
    let dir_path = tmplan_path(&base_path).join("decisions");
    let slug = slugify_decision_question(&data.question);
    let file_path = dir_path.join(format!("{:03}-{}.yaml", data.decision_id, slug));
    write_yaml_file(&file_path, &data)
}

#[tauri::command]
pub fn update_task_status(
    base_path: String,
    module_slug: String,
    task_id: String,
    status: TaskStatus,
) -> Result<(), String> {
    let file_path = resolve_module_file_path(&base_path, &module_slug)?;
    let mut module: ModulePlan = read_yaml_file(&file_path)?;
    let task = module
        .tasks
        .iter_mut()
        .find(|task| task.id == task_id)
        .ok_or_else(|| format!("Task {} not found in module {}", task_id, module_slug))?;

    task.status = status;
    module.status = derive_module_status(&module);
    module.updated_at = now_iso_timestamp();
    write_yaml_file(&file_path, &module)?;
    sync_status_file(&base_path)
}

#[tauri::command]
pub fn append_import_metadata(
    base_path: String,
    record: ImportRecord,
    field_records: Vec<FieldSourceRecord>,
) -> Result<(), String> {
    let imports_dir = tmplan_path(&base_path).join("imports");
    fs::create_dir_all(&imports_dir)
        .map_err(|e| format!("Failed to create imports directory: {}", e))?;

    let manifest_path = imports_dir.join("manifest.yaml");
    let mut manifest = if manifest_path.exists() {
        read_yaml_file::<ImportManifest>(&manifest_path)?
    } else {
        ImportManifest::default()
    };

    if !field_records.is_empty() {
        let field_sources_path = imports_dir.join("field-sources.yaml");
        let had_field_sources_file = field_sources_path.exists();
        let mut registry = if field_sources_path.exists() {
            read_yaml_file::<FieldSourceRegistry>(&field_sources_path)?
        } else {
            FieldSourceRegistry::default()
        };
        let previous_registry = registry.clone();

        for field_record in field_records {
            let field_key = field_record.field_key.clone();
            let entry = registry.fields.entry(field_key).or_default();
            entry.push(field_record);
            if entry.len() > 20 {
                let drain_count = entry.len() - 20;
                entry.drain(0..drain_count);
            }
        }

        write_yaml_file(&field_sources_path, &registry)?;

        manifest.imports.push(record);
        if let Err(err) = write_yaml_file(&manifest_path, &manifest) {
            if had_field_sources_file {
                let _ = write_yaml_file(&field_sources_path, &previous_registry);
            } else {
                let _ = fs::remove_file(&field_sources_path);
            }
            return Err(err);
        }

        return Ok(());
    }

    manifest.imports.push(record);
    write_yaml_file(&manifest_path, &manifest)
}

#[tauri::command]
pub fn remove_stale_module_files(base_path: String, module_slugs: Vec<String>) -> Result<(), String> {
    let keep_file_names: Vec<String> = module_slugs
        .into_iter()
        .map(|slug| format!("{}.yaml", slug))
        .collect();
    remove_yaml_files_except(&tmplan_path(&base_path).join("modules"), &keep_file_names)
}

#[tauri::command]
pub fn remove_stale_decision_files(
    base_path: String,
    decisions: Vec<DecisionFileRef>,
) -> Result<(), String> {
    let keep_file_names: Vec<String> = decisions
        .into_iter()
        .map(|decision| {
            format!(
                "{:03}-{}.yaml",
                decision.decision_id,
                slugify_decision_question(&decision.question)
            )
        })
        .collect();
    remove_yaml_files_except(&tmplan_path(&base_path).join("decisions"), &keep_file_names)
}

#[tauri::command]
pub fn init_tmplan(base_path: String) -> Result<(), String> {
    let root = tmplan_path(&base_path);

    // Create directory structure
    let dirs = ["modules", "decisions", "phases", "imports"];
    for dir in &dirs {
        fs::create_dir_all(root.join(dir))
            .map_err(|e| format!("Failed to create directory {}: {}", dir, e))?;
    }

    let now = now_iso_timestamp();

    // Create default project.yaml
    let project = ProjectConfig {
        schema_version: "1.0".to_string(),
        name: String::new(),
        description: String::new(),
        tech_stack: Vec::new(),
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    write_yaml_file_if_missing(&root.join("project.yaml"), &project)?;

    // Create default status.yaml
    let status = ProjectStatus {
        overall_progress: 0.0,
        current_phase: String::new(),
        modules_status: HashMap::new(),
        last_check_at: now.clone(),
        updated_at: now,
        conflicts: Vec::new(),
    };
    write_yaml_file_if_missing(&root.join("status.yaml"), &status)?;

    Ok(())
}

#[tauri::command]
pub fn check_tmplan_exists(path: String) -> Result<bool, String> {
    let tmplan = Path::new(&path).join(TMPLAN_DIR);
    Ok(tmplan.exists() && tmplan.is_dir())
}

#[tauri::command]
pub fn query_events(base_path: String, query: EventQueryParams) -> Result<Vec<PpfEvent>, String> {
    let dir = events_dir(&base_path);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;
    let mut files: Vec<String> = Vec::new();
    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy().to_string();
        if is_event_log_file(&file_name) {
            files.push(file_name);
        }
    }
    files.sort();

    let filtered_files = files.into_iter().filter(|file_name| {
        let date = &file_name[..10];
        if let Some(from_date) = &query.from_date {
            if date < from_date.as_str() {
                return false;
            }
        }
        if let Some(to_date) = &query.to_date {
            if date > to_date.as_str() {
                return false;
            }
        }
        true
    });

    let mut events: Vec<PpfEvent> = Vec::new();
    for file_name in filtered_files {
        let date = &file_name[..10];
        let day_log = read_day_log(&base_path, date)?;
        for event in day_log.events {
            if let Some(event_type) = &query.event_type {
                if &event.event_type != event_type {
                    continue;
                }
            }
            if let Some(actor) = &query.actor {
                if &event.actor != actor {
                    continue;
                }
            }
            if let Some(source) = &query.source {
                if &event.source != source {
                    continue;
                }
            }
            if let Some(target_id) = &query.target_id {
                if &event.target_id != target_id {
                    continue;
                }
            }
            events.push(event);
        }
    }

    let offset = query.offset.unwrap_or(0);
    let limit = query.limit.unwrap_or(100);
    Ok(events.into_iter().skip(offset).take(limit).collect())
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_root() -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("tmplan-fs-commands-{}", unique));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn read_all_modules_falls_back_to_plans_modules_when_modules_dir_is_missing() {
        let root = make_temp_root();
        let base_path = root.to_string_lossy().to_string();
        let plans_dir = root.join(".tmplan").join("plans").join("modules");
        fs::create_dir_all(&plans_dir).unwrap();
        fs::write(
            plans_dir.join("feature-a.yaml"),
            r#"module: Feature A
slug: feature-a
layer: implementation
status: pending
priority: medium
depends_on: []
decision_refs: []
overview: Example module
estimated_hours: null
created_at: 2026-03-13T00:00:00.000Z
updated_at: 2026-03-13T00:00:00.000Z
tasks:
  - id: feature-a-01
    title: First task
    status: pending
    depends_on: []
    detail: do something
    files_to_create: []
    files_to_modify: []
    acceptance_criteria: []
"#,
        ).unwrap();

        let modules = read_all_modules(base_path).unwrap();

        assert_eq!(modules.len(), 1);
        assert_eq!(modules[0].slug, "feature-a");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn read_project_falls_back_to_plans_project_when_project_yaml_is_missing() {
        let root = make_temp_root();
        let base_path = root.to_string_lossy().to_string();
        let plans_dir = root.join(".tmplan").join("plans");
        fs::create_dir_all(&plans_dir).unwrap();
        fs::write(
            plans_dir.join("project.yaml"),
            r#"schema_version: "1.0"
name: Planned Project
description: from plans project
tech_stack: []
created_at: 2026-03-16T00:00:00.000Z
updated_at: 2026-03-16T00:00:00.000Z
"#,
        )
        .unwrap();

        let project = read_project(base_path).unwrap();

        assert_eq!(project.name, "Planned Project");
        assert_eq!(project.description, "from plans project");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn read_all_decisions_falls_back_to_plans_decisions_when_decisions_dir_is_missing() {
        let root = make_temp_root();
        let base_path = root.to_string_lossy().to_string();
        let plans_dir = root.join(".tmplan").join("plans").join("decisions");
        fs::create_dir_all(&plans_dir).unwrap();
        fs::write(
            plans_dir.join("001-use-cache.yaml"),
            r#"decision_id: 1
question: Use cache?
context: import from plan decisions
options_presented: []
chosen: yes
reason: performance
impact: []
affected_modules: []
decided_at: 2026-03-16T00:00:00.000Z
supersedes: null
"#,
        )
        .unwrap();

        let decisions = read_all_decisions(base_path).unwrap();

        assert_eq!(decisions.len(), 1);
        assert_eq!(decisions[0].decision_id, 1);
        assert_eq!(decisions[0].chosen, "yes");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn read_import_metadata_returns_defaults_when_files_are_missing() {
        let root = make_temp_root();
        let base_path = root.to_string_lossy().to_string();
        fs::create_dir_all(root.join(".tmplan").join("imports")).unwrap();

        let metadata = read_import_metadata(base_path).unwrap();

        assert!(metadata.manifest.imports.is_empty());
        assert!(metadata.field_sources.fields.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn update_task_status_persists_into_plans_module_when_needed() {
        let root = make_temp_root();
        let base_path = root.to_string_lossy().to_string();
        init_tmplan(base_path.clone()).unwrap();
        let plans_dir = root.join(".tmplan").join("plans").join("modules");
        fs::create_dir_all(&plans_dir).unwrap();
        let module_path = plans_dir.join("feature-a.yaml");
        fs::write(
            &module_path,
            r#"module: Feature A
slug: feature-a
layer: implementation
status: pending
priority: medium
depends_on: []
decision_refs: []
overview: Example module
estimated_hours: null
created_at: 2026-03-13T00:00:00.000Z
updated_at: 2026-03-13T00:00:00.000Z
tasks:
  - id: feature-a-01
    title: First task
    status: pending
    depends_on: []
    detail: do something
    files_to_create: []
    files_to_modify: []
    acceptance_criteria: []
"#,
        )
        .unwrap();

        update_task_status(
            base_path.clone(),
            "feature-a".to_string(),
            "feature-a-01".to_string(),
            TaskStatus::Completed,
        )
        .unwrap();

        let updated: ModulePlan = read_yaml_file(&module_path).unwrap();
        assert_eq!(updated.tasks[0].status, TaskStatus::Completed);
        assert_eq!(updated.status, ModuleStatus::Completed);

        let status: ProjectStatus = read_yaml_file(&root.join(".tmplan").join("status.yaml")).unwrap();
        assert_eq!(status.overall_progress, 100.0);
        assert_eq!(
            status.modules_status.get("feature-a"),
            Some(&"completed".to_string())
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn slugify_decision_question_matches_web_writer_behavior() {
        assert_eq!(slugify_decision_question("should use cache?"), "should-use-cache");
        assert_eq!(slugify_decision_question("API Choice"), "api-choice");
        assert_eq!(slugify_decision_question("hello___world"), "hello-world");
    }

    #[test]
    fn init_tmplan_does_not_overwrite_existing_project_file() {
        let root = make_temp_root();
        let project_dir = root.join(".tmplan");
        fs::create_dir_all(&project_dir).unwrap();
        let project_path = project_dir.join("project.yaml");
        fs::write(
            &project_path,
            r#"schema_version: "1.0"
name: Existing Project
description: Keep me
tech_stack: []
created_at: existing-created
updated_at: existing-updated
"#,
        )
        .unwrap();

        init_tmplan(root.to_string_lossy().to_string()).unwrap();

        let content = fs::read_to_string(project_path).unwrap();
        assert!(content.contains("Existing Project"));
        assert!(content.contains("existing-created"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn query_events_filters_and_paginates_event_logs() {
        let root = make_temp_root();
        let base_path = root.to_string_lossy().to_string();
        let events_dir = root.join(".tmplan").join("events");
        fs::create_dir_all(&events_dir).unwrap();
        fs::write(
            events_dir.join("2026-03-15.yaml"),
            r#"date: 2026-03-15
events:
  - event_id: evt_aaaaaaaaaaaa
    action_id: act_1
    timestamp: 2026-03-15T10:00:00.000Z
    type: task.update
    target_id: task-a
    patches: []
    actor: user
    source: ui
  - event_id: evt_bbbbbbbbbbbb
    action_id: act_2
    timestamp: 2026-03-15T11:00:00.000Z
    type: module.update
    target_id: module-a
    patches: []
    actor: system
    source: markdown
"#,
        )
        .unwrap();

        let filtered = query_events(
            base_path.clone(),
            EventQueryParams {
                event_type: Some("task.update".to_string()),
                limit: Some(10),
                offset: Some(0),
                ..EventQueryParams::default()
            },
        )
        .unwrap();
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].event_id, "evt_aaaaaaaaaaaa");

        let paged = query_events(
            base_path.clone(),
            EventQueryParams {
                limit: Some(1),
                offset: Some(1),
                ..EventQueryParams::default()
            },
        )
        .unwrap();
        assert_eq!(paged.len(), 1);
        assert_eq!(paged[0].event_id, "evt_bbbbbbbbbbbb");

        fs::remove_dir_all(root).unwrap();
    }
}
