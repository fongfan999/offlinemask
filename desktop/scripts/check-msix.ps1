# Install the test-signed MSIX from desktop/artifacts/msix, prove the packaged helper
# loads its runtime and the app starts, uninstall, then run the Windows App
# Certification Kit as a report (decision 0117). Used by the release and MSIX workflows.
$ErrorActionPreference = 'Stop'
$msix = Resolve-Path 'desktop/artifacts/msix'
$signed = Get-ChildItem "$msix/*_test-signed.msix" | Select-Object -First 1
$cer = Get-ChildItem "$msix/*_test-signed.cer" | Select-Object -First 1
if (-not $signed -or -not $cer) { throw 'Run build-msix.mjs --test-sign first' }

Import-Certificate -FilePath $cer.FullName -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null
Add-AppxPackage -Path $signed.FullName
$package = Get-AppxPackage | Where-Object { $_.Name -like '*OfflineMask*' } | Select-Object -First 1
if (-not $package) { throw 'The MSIX did not install' }
"Installed $($package.PackageFullName) at $($package.InstallLocation)"
# The bundled helper must load its runtime from the read-only package folder.
mise exec -- node desktop/scripts/smoke-native-helper.mjs (Join-Path $package.InstallLocation 'native')
if ($LASTEXITCODE) { throw 'The packaged recognition helper failed its smoke test' }
Start-Process "shell:AppsFolder\$($package.PackageFamilyName)!OfflineMask"
Start-Sleep -Seconds 20
$running = Get-Process -Name OfflineMask -ErrorAction SilentlyContinue
if (-not $running) { throw 'OfflineMask was not running 20 s after launch from the package' }
"OfflineMask is running (pid $($running.Id -join ', '))"
$running | Stop-Process -Force
Remove-AppxPackage -Package $package.PackageFullName

$appcert = 'C:\Program Files (x86)\Windows Kits\10\App Certification Kit\appcert.exe'
if (-not (Test-Path $appcert)) {
  '::warning::appcert.exe is not on this runner; run WACK on a Windows PC before submitting.'
  exit 0
}
$report = Join-Path $msix 'wack-report.xml'
& $appcert reset | Out-Null
& $appcert test -appxpackagepath $signed.FullName -reportoutputpath $report
if (-not (Test-Path $report)) { '::warning::WACK wrote no report'; exit 0 }
[xml]$xml = Get-Content $report
"WACK overall: $($xml.REPORT.OVERALL_RESULT)"
$xml.SelectNodes('//TEST[RESULT="FAIL"]') | ForEach-Object { "::warning::WACK failed: $($_.NAME)" }
exit 0
