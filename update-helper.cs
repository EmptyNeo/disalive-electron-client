using System;
using System.Diagnostics;

internal static class UpdateHelper
{
    private static int Main(string[] args)
    {
        if (args.Length != 3) return 1;
        int parentId;
        if (!int.TryParse(args[0], out parentId)) return 1;
        try
        {
            using (var parent = Process.GetProcessById(parentId))
            {
                if (!parent.WaitForExit(60000)) return 4;
            }
        }
        catch (ArgumentException) { }

        try
        {
            using (var installer = Process.Start(new ProcessStartInfo {
                FileName = args[1], Arguments = "/S", UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden
            }))
            {
                if (installer == null) { Restart(args[2]); return 2; }
                installer.WaitForExit();
                if (installer.ExitCode != 0) { Restart(args[2]); return installer.ExitCode; }
            }
            Restart(args[2]);
            return 0;
        }
        catch (Exception) { Restart(args[2]); return 3; }
    }

    private static void Restart(string executable)
    {
        try { Process.Start(new ProcessStartInfo { FileName = executable, UseShellExecute = true }); }
        catch (Exception) { }
    }
}
