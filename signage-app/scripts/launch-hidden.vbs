Dim fso, shell, scriptDir, rootDir, nodeExe, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
shell.CurrentDirectory = rootDir

nodeExe = rootDir & "\scripts\resolve-node.js"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
  nodeExe = "C:\Program Files\nodejs\node.exe"
ElseIf fso.FileExists(shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\node\node.exe") Then
  nodeExe = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\node\node.exe"
Else
  nodeExe = "node.exe"
End If

cmd = """" & nodeExe & """ """ & rootDir & "\scripts\dev-launcher.js"""
shell.Run cmd, 0, False
