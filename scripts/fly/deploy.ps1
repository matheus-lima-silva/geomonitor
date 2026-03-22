param(
    [ValidateSet('homologacao', 'producao')]
    [string]$Environment = 'homologacao',
    [string[]]$Targets = @('api', 'web', 'worker'),
    [switch]$RemoteOnly = $true,
    [switch]$Ha = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ConfigPath {
    param(
        [string]$TargetEnvironment,
        [string]$Target
    )

    $map = @{
        api = "deploy/fly/$TargetEnvironment/api.toml"
        web = "deploy/fly/$TargetEnvironment/web.toml"
        worker = "deploy/fly/$TargetEnvironment/worker.toml"
    }

    return $map[$Target]
}

function Resolve-DockerfilePath {
    param([string]$Target)

    $map = @{
        api = 'backend/Dockerfile'
        web = 'Dockerfile'
        worker = 'worker/Dockerfile'
    }

    return $map[$Target]
}

function Invoke-FlyDeploy {
    param(
        [string]$ConfigPath,
        [string]$DockerfilePath
    )

    $arguments = @(
        'deploy',
        '--config', $ConfigPath,
        '--dockerfile', $DockerfilePath,
        '--strategy', 'rolling'
    )

    if ($RemoteOnly) {
        $arguments += '--remote-only'
    }

    if (-not $Ha) {
        $arguments += '--ha=false'
    }

    Write-Host ("fly " + ($arguments -join ' ')) -ForegroundColor Cyan
    & fly @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar deploy com $ConfigPath"
    }
}

foreach ($target in $Targets) {
    $normalizedTarget = $target.ToLowerInvariant()
    if ($normalizedTarget -notin @('api', 'web', 'worker')) {
        throw "Target nao suportado: $target"
    }

    $configPath = Resolve-ConfigPath -TargetEnvironment $Environment -Target $normalizedTarget
    $dockerfilePath = Resolve-DockerfilePath -Target $normalizedTarget
    Invoke-FlyDeploy -ConfigPath $configPath -DockerfilePath $dockerfilePath
}
