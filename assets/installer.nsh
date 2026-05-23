; Mnemosyne — NSIS custom installer script
; B37 Phase 6 — additional installer behaviors
; MV-VERSION-DISPLAY BP044 — version-class display in installer
; KniPr005 v0.1.9 — Non-destructive disclosure (A2 canon) added to installer welcome

; Non-destructive disclosure shown on installer welcome screen
!define MUI_WELCOMEPAGE_TEXT "Mnemosyne(TM) is a READ-ONLY companion.$\r$\n$\r$\nWhat Mnemosyne does to your computer:$\r$\n$\r$\n- Reads ONLY folders you explicitly mark as Substrated$\r$\n- Creates sha256-verified Eblet records inside its own data folder$\r$\n- Your original files are NEVER moved, modified, or uploaded$\r$\n- No account required. No telemetry. No phone-home.$\r$\n$\r$\nVerify via Developer Tab > Caithedral(TM) Inspector:$\r$\nevery Eblet shows its source path and matching sha256 hash.$\r$\n$\r$\nInstaller sha256: See SHA-256 at: https://github.com/Upekrithen/LianaBanyanPlatform/releases/tag/v0.1.9$\r$\n$\r$\nClick Next to continue."

; Kill any running Mnemosyne process before installing
!macro customInstall
  DetailPrint "Installing Mnemosyne ${VERSION} — LB Alpha-phase · craft authority"
  nsExec::Exec 'taskkill /F /IM "Mnemosyne.exe" /T'
  ; Legacy process name cleanup (pre-v0.1.2 installs)
  nsExec::Exec 'taskkill /F /IM "AMPLIFY Computer.exe" /T'
  ; Copy A2 disclosure README to install dir
  SetOutPath "$INSTDIR"
  File /nonfatal "${BUILD_RESOURCES_DIR}\..\assets\post_install_message.txt"
  IfFileExists "$INSTDIR\post_install_message.txt" 0 +2
    Rename "$INSTDIR\post_install_message.txt" "$INSTDIR\README_INSTALL.txt"
  DetailPrint "Mnemosyne ${VERSION} install ready — AGPL Free Forever · No Ads · No Strings"
!macroend

; On uninstall, leave user data intact (substrate cache, telemetry)
; Data lives in %APPDATA%\Mnemosyne — not removed (cooperative sovereignty right)
!macro customUnInstall
  DetailPrint "Mnemosyne ${VERSION} uninstall: user data preserved (cooperative sovereignty right)"
  ; Intentionally leave %APPDATA%\Mnemosyne substrate cache + telemetry
  DetailPrint "Substrate data preserved at $APPDATA\Mnemosyne"
!macroend
