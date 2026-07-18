export const metadata = {
  title: "Privacy · Tesla Service Insights",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 prose-invert">
      <h1 className="text-3xl font-bold text-white">Privacy & data handling</h1>
      <div className="mt-6 space-y-5 text-zinc-300 leading-relaxed">
        <p>
          This project exists to share <strong>technical service knowledge</strong>,
          not personal information. Design goal:{" "}
          <strong>original invoices are never stored</strong>.
        </p>
        <h2 className="text-xl font-semibold text-white">What we process</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Your PDF upload(s) are held in server memory long enough to merge
            (if multiple), extract text, and analyze with Grok, then discarded.
          </li>
          <li>
            Automated redaction removes emails, phones, VINs, street addresses,
            ZIPs, plate numbers, invoice/RO IDs, and long numeric identifiers.
          </li>
          <li>
            Grok is instructed to rewrite notes without names, account numbers,
            or exact locations.
          </li>
        </ul>
        <h2 className="text-xl font-semibold text-white">What we store</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Vehicle model and model year (not full VIN)</li>
          <li>Mileage as a range bucket (e.g. 25–50k)</li>
          <li>Symptoms, diagnosis, resolution, parts, labor notes</li>
          <li>Optional broad region only (e.g. US-West)</li>
          <li>Category tags and confidence score</li>
        </ul>
        <h2 className="text-xl font-semibold text-white">What we do not store</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Original PDF files</li>
          <li>Customer name, phone, email, address</li>
          <li>Full VIN or license plate</li>
          <li>Payment / credit card data</li>
          <li>Exact service center street address</li>
        </ul>
        <h2 className="text-xl font-semibold text-white">AI provider</h2>
        <p>
          Extraction uses the SpaceXAI / xAI API (Grok) with your server-side{" "}
          <code className="rounded bg-white/10 px-1 text-sm">XAI_API_KEY</code>.
          Content you upload is sent to the API for analysis. Do not upload
          documents you are not comfortable processing with that provider.
        </p>
        <h2 className="text-xl font-semibold text-white">Disclaimer</h2>
        <p>
          Not affiliated with Tesla, Inc. Community-shared notes may be
          incomplete or incorrect. Always follow official service procedures and
          applicable law when handling customer data.
        </p>
      </div>
    </div>
  );
}
