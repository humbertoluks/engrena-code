export {
  spacing,
  radii,
  fontFamily,
  colorTokenNames,
  designTokens,
} from './tokens/design-tokens'
export type { ColorTokenName } from './tokens/design-tokens'

export {
  configureThemeStorageKey,
  getThemeStorageKey,
  resolveTheme,
  nextThemePreference,
  applyThemeBoot,
  initThemeStore,
  useTheme,
  getResolvedTheme,
} from './hooks/useTheme'
export type { ThemePreference, ResolvedTheme } from './hooks/useTheme'

export { shikiThemeFromResolved } from './theme/shiki-theme'
export type { ShikiThemeName } from './theme/shiki-theme'

export { xtermThemeFromCssVars } from './theme/xterm-theme'
export type { XtermThemeMap } from './theme/xterm-theme'

export { ButtonPrimary } from './components/ButtonPrimary'
export { ButtonSecondary } from './components/ButtonSecondary'
export { Card, CardHeader } from './components/Card'
export { Badge } from './components/Badge'
export type { BadgeTone } from './components/Badge'
export { SegmentedControl } from './components/SegmentedControl'
export type { SegmentOption } from './components/SegmentedControl'
export { Skeleton } from './components/Skeleton'
export { InlineFeedback } from './components/InlineFeedback'
export type { FeedbackVariant } from './components/InlineFeedback'
export { StatusDot } from './components/StatusDot'
export type { DotVariant } from './components/StatusDot'
export { MetricCard } from './components/MetricCard'
export { ThemeControl } from './components/ThemeControl'
export { Field } from './components/Field'
export { Input, inputBaseClassName } from './components/Input'
export type { InputProps } from './components/Input'
export { Modal } from './components/Modal'
export type { ModalProps } from './components/Modal'

export { LoginScreen } from './screens/LoginScreen'
export {
  CODE_BRAND,
  CODE_UNLOCK_ORIGIN,
  LOGIN_COPY_SHARED,
  LOGIN_PRODUCT_CONFIG,
  PLAN_BRAND,
  PLAN_UNLOCK_ORIGIN,
  classifyUnlockFailure,
  clearUnlockedWorkspace,
  messageForError,
  persistUnlockedWorkspace,
  readUnlockedWorkspace,
} from './screens/loginScreen.logic'
export type {
  LoginProduct,
  LoginProductConfig,
  UnlockErrorKind,
  VaultUnlockResponse,
} from './screens/loginScreen.logic'
