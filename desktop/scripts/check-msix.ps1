# Install the test-signed MSIX from desktop/artifacts/msix, check the helper files are in
# it and the app starts, uninstall, then run the Windows App
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
# Files under WindowsApps can only be started by the package's own processes, so the
# recognition helper cannot be smoke-tested from here (spawn EPERM). The app starts it
# itself; that path is part of the manual test with the recognition pack installed.
foreach ($file in 'native\recognition-sidecar.exe', 'native\onnxruntime.dll') {
  if (-not (Test-Path (Join-Path $package.InstallLocation $file))) { throw "The package is missing $file" }
}
$launched = Get-Date
Start-Process "shell:AppsFolder\$($package.PackageFamilyName)!OfflineMask"
Start-Sleep -Seconds 20
$running = Get-Process -Name OfflineMask -ErrorAction SilentlyContinue
if (-not $running) {
  # Tell a crash in the package from a runner that cannot activate packaged apps.
  '--- Application errors since launch'
  Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Level = 1, 2; StartTime = $launched } -ErrorAction SilentlyContinue |
    Select-Object -First 10 | ForEach-Object { "$($_.ProviderName): $($_.Message)" }
  '--- Activation events since launch'
  foreach ($log in 'Microsoft-Windows-TWinUI/Operational', 'Microsoft-Windows-AppModel-Runtime/Admin', 'Microsoft-Windows-AppXDeploymentServer/Operational') {
    Get-WinEvent -FilterHashtable @{ LogName = $log; StartTime = $launched } -ErrorAction SilentlyContinue |
      Where-Object { $_.Level -le 3 } | Select-Object -First 10 | ForEach-Object { "$log $($_.Id): $($_.Message)" }
  }
  $plain = Resolve-Path 'desktop/src-tauri/target/release/OfflineMask.exe' -ErrorAction SilentlyContinue
  if ($plain) {
    '--- The same build started unpackaged'
    $process = Start-Process -FilePath $plain -PassThru
    Start-Sleep -Seconds 20
    if ($process.HasExited) { "Unpackaged app exited with code $($process.ExitCode)" } else { 'Unpackaged app is running'; $process | Stop-Process -Force }
  }
  throw 'OfflineMask was not running 20 s after launch from the package'
}
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
