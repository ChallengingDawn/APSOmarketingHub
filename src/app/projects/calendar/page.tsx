import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import ContentCalendar from "../ContentCalendar";

export const dynamic = "force-dynamic";

/** What goes out when, and what has no date at all. */
export default function ContentCalendarPage() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Content calendar"
        subtitle="What goes out when - and everything still waiting for a date"
      />
      <ContentCalendar />
    </Box>
  );
}
