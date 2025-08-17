; Custom NSIS installer script for TaskerADHD
; Adds checkbox for desktop shortcut option

!include "MUI2.nsh"

; Add custom page for desktop shortcut option
!define MUI_PAGE_CUSTOMFUNCTION_SHOW DesktopShortcutPageShow
!insertmacro MUI_PAGE_COMPONENTS

Var CreateDesktopShortcut

; Custom function to show desktop shortcut option
Function DesktopShortcutPageShow
  ; Add checkbox for desktop shortcut
  ${NSD_CreateCheckbox} 120u 10u 100u 10u "Create &desktop shortcut"
  Pop $CreateDesktopShortcut
  ${NSD_SetState} $CreateDesktopShortcut ${BST_CHECKED}
FunctionEnd

; Override the default desktop shortcut creation
!macro customInstall
  ${NSD_GetState} $CreateDesktopShortcut $0
  ${If} $0 == ${BST_CHECKED}
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}" "" "$INSTDIR\${PRODUCT_FILENAME}" 0
  ${EndIf}
!macroend
