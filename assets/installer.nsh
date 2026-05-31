; MnemosyneC — NSIS custom installer script
; B37 Phase 6 — additional installer behaviors
; BP067 v0.1.24 — transparent install copy (Truth-Always: Ollama attribution)

!define MUI_WELCOMEPAGE_TEXT "MnemosyneC(TM) — your private AI on your computer.$\r$\n$\r$\nDuring first launch, MnemosyneC will set up Ollama — a free, open-source AI engine (MIT license, created by a Y-Combinator startup). Your questions and files never leave your machine. Free, forever.$\r$\n$\r$\nMnemosyneC is READ-ONLY toward your files:$\r$\n- Reads ONLY folders you explicitly choose$\r$\n- Creates verified records in its own data folder$\r$\n- Your originals are NEVER moved, modified, or uploaded$\r$\n$\r$\nClick Next to install."

; Kill any running Mnemosyne process before installing
!macro customInstall
  DetailPrint "Installing MnemosyneC ${VERSION} — private AI · family-install release"
  nsExec::Exec 'taskkill /F /IM "MnemosyneC.exe" /T'
  nsExec::Exec 'taskkill /F /IM "Mnemosyne.exe" /T'
  ; Legacy process name cleanup (pre-v0.1.2 installs)
  nsExec::Exec 'taskkill /F /IM "AMPLIFY Computer.exe" /T'
  ; Copy A2 disclosure README to install dir
  SetOutPath "$INSTDIR"
  File /nonfatal "${BUILD_RESOURCES_DIR}\..\assets\post_install_message.txt"
  IfFileExists "$INSTDIR\post_install_message.txt" 0 +2
    Rename "$INSTDIR\post_install_message.txt" "$INSTDIR\README_INSTALL.txt"
  DetailPrint "Mnemosyne ${VERSION} install ready — SSPL · Pledge #2260 · No Ads · No Strings"
!macroend

; On uninstall, leave user data intact (substrate cache, telemetry)
; Data lives in %APPDATA%\Mnemosyne — not removed (cooperative sovereignty right)
!macro customUnInstall
  DetailPrint "Mnemosyne ${VERSION} uninstall: user data preserved (cooperative sovereignty right)"
  ; Intentionally leave %APPDATA%\Mnemosyne substrate cache + telemetry
  DetailPrint "Substrate data preserved at $APPDATA\Mnemosyne"
!macroend
