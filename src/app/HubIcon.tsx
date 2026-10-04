"use client";
// One glyph set for the front page, so a shortcut looks the same in its card,
// in the search results and in the expansion.

import GroupsIcon from "@mui/icons-material/Groups";
import DescriptionIcon from "@mui/icons-material/Description";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import BarChartIcon from "@mui/icons-material/BarChart";
import LayersIcon from "@mui/icons-material/Layers";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import RouteIcon from "@mui/icons-material/Route";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import PsychologyIcon from "@mui/icons-material/Psychology";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import PublicIcon from "@mui/icons-material/Public";
import BoltIcon from "@mui/icons-material/Bolt";
import CookieIcon from "@mui/icons-material/Cookie";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";

import type { IconKey } from "./hubApps";

const MAP: Record<IconKey, React.ElementType> = {
  groups: GroupsIcon,
  description: DescriptionIcon,
  inventory: Inventory2Icon,
  bar: BarChartIcon,
  layers: LayersIcon,
  edit: EditNoteIcon,
  photo: PhotoLibraryIcon,
  search: SearchIcon,
  filter: FilterAltIcon,
  tag: LocalOfferIcon,
  sync: SyncAltIcon,
  route: RouteIcon,
  health: MonitorHeartIcon,
  ads: AdsClickIcon,
  target: TrackChangesIcon,
  brain: PsychologyIcon,
  template: DashboardCustomizeIcon,
  globe: PublicIcon,
  bolt: BoltIcon,
  cookie: CookieIcon,
  verified: VerifiedOutlinedIcon,
};

export default function HubIcon({ name, fontSize = 18 }: { name: IconKey; fontSize?: number }) {
  const C = MAP[name] ?? LayersIcon;
  return <C sx={{ fontSize }} />;
}
