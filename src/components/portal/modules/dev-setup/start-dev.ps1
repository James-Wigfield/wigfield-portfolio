<#
  start-dev.ps1 - one action opens the whole dev layout.
    Right-hand monitor: one Windows Terminal, Claude Code in a pane grid
    Left-hand monitor:  VS Code (narrow) | Chrome   (the same in A and B)
    Chosen by position in Settings > Display, so it doesn't matter which is primary.

  Run:   powershell -NoProfile -ExecutionPolicy Bypass -File start-dev.ps1 -Layout A|B [-DryRun]
  A      3x2 grid: 5 Portara + 1 Wigfield      B   4x2 grid: 6 Portara + 2 Wigfield
  Every session keeps its name and /color in both layouts. -DryRun prints the plan and opens nothing.
#>
param([ValidateSet('A', 'B')][string]$Layout = 'A', [switch]$DryRun)

# ---- edit me --------------------------------------------------------------
$Docs     = "$HOME\Documents"
$Portara  = "$Docs\business\portara-repo"
$Wigfield = "$Docs\personal-projects\wigfield-portfolio"
# Every session: folder, name, /color. These are all 8 colours that /color accepts.
$Sessions = @{
  P1 = @($Portara, 'portara-repo-1', 'red');     P2 = @($Portara, 'portara-repo-2', 'blue')
  P3 = @($Portara, 'portara-repo-3', 'green');   P4 = @($Portara, 'portara-repo-4', 'purple')
  P5 = @($Portara, 'portara-repo-5', 'pink');    P6 = @($Portara, 'portara-repo-6', 'cyan')
  W1 = @($Wigfield, 'wigfield-portfolio-1', 'yellow')
  W2 = @($Wigfield, 'wigfield-portfolio-2', 'orange')
}
# Which session fills each pane: left to right, top row first.
$Grid = @{
  A = @('P1', 'P2', 'P3',        'P4', 'P5', 'W1')         # 3x2
  B = @('P1', 'P2', 'P3', 'P4',  'P5', 'P6', 'W1', 'W2')   # 4x2
}
$Claude    = 'claude --dangerously-skip-permissions'   # same as today
$Workspace = "$Docs\dev.code-workspace"                # multi-root: one VS Code window
$ChromeProfile = 'Profile 2'                           # Chrome profile for the Portara account
$Urls      = @()                                       # empty = Chrome's normal new-tab page
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
# wt arguments for one session: its folder, then Claude Code with its name and /color.
function Get-Run([string]$Key) {
  $dir, $name, $color = $Sessions[$Key]
  "-d `"$dir`" powershell -NoExit -Command $Claude -n $name '/color $color'"
}
# The grid is built ONE SPLIT PER wt CALL, and every call first focuses the pane it splits
# by its id. Never chain two splits in one call: wt splits whichever pane is active, and a
# brand-new pane isn't active yet while it is still starting (Claude panes take seconds),
# so the next split lands on an older pane. Seen 2026-11-18 on a real launch: the top row,
# still sent as one burst, came out red|green|blue at 1/6|1/6|2/3. Probe panes start too
# fast to show this, so test with real Claude panes.
# Pane ids count up in creation order: 0..Cols-1 = top row, then the bottom row.
function Get-Steps([string[]]$Keys, [int]$Cols, [string]$Win) {
  $s = @("-w $Win $(Get-Run $Keys[0])")                     # new named window: pane 0, top-left
  for ($c = 1; $c -lt $Cols; $c++) {                        # top row: split pane c-1 to the right
    $share = [math]::Round(($Cols - $c) / ($Cols - $c + 1), 3)
    $s += "-w $Win fp -t $($c - 1) ; sp -V -s $share $(Get-Run $Keys[$c])"
  }
  for ($c = 0; $c -lt $Cols; $c++) {                        # bottom row: split top pane c down
    $s += "-w $Win fp -t $c ; sp -H -s 0.5 $(Get-Run $Keys[$Cols + $c])"
  }
  $s
}

# By position, not by primary: Claude grid on the right-hand screen, VS Code + Chrome on the left.
$screens = @([System.Windows.Forms.Screen]::AllScreens | Sort-Object { $_.Bounds.X })
if ($screens.Count -lt 2) { throw 'Second monitor not found.' }
$Side = $screens[0].WorkingArea      # left on the desk
$Term = $screens[-1].WorkingArea     # right on the desk

$cols = if ($Layout -eq 'B') { 4 } else { 3 }
$codeW = 560; $webW = $Side.Width - $codeW                         # side monitor: same in A and B
$win   = "dev$Layout-$(Get-Date -Format HHmmss)"                   # this grid's own window
$steps = @(Get-Steps $Grid[$Layout] $cols $win)

if ($DryRun) {
  "Layout $Layout  ($cols x 2)"
  for ($i = 0; $i -lt $Grid[$Layout].Count; $i++) {
    $dir, $name, $color = $Sessions[$Grid[$Layout][$i]]
    "  pane {0}  row {1}  {2,-22} {3,-7} {4}" -f ($i + 1), ([math]::Floor($i / $cols) + 1), $name, $color, $dir
  }
  "Claude grid -> $Term"
  "VS Code     -> x $($Side.X), $codeW px wide ($Workspace)"
  "Chrome      -> x $($Side.X + $codeW), $webW px wide"
  ''
  $steps | ForEach-Object { "wt.exe $_" }
  return
}

# 1. Claude Code grid -> terminal monitor, maximised. Open the window with pane 0, then send
#    each split as its own call, with a pause so every new pane has settled before the next.
$before = Get-Wins 'WindowsTerminal' | ForEach-Object Handle
Start-Process wt.exe -ArgumentList $steps[0]
$h = Wait-NewWin 'WindowsTerminal' $before
Start-Sleep -Milliseconds 1200
foreach ($s in $steps[1..($steps.Count - 1)]) { Start-Process wt.exe -ArgumentList $s; Start-Sleep -Milliseconds 700 }
if ($h) { [DevWin]::Place($h, $Term.X, $Term.Y, $Term.Width, $Term.Height, $true) }

# 2. VS Code -> narrow strip on the outer edge
$before = Get-Wins 'Code' | ForEach-Object Handle
Start-Process $CodeExe -ArgumentList "-n `"$Workspace`""
$h = Wait-NewWin 'Code' $before 12
if (-not $h) { $h = (Get-Wins 'Code' | Where-Object Title -like '*dev (Workspace)*' | Select-Object -First 1).Handle }   # already open
if ($h) { [DevWin]::Place($h, $Side.X, $Side.Y, $codeW, $Side.Height, $false) }

# 3. Chrome -> the rest of the side monitor, next to the seam
$before = Get-Wins 'chrome' | ForEach-Object Handle
Start-Process $ChromeExe -ArgumentList (@("--profile-directory=`"$ChromeProfile`"", '--new-window') + $Urls)
$h = Wait-NewWin 'chrome' $before
if ($h) { [DevWin]::Place($h, ($Side.X + $codeW), $Side.Y, $webW, $Side.Height, $false) }
