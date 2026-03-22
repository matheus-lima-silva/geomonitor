param(
    [ValidateSet('homologacao', 'producao')]
    [string]$Environment = 'homologacao',
    [Parameter(Mandatory = $true)]
    [string]$Org,
    [string]$Region = 'gru',
    [string]$PostgresClusterName,
    [string]$TigrisBucketName,
    [string]$PostgresPlan = 'basic',
    [int]$PostgresVolumeSize = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-AppNames {
    param([string]$TargetEnvironment)

    if ($TargetEnvironment -eq 'producao') {
        return @{
            Web = 'geomonitor-web'
            Api = 'geomonitor-api'
            Worker = 'geomonitor-worker'
        }
    }

    return @{
        Web = 'geomonitor-web-hml'
        Api = 'geomonitor-api-hml'
        Worker = 'geomonitor-worker-hml'
    }
}

function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host "### $Title" -ForegroundColor Cyan
}

$apps = Resolve-AppNames -TargetEnvironment $Environment
$pgName = if ($PostgresClusterName) { $PostgresClusterName } elseif ($Environment -eq 'producao') { 'geomonitor-pg' } else { 'geomonitor-pg-hml' }
$bucketName = if ($TigrisBucketName) { $TigrisBucketName } elseif ($Environment -eq 'producao') { 'geomonitor-media' } else { 'geomonitor-media-hml' }

Write-Host "Playbook de bootstrap Fly.io para '$Environment'" -ForegroundColor Green
Write-Host "Organizacao: $Org"
Write-Host "Regiao primaria: $Region"

Write-Section 'Criacao dos apps'
@(
    "fly apps create $($apps.Web) -o $Org -y",
    "fly apps create $($apps.Api) -o $Org -y",
    "fly apps create $($apps.Worker) -o $Org -y"
) | ForEach-Object { Write-Host $_ }

Write-Section 'Managed Postgres'
Write-Host "fly mpg create --name $pgName -o $Org -r $Region --plan $PostgresPlan --volume-size $PostgresVolumeSize"
Write-Host '# Depois da criacao, anote o cluster ID retornado por `fly mpg list`.'
Write-Host "fly mpg attach <cluster-id> -a $($apps.Api)"
Write-Host "fly mpg attach <cluster-id> -a $($apps.Worker)"

Write-Section 'Bucket Tigris'
Write-Host "fly storage create -a $($apps.Api) -n $bucketName -o $Org -y"
Write-Host '# Copie os secrets retornados pelo comando acima e replique no worker.'

Write-Section 'Secrets de runtime'
Write-Host "fly secrets set FIREBASE_SERVICE_ACCOUNT_JSON='<json>' DATA_BACKEND=postgres MEDIA_BACKEND=tigris REPORT_EXECUTION_BACKEND=python -a $($apps.Api)"
Write-Host "fly secrets set AWS_ACCESS_KEY_ID='<value>' AWS_SECRET_ACCESS_KEY='<value>' AWS_REGION='<value>' AWS_ENDPOINT_URL_S3='<value>' BUCKET_NAME='$bucketName' -a $($apps.Worker)"

Write-Section 'Deploy inicial'
Write-Host ".\\scripts\\fly\\deploy.ps1 -Environment $Environment -Targets api,web,worker"

Write-Section 'Checks finais'
Write-Host "fly status -a $($apps.Api)"
Write-Host "fly status -a $($apps.Web)"
Write-Host "fly status -a $($apps.Worker)"
Write-Host "fly scale count 1 --app $($apps.Api) --region $Region --yes"
Write-Host "fly scale count 1 --app $($apps.Web) --region $Region --yes"
Write-Host "fly scale count 1 --app $($apps.Worker) --region $Region --yes"
