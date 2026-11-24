using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

// Poll only keys configured by the application. The process never records text.
internal static class HotkeyMonitor
{
    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int key);

    private static readonly object Gate = new object();
    private static HashSet<int> watched = new HashSet<int>();
    private static readonly HashSet<int> down = new HashSet<int>();

    private static void ReadConfiguration()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            var next = new HashSet<int>();
            foreach (var part in line.Split(','))
            {
                int key;
                if (int.TryParse(part, out key) && key > 0 && key < 256) next.Add(key);
            }
            lock (Gate)
            {
                watched = next;
                down.Clear();
            }
        }
        Environment.Exit(0);
    }

    private static void Main()
    {
        Console.OutputEncoding = System.Text.Encoding.ASCII;
        var reader = new Thread(ReadConfiguration) { IsBackground = true };
        reader.Start();
        while (true)
        {
            lock (Gate)
            {
                foreach (var key in watched)
                {
                    bool pressed = (GetAsyncKeyState(key) & 0x8000) != 0;
                    if (pressed && down.Add(key)) Console.WriteLine("D " + key);
                    else if (!pressed && down.Remove(key)) Console.WriteLine("U " + key);
                }
            }
            Thread.Sleep(16);
        }
    }
}
