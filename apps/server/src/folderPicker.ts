import { promises as fs } from "node:fs";

type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

type CommandRunner = (
  cwd: string,
  command: string,
  args: string[],
  timeoutMs?: number
) => Promise<CommandResult>;

type FolderPickerResult = {
  ok: boolean;
  path?: string;
  cancelled?: boolean;
  message?: string;
};

export async function openNativeFolderPicker(
  initialPath: string,
  runCommand: CommandRunner
): Promise<FolderPickerResult> {
  const candidates = await getFolderPickerCandidates(initialPath);
  const failures: string[] = [];

  for (const candidate of candidates) {
    const result = await runCommand(process.cwd(), candidate.command, candidate.args, 1000 * 60 * 5);
    const selectedPath = result.stdout.trim();

    if (result.ok && selectedPath) {
      return {
        ok: true,
        path: normalizePickedPath(selectedPath)
      };
    }

    if (result.ok && !selectedPath) {
      return {
        ok: false,
        cancelled: true
      };
    }

    if (isFolderPickerCancel(result)) {
      return {
        ok: false,
        cancelled: true
      };
    }

    failures.push(`${result.command}\n${result.output || "No output"}`);
  }

  return {
    ok: false,
    message: [
      "Unable to open a native folder picker.",
      "Install zenity/kdialog on Linux, use macOS Finder, or run from Windows/WSL with PowerShell available.",
      "",
      "Tried:",
      ...failures.map((failure) => `- ${failure.split("\n")[0]}`)
    ].join("\n")
  };
}

async function getFolderPickerCandidates(initialPath: string): Promise<Array<{ command: string; args: string[] }>> {
  if (process.platform === "win32") {
    return getPowerShellFolderPickerCandidates(initialPath);
  }

  if (process.platform === "darwin") {
    return [
      {
        command: "osascript",
        args: ["-e", `POSIX path of (choose folder with prompt "Select repo-control workspace folder")`]
      }
    ];
  }

  if (await isWsl()) {
    return getPowerShellFolderPickerCandidates(toWindowsPickerPath(initialPath));
  }

  return [
    {
      command: "zenity",
      args: ["--file-selection", "--directory", "--title=Select repo-control workspace folder", `--filename=${initialPath}`]
    },
    {
      command: "kdialog",
      args: ["--getexistingdirectory", initialPath, "--title", "Select repo-control workspace folder"]
    }
  ];
}

function getPowerShellFolderPickerCandidates(initialPath: string): Array<{ command: string; args: string[] }> {
  const modernScript = getModernWindowsFolderPickerScript(initialPath);
  const legacyScript = getLegacyWindowsFolderPickerScript(initialPath);

  return [
    {
      command: "powershell.exe",
      args: ["-NoProfile", "-STA", "-Command", modernScript]
    },
    {
      command: "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
      args: ["-NoProfile", "-STA", "-Command", modernScript]
    },
    {
      command: "powershell.exe",
      args: ["-NoProfile", "-STA", "-Command", legacyScript]
    },
    {
      command: "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
      args: ["-NoProfile", "-STA", "-Command", legacyScript]
    }
  ];
}

function getModernWindowsFolderPickerScript(initialPath: string): string {
  const selectedPath = initialPath ? `'${escapePowerShellString(initialPath)}'` : "''";

  return `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class RepoControlFolderPicker
{
    [ComImport]
    [Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
    private class FileOpenDialog
    {
    }

    [ComImport]
    [Guid("d57c7288-d4ad-4768-be02-9d969532d960")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileOpenDialog
    {
        [PreserveSig] int Show(IntPtr parent);
        void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
        void SetFileTypeIndex(uint iFileType);
        void GetFileTypeIndex(out uint piFileType);
        void Advise(IntPtr pfde, out uint pdwCookie);
        void Unadvise(uint dwCookie);
        void SetOptions(uint fos);
        void GetOptions(out uint pfos);
        void SetDefaultFolder(IShellItem psi);
        void SetFolder(IShellItem psi);
        void GetFolder(out IShellItem ppsi);
        void GetCurrentSelection(out IShellItem ppsi);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
        void GetResult(out IShellItem ppsi);
        void AddPlace(IShellItem psi, int fdap);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
        void Close(int hr);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr pFilter);
        void GetResults(out IntPtr ppenum);
        void GetSelectedItems(out IntPtr ppsai);
    }

    [ComImport]
    [Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem
    {
        void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
        void GetParent(out IShellItem ppsi);
        void GetDisplayName(uint sigdnName, out IntPtr ppszName);
        void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
        void Compare(IShellItem psi, uint hint, out int piOrder);
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
    private static extern int SHCreateItemFromParsingName(
        string pszPath,
        IntPtr pbc,
        ref Guid riid,
        out IShellItem ppv
    );

    private const uint FOS_PICKFOLDERS = 0x00000020;
    private const uint FOS_FORCEFILESYSTEM = 0x00000040;
    private const uint FOS_NOCHANGEDIR = 0x00000008;
    private const uint FOS_PATHMUSTEXIST = 0x00000800;
    private const uint FOS_DONTADDTORECENT = 0x02000000;
    private const uint SIGDN_FILESYSPATH = 0x80058000;
    private const int ERROR_CANCELLED = unchecked((int)0x800704C7);
    private const int S_OK = 0;

    public static string Pick(string title, string initialPath)
    {
        IFileOpenDialog dialog = (IFileOpenDialog)new FileOpenDialog();
        uint options;
        dialog.GetOptions(out options);
        dialog.SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | FOS_NOCHANGEDIR | FOS_DONTADDTORECENT);
        dialog.SetTitle(title);
        dialog.SetOkButtonLabel("Select Folder");

        if (!String.IsNullOrWhiteSpace(initialPath))
        {
            IShellItem folder;
            Guid shellItemGuid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe");

            if (SHCreateItemFromParsingName(initialPath, IntPtr.Zero, ref shellItemGuid, out folder) == S_OK)
            {
                dialog.SetFolder(folder);
            }
        }

        int hr = dialog.Show(IntPtr.Zero);

        if (hr == ERROR_CANCELLED)
        {
            return "";
        }

        if (hr != S_OK)
        {
            Marshal.ThrowExceptionForHR(hr);
        }

        IShellItem result;
        dialog.GetResult(out result);

        IntPtr pathPointer;
        result.GetDisplayName(SIGDN_FILESYSPATH, out pathPointer);

        string selectedPath = Marshal.PtrToStringUni(pathPointer);
        Marshal.FreeCoTaskMem(pathPointer);

        return selectedPath ?? "";
    }
}
'@
[RepoControlFolderPicker]::Pick('Select repo-control workspace folder', ${selectedPath})
`.trim();
}

function getLegacyWindowsFolderPickerScript(initialPath: string): string {
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select repo-control workspace folder'",
    "$dialog.ShowNewFolderButton = $true",
    initialPath ? `$dialog.SelectedPath = '${escapePowerShellString(initialPath)}'` : "",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
  ]
    .filter(Boolean)
    .join("; ");
}

function isFolderPickerCancel(result: CommandResult): boolean {
  const output = result.output.toLowerCase();

  return result.exitCode !== null && !result.stdout.trim() && (output.includes("cancel") || output.trim().length === 0);
}

async function isWsl(): Promise<boolean> {
  if (process.env.WSL_DISTRO_NAME) {
    return true;
  }

  const version = await fs.readFile("/proc/version", "utf8").catch(() => "");
  return version.toLowerCase().includes("microsoft") || version.toLowerCase().includes("wsl");
}

function toWindowsPickerPath(localPath: string): string {
  const mountMatch = localPath.match(/^\/mnt\/([a-z])\/(.*)$/i);

  if (mountMatch) {
    return `${mountMatch[1].toUpperCase()}:\\${mountMatch[2].replaceAll("/", "\\")}`;
  }

  if (process.env.WSL_DISTRO_NAME && localPath.startsWith("/")) {
    return `\\\\wsl.localhost\\${process.env.WSL_DISTRO_NAME}${localPath.replaceAll("/", "\\")}`;
  }

  return localPath;
}

function normalizePickedPath(pickedPath: string): string {
  const normalized = pickedPath.replace(/\r/g, "").trim();
  const driveMatch = normalized.match(/^([A-Za-z]):[\\/](.*)$/);

  if (process.platform !== "win32" && driveMatch) {
    return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2].replaceAll("\\", "/")}`;
  }

  const wslShareMatch = normalized.match(/^\\\\wsl(?:\.localhost)?\\[^\\]+\\(.+)$/i);

  if (process.platform !== "win32" && wslShareMatch) {
    return `/${wslShareMatch[1].replaceAll("\\", "/")}`;
  }

  return normalized;
}

function escapePowerShellString(value: string): string {
  return value.replaceAll("'", "''");
}
