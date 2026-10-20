use reqwest::header::{ACCEPT, USER_AGENT};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const RELEASES_API: &str = "https://api.github.com/repos/Rodert/si-switch/releases?per_page=20";
const POLICY_URL: &str = "https://rodert.github.io/si-switch/update-policy.json";
const DEFAULT_DOWNLOAD_URL: &str = "https://rodert.github.io/si-switch/";

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    published_at: Option<String>,
    body: Option<String>,
    draft: bool,
    assets: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdatePolicy {
    #[serde(default = "default_update_type")]
    default_update_type: String,
    #[serde(default)]
    forced_versions: Vec<String>,
    #[serde(default = "default_download_url")]
    download_page_url: String,
    #[serde(default)]
    force_update_message: String,
}

impl Default for UpdatePolicy {
    fn default() -> Self {
        Self {
            default_update_type: default_update_type(),
            forced_versions: Vec::new(),
            download_page_url: default_download_url(),
            force_update_message: String::new(),
        }
    }
}

fn default_update_type() -> String {
    "optional".into()
}

fn default_download_url() -> String {
    DEFAULT_DOWNLOAD_URL.into()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    update_available: bool,
    current_version: String,
    latest_version: String,
    update_type: String,
    download_url: String,
    release_url: String,
    published_at: Option<String>,
    release_notes: String,
    message: String,
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    let current =
        Version::parse(&current_version).map_err(|error| format!("当前版本格式无效：{error}"))?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| format!("无法创建更新请求：{error}"))?;

    let releases = client
        .get(RELEASES_API)
        .header(USER_AGENT, "Si-Switch-Updater")
        .header(ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|error| format!("无法连接 GitHub：{error}"))?
        .error_for_status()
        .map_err(|error| format!("GitHub 返回错误：{error}"))?
        .json::<Vec<GithubRelease>>()
        .await
        .map_err(|error| format!("无法读取版本信息：{error}"))?;

    let latest = releases
        .into_iter()
        .filter(|release| !release.draft && !release.assets.is_empty())
        .filter_map(|release| {
            parse_release_version(&release.tag_name).map(|version| (version, release))
        })
        .max_by(|(left, _), (right, _)| left.cmp(right));

    let Some((latest_version, release)) = latest else {
        return Err("GitHub 暂无可下载版本".into());
    };

    let policy = fetch_policy(&client).await.unwrap_or_default();
    let update_available = latest_version > current;
    let update_type = resolve_update_type(&policy, &current_version, update_available);
    let forced = update_type == "forced";
    let message = if forced {
        if policy.force_update_message.trim().is_empty() {
            "当前版本需要升级后才能继续使用。".into()
        } else {
            policy.force_update_message
        }
    } else if update_available {
        format!("发现新版本 v{latest_version}，你可以立即下载或稍后更新。")
    } else {
        "当前已经是最新版本。".into()
    };

    Ok(UpdateCheckResult {
        update_available,
        current_version,
        latest_version: latest_version.to_string(),
        update_type: update_type.into(),
        download_url: policy.download_page_url,
        release_url: release.html_url,
        published_at: release.published_at,
        release_notes: release.body.unwrap_or_default(),
        message,
    })
}

async fn fetch_policy(client: &reqwest::Client) -> Result<UpdatePolicy, reqwest::Error> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    client
        .get(format!("{POLICY_URL}?t={timestamp}"))
        .header(USER_AGENT, "Si-Switch-Updater")
        .send()
        .await?
        .error_for_status()?
        .json::<UpdatePolicy>()
        .await
}

fn parse_release_version(tag: &str) -> Option<Version> {
    let value = tag
        .strip_prefix("build-v")
        .or_else(|| tag.strip_prefix('v'))
        .unwrap_or(tag);
    let version = value.split('-').next()?;
    Version::parse(version).ok()
}

fn resolve_update_type(
    policy: &UpdatePolicy,
    current_version: &str,
    update_available: bool,
) -> &'static str {
    if !update_available {
        return "optional";
    }

    let explicitly_forced = policy
        .forced_versions
        .iter()
        .any(|version| version == current_version);
    if explicitly_forced || policy.default_update_type == "forced" {
        "forced"
    } else {
        "optional"
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_release_version, resolve_update_type, UpdatePolicy};
    use semver::Version;

    #[test]
    fn parses_automatic_and_formal_release_tags() {
        assert_eq!(
            parse_release_version("build-v0.1.27-2026-10-20-1205-a1b2c3d"),
            Some(Version::new(0, 1, 27))
        );
        assert_eq!(parse_release_version("v1.2.3"), Some(Version::new(1, 2, 3)));
        assert_eq!(parse_release_version("not-a-version"), None);
    }

    #[test]
    fn forced_version_can_return_to_optional() {
        let mut policy = UpdatePolicy::default();
        policy.forced_versions.push("0.1.12".into());
        assert_eq!(resolve_update_type(&policy, "0.1.12", true), "forced");

        policy.forced_versions.clear();
        assert_eq!(resolve_update_type(&policy, "0.1.12", true), "optional");
    }

    #[test]
    fn invalid_policy_values_fail_safe_to_optional() {
        let mut policy = UpdatePolicy::default();
        policy.default_update_type = "unknown".into();
        assert_eq!(resolve_update_type(&policy, "0.1.12", true), "optional");
        assert_eq!(resolve_update_type(&policy, "0.1.12", false), "optional");
    }
}
