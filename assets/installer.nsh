; Mnemosyne — NSIS custom installer script
; B37 Phase 6 — additional installer behaviors
; MV-VERSION-DISPLAY BP044 — version-class display in installer welcome
; KniPr005 v0.1.9 — Non-destructive disclosure (A2 canon) added to installer welcome
; K-D6-6-9 BP105 — D3 keypair persistence across NSIS upgrade (3-layer defense)
; K-D6-6-11 BP105 — Non-admin install heartbeat fix (scheduled task + process kill)

; Non-destructive disclosure shown on installer welcome screen
!define MUI_WELCOMEPAGE_TEXT "Mnemosyne(TM) is a READ-ONLY companion.$\r$\n$\r$\nWhat Mnemosyne does to your computer:$\r$\n$\r$\n- Reads ONLY folders you explicitly mark as Substrated$\r$\n- Creates sha256-verified Eblet records inside its own data folder$\r$\n- Your original files are NEVER moved, modified, or uploaded$\r$\n- No account required. No telemetry. No phone-home.$\r$\n$\r$\nVerify via Developer Tab > Caithedral(TM) Inspector:$\r$\nevery Eblet shows its source path and matching sha256 hash.$\r$\n$\r$\nInstaller sha256: See SHA-256 at: https://github.com/Upekrithen/LianaBanyanPlatform/releases/tag/v0.1.9$\r$\n$\r$\nClick Next to continue."

; K20 Module 3 + K-D6-6-9 + K-D6-6-11: Install behaviors
!macro customInstall
  DetailPrint "Installing MnemosyneC ${VERSION} — LB Alpha-phase · craft authority"

  ; K-D6-6-11: Kill BOTH old and new process names before installing
  nsExec::Exec 'taskkill /F /IM "MnemosyneC.exe" /T'
  nsExec::Exec 'taskkill /F /IM "Mnemosyne.exe" /T'
  nsExec::Exec 'taskkill /F /IM "AMPLIFY Computer.exe" /T'

  ; D3 persistence — Layer 1a: restore keypair from ProgramData backup if AppData was wiped
  ; This fires when NSIS upgrade or user-initiated uninstall deleted %APPDATA%\MnemosyneC\keys\
  ${IfNot} ${FileExists} "$APPDATA\MnemosyneC\keys\peer.ed25519.priv"
    ${If} ${FileExists} "$PROGRAMDATA\MnemosyneC\keys\peer.ed25519.priv"
      DetailPrint "D3 persistence: restoring keypair from ProgramData backup"
      CreateDirectory "$APPDATA\MnemosyneC\keys"
      CopyFiles /SILENT "$PROGRAMDATA\MnemosyneC\keys\peer.ed25519.priv" "$APPDATA\MnemosyneC\keys\peer.ed25519.priv"
      CopyFiles /SILENT "$PROGRAMDATA\MnemosyneC\keys\peer.ed25519.pub" "$APPDATA\MnemosyneC\keys\peer.ed25519.pub"
      DetailPrint "D3 persistence: keypair restored — peer identity preserved across upgrade"
    ${Else}
      DetailPrint "D3 persistence: no backup found in ProgramData — fresh identity will be generated on first launch"
    ${EndIf}
  ${Else}
    DetailPrint "D3 persistence: existing keypair found in AppData — identity will survive this upgrade"
  ${EndIf}

  ; Copy A2 disclosure README to install dir
  SetOutPath "$INSTDIR"
  File /nonfatal "${BUILD_RESOURCES_DIR}\..\assets\post_install_message.txt"
  IfFileExists "$INSTDIR\post_install_message.txt" 0 +2
    Rename "$INSTDIR\post_install_message.txt" "$INSTDIR\README_INSTALL.txt"

  ; K-D6-6-11: Register scheduled task for autostart — handles both admin and non-admin accounts
  ; /RU "" runs as the current user (resolves UAC issues for non-admin accounts)
  ; /RL LIMITED used instead of HIGHEST to allow non-admin users to run the task
  nsExec::ExecToStack 'powershell.exe -NonInteractive -Command "schtasks /Create /F /TN MnemosyneCAutoStart /TR ''\"$INSTDIR\MnemosyneC.exe\" --hidden'' /SC ONLOGON /RL LIMITED 2>&1; exit $LASTEXITCODE"'
  Pop $0  ; exit code
  Pop $1  ; output
  ${If} $0 == 0
    DetailPrint "MnemosyneC autostart task registered (LIMITED privilege — non-admin safe)"
  ${Else}
    ; Fallback: try with HIGHEST for admin accounts
    nsExec::Exec 'powershell.exe -NonInteractive -Command "schtasks /Create /F /TN MnemosyneCAutoStart /TR ''\"$INSTDIR\MnemosyneC.exe\" --hidden'' /SC ONLOGON /RL HIGHEST"'
    DetailPrint "MnemosyneC autostart task registered (HIGHEST privilege)"
  ${EndIf}

  DetailPrint "MnemosyneC ${VERSION} install ready — SSPL · Pledge #2260 · No Ads · No Strings"
!macroend

; D3 persistence — never delete user identity or config
; On uninstall: back up keypair to ProgramData BEFORE AppData deletion (cooperative sovereignty right)
!macro customUnInstall
  DetailPrint "MnemosyneC ${VERSION} uninstall: preserving user identity (D3 cooperative sovereignty right)"

  ; D3 persistence — Layer 1b: back up keypair to ProgramData before it might be wiped
  ; customUnInstall runs before AppData deletion (isDeleteAppData guard), so files still exist here
  ${If} ${FileExists} "$APPDATA\MnemosyneC\keys\peer.ed25519.priv"
    CreateDirectory "$PROGRAMDATA\MnemosyneC\keys"
    CopyFiles /SILENT "$APPDATA\MnemosyneC\keys\peer.ed25519.priv" "$PROGRAMDATA\MnemosyneC\keys\peer.ed25519.priv"
    CopyFiles /SILENT "$APPDATA\MnemosyneC\keys\peer.ed25519.pub" "$PROGRAMDATA\MnemosyneC\keys\peer.ed25519.pub"
    DetailPrint "D3 persistence: keypair backed up to ProgramData (survives AppData wipe)"
  ${EndIf}

  ; Intentionally leave %APPDATA%\MnemosyneC substrate cache + telemetry
  DetailPrint "Substrate data preserved at $APPDATA\MnemosyneC (cooperative sovereignty right)"

  ; Remove autostart scheduled task on full uninstall
  nsExec::Exec 'schtasks /Delete /F /TN MnemosyneCAutoStart'
!macroend
