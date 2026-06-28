export const dynamic = "force-dynamic";

import { FollowUpsTable } from "@/components/follow-ups/follow-ups-table";

export default function FollowUpsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vazifalar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Bugungi va kelgusi vazifalar markazi
        </p>
      </div>
      <FollowUpsTable />
    </div>
  );
}
