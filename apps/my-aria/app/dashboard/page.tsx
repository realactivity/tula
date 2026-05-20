import { getDashboardData } from "@/lib/data/loader";
import { DashboardSection } from "@/components/dashboard/section";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { UpcomingCard } from "@/components/dashboard/upcoming-card";
import { RecentResultsCard } from "@/components/dashboard/recent-results-card";
import { MedicationsCard } from "@/components/dashboard/medications-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import {
  LongitudinalFeedsSection,
  DeIdentificationSection,
} from "@/components/dashboard/capability-section";
import { DisclaimerFull } from "@/components/shell/disclaimer";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-5">
      <DashboardSection index={0}>
        <WelcomeCard
          greeting={data.greeting}
          firstName={data.patientFirstName}
          refreshedAt={data.refreshedAt}
        />
      </DashboardSection>

      <DashboardSection index={1} title="Upcoming">
        <UpcomingCard appointment={data.upcomingAppointment} />
      </DashboardSection>

      <DashboardSection index={2} title="Recent results">
        <RecentResultsCard trends={data.recentLabs} />
      </DashboardSection>

      <DashboardSection index={3} title="Medications">
        <MedicationsCard medications={data.activeMedications} />
      </DashboardSection>

      <DashboardSection index={4} title="Quick actions">
        <QuickActions actions={data.quickActions} />
      </DashboardSection>

      <DashboardSection index={5} title="Longitudinal feeds">
        <LongitudinalFeedsSection feeds={data.longitudinalFeeds} />
      </DashboardSection>

      <DashboardSection index={6} title="De-identification">
        <DeIdentificationSection capability={data.deIdentification} />
      </DashboardSection>

      <DisclaimerFull />
    </div>
  );
}
