// Planner Desk: plannerdesk-open:<path> -> open in Windows Explorer.
// Folder: opens the folder. File: opens its folder with the file selected (never runs the file).
var arg = WScript.Arguments.length ? WScript.Arguments(0) : "";
var p = arg.replace(/^plannerdesk-open:(\/\/)?/i, "");
try { p = decodeURIComponent(p); } catch (e) { WScript.Quit(1); }
p = p.replace(/"/g, "").replace(/\//g, "\\").replace(/^\s+|\s+$/g, "");
// only local drive (C:\...) or network (\\server\...) paths
if (!/^([a-z]:\\|\\\\[^\\])/i.test(p)) WScript.Quit(1);
var fso = new ActiveXObject("Scripting.FileSystemObject");
var sh = new ActiveXObject("WScript.Shell");
if (fso.FolderExists(p)) sh.Run('explorer.exe "' + p + '"', 1, false);
else if (fso.FileExists(p)) sh.Run('explorer.exe /select,"' + p + '"', 1, false);
else {
  // missing: open the nearest folder that still exists
  var d = p;
  while (d && !fso.FolderExists(d)) { var i = d.replace(/\\+$/, "").lastIndexOf("\\"); d = i > 2 ? d.slice(0, i) : ""; }
  if (d) sh.Run('explorer.exe "' + d + '"', 1, false);
}
