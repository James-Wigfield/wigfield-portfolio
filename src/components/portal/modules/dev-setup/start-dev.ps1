<#
  start-dev.ps1 - one action opens the whole dev layout.
    Terminal monitor (primary): one Windows Terminal, Claude Code in a pane grid
    Side monitor:               VS Code (narrow) | Chrome   [+ one tall Claude with -Max]

  Run:   powershell -NoProfile -ExecutionPolicy Bypass -File start-dev.ps1 [-Max]
  -Max   4x2 grid (8 panes) + a 9th tall session on the side monitor
#>
param([switch]$Max)

# ---- edit me --------------------------------------------------------------
$Docs    = "$HOME\Documents"
$Portara = "$Docs\business\portara-repo"
# One folder per pane, left to right, top row first (6 for the grid, 8 with -Max).
$Panes = @(
  $Portara, $Portara, $Portara,
  "$Docs\personal-projects\wigfield-portfolio",
  "$Docs\university\cits4010\honours-dissertation",
  "$Docs\personal-projects\usa-trip",
  "$Docs\university\cits5017\cits5017-project-two",
  "$Docs\university\cits4010\Mamba_PSMA"
)
$TallPane  = $Portara                                  # -Max only
$Claude    = 'claude --dangerously-skip-permissions'   # same as today
$Workspace = "$Docs\dev.code-workspace"                # multi-root: one VS Code window
$ChromeProfile = 'Profile 3'                           # Chrome profile "James" (last used)
$Urls      = @('https://github.com/tiboto/portara-repo')   # add your localhost dev URL
$CodeExe   = "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe"
$ChromeExe = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# ---------------------------------------------------------------------------

Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class DevWin {
  public struct RECT { public int L, T, R, B; }
  public class Info { public IntPtr Handle; public uint Pid; public string Title; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int size);

  public static List<Info> Visible() {
    var list = new List<Info>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;   // skip hidden + owned popups
      var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
      if (sb.Length == 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      list.Add(new Info { Handle = h, Pid = pid, Title = sb.ToString() });
      return true;
    }, IntPtr.Zero);
    return list;
  }

  // Place the VISIBLE frame at x,y,w,h (Windows 11 adds ~7px invisible borders).
  public static void Place(IntPtr h, int x, int y, int w, int hh, bool maximize) {
    ShowWindow(h, 9);                                                  // SW_RESTORE
    RECT wr, fr; GetWindowRect(h, out wr);
    int l = 0, t = 0, r = 0, b = 0;
    if (DwmGetWindowAttribute(h, 9, out fr, Marshal.SizeOf(typeof(RECT))) == 0) {
      l = fr.L - wr.L; t = fr.T - wr.T; r = wr.R - fr.R; b = wr.B - fr.B;
    }
    SetWindowPos(h, IntPtr.Zero, x - l, y - t, w + l + r, hh + t + b, 0x0044); // NOZORDER|SHOWWINDOW
    if (maximize) ShowWindow(h, 3);                                    // SW_MAXIMIZE on that monitor
  }
}
'@
[void][DevWin]::SetProcessDpiAwarenessContext([IntPtr]-4)

function Get-Wins([string]$Name) {
  $ids = @(Get-Process -Name $Name -ErrorAction SilentlyContinue | ForEach-Object Id)
  @([DevWin]::Visible() | Where-Object { $ids -contains $_.Pid })
}
function Wait-NewWin([string]$Name, $Before, [int]$Seconds = 20) {
  $until = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $until) {
    $new = Get-Wins $Name | Where-Object { $Before -notcontains $_.Handle } | Select-Object -First 1
    if ($new) { Start-Sleep -Milliseconds 400; return $new.Handle }
    Start-Sleep -Milliseconds 250
  }
  Write-Warning "No new $Name window after $Seconds s - left where it opened."
}
# wt arguments for a cols x 2 grid of panes, each running Claude Code in its folder.
function Get-GridArgs([string[]]$Dirs, [int]$Cols) {
  $run = "powershell -NoExit -Command $Claude"
  $a = @("-w new -d `"$($Dirs[0])`" $run")
  for ($c = 1; $c -lt $Cols; $c++) {                       # top row, left to right
    $share = [math]::Round(($Cols - $c) / ($Cols - $c + 1), 3)
    $a += "sp -V -s $share -d `"$($Dirs[$c])`" $run"
  }
  $a += @('mf left') * ($Cols - 1)                         # back to top-left
  for ($c = 0; $c -lt $Cols; $c++) {                       # split each column down
    if ($c -gt 0) { $a += 'mf right' }
    $a += "sp -H -s 0.5 -d `"$($Dirs[$Cols + $c])`" $run"
  }
  $a -join ' ; '
}

$screens = [System.Windows.Forms.Screen]::AllScreens
$Term = ($screens | Where-Object Primary).WorkingArea                 # 2560x1392 at x 0
$Side = ($screens | Where-Object { -not $_.Primary }).WorkingArea     # 2560x1392 at x -2560
if (-not $Side) { throw 'Second monitor not found.' }

$cols = if ($Max) { 4 } else { 3 }
if ($Max) { $codeW = 480; $webW = 1440 } else { $codeW = 560; $webW = $Side.Width - 560 }

# 1. Claude Code grid -> terminal monitor, maximised
$before = Get-Wins 'WindowsTerminal' | ForEach-Object Handle
Start-Process wt.exe -ArgumentList (Get-GridArgs $Panes[0..($cols * 2 - 1)] $cols)
$h = Wait-NewWin 'WindowsTerminal' $before
if ($h) { [DevWin]::Place($h, $Term.X, $Term.Y, $Term.Width, $Term.Height, $true) }

# 2. Tall 9th session against the seam (-Max only)
if ($Max) {
  $before = Get-Wins 'WindowsTerminal' | ForEach-Object Handle
  Start-Process wt.exe -ArgumentList "-w new -d `"$TallPane`" powershell -NoExit -Command $Claude"
  $h = Wait-NewWin 'WindowsTerminal' $before
  if ($h) { [DevWin]::Place($h, ($Side.X + $codeW + $webW), $Side.Y, ($Side.Width - $codeW - $webW), $Side.Height, $false) }
}

# 3. VS Code -> narrow strip on the outer edge
$before = Get-Wins 'Code' | ForEach-Object Handle
Start-Process $CodeExe -ArgumentList "-n `"$Workspace`""
$h = Wait-NewWin 'Code' $before 12
if (-not $h) { $h = (Get-Wins 'Code' | Where-Object Title -like '*dev (Workspace)*' | Select-Object -First 1).Handle }   # already open
if ($h) { [DevWin]::Place($h, $Side.X, $Side.Y, $codeW, $Side.Height, $false) }

# 4. Chrome -> the rest of the side monitor, next to the seam
$before = Get-Wins 'chrome' | ForEach-Object Handle
Start-Process $ChromeExe -ArgumentList (@("--profile-directory=`"$ChromeProfile`"", '--new-window') + $Urls)
$h = Wait-NewWin 'chrome' $before
if ($h) { [DevWin]::Place($h, ($Side.X + $codeW), $Side.Y, $webW, $Side.Height, $false) }
