Dim fso, shell, scriptDir, rootDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
shell.CurrentDirectory = rootDir
shell.Run "node """ & rootDir & "\scripts\dev-launcher.js""", 0, False
