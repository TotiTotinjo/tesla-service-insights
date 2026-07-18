import { UploadForm } from "@/components/UploadForm";

export const metadata = {
  title: "Upload invoice · Tesla Service Insights",
};

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-white">Upload service invoice</h1>
      <p className="mt-2 text-zinc-400">
        PDF only. Multi-visit invoices are split into separate issues. You review
        and confirm before anything is published — originals never stored.
      </p>
      <div className="mt-8">
        <UploadForm />
      </div>
    </div>
  );
}
