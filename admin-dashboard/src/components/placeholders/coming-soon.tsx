import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = { title: string };

export function ComingSoon({ title }: Props) {
  return (
    <Card className="max-w-lg border-[#e5e7eb] bg-white">
      <CardHeader>
        <CardTitle className="text-[#111827]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-[#6b7280]">
        This section is a placeholder for the demo. Hook it to Supabase when you
        are ready.
      </CardContent>
    </Card>
  );
}
