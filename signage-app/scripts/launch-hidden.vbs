' 无黑窗启动 FindWay Agent（供 desktop.bat 调用）
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = fso.GetParentFolderName(root)
shell.Run "node scripts\dev-launcher.js", 0, False
