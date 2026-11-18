; MusicFree 在线安装器（stub）
; 本体仅 ~3MB：安装时从 GitHub Release 下载 payload.7z（完整程序，约 88MB）并解压到安装目录。
; 编译：ISCC build-online-installer.iss（需 Inno Setup 6.1+）
; 发版流程：更新 payload → 上传到新 tag 的 Release → 修改下方 PayloadTag/PayloadName/MyAppVersion → 重新编译。

#define MyAppName "MusicFree"
#define MyAppVersion "0.0.8"
#define MyAppPublisher "acientemple"
#define MyAppURL "https://github.com/acientemple/ElegantMusicFreeDesktop"
#define MyAppExeName "MusicFree.exe"
#ifndef PayloadTag
  #define PayloadTag "v0.0.8-custom.1"
#endif
#ifndef PayloadName
  #define PayloadName "MusicFree-payload.7z"
#endif

[Setup]
; 此 AppId 为本定制版安装器专属，发布后不得更改（升级识别依赖它）
AppId={{D1286FEF-7F3B-40BA-8881-36005EE2895E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\..\out\installer
OutputBaseFilename=MusicFreeSetup-Online-{#MyAppVersion}
SetupIconFile=..\..\res\logo.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
; Inno 6.7 官方安装包不含简中翻译，从 issrc 仓库取 unofficial 版放本地
Name: "chinesesimplified"; MessagesFile: "languages\ChineseSimplified.isl"

[CustomMessages]
english.DownloadTitle=Downloading MusicFree program files...
english.DownloadDesc=Downloading the program package (about 67 MB) from GitHub. Please keep your network connected.
english.DownloadFailed=Download failed:%n%n%1%n%nPlease check your network connection and try again. If you are in mainland China, a proxy may be required to reach GitHub.
english.DownloadAborted=Download cancelled. Installation aborted.
english.ExtractFailed=Extraction failed (error code %1). The downloaded package may be corrupted. Please try again.
english.VerifyFailed=Installation verification failed: MusicFree.exe not found after extraction.
chinesesimplified.DownloadTitle=正在下载 MusicFree 程序文件……
chinesesimplified.DownloadDesc=正在从 GitHub 下载程序包（约 67MB），请保持网络通畅。
chinesesimplified.DownloadFailed=下载失败：%n%n%1%n%n请检查网络连接后重试。大陆网络可能需要代理才能访问 GitHub。
chinesesimplified.DownloadAborted=已取消下载，安装中止。
chinesesimplified.ExtractFailed=解压失败（错误码 %1），下载的程序包可能已损坏，请重试。
chinesesimplified.VerifyFailed=安装校验失败：解压后未找到 MusicFree.exe。
english.LaunchApp=&Launch MusicFree
chinesesimplified.LaunchApp=启动 MusicFree(&L)

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; 仅携带解压工具（7zr.exe 独立版，7-Zip 家族，LGPL，许可证见 release/installer/7z/License.txt），不带任何应用文件
Source: "7z\7zr.exe"; DestDir: "{tmp}"; Flags: dontcopy

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchApp}"; Flags: nowait postinstall skipifsilent

[Code]
const
  PayloadURL = 'https://github.com/acientemple/ElegantMusicFreeDesktop/releases/download/{#PayloadTag}/{#PayloadName}';

var
  DownloadPage: TDownloadWizardPage;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage(SetupMessage(msgWizardPreparing),
    SetupMessage(msgPreparingDesc), nil);
  DownloadPage.ShowBaseNameInsteadOfUrl := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  NeedsRestart := False;

  { 释放解压工具 }
  ExtractTemporaryFile('7zr.exe');

  { 下载 payload（第三参数为 SHA256，下载后自动校验） }
  DownloadPage.Clear;
  DownloadPage.SetText(CustomMessage('DownloadTitle'), CustomMessage('DownloadDesc'));
  DownloadPage.Add(PayloadURL, 'payload.7z',
    '56221591be4ed2f7f9517293f8ad191b8bd91d49ba24ba60f25646b6b4f545f3');
  DownloadPage.Show;
  try
    try
      DownloadPage.Download;
    except
      if DownloadPage.AbortedByUser then
        Result := CustomMessage('DownloadAborted')
      else
        Result := FmtMessage(CustomMessage('DownloadFailed'), [GetExceptionMessage]);
      Exit;
    end;
  finally
    DownloadPage.Hide;
  end;

  { 解压到安装目录（7z 解压自带 CRC 校验，包损坏会返回非 0） }
  if not Exec(ExpandConstant('{tmp}\7zr.exe'),
      ExpandConstant('x -y -bso0 -bsp0 -bse0 -o"{app}" "{tmp}\payload.7z"'),
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := FmtMessage(CustomMessage('ExtractFailed'), ['-1']);
    Exit;
  end;
  if ResultCode <> 0 then
  begin
    Result := FmtMessage(CustomMessage('ExtractFailed'), [IntToStr(ResultCode)]);
    Exit;
  end;

  { 校验 }
  if not FileExists(ExpandConstant('{app}\{#MyAppExeName}')) then
  begin
    Result := CustomMessage('VerifyFailed');
    Exit;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  { payload 文件由 7zr 解压而来，不在 Inno 的卸载清单里；卸载时整目录删除。
    安全护栏：仅当目录内确有 MusicFree.exe 时才删，避免误删用户误选的目录。
    用户数据在 %APPDATA%\MusicFree，不受影响。 }
  if CurUninstallStep = usPostUninstall then
    if FileExists(ExpandConstant('{app}\{#MyAppExeName}')) then
      DelTree(ExpandConstant('{app}'), True, True, True);
end;
