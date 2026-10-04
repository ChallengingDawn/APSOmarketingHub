// Settings is an application, so it gets an application's chrome: one title and
// one row of sections, wrapping everything underneath it.
import SettingsChrome from "./SettingsChrome";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsChrome>{children}</SettingsChrome>;
}
