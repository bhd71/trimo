# Usage: .\release.ps1 <version>
# Example: .\release.ps1 0.2.0
# Bumps version in all three manifests, commits, tags, and pushes.

param(
    [Parameter(Mandatory)]
    [string]$Version
)

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be in MAJOR.MINOR.PATCH format (e.g. 0.2.0)"
    exit 1
}

$tag = "v$Version"

# --- Update tauri.conf.json ---
$tauriConf = "src-tauri/tauri.conf.json"
(Get-Content $tauriConf) -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`"" |
    Set-Content $tauriConf

# --- Update Cargo.toml (first occurrence = package version) ---
$cargoToml = "src-tauri/Cargo.toml"
$content = Get-Content $cargoToml
$replaced = $false
$content = $content | ForEach-Object {
    if (-not $replaced -and $_ -match '^version\s*=\s*"\d+\.\d+\.\d+"') {
        $replaced = $true
        $_ -replace '"\d+\.\d+\.\d+"', "`"$Version`""
    } else {
        $_
    }
}
$content | Set-Content $cargoToml

# --- Update package.json ---
$packageJson = "package.json"
(Get-Content $packageJson) -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`"" |
    Set-Content $packageJson

Write-Host "Bumped versions to $Version"

# --- Commit, tag, push ---
git add $tauriConf $cargoToml $packageJson
git commit -m "chore: bump version to $Version"
git tag $tag
git push
git push origin $tag

Write-Host "Released $tag"
