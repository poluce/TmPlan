use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct FileStatus {
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModuleProgress {
    pub slug: String,
    pub total_files: usize,
    pub existing_files: usize,
    pub files: Vec<FileStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectProgress {
    pub total_files: usize,
    pub existing_files: usize,
    pub modules: Vec<ModuleProgress>,
}

#[tauri::command]
pub fn check_file_exists(project_path: String, file_path: String) -> Result<bool, String> {
    let full_path = Path::new(&project_path).join(&file_path);
    Ok(full_path.exists())
}

#[tauri::command]
pub fn check_module_progress(
    project_path: String,
    module_data: serde_json::Value,
) -> Result<ModuleProgress, String> {
    let slug = module_data
        .get("slug")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let tasks = module_data
        .get("tasks")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut files: Vec<FileStatus> = Vec::new();

    for task in &tasks {
        let files_to_create = task
            .get("files_to_create")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        for file_val in &files_to_create {
            if let Some(file_path) = file_val.as_str() {
                let full_path = Path::new(&project_path).join(file_path);
                files.push(FileStatus {
                    path: file_path.to_string(),
                    exists: full_path.exists(),
                });
            }
        }
    }

    let total_files = files.len();
    let existing_files = files.iter().filter(|f| f.exists).count();

    Ok(ModuleProgress {
        slug,
        total_files,
        existing_files,
        files,
    })
}

#[tauri::command]
pub fn check_project_progress(
    project_path: String,
    modules_data: Vec<serde_json::Value>,
) -> Result<ProjectProgress, String> {
    let mut modules: Vec<ModuleProgress> = Vec::new();
    let mut total_files: usize = 0;
    let mut existing_files: usize = 0;

    for module_data in modules_data {
        let progress = check_module_progress(project_path.clone(), module_data)?;
        total_files += progress.total_files;
        existing_files += progress.existing_files;
        modules.push(progress);
    }

    Ok(ProjectProgress {
        total_files,
        existing_files,
        modules,
    })
}
