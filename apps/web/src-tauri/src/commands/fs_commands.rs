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

fn read_yaml_dir<T: serde::de::DeserializeOwned>(dir_path: &Path) -> Result<Vec<T>, String> {
    if !dir_path.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path.display(), e))?;

    let mut results = Vec::new();
    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("yaml") {
            let item: T = read_yaml_file(&path)?;
            results.push(item);
        }
    }
    Ok(results)
}

// --- Tauri Commands ---

#[tauri::command]
pub fn read_project(base_path: String) -> Result<ProjectConfig, String> {
    let file_path = tmplan_path(&base_path).join("project.yaml");
    read_yaml_file(&file_path)
}

#[tauri::command]
pub fn read_all_modules(base_path: String) -> Result<Vec<ModulePlan>, String> {
    let dir_path = tmplan_path(&base_path).join("modules");
    read_yaml_dir(&dir_path)
}

#[tauri::command]
pub fn read_all_decisions(base_path: String) -> Result<Vec<Decision>, String> {
    let dir_path = tmplan_path(&base_path).join("decisions");
    read_yaml_dir(&dir_path)
}

#[tauri::command]
pub fn read_status(base_path: String) -> Result<ProjectStatus, String> {
    let file_path = tmplan_path(&base_path).join("status.yaml");
    read_yaml_file(&file_path)
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
    let slug = data.question
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric() && c != ' ', "")
        .split_whitespace()
        .take(5)
        .collect::<Vec<&str>>()
        .join("-");
    let file_path = dir_path.join(format!("{:03}-{}.yaml", data.decision_id, slug));
    write_yaml_file(&file_path, &data)
}

#[tauri::command]
pub fn init_tmplan(base_path: String) -> Result<(), String> {
    let root = tmplan_path(&base_path);

    // Create directory structure
    let dirs = ["modules", "decisions", "phases"];
    for dir in &dirs {
        fs::create_dir_all(root.join(dir))
            .map_err(|e| format!("Failed to create directory {}: {}", dir, e))?;
    }

    // Create default project.yaml
    let project = ProjectConfig {
        schema_version: "1.0".to_string(),
        name: String::new(),
        description: String::new(),
        tech_stack: Vec::new(),
        created_at: String::new(),
        updated_at: String::new(),
    };
    write_yaml_file(&root.join("project.yaml"), &project)?;

    // Create default status.yaml
    let status = ProjectStatus {
        overall_progress: 0.0,
        current_phase: String::new(),
        modules_status: HashMap::new(),
        last_check_at: String::new(),
        updated_at: String::new(),
        conflicts: Vec::new(),
    };
    write_yaml_file(&root.join("status.yaml"), &status)?;

    Ok(())
}

#[tauri::command]
pub fn check_tmplan_exists(path: String) -> Result<bool, String> {
    let tmplan = Path::new(&path).join(TMPLAN_DIR);
    Ok(tmplan.exists() && tmplan.is_dir())
}
