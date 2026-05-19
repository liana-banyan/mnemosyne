; Mnemosyne — NSIS custom installer script
; B37 Phase 6 — additional installer behaviors
; MV-VERSION-DISPLAY BP044 — version-class display in installer

; Kill any running Mnemosyne process before installing
!macro customInstall
  DetailPrint "Installing Mnemosyne ${VERSION} — LB Alpha-phase · craft authority"
  nsExec::Exec 'taskkill /F /IM "Mnemosyne.exe" /T'
  ; Legacy process name cleanup (pre-v0.1.2 installs)
  nsExec::Exec 'taskkill /F /IM "AMPLIFY Computer.exe" /T'
  DetailPrint "Mnemosyne ${VERSION} install ready — AGPL Free Forever · No Ads · No Strings"
!macroend

; On uninstall, leave user data intact (substrate cache, telemetry)
; Data lives in %APPDATA%\Mnemosyne — not removed (cooperative sovereignty right)
!macro customUnInstall
  DetailPrint "Mnemosyne ${VERSION} uninstall: user data preserved (cooperative sovereignty right)"
  ; Intentionally leave %APPDATA%\Mnemosyne substrate cache + telemetry
  DetailPrint "Substrate data preserved at $APPDATA\Mnemosyne"
!macroend
