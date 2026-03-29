using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        try
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            var installRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "KidsBookStudio");
            Directory.CreateDirectory(installRoot);
            var appFolder = Path.Combine(
                installRoot,
                $"KidsBook Studio {DateTime.UtcNow:yyyyMMddHHmmss}");

            Directory.CreateDirectory(appFolder);
            ExtractPayload(appFolder);
            CreateShortcuts(appFolder);
            LaunchApp(appFolder);

            MessageBox.Show(
                "KidsBook Studio a ete installe.",
                "KidsBook Studio",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);

            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.ToString(),
                "KidsBook Studio - Installation error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void ExtractPayload(string targetRoot)
    {
        var payloadStream = typeof(Program).Assembly
            .GetManifestResourceStream("KidsBookStudioSetup.payload.zip")
            ?? throw new InvalidOperationException("Payload resource not found.");

        using var archive = new ZipArchive(payloadStream, ZipArchiveMode.Read, leaveOpen: false);
            foreach (var entry in archive.Entries)
            {
                var destinationPath = Path.Combine(targetRoot, entry.FullName.Replace('/', Path.DirectorySeparatorChar));

                if (string.IsNullOrEmpty(entry.Name))
                {
                    Directory.CreateDirectory(destinationPath);
                    continue;
                }

                var destinationDirectory = Path.GetDirectoryName(destinationPath);
                if (!string.IsNullOrEmpty(destinationDirectory))
                {
                    Directory.CreateDirectory(destinationDirectory);
                }

                using var source = entry.Open();
                using var destination = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None);
                source.CopyTo(destination);
            }
        }

    private static void CreateShortcuts(string appFolder)
    {
        var electronExe = Path.Combine(appFolder, "node_modules", "electron", "dist", "electron.exe");
        if (!File.Exists(electronExe))
        {
            throw new FileNotFoundException("Electron executable not found in installed payload.", electronExe);
        }

        var desktopShortcut = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
            "KidsBook Studio.lnk");

        var startMenuFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
            "Programs",
            "KidsBook Studio");
        Directory.CreateDirectory(startMenuFolder);

        var startMenuShortcut = Path.Combine(startMenuFolder, "KidsBook Studio.lnk");

        CreateShortcut(desktopShortcut, electronExe, "\".\"", appFolder, electronExe);
        CreateShortcut(startMenuShortcut, electronExe, "\".\"", appFolder, electronExe);
    }

    private static void CreateShortcut(string shortcutPath, string targetPath, string arguments, string workingDirectory, string iconPath)
    {
        var shellType = Type.GetTypeFromProgID("WScript.Shell")
            ?? throw new InvalidOperationException("WScript.Shell COM component is not available.");

        dynamic shell = Activator.CreateInstance(shellType)
            ?? throw new InvalidOperationException("Failed to create WScript.Shell instance.");

        dynamic shortcut = shell.CreateShortcut(shortcutPath);
        shortcut.TargetPath = targetPath;
        shortcut.Arguments = arguments;
        shortcut.WorkingDirectory = workingDirectory;
        shortcut.IconLocation = iconPath;
        shortcut.Description = "KidsBook Studio";
        shortcut.Save();
    }

    private static void LaunchApp(string appFolder)
    {
        var electronExe = Path.Combine(appFolder, "node_modules", "electron", "dist", "electron.exe");
        Process.Start(new ProcessStartInfo
        {
            FileName = electronExe,
            Arguments = ".",
            WorkingDirectory = appFolder,
            UseShellExecute = false
        });
    }
}
