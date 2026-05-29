Dim fso, shell, scriptDir, rootDir, launcher

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
launcher = fso.BuildPath(scriptDir, "launch.cmd")

shell.CurrentDirectory = rootDir
shell.Run Chr(34) & launcher & Chr(34), 0, False
