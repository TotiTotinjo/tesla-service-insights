export const metadata = {
  title: "Privacy · RO Insights",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 prose-invert">
      <h1 className="text-3xl font-bold text-white">Privacy & data handling</h1>
      <div className="mt-6 space-y-5 text-zinc-300 leading-relaxed">
        <p>
          This project exists to share{" "}
          <strong>technical service knowledge</strong>, not personal
          information. Design goal:{" "}
          <strong>original invoices are never stored</strong>.
        </p>

        <h2 className="text-xl font-semibold text-white">What we process</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Your PDF upload(s) are held in server memory long enough to merge
            (if multiple), extract text, redact PII, and analyze — then
            discarded.
          </li>
          <li>
            Automated redaction removes emails, phones, VINs, street addresses,
            ZIPs, plate numbers, invoice/RO IDs, and long numeric identifiers.
          </li>
          <li>
            You review draft issues <strong>before publish</strong> — only what
            you confirm goes to the public board.
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-white">What we store</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Vehicle model and model year (not full VIN)</li>
          <li>Mileage as a range bucket (e.g. 25–50k)</li>
          <li>Symptoms, diagnosis, resolution, parts, labor notes</li>
          <li>Optional broad region only (e.g. US-West)</li>
          <li>Category tags, fix status, and confidence score</li>
          <li>Anonymous hashes used only for duplicate detection</li>
        </ul>

        <h2 className="text-xl font-semibold text-white">
          What we do not store
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Original PDF files</li>
          <li>Customer name, phone, email, address</li>
          <li>Full VIN or license plate</li>
          <li>Payment / credit card data</li>
          <li>Exact service center street address</li>
        </ul>

        <h2 className="text-xl font-semibold text-white">AI provider</h2>
        <p>
          Extraction uses the xAI API (Grok) with a server-side API key.{" "}
          <strong>Redacted technical text</strong> is sent to xAI for analysis.
          Do not upload documents you are not comfortable processing with that
          provider.
        </p>

        <h2 className="text-xl font-semibold text-white">Early beta limits</h2>
        <p>
          To control cost and abuse: limited analyses per IP per day and a low
          global daily cap. Re-uploading the same PDF does not call Grok again.
        </p>

        <h2 className="text-xl font-semibold text-white">Disclaimer</h2>
        <p>
          Not affiliated with Tesla, Inc. Community-shared notes may be
          incomplete or incorrect. Always follow official service procedures and
          applicable law when handling customer data. Only upload invoices you
          have the right to share.
        </p>
      </div>
    </div>
  );
}
