import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SplitPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Splitter</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Stem separation, per-stem waveforms, mute/solo/volume, and mixdown download land here in Phase 8.
      </CardContent>
    </Card>
  );
}
