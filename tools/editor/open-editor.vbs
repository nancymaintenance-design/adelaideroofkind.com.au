Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
root = fs.GetParentFolderName(WScript.ScriptFullName)
shell.Run """C:\Program Files\nodejs\node.exe"" """ & root & "\launch-local.cjs""", 0, False
