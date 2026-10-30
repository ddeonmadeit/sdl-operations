import QRCode from "qrcode";
import { ActionButton, CopyButton } from "@/components/client";
import { SiteHeader } from "@/components/site/site-ui";
import { newInductionLink } from "@/lib/actions/jobs";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { getJob } from "@/lib/queries";

export const metadata = { title: "Induction QR" };

export default async function InductionQr({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const link = `${appUrl()}/induct/${job.inductionToken}`;
  const svg = await QRCode.toString(link, { type: "svg", margin: 1, width: 320, color: { dark: "#18211c", light: "#ffffff" } });
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}/induction`} title="Scan to sign in" sub={job.siteAddress ?? job.name} />
      <div className="card mx-auto max-w-sm p-6 text-center">
        <div className="mx-auto w-full max-w-[280px] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-4 text-sm text-muted">Workers scan with their phone camera, fill in their details and sign. It lands on this job&apos;s induction register.</p>
        <div className="mt-4 flex flex-col gap-2">
          <CopyButton text={link} label="Copy link to text it" />
          <ActionButton action={newInductionLink.bind(null, job.id)} confirm="Make a new link? The old QR code will stop working." className="btn-ghost btn-sm">
            Reset link
          </ActionButton>
        </div>
      </div>
    </>
  );
}
