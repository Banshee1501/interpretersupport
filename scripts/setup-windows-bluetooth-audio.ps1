<#
.SYNOPSIS
  Automates most of the Windows audio setup needed to transcribe system/call
  audio (e.g. a Zoom/Meet/Teams call) when your output device is a Bluetooth
  headset, without routing your own microphone into the transcription.

.WHAT THIS SCRIPT DOES
  1. Downloads and silently installs VB-CABLE (if not already installed).
  2. Installs the "AudioDeviceCmdlets" PowerShell module (if missing).
  3. Sets "CABLE Input (VB-Audio Virtual Cable)" as the default PLAYBACK device.
  4. Sets "CABLE Output (VB-Audio Virtual Cable)" as the default RECORDING device.

.WHAT YOU STILL HAVE TO DO BY HAND (Windows does not expose these via any
  API or command line, only through the GUI):
  1. Control Panel > Sound > Recording tab > right-click "CABLE Output" >
     Properties > Listen tab > check "Listen to this device" > under
     "Playback through this device" choose your Bluetooth headphones > OK.
     (This is what lets you keep hearing the call through your headphones.)
  2. In your call app (Zoom/Meet/Teams), manually set the microphone to your
     real Bluetooth headset (not "Default"), so your own voice still reaches
     the call normally.

.USAGE
  Run from an elevated PowerShell (Run as Administrator):
      powershell -ExecutionPolicy Bypass -File .\setup-windows-bluetooth-audio.ps1

  A restart of VB-CABLE-dependent apps (or a reboot) may be required the
  first time VB-CABLE is installed.
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# 1. Install VB-CABLE if not already present
# ---------------------------------------------------------------------------
Write-Step "Checking for VB-CABLE..."

$cablePresent = Get-CimInstance Win32_SoundDevice | Where-Object { $_.Name -like "*CABLE*" }

if ($cablePresent) {
    Write-Host "VB-CABLE already installed, skipping download." -ForegroundColor Green
} else {
    Write-Step "Downloading VB-CABLE from the official vb-audio.com site..."
    $zipUrl  = "https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip"
    $zipPath = Join-Path $env:TEMP "VBCABLE_Driver_Pack.zip"
    $extractPath = Join-Path $env:TEMP "VBCABLE_Driver_Pack"

    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

    Write-Step "Running the VB-CABLE installer (silent mode)..."
    $setupExe = Get-ChildItem -Path $extractPath -Filter "VBCABLE_Setup_x64.exe" -Recurse | Select-Object -First 1
    if (-not $setupExe) {
        $setupExe = Get-ChildItem -Path $extractPath -Filter "VBCABLE_Setup.exe" -Recurse | Select-Object -First 1
    }
    if (-not $setupExe) {
        throw "Could not find the VB-CABLE installer inside the downloaded package. Install it manually from https://vb-audio.com/Cable/"
    }

    Start-Process -FilePath $setupExe.FullName -ArgumentList "-i -h" -Wait
    Write-Host "VB-CABLE installer finished. A reboot may be required for it to appear as an audio device." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 2. Install AudioDeviceCmdlets (lets us set default devices from the CLI)
# ---------------------------------------------------------------------------
Write-Step "Checking for the AudioDeviceCmdlets PowerShell module..."

if (-not (Get-Module -ListAvailable -Name AudioDeviceCmdlets)) {
    Write-Step "Installing AudioDeviceCmdlets from the PowerShell Gallery..."
    Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null
    Install-Module -Name AudioDeviceCmdlets -Force -Scope CurrentUser
} else {
    Write-Host "AudioDeviceCmdlets already installed." -ForegroundColor Green
}

Import-Module AudioDeviceCmdlets

# ---------------------------------------------------------------------------
# 3. Set CABLE Input as default playback, CABLE Output as default recording
# ---------------------------------------------------------------------------
Write-Step "Looking for CABLE Input / CABLE Output audio endpoints..."

$devices = Get-AudioDevice -List
$cableInput  = $devices | Where-Object { $_.Name -like "*CABLE Input*" -and $_.Type -eq "Playback" }
$cableOutput = $devices | Where-Object { $_.Name -like "*CABLE Output*" -and $_.Type -eq "Recording" }

if (-not $cableInput -or -not $cableOutput) {
    Write-Host "Could not find CABLE Input/Output yet. If VB-CABLE was just installed, reboot and re-run this script." -ForegroundColor Yellow
} else {
    Write-Step "Setting 'CABLE Input' as the default playback device..."
    Set-AudioDevice -ID $cableInput.ID

    Write-Step "Setting 'CABLE Output' as the default recording device..."
    Set-AudioDevice -ID $cableOutput.ID

    Write-Host "Default playback/recording devices configured." -ForegroundColor Green
}

Write-Step "Done with the part this script can automate."
Write-Host ""
Write-Host "Remaining manual steps (Windows only allows these via the GUI):" -ForegroundColor Yellow
Write-Host "  1. Control Panel > Sound > Recording tab > right-click 'CABLE Output' >"
Write-Host "     Properties > Listen tab > check 'Listen to this device' > choose your"
Write-Host "     Bluetooth headphones as the playback device > OK."
Write-Host "  2. In Zoom/Meet/Teams, set the microphone to your real Bluetooth headset"
Write-Host "     (not 'Default'), so your own voice keeps reaching the call."
Write-Host "  3. In the 'Interprete en Vivo' website, choose 'Microfono' as the source."
