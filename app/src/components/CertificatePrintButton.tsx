"use client";

export function CertificatePrintButton() {
  return (
    <button onClick={() => window.print()} className="btn no-print">
      Vytlačiť / uložiť ako PDF
    </button>
  );
}
