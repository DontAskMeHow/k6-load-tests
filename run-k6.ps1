param(
  [string]$EnvFile = ".env",
  [string]$Output = "experimental-prometheus-rw",
  [string]$Script = "main.js"
)

if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith('#')) {
      return
    }

    $separatorIndex = $line.IndexOf('=')

    if ($separatorIndex -lt 1) {
      return
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:5000" }
$appName = if ($env:APP) { $env:APP } else { "kiosk" }
$testId = if ($env:K6_TESTID) { $env:K6_TESTID } else { "local" }
$remoteWriteUrl = $env:K6_PROMETHEUS_RW_SERVER_URL
$frontendMode = if ($env:OFFICE_MODE) { $env:OFFICE_MODE } else { "mixed" }
$serviceMode = if ($env:FIELD_SCENARIO_MODE) { $env:FIELD_SCENARIO_MODE } else { "simple" }

if ($Output -eq "experimental-prometheus-rw" -and $remoteWriteUrl) {
  if ($remoteWriteUrl -match "/api/v1/import/prometheus/?$") {
    throw "K6_PROMETHEUS_RW_SERVER_URL points to /api/v1/import/prometheus, but k6 experimental-prometheus-rw requires Prometheus Remote Write endpoint, usually /api/v1/write for VictoriaMetrics."
  }
}

k6 run -o $Output --tag "testid=$testId" -e "BASE_URL=$baseUrl" -e "APP=$appName" -e "OFFICE_MODE=$frontendMode" -e "FIELD_SCENARIO_MODE=$serviceMode" $Script

